package com.rnave.studily.feynman;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.feynman.ClaudeFeynmanTutor.Assessed;
import com.rnave.studily.feynman.ClaudeFeynmanTutor.HistoryLine;
import com.rnave.studily.feynman.ClaudeFeynmanTutor.Outcome;
import com.rnave.studily.feynman.FeynmanDtos.AvailabilityDto;
import com.rnave.studily.feynman.FeynmanDtos.ConceptScoreDto;
import com.rnave.studily.feynman.FeynmanDtos.DocumentDto;
import com.rnave.studily.feynman.FeynmanDtos.GapDto;
import com.rnave.studily.feynman.FeynmanDtos.MessageDto;
import com.rnave.studily.feynman.FeynmanDtos.ReportDto;
import com.rnave.studily.feynman.FeynmanDtos.SessionDto;
import com.rnave.studily.feynman.FeynmanDtos.SessionSummaryDto;
import com.rnave.studily.feynman.FeynmanDtos.SlideDto;
import com.rnave.studily.feynman.FeynmanDtos.TurnDto;
import com.rnave.studily.filebank.BankFile;
import com.rnave.studily.filebank.BankService;
import com.rnave.studily.flashcard.generate.StudyDocumentReader;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.rag.Scope;
import com.rnave.studily.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
public class FeynmanService {

    private static final Logger log = LoggerFactory.getLogger(FeynmanService.class);

    static final int MAX_FILES = 3;
    static final long MAX_FILE_BYTES = 25L * 1024 * 1024;
    static final int MAX_MATERIAL_CHARS = 200_000;
    static final int MAX_CONCEPTS = 15;
    static final int MAX_TITLE = 120;
    static final int MAX_FOCUS = 1000;

    private final ClaudeFeynmanTutor tutor;
    private final FeynmanLimits limits;
    private final StudyDocumentReader reader;
    private final BankService bankService;
    private final CourseRepository courses;
    private final FeynmanSessionRepository sessions;
    private final FeynmanDocumentRepository documents;
    private final FeynmanMessageRepository messages;
    private final FeynmanAssessmentRepository assessments;
    private final AiUsageRecorder usageRecorder;
    private final CurrentUser currentUser;
    private final Set<Long> inFlight = ConcurrentHashMap.newKeySet();

    public FeynmanService(ClaudeFeynmanTutor tutor, FeynmanLimits limits, StudyDocumentReader reader,
                          BankService bankService, CourseRepository courses,
                          FeynmanSessionRepository sessions, FeynmanDocumentRepository documents,
                          FeynmanMessageRepository messages, FeynmanAssessmentRepository assessments,
                          AiUsageRecorder usageRecorder, CurrentUser currentUser) {
        this.tutor = tutor;
        this.limits = limits;
        this.reader = reader;
        this.bankService = bankService;
        this.courses = courses;
        this.sessions = sessions;
        this.documents = documents;
        this.messages = messages;
        this.assessments = assessments;
        this.usageRecorder = usageRecorder;
        this.currentUser = currentUser;
    }

    public AvailabilityDto availability() {
        boolean enabled = tutor.enabled();
        return new AvailabilityDto(enabled, enabled && limits.paused(), enabled ? limits.remainingToday() : 0,
                MAX_FILES, MAX_FILE_BYTES);
    }

    public List<SessionSummaryDto> list(Long courseId) {
        Long userId = currentUser.id();
        List<FeynmanSession> found;
        if (courseId == null) {
            found = sessions.findByUserIdOrderByUpdatedAtDesc(userId);
        } else {
            ownedCourse(courseId);
            found = sessions.findByUserIdAndCourseIdOrderByUpdatedAtDesc(userId, courseId);
        }
        Map<Long, String> names = new HashMap<>();
        courses.findByUserIdOrderByNameAsc(userId).forEach(c -> names.put(c.getId(), c.getName()));
        return found.stream()
                .map(s -> new SessionSummaryDto(s.getId(), s.getTitle(), s.getCourseId(),
                        names.get(s.getCourseId()), s.getStatus(), s.getScore(), s.getUpdatedAt()))
                .toList();
    }

    public SessionDto get(Long id) {
        return dto(owned(id));
    }

    record Material(Long bankFileId, String fileName, long sizeBytes, String text) {
    }

    public SessionDto start(Long courseId, String title, String focus, List<MultipartFile> files,
                            List<Long> bankFileIds) {
        requireEnabled();
        List<MultipartFile> uploads = present(files);
        List<Long> picked = distinct(bankFileIds);
        if (uploads.isEmpty() && picked.isEmpty()) {
            throw new BadRequestException("Add your lecture slides or notes to start.");
        }
        requireFileCount(uploads.size() + picked.size());
        if (courseId == null) {
            throw new BadRequestException("Choose a course for this session.");
        }
        ownedCourse(courseId);
        List<Material> read = readUploads(uploads);
        List<Material> fromBank = readBankFiles(courseId, picked);
        List<Material> all = new ArrayList<>(read);
        all.addAll(fromBank);
        requireMaterialFits(all);
        String cleanFocus = clip(focus, MAX_FOCUS);
        User user = currentUser.entity();
        return guarded(user.getId(), () -> {
            limits.check();
            List<Material> material = new ArrayList<>(saveUploads(user.getId(), courseId, uploads, read));
            material.addAll(fromBank);
            FeynmanPlan plan = buildPlan(user, material, cleanFocus);

            FeynmanSession session = new FeynmanSession();
            session.setUser(user);
            session.setCourseId(courseId);
            String chosen = clip(title, MAX_TITLE);
            session.setTitle(chosen != null ? chosen : titleFrom(plan, material));
            session.setFocus(cleanFocus);
            session.setPlan(ClaudeFeynmanTutor.JSON.writeValueAsString(plan));
            session = sessions.save(session);
            for (Material m : material) {
                saveDocument(session, m);
            }
            saveMessage(session, FeynmanRole.BOT, FeynmanKind.CHAT, opening(plan), firstConcept(plan));
            return dto(session);
        });
    }

    public SessionDto addDocuments(Long id, List<MultipartFile> files) {
        requireEnabled();
        FeynmanSession session = owned(id);
        requireActive(session);
        if (messages.countBySessionIdAndRole(id, FeynmanRole.USER) > 0) {
            throw new BadRequestException("You can only add files before you start explaining.");
        }
        if (session.getCourseId() == null) {
            throw new BadRequestException("This session isn't linked to a course, so new files can't be saved to a file bank.");
        }
        List<MultipartFile> uploads = present(files);
        if (uploads.isEmpty()) {
            throw new BadRequestException("Add your lecture slides or notes to start.");
        }
        List<FeynmanDocument> existing = documents.findBySessionIdOrderByIdAsc(id);
        requireFileCount(existing.size() + uploads.size());
        List<Material> added = readUploads(uploads);
        List<Material> all = new ArrayList<>();
        existing.forEach(d -> all.add(new Material(d.getBankFileId(), d.getFileName(), d.getSizeBytes(), d.getContent())));
        all.addAll(added);
        requireMaterialFits(all);
        User user = currentUser.entity();
        Long courseId = session.getCourseId();
        return guarded(user.getId(), () -> {
            limits.check();
            List<Material> linked = saveUploads(user.getId(), courseId, uploads, added);
            FeynmanPlan plan = buildPlan(user, all, session.getFocus());
            for (Material m : linked) {
                saveDocument(session, m);
            }
            session.setPlan(ClaudeFeynmanTutor.JSON.writeValueAsString(plan));
            touch(session);
            for (FeynmanMessage m : messages.findBySessionIdOrderByIdAsc(id)) {
                messages.delete(m);
            }
            saveMessage(session, FeynmanRole.BOT, FeynmanKind.CHAT, opening(plan), firstConcept(plan));
            return dto(session);
        });
    }

    public TurnDto send(Long id, String body) {
        requireEnabled();
        FeynmanSession session = owned(id);
        requireActive(session);
        String text = body == null ? "" : body.strip();
        if (text.isEmpty()) {
            throw new BadRequestException("Write something to send.");
        }
        User user = currentUser.entity();
        return guarded(user.getId(), () -> {
            limits.check();
            FeynmanPlan plan = plan(session);
            List<FeynmanAssessment> past = assessments.findBySessionIdOrderByIdAsc(id);
            List<HistoryLine> history = messages.findBySessionIdOrderByIdAsc(id).stream()
                    .filter(m -> m.getKind() == FeynmanKind.CHAT)
                    .map(m -> new HistoryLine(m.getRole(), m.getBody()))
                    .toList();

            Outcome<FeynmanTurn> outcome = tutor.turn(plan, assessed(past), history, text);
            record(user, outcome);
            if (!outcome.ok() || outcome.result().messages() == null || outcome.result().messages().isEmpty()) {
                throw new BadRequestException(ClaudeFeynmanTutor.FAILED);
            }
            FeynmanTurn turn = outcome.result();

            Map<String, SlideDto> slides = slides(plan, documents.findBySessionIdOrderByIdAsc(id));
            String focus = FeynmanScoring.matchConcept(plan, turn.focusConcept())
                    .or(() -> FeynmanScoring.matchConcept(plan, turn.concept()))
                    .orElse(null);
            List<MessageDto> out = new ArrayList<>();
            FeynmanMessage studentMessage = saveMessage(session, FeynmanRole.USER, FeynmanKind.CHAT, text);
            out.add(dto(studentMessage, slides));
            for (String bubble : turn.messages()) {
                if (bubble != null && !bubble.isBlank()) {
                    out.add(dto(saveMessage(session, FeynmanRole.BOT, FeynmanKind.CHAT, bubble.strip(), focus),
                            slides));
                }
            }
            if (turn.assessed()) {
                Optional<String> concept = FeynmanScoring.matchConcept(plan, turn.concept());
                if (concept.isPresent()) {
                    FeynmanAssessment a = new FeynmanAssessment();
                    a.setSession(session);
                    a.setMessage(studentMessage);
                    a.setConcept(concept.get());
                    a.setScore(FeynmanScoring.clamp(turn.score()));
                    a.setGaps(turn.gaps() == null || turn.gaps().isEmpty() ? null : String.join("\n", turn.gaps()));
                    a.setDidNotKnow(turn.didNotKnow());
                    assessments.save(a);
                } else {
                    log.info("StudilyBot assessed a concept that isn't in the plan: {}", turn.concept());
                }
            }
            touch(session);

            if (turn.lectureComplete()) {
                try {
                    TurnDto report = complete(user, session, plan);
                    out.addAll(report.messages());
                    return new TurnDto(out, report.status(), report.score());
                } catch (BadRequestException e) {
                    log.warn("StudilyBot finished the lecture but the report failed: {}", e.getMessage());
                }
            }
            return new TurnDto(out, session.getStatus(), session.getScore());
        });
    }

    public TurnDto finish(Long id) {
        requireEnabled();
        FeynmanSession session = owned(id);
        requireActive(session);
        User user = currentUser.entity();
        return guarded(user.getId(), () -> {
            limits.check();
            return complete(user, session, plan(session));
        });
    }

    public void delete(Long id) {
        sessions.delete(owned(id));
    }

    private TurnDto complete(User user, FeynmanSession session, FeynmanPlan plan) {
        List<FeynmanAssessment> past = assessments.findBySessionIdOrderByIdAsc(session.getId());
        if (past.isEmpty()) {
            throw new BadRequestException("Explain at least one idea to StudilyBot before you finish.");
        }
        List<ConceptScoreDto> scores = FeynmanScoring.conceptScores(plan, past);
        int score = FeynmanScoring.overall(scores);

        Outcome<FeynmanReport> outcome = tutor.report(plan, assessed(past));
        record(user, outcome);
        if (!outcome.ok()) {
            throw new BadRequestException(ClaudeFeynmanTutor.FAILED);
        }
        FeynmanReport report = outcome.result();
        ReportDto dto = new ReportDto(score,
                report.summary() == null ? "" : report.summary(),
                report.strengths() == null ? List.of() : report.strengths(),
                report.gaps() == null ? List.of()
                        : report.gaps().stream().map(g -> new GapDto(g.concept(), g.detail())).toList(),
                scores);
        FeynmanMessage saved = saveMessage(session, FeynmanRole.BOT, FeynmanKind.REPORT,
                ClaudeFeynmanTutor.JSON.writeValueAsString(dto));
        session.setStatus(FeynmanStatus.COMPLETE);
        session.setScore(score);
        touch(session);
        return new TurnDto(List.of(dto(saved, Map.of())), FeynmanStatus.COMPLETE, score);
    }

    private FeynmanPlan buildPlan(User user, List<Material> material, String focus) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < material.size(); i++) {
            Material m = material.get(i);
            text.append("Document ").append(i + 1).append(": ").append(m.fileName()).append("\n\n")
                    .append(m.text()).append("\n\n");
        }
        Outcome<FeynmanPlan> outcome = tutor.plan(text.toString().strip(), focus);
        record(user, outcome);
        if (!outcome.ok()) {
            throw new BadRequestException("StudilyBot couldn't read a lecture from that. Try again, or try a different file.");
        }
        FeynmanPlan plan = outcome.result();
        List<FeynmanPlan.Concept> concepts = plan.concepts() == null ? List.of() : plan.concepts().stream()
                .filter(c -> c != null && c.name() != null && !c.name().isBlank())
                .limit(MAX_CONCEPTS)
                .toList();
        if (concepts.isEmpty()) {
            throw new BadRequestException("StudilyBot couldn't find anything to teach back in that. Try a file with more notes in it.");
        }
        return new FeynmanPlan(plan.topic(), concepts);
    }

    private List<Material> readUploads(List<MultipartFile> uploads) {
        List<Material> material = new ArrayList<>();
        for (MultipartFile file : uploads) {
            String name = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
            if (file.getSize() > MAX_FILE_BYTES) {
                throw new BadRequestException(name + " is too big. Files can be up to 25 MB.");
            }
            byte[] bytes;
            try {
                bytes = file.getBytes();
            } catch (IOException e) {
                throw new BadRequestException(name + " could not be read.");
            }
            String text = reader.readText(name, bytes);
            if (text.isBlank()) {
                throw new BadRequestException(name + " has no text StudilyBot can read.");
            }
            material.add(new Material(null, name, bytes.length, text));
        }
        return material;
    }

    private List<Material> readBankFiles(Long courseId, List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Material> material = new ArrayList<>();
        for (BankFile file : bankService.ownedFiles(ids)) {
            if (!courseId.equals(file.getCourseId())) {
                throw new BadRequestException("Pick files from this course's file bank.");
            }
            material.add(new Material(file.getId(), file.getName(), file.getSizeBytes(), bankText(file)));
        }
        return material;
    }

    private String bankText(BankFile file) {
        byte[] bytes;
        try {
            bytes = bankService.content(file);
        } catch (RuntimeException e) {
            throw new BadRequestException(file.getName() + " could not be read. Try again in a moment.");
        }
        String text = reader.readText(file.getName(), bytes);
        if (text.isBlank()) {
            throw new BadRequestException(file.getName() + " has no text StudilyBot can read.");
        }
        return text;
    }

    private List<Material> saveUploads(Long userId, Long courseId, List<MultipartFile> uploads, List<Material> read) {
        if (uploads.isEmpty()) {
            return List.of();
        }
        List<BankFile> saved = bankService.upload(Scope.course(userId, courseId), uploads, null);
        List<Material> linked = new ArrayList<>();
        for (int i = 0; i < read.size(); i++) {
            Material m = read.get(i);
            linked.add(new Material(saved.get(i).getId(), m.fileName(), m.sizeBytes(), m.text()));
        }
        return linked;
    }

    private static void requireMaterialFits(List<Material> material) {
        int chars = material.stream().mapToInt(m -> m.text().length()).sum();
        if (chars > MAX_MATERIAL_CHARS) {
            throw new BadRequestException("That's too much material for one session. Try one lecture at a time.");
        }
    }

    private static void requireFileCount(int count) {
        if (count > MAX_FILES) {
            throw new BadRequestException("A session can use up to " + MAX_FILES + " files.");
        }
    }

    private static List<MultipartFile> present(List<MultipartFile> files) {
        return files == null ? List.of()
                : files.stream().filter(f -> f != null && !f.isEmpty()).toList();
    }

    private static List<Long> distinct(List<Long> ids) {
        return ids == null ? List.of() : ids.stream().distinct().toList();
    }

    private <T> T guarded(Long userId, Supplier<T> work) {
        if (!inFlight.add(userId)) {
            throw new TooManyRequestsException("StudilyBot is still answering. Wait for it to finish first.");
        }
        try {
            return work.get();
        } finally {
            inFlight.remove(userId);
        }
    }

    private void requireEnabled() {
        if (!tutor.enabled()) {
            throw new BadRequestException("StudilyBot isn't available right now.");
        }
    }

    private static void requireActive(FeynmanSession session) {
        if (session.getStatus() != FeynmanStatus.ACTIVE) {
            throw new BadRequestException("This session is finished. Start a new one to keep going.");
        }
    }

    private FeynmanSession owned(Long id) {
        return sessions.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Session not found"));
    }

    private Course ownedCourse(Long courseId) {
        return courses.findByIdAndUserId(courseId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Course not found"));
    }

    private static FeynmanPlan plan(FeynmanSession session) {
        return ClaudeFeynmanTutor.JSON.readValue(session.getPlan(), FeynmanPlan.class);
    }

    private static List<Assessed> assessed(List<FeynmanAssessment> past) {
        return past.stream()
                .map(a -> new Assessed(a.getConcept(), a.getScore(), a.getGaps(), a.isDidNotKnow()))
                .toList();
    }

    static String opening(FeynmanPlan plan) {
        String first = plan.concepts().get(0).name();
        String topic = plan.topic() == null || plan.topic().isBlank() ? null : plan.topic().strip();
        int count = plan.concepts().size();
        String lead = topic == null ? "Alright!" : "Alright, " + topic + "!";
        return lead + " Teach it to me. I read your material and found " + count
                + (count == 1 ? " idea" : " ideas") + " to go through. Pretend I've never heard of any of it. "
                + "Let's start with " + first + ". How would you explain it to me?";
    }

    private static String titleFrom(FeynmanPlan plan, List<Material> material) {
        String title = plan.topic();
        if (title == null || title.isBlank()) {
            String name = material.get(0).fileName();
            title = name.contains(".") ? name.substring(0, name.lastIndexOf('.')) : name;
        }
        return clip(title, MAX_TITLE);
    }

    private static String clip(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String s = value.strip();
        return s.length() > max ? s.substring(0, max).strip() : s;
    }

    private void touch(FeynmanSession session) {
        session.setUpdatedAt(Instant.now());
        sessions.save(session);
    }

    private void saveDocument(FeynmanSession session, Material m) {
        FeynmanDocument doc = new FeynmanDocument();
        doc.setSession(session);
        doc.setFileName(clip(m.fileName(), 255));
        doc.setSizeBytes(m.sizeBytes());
        doc.setBankFileId(m.bankFileId());
        doc.setContent(m.text());
        documents.save(doc);
    }

    private FeynmanMessage saveMessage(FeynmanSession session, FeynmanRole role, FeynmanKind kind, String body) {
        return saveMessage(session, role, kind, body, null);
    }

    private FeynmanMessage saveMessage(FeynmanSession session, FeynmanRole role, FeynmanKind kind, String body,
                                       String concept) {
        FeynmanMessage message = new FeynmanMessage();
        message.setSession(session);
        message.setRole(role);
        message.setKind(kind);
        message.setBody(body);
        message.setConcept(concept);
        return messages.save(message);
    }

    private static String firstConcept(FeynmanPlan plan) {
        return plan.concepts().get(0).name();
    }

    static Map<String, SlideDto> slides(FeynmanPlan plan, List<FeynmanDocument> docs) {
        Map<String, SlideDto> out = new HashMap<>();
        if (plan == null || plan.concepts() == null) {
            return out;
        }
        for (FeynmanPlan.Concept concept : plan.concepts()) {
            if (concept == null || concept.name() == null || concept.document() == null || concept.page() == null) {
                continue;
            }
            int index = concept.document() - 1;
            if (index < 0 || index >= docs.size() || concept.page() < 1) {
                continue;
            }
            FeynmanDocument doc = docs.get(index);
            if (doc.getBankFileId() == null || !previewable(doc.getFileName())) {
                continue;
            }
            out.put(concept.name(), new SlideDto(doc.getBankFileId(), doc.getFileName(), concept.page()));
        }
        return out;
    }

    private static boolean previewable(String fileName) {
        String lower = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        return lower.endsWith(".pdf") || lower.endsWith(".pptx");
    }

    private Map<String, SlideDto> slidesFor(FeynmanSession session, List<FeynmanDocument> docs) {
        if (session.getPlan() == null) {
            return Map.of();
        }
        try {
            return slides(plan(session), docs);
        } catch (RuntimeException e) {
            log.warn("Could not read the plan for session {}: {}", session.getId(), e.getMessage());
            return Map.of();
        }
    }

    private void record(User user, Outcome<?> outcome) {
        try {
            usageRecorder.record(user.getId(), AiFeature.FEYNMAN, outcome.model(), outcome.inputTokens(),
                    outcome.outputTokens(), outcome.ok());
        } catch (RuntimeException e) {
            log.warn("Could not record StudilyBot usage: {}", e.getMessage());
        }
    }

    private SessionDto dto(FeynmanSession s) {
        List<FeynmanDocument> stored = documents.findBySessionIdOrderByIdAsc(s.getId());
        Map<String, SlideDto> slides = slidesFor(s, stored);
        List<DocumentDto> docs = stored.stream()
                .map(d -> new DocumentDto(d.getId(), d.getFileName(), d.getSizeBytes(), d.getContent().length(),
                        d.getCreatedAt(), d.getBankFileId()))
                .toList();
        List<MessageDto> msgs = messages.findBySessionIdOrderByIdAsc(s.getId()).stream()
                .map(m -> dto(m, slides))
                .toList();
        return new SessionDto(s.getId(), s.getTitle(), s.getFocus(), s.getCourseId(), courseName(s.getCourseId()),
                s.getStatus(), s.getScore(), docs, msgs);
    }

    private String courseName(Long courseId) {
        return courseId == null ? null
                : courses.findByIdAndUserId(courseId, currentUser.id()).map(Course::getName).orElse(null);
    }

    private static MessageDto dto(FeynmanMessage m, Map<String, SlideDto> slides) {
        SlideDto slide = m.getRole() == FeynmanRole.BOT && m.getConcept() != null ? slides.get(m.getConcept()) : null;
        return new MessageDto(m.getId(), m.getRole(), m.getKind(), m.getBody(), slide, m.getCreatedAt());
    }
}
