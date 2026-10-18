package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.flashcard.FlashcardImageService;
import com.rnave.studily.flashcard.FlashcardSetService;
import com.rnave.studily.flashcard.generate.ClaudeFlashcardGenerator.ModelInput;
import com.rnave.studily.flashcard.generate.ClaudeFlashcardGenerator.Outcome;
import com.rnave.studily.flashcard.generate.FlashcardGenDtos.GenAvailabilityDto;
import com.rnave.studily.flashcard.generate.FlashcardGenDtos.GeneratedCardDto;
import com.rnave.studily.flashcard.generate.FlashcardGenDtos.GeneratedDeckDto;
import com.rnave.studily.flashcard.generate.StudyDocument.Figure;
import com.rnave.studily.flashcard.generate.StudyDocument.Picture;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.CourseParseCache;
import com.rnave.studily.parse.CourseParseUsage;
import com.rnave.studily.parse.CourseParseUsageRepository;
import com.rnave.studily.user.User;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Service
public class FlashcardGenService {

    private static final Logger log = LoggerFactory.getLogger(FlashcardGenService.class);

    static final int MAX_FILES = 3;
    static final long MAX_FILE_BYTES = 25L * 1024 * 1024;
    static final long MAX_TOTAL_BYTES = 50L * 1024 * 1024;
    static final int MAX_CARDS = 150;
    static final int MAX_IMAGES = 30;
    static final int MAX_CONCURRENT = 3;
    static final int MAX_TITLE = 120;
    static final long MODEL_WAIT_SECONDS = 170;

    private final StudyDocumentReader reader;
    private final ClaudeFlashcardGenerator generator;
    private final FlashcardGenLimits limits;
    private final CourseParseCache cache;
    private final CourseParseUsageRepository usageRepository;
    private final FlashcardImageService imageService;
    private final FlashcardSetService setService;
    private final CurrentUser currentUser;
    private final Semaphore slots = new Semaphore(MAX_CONCURRENT);
    private final Set<Long> inFlight = ConcurrentHashMap.newKeySet();
    private final ExecutorService modelCalls = Executors.newVirtualThreadPerTaskExecutor();

    public FlashcardGenService(StudyDocumentReader reader, ClaudeFlashcardGenerator generator,
                               FlashcardGenLimits limits, CourseParseCache cache,
                               CourseParseUsageRepository usageRepository, FlashcardImageService imageService,
                               FlashcardSetService setService, CurrentUser currentUser) {
        this.reader = reader;
        this.generator = generator;
        this.limits = limits;
        this.cache = cache;
        this.usageRepository = usageRepository;
        this.imageService = imageService;
        this.setService = setService;
        this.currentUser = currentUser;
    }

    @PreDestroy
    void shutdown() {
        modelCalls.shutdownNow();
    }

    public GenAvailabilityDto availability() {
        boolean enabled = generator.enabled();
        return new GenAvailabilityDto(enabled, limits.monthlyLimit(), enabled ? limits.remaining() : 0,
                enabled && limits.paused(), MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES);
    }

    record Upload(String name, byte[] bytes) {
    }

    private record Prepared(Upload upload, StudyDocument doc, ModelInput input, String cacheKey) {
    }

    private record Generated(Prepared prepared, GenResult result, String failure) {
    }

    public GeneratedDeckDto generate(Long setId, List<MultipartFile> files) {
        if (!generator.enabled()) {
            throw new BadRequestException("Making flashcards from documents isn't available right now.");
        }
        List<Upload> uploads = uploads(files);
        List<String> existingFronts = setId == null ? List.of() : setService.ownedCardFronts(setId);
        Long userId = currentUser.id();
        if (!inFlight.add(userId)) {
            throw new TooManyRequestsException("You're already making flashcards. Wait for that to finish first.");
        }
        boolean acquired = false;
        try {
            acquired = slots.tryAcquire(10, TimeUnit.SECONDS);
            if (!acquired) {
                throw new TooManyRequestsException(
                        "Lots of people are making flashcards right now. Try again in a minute.");
            }
            return run(userId, uploads, existingFronts);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadRequestException(ClaudeFlashcardGenerator.FAILED);
        } finally {
            if (acquired) {
                slots.release();
            }
            inFlight.remove(userId);
        }
    }

    private GeneratedDeckDto run(Long userId, List<Upload> uploads, List<String> existingFronts) {
        for (Upload upload : uploads) {
            try {
                FileSniffer.sniff(upload.bytes());
            } catch (BadRequestException e) {
                throw new BadRequestException(upload.name() + ": " + e.getMessage());
            }
        }
        List<Prepared> prepared = new ArrayList<>();
        for (Upload upload : uploads) {
            StudyDocument doc = reader.read(upload.name(), upload.bytes());
            prepared.add(new Prepared(upload, doc, ClaudeFlashcardGenerator.select(doc), cacheKey(upload.bytes())));
        }

        List<Generated> generated = new ArrayList<>();
        List<Prepared> uncached = new ArrayList<>();
        Map<Prepared, GenResult> hits = new HashMap<>();
        for (Prepared p : prepared) {
            Optional<GenResult> hit = cache.lookup(p.cacheKey(), GenResult.class);
            if (hit.isPresent()) {
                hits.put(p, hit.get());
            } else {
                uncached.add(p);
            }
        }
        if (!uncached.isEmpty()) {
            limits.check(uncached.size());
        }

        Map<Prepared, Future<Outcome>> calls = new HashMap<>();
        for (Prepared p : uncached) {
            calls.put(p, modelCalls.submit(() -> generator.generate(p.doc(), p.input())));
        }
        User user = currentUser.entity();
        for (Prepared p : prepared) {
            if (hits.containsKey(p)) {
                generated.add(new Generated(p, hits.get(p), null));
                continue;
            }
            Outcome outcome = await(calls.get(p));
            if (outcome.billed()) {
                record(user, outcome);
            }
            if (outcome.ok()) {
                cache.store(p.cacheKey(), outcome.result(), generator.model());
                generated.add(new Generated(p, outcome.result(), null));
            } else {
                generated.add(new Generated(p, null, outcome.failure()));
            }
        }
        return assemble(userId, generated, existingFronts);
    }

    private Outcome await(Future<Outcome> call) {
        try {
            return call.get(MODEL_WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            call.cancel(true);
            Thread.currentThread().interrupt();
            return new Outcome(null, 0, 0, false, ClaudeFlashcardGenerator.FAILED);
        } catch (Exception e) {
            call.cancel(true);
            log.warn("Flashcard generation call failed: {}", e.toString());
            return new Outcome(null, 0, 0, false, ClaudeFlashcardGenerator.FAILED);
        }
    }

    private void record(User user, Outcome outcome) {
        try {
            CourseParseUsage usage = new CourseParseUsage();
            usage.setUser(user);
            usage.setModel(generator.model());
            usage.setInputTokens(outcome.inputTokens());
            usage.setOutputTokens(outcome.outputTokens());
            usage.setFeature(AiFeature.FLASHCARDS);
            usage.setSucceeded(outcome.ok());
            usageRepository.save(usage);
        } catch (RuntimeException e) {
            log.warn("Could not record flashcard generation usage: {}", e.getMessage());
        }
    }

    private GeneratedDeckDto assemble(Long userId, List<Generated> generated, List<String> existingFronts) {
        List<String> warnings = new ArrayList<>();
        boolean multiple = generated.size() > 1;
        String firstFailure = null;
        for (Generated g : generated) {
            if (g.result() == null) {
                String message = multiple ? g.prepared().upload().name() + ": " + g.failure() : g.failure();
                warnings.add(message);
                firstFailure = firstFailure == null ? message : firstFailure;
            }
        }
        if (generated.stream().allMatch(g -> g.result() == null)) {
            throw new BadRequestException(firstFailure == null ? ClaudeFlashcardGenerator.FAILED : firstFailure);
        }

        Set<String> existing = new HashSet<>();
        existingFronts.forEach(front -> existing.add(CardNormalizer.key(front)));
        Set<String> seen = new HashSet<>();
        Map<String, String> stored = new HashMap<>();
        boolean storageFull = false;
        boolean capped = false;
        int duplicates = 0;
        List<GeneratedCardDto> cards = new ArrayList<>();
        String title = null;

        for (int d = 0; d < generated.size(); d++) {
            Generated g = generated.get(d);
            if (g.result() == null) {
                continue;
            }
            StudyDocument doc = g.prepared().doc();
            if (title == null && g.result().title() != null && !g.result().title().isBlank()) {
                title = g.result().title().strip();
            }
            for (CardNormalizer.Card card : CardNormalizer.normalize(
                    g.result(), g.prepared().input().references(), doc.pages().size())) {
                if (cards.size() >= MAX_CARDS) {
                    capped = true;
                    break;
                }
                if (!seen.add(CardNormalizer.key(card.front()) + "|" + card.frontRef())) {
                    continue;
                }
                String frontImage = null;
                String backImage = null;
                if (!storageFull) {
                    try {
                        frontImage = image(userId, doc, d, card.frontRef(), stored);
                        backImage = image(userId, doc, d, card.backRef(), stored);
                    } catch (ConflictException e) {
                        storageFull = true;
                    }
                }
                if ((card.front().isEmpty() && frontImage == null) || (card.back().isEmpty() && backImage == null)) {
                    continue;
                }
                boolean duplicate = existing.contains(CardNormalizer.key(card.front()));
                duplicates += duplicate ? 1 : 0;
                cards.add(new GeneratedCardDto(card.front(), card.back(), frontImage, backImage, card.sourcePage(),
                        doc.label(card.sourcePage()), doc.fileName(), duplicate));
            }
        }
        if (cards.isEmpty()) {
            throw new BadRequestException("No flashcards could be made from that. Try a file with more notes in it.");
        }
        if (capped) {
            warnings.add("Only the first " + MAX_CARDS + " cards were kept. Upload fewer files at once to get the rest.");
        }
        if (storageFull) {
            warnings.add("Your flashcard image storage is full, so some cards were made without their pictures.");
        }
        if (duplicates > 0) {
            warnings.add(duplicates + (duplicates == 1 ? " card is" : " cards are")
                    + " already in this set, so " + (duplicates == 1 ? "it starts" : "they start") + " unticked.");
        }
        if (title == null) {
            String name = generated.get(0).prepared().upload().name();
            title = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name;
        }
        if (title.length() > MAX_TITLE) {
            title = title.substring(0, MAX_TITLE).strip();
        }
        return new GeneratedDeckDto(title, cards, warnings, limits.remaining());
    }

    private String image(Long userId, StudyDocument doc, int docIndex, String ref, Map<String, String> stored) {
        if (ref == null) {
            return null;
        }
        String id = docIndex + ":" + ref;
        if (stored.containsKey(id)) {
            String key = stored.get(id);
            return key.isEmpty() ? null : key;
        }
        if (stored.values().stream().filter(k -> !k.isEmpty()).count() >= MAX_IMAGES) {
            return null;
        }
        Picture picture = picture(doc, ref);
        String key = "";
        if (picture != null) {
            try {
                key = imageService.storeGenerated(userId, picture.mediaType(), picture.data()).key();
            } catch (BadRequestException e) {
                key = "";
            }
        }
        stored.put(id, key);
        return key.isEmpty() ? null : key;
    }

    private static Picture picture(StudyDocument doc, String ref) {
        int number = Integer.parseInt(ref.substring(ref.indexOf('-') + 1));
        if (ref.startsWith("page-")) {
            return doc.pages().stream().filter(p -> p.number() == number).findFirst()
                    .map(StudyDocument.Page::render).orElse(null);
        }
        return doc.figures().stream().filter(f -> f.id() == number).findFirst()
                .map(Figure::picture).orElse(null);
    }

    private List<Upload> uploads(List<MultipartFile> files) {
        List<MultipartFile> present = files == null ? List.of()
                : files.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (present.isEmpty()) {
            throw new BadRequestException("Add a file first.");
        }
        if (present.size() > MAX_FILES) {
            throw new BadRequestException("Upload at most " + MAX_FILES + " files at a time.");
        }
        long total = 0;
        List<Upload> uploads = new ArrayList<>();
        for (MultipartFile file : present) {
            if (file.getSize() > MAX_FILE_BYTES) {
                throw new BadRequestException(name(file) + " is larger than 25 MB.");
            }
            total += file.getSize();
            if (total > MAX_TOTAL_BYTES) {
                throw new BadRequestException("Those files add up to more than 50 MB. Upload fewer at a time.");
            }
            try {
                uploads.add(new Upload(name(file), file.getBytes()));
            } catch (IOException e) {
                throw new BadRequestException(name(file) + " could not be read.");
            }
        }
        return uploads;
    }

    static String name(MultipartFile file) {
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String name = original.substring(Math.max(original.lastIndexOf('/'), original.lastIndexOf('\\')) + 1)
                .replaceAll("[\\p{Cntrl}\"<>]", "")
                .strip();
        if (name.isEmpty()) {
            name = "file";
        }
        return name.length() > 100 ? name.substring(name.length() - 100) : name;
    }

    private String cacheKey(byte[] bytes) {
        MessageDigest digest = sha256();
        digest.update(("flashcards:v" + ClaudeFlashcardGenerator.PROMPT_VERSION + ":r" + StudyDocumentReader.READER_VERSION
                + ":" + generator.model() + ":").getBytes(StandardCharsets.UTF_8));
        digest.update(bytes);
        return HexFormat.of().formatHex(digest.digest());
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
