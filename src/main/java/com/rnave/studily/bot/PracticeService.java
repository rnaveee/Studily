package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.AnswerResultDto;
import com.rnave.studily.bot.BotDtos.BotMeta;
import com.rnave.studily.bot.BotDtos.ChatDto;
import com.rnave.studily.bot.BotDtos.CitationDto;
import com.rnave.studily.bot.BotDtos.GradeDto;
import com.rnave.studily.bot.BotDtos.MessageDto;
import com.rnave.studily.bot.BotDtos.ProblemDto;
import com.rnave.studily.bot.BotDtos.ProblemSecret;
import com.rnave.studily.bot.BotDtos.StartPracticeRequest;
import com.rnave.studily.bot.BotDtos.Verdict;
import com.rnave.studily.bot.PracticeTutor.Excerpt;
import com.rnave.studily.bot.PracticeTutor.GradeDraft;
import com.rnave.studily.bot.PracticeTutor.Intent;
import com.rnave.studily.bot.PracticeTutor.Outcome;
import com.rnave.studily.bot.PracticeTutor.Photo;
import com.rnave.studily.bot.PracticeTutor.ProblemDraft;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.rag.RetrievedChunk;
import com.rnave.studily.rag.Retriever;
import com.rnave.studily.rag.Scope;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class PracticeService {

    static final int CONTEXT_CHUNKS = 10;
    static final int MAX_EARLIER = 20;
    static final int MAX_ANSWER_CHARS = 4000;
    static final int MAX_TITLE = 120;
    static final int QUOTE_CHARS = 600;
    static final String PHOTO_CAPTION = "📷 Photo of my work";
    static final String NO_FILES = "Add some course files first, then I can write problems from them.";
    static final String NO_PROBLEM = "Ask for a problem first.";
    static final String REVEAL_FEEDBACK = "Here's the worked solution.";
    static final Set<BankFileKind> CLASS_KINDS = Set.of(BankFileKind.PRACTICE_EXAM, BankFileKind.ASSIGNMENT);
    static final Set<BankFileKind> STUDY_KINDS = Set.of(BankFileKind.LECTURE, BankFileKind.NOTES);

    private final BotChatRepository chats;
    private final BotMessageRepository messages;
    private final BotMessages botMessages;
    private final CourseRepository courses;
    private final Retriever retriever;
    private final PracticeTutor tutor;
    private final BotLimits limits;
    private final AiUsageRecorder usage;
    private final CurrentUser currentUser;
    private final long maxPhotoBytes;

    public PracticeService(BotChatRepository chats, BotMessageRepository messages, BotMessages botMessages,
                           CourseRepository courses, Retriever retriever, PracticeTutor tutor, BotLimits limits,
                           AiUsageRecorder usage, CurrentUser currentUser,
                           @Value("${app.bot.practice.max-photo-bytes}") long maxPhotoBytes) {
        this.chats = chats;
        this.messages = messages;
        this.botMessages = botMessages;
        this.courses = courses;
        this.retriever = retriever;
        this.tutor = tutor;
        this.limits = limits;
        this.usage = usage;
        this.currentUser = currentUser;
        this.maxPhotoBytes = maxPhotoBytes;
    }

    public ChatDto start(StartPracticeRequest request) {
        requireEnabled();
        Long userId = currentUser.id();
        Course course = courses.findByIdAndUserId(request.courseId(), userId)
                .orElseThrow(() -> new NotFoundException("Course not found"));
        String topic = clean(request.topic());
        Generated generated = generate(userId, Scope.course(userId, course.getId()), request.difficulty(), topic,
                List.of());

        BotChat chat = new BotChat();
        chat.setUserId(userId);
        chat.setMode(BotMode.PRACTICE);
        chat.setCourseId(course.getId());
        chat.setTitle(title(course.getName(), request.difficulty(), topic));
        chat.setDifficulty(request.difficulty());
        chat.setTopic(topic);
        chat.setTemporary(false);
        chat = chats.save(chat);
        BotMessage problem = saveProblem(chat, generated);
        return new ChatDto(chat.getId(), chat.getMode(), chat.getCourseId(), course.getName(), chat.getTitle(),
                chat.getDifficulty(), chat.getUpdatedAt(), chat.getTopic(), chat.isTemporary(),
                chat.getParentChatId(), List.of(botMessages.dto(problem)), List.of());
    }

    public MessageDto next(Long chatId) {
        requireEnabled();
        BotChat chat = ownedPractice(chatId);
        List<BotMessage> history = messages.findByChatIdOrderByIdAsc(chatId);
        Generated generated = generate(chat.getUserId(), courseScope(chat), chat.getDifficulty(), chat.getTopic(),
                history);
        BotMessage saved = saveProblem(chat, generated);
        touch(chat);
        return botMessages.dto(saved);
    }

    public MessageDto reveal(Long chatId) {
        BotChat chat = ownedPractice(chatId);
        Current current = latestProblem(chatId);
        BotMessage saved = saveGrade(chat, new GradeDto(Verdict.INCORRECT, REVEAL_FEEDBACK, List.of(),
                current.secret().solution()));
        touch(chat);
        return botMessages.dto(saved);
    }

    public AnswerResultDto answer(Long chatId, String rawText, MultipartFile photo) {
        requireEnabled();
        BotChat chat = ownedPractice(chatId);
        String text = answerText(rawText);
        Photo image = photo(photo);
        if (text == null && image == null) {
            throw new BadRequestException("Write your answer or send a photo of your work.");
        }
        Current current = latestProblem(chatId);

        limits.check(BotMode.PRACTICE);
        Outcome<GradeDraft> outcome = tutor.grade(current.problem().statement(), current.secret(), text, image);
        record(chat.getUserId(), outcome);
        if (!outcome.ok()) {
            throw new BadRequestException(PracticeTutor.FAILED);
        }

        GradeDraft draft = outcome.result();
        BotMessage userMessage = saveMessage(chat, BotRole.USER, BotMessageKind.TEXT,
                text == null ? PHOTO_CAPTION : text, null);
        if (draft.intent() == Intent.QUESTION) {
            int number = current.problem().number();
            BotChat help = helpChat(chat, number);
            touch(chat);
            String question = text == null ? "I need help with problem " + number + "." : text;
            return new AnswerResultDto(botMessages.dto(userMessage), null, help.getId(), question);
        }
        BotMessage gradeMessage = saveGrade(chat, grade(draft, current.secret()));
        touch(chat);
        return new AnswerResultDto(botMessages.dto(userMessage), botMessages.dto(gradeMessage), null, null);
    }

    private record Generated(ProblemDto problem, ProblemSecret secret) {
    }

    private record Current(ProblemDto problem, ProblemSecret secret) {
    }

    private Generated generate(Long userId, Scope scope, Difficulty difficulty, String topic,
                               List<BotMessage> history) {
        if (retriever.readyFiles(scope) == 0) {
            throw new BadRequestException(NO_FILES);
        }
        limits.check(BotMode.PRACTICE);
        List<RetrievedChunk> chunks = context(scope, difficulty, topic);

        List<BotMessage> problems = problems(history);
        Outcome<ProblemDraft> outcome = tutor.problem(difficulty, topic, excerpts(chunks), earlier(problems));
        record(userId, outcome);
        if (!outcome.ok()) {
            throw new BadRequestException(PracticeTutor.FAILED);
        }
        ProblemDraft draft = outcome.result();
        if (blank(draft.statement()) || blank(draft.solution()) || blank(draft.finalAnswer())) {
            throw new BadRequestException(PracticeTutor.FAILED);
        }

        List<CitationDto> sources = citations(draft.sourceIndexes(), chunks);
        boolean fromClass = difficulty == Difficulty.CLASS && draft.fromClass() && !sources.isEmpty();
        ProblemDto problem = new ProblemDto(problems.size() + 1, draft.statement().strip(), fromClass, sources);
        return new Generated(problem, new ProblemSecret(draft.solution().strip(), draft.finalAnswer().strip()));
    }

    private List<RetrievedChunk> context(Scope scope, Difficulty difficulty, String topic) {
        if (topic != null) {
            List<RetrievedChunk> found = retriever.retrieve(scope, topic, CONTEXT_CHUNKS,
                    AiFeature.BOT_PRACTICE).chunks();
            if (found.isEmpty()) {
                throw new BadRequestException("I couldn't find \"" + topic
                        + "\" in your course files. Try another topic, or leave it blank.");
            }
            return found;
        }
        Set<BankFileKind> preferred = difficulty == Difficulty.CLASS ? CLASS_KINDS : STUDY_KINDS;
        List<RetrievedChunk> sampled = retriever.sample(scope, CONTEXT_CHUNKS, preferred);
        if (sampled.isEmpty()) {
            throw new BadRequestException(NO_FILES);
        }
        return sampled;
    }

    private BotMessage saveProblem(BotChat chat, Generated generated) {
        return saveMessage(chat, BotRole.BOT, BotMessageKind.PROBLEM, generated.problem().statement(),
                BotMeta.problem(generated.problem(), generated.secret()));
    }

    private BotMessage saveGrade(BotChat chat, GradeDto grade) {
        return saveMessage(chat, BotRole.BOT, BotMessageKind.GRADE, grade.feedback(), BotMeta.grade(grade));
    }

    private BotMessage saveMessage(BotChat chat, BotRole role, BotMessageKind kind, String content, BotMeta meta) {
        BotMessage message = new BotMessage();
        message.setChatId(chat.getId());
        message.setRole(role);
        message.setKind(kind);
        message.setContent(content);
        message.setMeta(botMessages.write(meta));
        return messages.save(message);
    }

    private BotChat helpChat(BotChat practice, int number) {
        return chats.findFirstByParentChatIdAndUserIdOrderByIdDesc(practice.getId(), practice.getUserId())
                .orElseGet(() -> {
                    BotChat help = new BotChat();
                    help.setUserId(practice.getUserId());
                    help.setMode(BotMode.CHAT);
                    help.setCourseId(practice.getCourseId());
                    help.setTitle("Question about problem " + number);
                    help.setTemporary(true);
                    help.setParentChatId(practice.getId());
                    return chats.save(help);
                });
    }

    private void touch(BotChat chat) {
        chat.setUpdatedAt(Instant.now());
        chats.save(chat);
    }

    private void record(Long userId, Outcome<?> outcome) {
        usage.record(userId, AiFeature.BOT_PRACTICE, outcome.model(), outcome.inputTokens(),
                outcome.outputTokens(), outcome.ok());
    }

    private BotChat ownedPractice(Long id) {
        return chats.findByIdAndUserId(id, currentUser.id())
                .filter(chat -> chat.getMode() == BotMode.PRACTICE)
                .orElseThrow(() -> new NotFoundException("Practice session not found"));
    }

    private Current latestProblem(Long chatId) {
        BotMessage latest = null;
        for (BotMessage message : messages.findByChatIdOrderByIdAsc(chatId)) {
            if (message.getKind() == BotMessageKind.PROBLEM) {
                latest = message;
            }
        }
        if (latest == null) {
            throw new BadRequestException(NO_PROBLEM);
        }
        BotMeta meta = botMessages.read(latest.getMeta());
        if (meta == null || meta.problem() == null || meta.secret() == null) {
            throw new BadRequestException(NO_PROBLEM);
        }
        return new Current(meta.problem(), meta.secret());
    }

    private static Scope courseScope(BotChat chat) {
        if (chat.getCourseId() == null) {
            throw new BadRequestException("This practice session has no course. Start a new one.");
        }
        return Scope.course(chat.getUserId(), chat.getCourseId());
    }

    private void requireEnabled() {
        if (!tutor.enabled()) {
            throw new BadRequestException("StudilyBot isn't available right now.");
        }
    }

    private Photo photo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        if (file.getSize() > maxPhotoBytes) {
            throw new BadRequestException("That photo is too big. Photos can be up to "
                    + Math.max(1, maxPhotoBytes / (1024 * 1024)) + " MB.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("That photo couldn't be read. Try another one.");
        }
        String mimeType = photoMime(bytes);
        if (mimeType == null) {
            throw new BadRequestException("Photos must be JPEG, PNG or WebP.");
        }
        return new Photo(mimeType, bytes);
    }

    static String photoMime(byte[] bytes) {
        if (at(bytes, 0, 0xFF, 0xD8, 0xFF)) {
            return "image/jpeg";
        }
        if (at(bytes, 0, 0x89, 'P', 'N', 'G')) {
            return "image/png";
        }
        if (at(bytes, 0, 'R', 'I', 'F', 'F') && at(bytes, 8, 'W', 'E', 'B', 'P')) {
            return "image/webp";
        }
        return null;
    }

    private static boolean at(byte[] bytes, int offset, int... expected) {
        if (bytes.length < offset + expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((bytes[offset + i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }

    private static String answerText(String raw) {
        String text = clean(raw);
        if (text != null && text.length() > MAX_ANSWER_CHARS) {
            throw new BadRequestException("Keep your answer under " + MAX_ANSWER_CHARS + " characters.");
        }
        return text;
    }

    private static GradeDto grade(GradeDraft draft, ProblemSecret secret) {
        Verdict verdict = draft.verdict() == null ? Verdict.INCORRECT : draft.verdict();
        String feedback = clean(draft.feedback());
        if (feedback == null) {
            feedback = fallbackFeedback(verdict);
        }
        List<String> steps = draft.steps() == null ? List.of()
                : draft.steps().stream().map(PracticeService::clean).filter(Objects::nonNull).toList();
        return new GradeDto(verdict, feedback, steps, verdict == Verdict.CORRECT ? secret.solution() : null);
    }

    private static String fallbackFeedback(Verdict verdict) {
        return switch (verdict) {
            case CORRECT -> "Correct!";
            case PARTIAL -> "You're partly there. Check your working.";
            case INCORRECT -> "Not quite. Check your working and try again.";
        };
    }

    private static List<BotMessage> problems(List<BotMessage> history) {
        return history.stream().filter(m -> m.getKind() == BotMessageKind.PROBLEM).toList();
    }

    private static List<String> earlier(List<BotMessage> problems) {
        List<String> statements = problems.stream().map(BotMessage::getContent).toList();
        return statements.subList(Math.max(0, statements.size() - MAX_EARLIER), statements.size());
    }

    static List<Excerpt> excerpts(List<RetrievedChunk> chunks) {
        List<Excerpt> out = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            RetrievedChunk chunk = chunks.get(i);
            out.add(new Excerpt(i + 1, chunk.location(), chunk.content()));
        }
        return out;
    }

    static List<CitationDto> citations(List<Integer> indexes, List<RetrievedChunk> chunks) {
        if (indexes == null) {
            return List.of();
        }
        List<CitationDto> out = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();
        for (Integer index : indexes) {
            if (index == null || index < 1 || index > chunks.size() || !seen.add(index)) {
                continue;
            }
            RetrievedChunk chunk = chunks.get(index - 1);
            out.add(new CitationDto(index, chunk.fileId(), chunk.fileName(), chunk.pageFrom(), chunk.pageTo(),
                    clip(chunk.content(), QUOTE_CHARS), chunk.previewable()));
        }
        return out;
    }

    static String title(String courseName, Difficulty difficulty, String topic) {
        String title = topic != null ? topic
                : (courseName == null ? "Practice" : courseName) + " · " + label(difficulty);
        return clip(title, MAX_TITLE);
    }

    private static String label(Difficulty difficulty) {
        return switch (difficulty) {
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
            case CLASS -> "Class-accurate";
        };
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String clean(String value) {
        if (value == null) {
            return null;
        }
        String stripped = value.strip();
        return stripped.isEmpty() ? null : stripped;
    }

    private static String clip(String value, int max) {
        return value.length() > max ? value.substring(0, max).strip() : value;
    }
}
