package com.rnave.studily.rag;

import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankFile;
import com.rnave.studily.filebank.BankFileRepository;
import com.rnave.studily.filebank.FileStorage;
import com.rnave.studily.parse.AiBudget;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.parse.CourseParseUsageRepository;
import com.rnave.studily.user.UserTimeZones;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

@Component
public class IngestionWorker {

    private static final Logger log = LoggerFactory.getLogger(IngestionWorker.class);

    static final int CONCURRENCY = 2;
    static final int MAX_ATTEMPTS = 3;
    static final int STALE_LOCK_MINUTES = 15;

    private final JdbcTemplate jdbc;
    private final BankFileRepository files;
    private final CourseRepository courses;
    private final ObjectProvider<FileStorage> storage;
    private final TextExtractor extractor;
    private final Chunker chunker;
    private final VoyageClient voyage;
    private final ChunkStore chunkStore;
    private final AiUsageRecorder usage;
    private final CourseParseUsageRepository usageRows;
    private final UserTimeZones timeZones;
    private final double monthlyBudgetUsd;
    private final int maxChunksPerScope;
    private final ExecutorService executor = Executors.newFixedThreadPool(CONCURRENCY, runnable -> {
        Thread thread = new Thread(runnable, "bank-ingest");
        thread.setDaemon(true);
        return thread;
    });
    private final Semaphore slots = new Semaphore(CONCURRENCY);

    public IngestionWorker(JdbcTemplate jdbc, BankFileRepository files, CourseRepository courses,
                           ObjectProvider<FileStorage> storage, TextExtractor extractor, Chunker chunker,
                           VoyageClient voyage, ChunkStore chunkStore, AiUsageRecorder usage,
                           CourseParseUsageRepository usageRows, UserTimeZones timeZones,
                           @Value("${app.rag.embeddings-monthly-budget-usd}") double monthlyBudgetUsd,
                           @Value("${app.bank.max-chunks-per-scope}") int maxChunksPerScope) {
        this.jdbc = jdbc;
        this.files = files;
        this.courses = courses;
        this.storage = storage;
        this.extractor = extractor;
        this.chunker = chunker;
        this.voyage = voyage;
        this.chunkStore = chunkStore;
        this.usage = usage;
        this.usageRows = usageRows;
        this.timeZones = timeZones;
        this.monthlyBudgetUsd = monthlyBudgetUsd;
        this.maxChunksPerScope = maxChunksPerScope;
    }

    @Scheduled(fixedDelay = 2_000, initialDelay = 10_000)
    void poll() {
        FileStorage fileStorage = storage.getIfAvailable();
        if (fileStorage == null || !fileStorage.configured() || !voyage.configured()) {
            return;
        }
        failAbandoned();
        while (slots.tryAcquire()) {
            Optional<Long> claimed = claimNext();
            if (claimed.isEmpty()) {
                slots.release();
                return;
            }
            long fileId = claimed.get();
            executor.execute(() -> {
                try {
                    process(fileId, fileStorage);
                } finally {
                    slots.release();
                }
            });
        }
    }

    Optional<Long> claimNext() {
        List<Long> ids = jdbc.queryForList("""
                UPDATE bank_files
                SET status = 'PROCESSING', locked_at = now(), attempts = attempts + 1,
                    status_detail = 'Reading the file'
                WHERE id = (
                    SELECT id FROM bank_files
                    WHERE (status = 'QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
                       OR (status = 'PROCESSING' AND locked_at < now() - make_interval(mins => ?)
                           AND attempts < ?)
                    ORDER BY id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1)
                RETURNING id""", Long.class, STALE_LOCK_MINUTES, MAX_ATTEMPTS);
        return ids.stream().findFirst();
    }

    void process(long fileId, FileStorage fileStorage) {
        BankFile file = files.findById(fileId).orElse(null);
        if (file == null) {
            return;
        }
        try {
            if (embeddingBudgetSpent()) {
                defer(fileId);
                return;
            }
            byte[] bytes = fileStorage.get(file.getStorageKey());
            ExtractedDocument document = extractor.extract(bytes, file.getFormat());
            List<Chunk> chunks = chunker.chunk(document.sections());
            if (chunks.isEmpty()) {
                throw new IngestFailure(document.unreadablePages() > 0
                        ? "No text found. This looks like a scanned document, which can't be searched yet."
                        : "No text found in this file.", true);
            }

            Scope scope = scopeOf(file);
            if (chunkStore.chunkCount(scope, fileId) + chunks.size() > maxChunksPerScope) {
                throw new IngestFailure("This file bank is full", true);
            }

            progress(fileId, "Indexing " + chunks.size() + (chunks.size() == 1 ? " passage" : " passages"));
            String context = contextLine(file);
            List<String> inputs = chunks.stream().map(chunk -> embeddingInput(context, chunk)).toList();
            VoyageClient.Embeddings embeddings = embed(file.getUserId(), inputs);

            String note = document.mostlyUnreadable()
                    ? "Some pages look scanned, so only part of this file can be searched."
                    : null;
            chunkStore.completeFile(fileId, file.getUserId(), file.getCourseId(), file.getChatId(), chunks,
                    embeddings.vectors(), document.pageCount(), embeddings.model(), note);
            log.info("Indexed bank file {} into {} chunks ({} tokens)", fileId, chunks.size(), embeddings.tokens());
        } catch (IngestFailure e) {
            fail(fileId, e.getMessage(), e.permanent());
        } catch (RuntimeException e) {
            log.warn("Indexing bank file {} failed: {}", fileId, e.toString());
            fail(fileId, "Indexing hit a problem. It will be retried automatically.", false);
        }
    }

    private boolean embeddingBudgetSpent() {
        double spent = AiBudget.usd(usageRows.spendSince(
                AiBudget.monthStart(ZonedDateTime.now(timeZones.fallback())), AiFeature.EMBEDDINGS));
        return spent >= monthlyBudgetUsd;
    }

    private VoyageClient.Embeddings embed(long userId, List<String> inputs) {
        VoyageClient.Embeddings embeddings;
        try {
            embeddings = voyage.embedDocuments(inputs);
        } catch (RuntimeException e) {
            usage.record(userId, AiFeature.EMBEDDINGS, voyage.embedModel(), 0, 0, false);
            throw e;
        }
        usage.record(userId, AiFeature.EMBEDDINGS, embeddings.model(), embeddings.tokens(), 0, true);
        return embeddings;
    }

    static Scope scopeOf(BankFile file) {
        return file.getCourseId() != null
                ? Scope.course(file.getUserId(), file.getCourseId())
                : Scope.chat(file.getUserId(), file.getChatId());
    }

    String contextLine(BankFile file) {
        if (file.getCourseId() == null) {
            return file.getName();
        }
        String course = courses.findById(file.getCourseId())
                .map(IngestionWorker::courseLabel)
                .orElse("");
        return course.isBlank() ? file.getName() : course + " · " + file.getName();
    }

    static String embeddingInput(String context, Chunk chunk) {
        StringBuilder header = new StringBuilder(context);
        if (chunk.heading() != null) {
            header.append(" · ").append(chunk.heading());
        }
        if (chunk.pageFrom() != null) {
            header.append(" · p. ").append(chunk.pageFrom());
            if (chunk.pageTo() != null && !chunk.pageTo().equals(chunk.pageFrom())) {
                header.append('-').append(chunk.pageTo());
            }
        }
        return header + "\n\n" + chunk.text();
    }

    static String courseLabel(Course course) {
        if (course.getCode() == null || course.getCode().isBlank()) {
            return course.getName();
        }
        return course.getCode() + " " + course.getName();
    }

    private void progress(long fileId, String detail) {
        jdbc.update("UPDATE bank_files SET status_detail = ? WHERE id = ? AND status = 'PROCESSING'", detail, fileId);
    }

    private void defer(long fileId) {
        jdbc.update("""
                        UPDATE bank_files
                        SET status = 'QUEUED', status_detail = 'Waiting for indexing capacity', locked_at = NULL,
                            attempts = GREATEST(attempts - 1, 0), next_attempt_at = now() + interval '1 hour'
                        WHERE id = ?""",
                fileId);
    }

    private void fail(long fileId, String message, boolean permanent) {
        jdbc.update("""
                        UPDATE bank_files
                        SET status = CASE WHEN ? OR attempts >= ? THEN 'FAILED' ELSE 'QUEUED' END,
                            status_detail = ?,
                            locked_at = NULL,
                            next_attempt_at = now() + make_interval(mins => attempts * attempts)
                        WHERE id = ?""",
                permanent, MAX_ATTEMPTS, message, fileId);
    }

    private void failAbandoned() {
        jdbc.update("""
                        UPDATE bank_files
                        SET status = 'FAILED', status_detail = 'Indexing kept failing. Try re-indexing the file.',
                            locked_at = NULL
                        WHERE status = 'PROCESSING'
                          AND locked_at < now() - make_interval(mins => ?)
                          AND attempts >= ?""",
                STALE_LOCK_MINUTES, MAX_ATTEMPTS);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
