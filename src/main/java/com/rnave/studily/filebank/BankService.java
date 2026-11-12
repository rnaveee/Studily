package com.rnave.studily.filebank;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankDtos.BankStatusDto;
import com.rnave.studily.rag.Scope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class BankService {

    private static final Logger log = LoggerFactory.getLogger(BankService.class);
    private static final long MINUTE_MS = 60_000L;
    private static final int MAX_NAME_CHARS = 255;
    private static final int UPLOADS_PER_MINUTE = 20;
    private static final long MEGABYTE = 1024L * 1024;

    private static final List<String> PRACTICE_PREFIXES = List.of("midterm", "final", "exam", "practice", "quiz");
    private static final Set<String> PRACTICE_WORDS = Set.of("sample", "samples");
    private static final List<String> ASSIGNMENT_PREFIXES =
            List.of("assignment", "homework", "tutorial", "laborator", "problemset");
    private static final Set<String> ASSIGNMENT_WORDS = Set.of("hw", "hws", "pset", "psets", "lab", "labs");
    private static final List<String> LECTURE_PREFIXES = List.of("lecture", "slide", "week", "chap");
    private static final Set<String> LECTURE_WORDS = Set.of("ch", "unit", "units");
    private static final List<String> NOTES_PREFIXES = List.of("note");

    private final SlidingWindowRateLimiter uploadLimiter = new SlidingWindowRateLimiter(UPLOADS_PER_MINUTE, MINUTE_MS);
    private final BankFileRepository files;
    private final CourseRepository courses;
    private final CurrentUser currentUser;
    private final FileStorage storage;
    private final UploadInspector inspector;
    private final PagePreviewRenderer previews;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final long maxFileBytes;
    private final int maxFilesPerRequest;
    private final int maxFilesPerUser;
    private final long quotaBytes;

    public BankService(BankFileRepository files, CourseRepository courses, CurrentUser currentUser,
                       FileStorage storage, UploadInspector inspector, PagePreviewRenderer previews,
                       JdbcTemplate jdbc, PlatformTransactionManager transactionManager,
                       @Value("${app.bank.max-file-bytes}") long maxFileBytes,
                       @Value("${app.bank.max-files-per-request}") int maxFilesPerRequest,
                       @Value("${app.bank.max-files-per-user}") int maxFilesPerUser,
                       @Value("${app.bank.quota-bytes}") long quotaBytes) {
        this.files = files;
        this.courses = courses;
        this.currentUser = currentUser;
        this.storage = storage;
        this.inspector = inspector;
        this.previews = previews;
        this.jdbc = jdbc;
        this.transactions = new TransactionTemplate(transactionManager);
        this.maxFileBytes = maxFileBytes;
        this.maxFilesPerRequest = maxFilesPerRequest;
        this.maxFilesPerUser = maxFilesPerUser;
        this.quotaBytes = quotaBytes;
    }

    @Transactional(readOnly = true)
    public BankStatusDto status() {
        Long userId = currentUser.id();
        return new BankStatusDto(enabled(), files.totalBytes(userId), quotaBytes, files.countByUserId(userId),
                maxFilesPerUser, maxFileBytes, maxFilesPerRequest);
    }

    public boolean enabled() {
        return storage.configured();
    }

    @Transactional(readOnly = true)
    public List<BankFileDto> courseFiles(Long courseId) {
        requireOwnedCourse(courseId);
        return files.findByCourseIdAndUserIdOrderByCreatedAtDesc(courseId, currentUser.id())
                .stream().map(BankFileDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<BankFileDto> chatFiles(Long chatId) {
        return files.findByChatIdAndUserIdOrderByCreatedAtDesc(chatId, currentUser.id())
                .stream().map(BankFileDto::from).toList();
    }

    public List<BankFile> upload(Scope scope, List<MultipartFile> uploads, BankFileKind kindOrNull) {
        requireStorage();
        Long userId = currentUser.id();
        if (scope.userId() != userId) {
            throw new NotFoundException("Not found");
        }
        if (!uploadLimiter.tryConsume("user:" + userId)) {
            throw new TooManyRequestsException("You're uploading very quickly. Wait a minute and try again.");
        }
        if (scope.isCourse()) {
            requireOwnedCourse(scope.courseId());
        }
        if (uploads == null || uploads.isEmpty()) {
            throw new BadRequestException("Choose a file to upload.");
        }
        if (uploads.size() > maxFilesPerRequest) {
            throw new BadRequestException("Upload up to " + maxFilesPerRequest + " files at a time.");
        }

        List<Prepared> prepared = new ArrayList<>();
        for (MultipartFile upload : uploads) {
            prepared.add(prepare(upload));
        }
        return persist(scope, userId, kindOrNull, prepared, true);
    }

    private List<BankFile> persist(Scope scope, Long userId, BankFileKind kindOrNull, List<Prepared> prepared,
                                   boolean retryOnRace) {
        List<String> stored = new ArrayList<>();
        try {
            return transactions.execute(status -> {
                jdbc.queryForObject("SELECT pg_advisory_xact_lock(?)", Object.class, userId);
                Map<String, BankFile> resolved = new HashMap<>();
                Map<String, Prepared> fresh = new LinkedHashMap<>();
                for (Prepared file : prepared) {
                    if (resolved.containsKey(file.sha256()) || fresh.containsKey(file.sha256())) {
                        continue;
                    }
                    Optional<BankFile> existing = existing(scope, file.sha256());
                    if (existing.isPresent()) {
                        resolved.put(file.sha256(), existing.get());
                    } else {
                        fresh.put(file.sha256(), file);
                    }
                }
                enforceLimits(userId, fresh.values());
                for (Prepared file : fresh.values()) {
                    resolved.put(file.sha256(), store(scope, userId, kindOrNull, file, stored));
                }
                return prepared.stream().map(file -> resolved.get(file.sha256())).toList();
            });
        } catch (DataIntegrityViolationException e) {
            stored.forEach(this::deleteQuietly);
            if (retryOnRace) {
                return persist(scope, userId, kindOrNull, prepared, false);
            }
            throw new ConflictException("That file was just added. Refresh and try again.");
        } catch (RuntimeException e) {
            stored.forEach(this::deleteQuietly);
            throw e;
        }
    }

    @Transactional
    public BankFileDto setKind(Long id, BankFileKind kind) {
        if (kind == null) {
            throw new BadRequestException("Choose a kind for this file.");
        }
        BankFile file = owned(id);
        file.setKind(kind);
        return BankFileDto.from(file);
    }

    @Transactional
    public BankFileDto retry(Long id) {
        BankFile file = owned(id);
        if (file.getStatus() != BankFileStatus.FAILED) {
            throw new BadRequestException("Only files that failed can be retried.");
        }
        file.setStatus(BankFileStatus.QUEUED);
        file.setStatusDetail(null);
        file.setAttempts(0);
        file.setLockedAt(null);
        file.setNextAttemptAt(null);
        return BankFileDto.from(file);
    }

    @Transactional
    public void delete(Long id) {
        files.delete(owned(id));
    }

    @Transactional
    public void moveChatFilesToCourse(long userId, long chatId, long courseId) {
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(?)", Object.class, userId);
        List<BankFile> chatFiles = files.findByChatIdAndUserIdOrderByCreatedAtDesc(chatId, userId);
        if (chatFiles.stream().anyMatch(file -> file.getStatus() == BankFileStatus.QUEUED
                || file.getStatus() == BankFileStatus.PROCESSING)) {
            throw new BadRequestException("StudilyBot is still reading this chat's files. Try again in a moment.");
        }
        for (BankFile file : chatFiles) {
            if (files.findByCourseIdAndSha256(courseId, file.getSha256()).isPresent()) {
                files.delete(file);
                continue;
            }
            file.setChatId(null);
            file.setCourseId(courseId);
            files.save(file);
        }
        files.flush();
        jdbc.update("UPDATE bank_chunks SET course_id = ?, chat_id = NULL WHERE user_id = ? AND chat_id = ?",
                courseId, userId, chatId);
    }

    public byte[] previewPng(Long id, int page) {
        BankFile file = owned(id);
        if (!file.getFormat().previewable()) {
            throw new NotFoundException("This file doesn't have page previews.");
        }
        if (page < 1) {
            throw new NotFoundException("Page not found");
        }
        return previews.render(file.getFormat(), file.getName(), storage.get(file.getStorageKey()), page);
    }

    public byte[] content(BankFile file) {
        return storage.get(file.getStorageKey());
    }

    @Transactional(readOnly = true)
    public List<BankFile> ownedFiles(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        if (ids.stream().anyMatch(Objects::isNull)) {
            throw new NotFoundException("File not found");
        }
        List<Long> distinct = ids.stream().distinct().toList();
        Map<Long, BankFile> byId = files.findByIdInAndUserId(distinct, currentUser.id()).stream()
                .collect(Collectors.toMap(BankFile::getId, Function.identity()));
        if (byId.size() != distinct.size()) {
            throw new NotFoundException("File not found");
        }
        return distinct.stream().map(byId::get).toList();
    }

    static BankFileKind guessKind(String fileName) {
        List<String> words = words(fileName);
        if (matches(words, PRACTICE_PREFIXES, PRACTICE_WORDS)) {
            return BankFileKind.PRACTICE_EXAM;
        }
        if (matches(words, ASSIGNMENT_PREFIXES, ASSIGNMENT_WORDS) || hasProblemSet(words)) {
            return BankFileKind.ASSIGNMENT;
        }
        if (matches(words, LECTURE_PREFIXES, LECTURE_WORDS)) {
            return BankFileKind.LECTURE;
        }
        if (matches(words, NOTES_PREFIXES, Set.of())) {
            return BankFileKind.NOTES;
        }
        return BankFileKind.OTHER;
    }

    @Scheduled(fixedRate = 10 * MINUTE_MS)
    void evictStaleWindows() {
        uploadLimiter.evictStale();
    }

    private Prepared prepare(MultipartFile upload) {
        if (upload == null || upload.isEmpty()) {
            throw new BadRequestException("Choose a file to upload.");
        }
        if (upload.getSize() > maxFileBytes) {
            throw new BadRequestException("Files must be " + megabytes(maxFileBytes) + " MB or smaller.");
        }
        byte[] bytes;
        try {
            bytes = upload.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("That file could not be read.");
        }
        BankFormat format = inspector.inspect(upload.getOriginalFilename(), bytes);
        return new Prepared(cleanName(upload.getOriginalFilename()), format, bytes, sha256(bytes));
    }

    private void enforceLimits(Long userId, Collection<Prepared> fresh) {
        if (fresh.isEmpty()) {
            return;
        }
        long newBytes = fresh.stream().mapToLong(file -> file.bytes().length).sum();
        if (files.countByUserId(userId) + fresh.size() > maxFilesPerUser) {
            throw new BadRequestException("Your file bank holds " + maxFilesPerUser
                    + " files. Delete some and try again.");
        }
        if (files.totalBytes(userId) + newBytes > quotaBytes) {
            throw new BadRequestException("This would go over your " + megabytes(quotaBytes)
                    + " MB file bank. Delete some files and try again.");
        }
    }

    private BankFile store(Scope scope, Long userId, BankFileKind kindOrNull, Prepared file, List<String> stored) {
        String key = "bank/" + userId + "/" + UUID.randomUUID();
        storage.put(key, file.bytes(), file.format().contentType());
        stored.add(key);

        BankFile row = new BankFile();
        row.setUserId(userId);
        row.setCourseId(scope.isCourse() ? scope.courseId() : null);
        row.setChatId(scope.isCourse() ? null : scope.chatId());
        row.setName(file.name());
        row.setContentType(file.format().contentType());
        row.setFormat(file.format());
        row.setKind(kindOrNull != null ? kindOrNull : guessKind(file.name()));
        row.setSizeBytes(file.bytes().length);
        row.setSha256(file.sha256());
        row.setStorageKey(key);
        return files.saveAndFlush(row);
    }

    private Optional<BankFile> existing(Scope scope, String sha256) {
        return scope.isCourse()
                ? files.findByCourseIdAndSha256(scope.courseId(), sha256)
                : files.findByChatIdAndSha256(scope.chatId(), sha256);
    }

    private BankFile owned(Long id) {
        return files.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("File not found"));
    }

    private void requireOwnedCourse(Long courseId) {
        if (courses.findByIdAndUserId(courseId, currentUser.id()).isEmpty()) {
            throw new NotFoundException("Course not found");
        }
    }

    private void requireStorage() {
        if (!enabled()) {
            throw new BadRequestException("File storage isn't set up on this server yet.");
        }
    }

    private void deleteQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("Could not clean up stored file {}: {}", key, e.getMessage());
        }
    }

    private static boolean matches(List<String> words, List<String> prefixes, Set<String> exact) {
        for (String word : words) {
            if (exact.contains(word)) {
                return true;
            }
            for (String prefix : prefixes) {
                if (word.startsWith(prefix)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean hasProblemSet(List<String> words) {
        for (int i = 0; i + 1 < words.size(); i++) {
            if (words.get(i).equals("problem") && (words.get(i + 1).equals("set") || words.get(i + 1).equals("sets"))) {
                return true;
            }
        }
        return false;
    }

    private static List<String> words(String fileName) {
        if (fileName == null) {
            return List.of();
        }
        return Arrays.stream(fileName.toLowerCase(Locale.ROOT).split("[^\\p{L}]+"))
                .filter(word -> !word.isEmpty())
                .toList();
    }

    static String cleanName(String raw) {
        String name = raw == null ? "" : raw;
        name = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
        name = name.replaceAll("[\\p{Cntrl}\"<>|*?:]", "").strip();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            name = "Untitled";
        }
        return name.length() > MAX_NAME_CHARS ? name.substring(0, MAX_NAME_CHARS) : name;
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static long megabytes(long bytes) {
        return bytes / MEGABYTE;
    }

    private record Prepared(String name, BankFormat format, byte[] bytes, String sha256) {
    }
}
