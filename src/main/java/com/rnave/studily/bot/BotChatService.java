package com.rnave.studily.bot;

import com.anthropic.core.http.StreamResponse;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.InternalServerException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.SseException;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.models.messages.StopReason;
import com.rnave.studily.bot.BotDtos.AttachmentDto;
import com.rnave.studily.bot.BotDtos.BotMeta;
import com.rnave.studily.bot.BotDtos.ChatDto;
import com.rnave.studily.bot.BotDtos.ChatSummaryDto;
import com.rnave.studily.bot.BotDtos.CreateChatRequest;
import com.rnave.studily.bot.BotDtos.DeltaEvent;
import com.rnave.studily.bot.BotDtos.DoneEvent;
import com.rnave.studily.bot.BotDtos.ErrorEvent;
import com.rnave.studily.bot.BotDtos.MessageDto;
import com.rnave.studily.bot.BotDtos.MetaEvent;
import com.rnave.studily.bot.BotDtos.StatusDto;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankFile;
import com.rnave.studily.filebank.BankFileDto;
import com.rnave.studily.filebank.BankService;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.rag.ClaudeConnection;
import com.rnave.studily.rag.QueryRewriter;
import com.rnave.studily.rag.QueryRewriter.HistoryTurn;
import com.rnave.studily.rag.RetrievedChunk;
import com.rnave.studily.rag.Retriever;
import com.rnave.studily.rag.Scope;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class BotChatService {

    private static final Logger log = LoggerFactory.getLogger(BotChatService.class);

    static final long STREAM_TIMEOUT_MS = 180_000;
    static final int HISTORY_MESSAGES = 8;
    static final int TOP_K = 8;
    static final int MAX_QUESTION_CHARS = 2000;
    static final int TITLE_CHARS = 60;
    static final String NEW_CHAT_TITLE = "New chat";
    static final String HELP_CHAT_TITLE = "Practice help";
    static final String REFUSED =
            "I can't help with that one. Try rephrasing the question, or ask about a different part of your notes.";
    static final String EMPTY_ANSWER = "I couldn't put an answer together for that. Try rewording the question.";
    static final String CHAT_FILES_SCOPE = "the files attached to this chat";
    static final int MAX_ATTACHMENTS = 10;

    record Turn(long userId, long chatId, String question, Scope scope, String scopeLabel,
                List<HistoryTurn> history) {
    }

    private final Set<Long> inFlight = ConcurrentHashMap.newKeySet();
    private final ExecutorService streams = Executors.newVirtualThreadPerTaskExecutor();
    private final BotChatRepository chats;
    private final BotMessageRepository messages;
    private final CourseRepository courses;
    private final CurrentUser currentUser;
    private final BotLimits limits;
    private final BankService bank;
    private final QueryRewriter rewriter;
    private final Retriever retriever;
    private final ChatPromptBuilder prompts;
    private final ClaudeConnection claude;
    private final AiUsageRecorder usage;
    private final BotMessages botMessages;
    private final JdbcTemplate jdbc;
    private final boolean botEnabled;

    public BotChatService(BotChatRepository chats, BotMessageRepository messages, CourseRepository courses,
                          CurrentUser currentUser, BotLimits limits, BankService bank, QueryRewriter rewriter,
                          Retriever retriever, ChatPromptBuilder prompts, ClaudeConnection claude,
                          AiUsageRecorder usage, BotMessages botMessages, JdbcTemplate jdbc,
                          @Value("${app.bot.enabled}") boolean botEnabled) {
        this.chats = chats;
        this.messages = messages;
        this.courses = courses;
        this.currentUser = currentUser;
        this.limits = limits;
        this.bank = bank;
        this.rewriter = rewriter;
        this.retriever = retriever;
        this.prompts = prompts;
        this.claude = claude;
        this.usage = usage;
        this.botMessages = botMessages;
        this.jdbc = jdbc;
        this.botEnabled = botEnabled;
    }

    @Transactional(readOnly = true)
    public List<ChatSummaryDto> list(BotMode mode) {
        long userId = currentUser.id();
        Map<Long, String> names = new HashMap<>();
        for (Course course : courses.findByUserIdOrderByNameAsc(userId)) {
            names.put(course.getId(), courseLabel(course));
        }
        return chats.findByUserIdAndModeAndTemporaryFalseOrderByUpdatedAtDesc(userId, mode).stream()
                .map(chat -> new ChatSummaryDto(chat.getId(), chat.getMode(), chat.getCourseId(),
                        chat.getCourseId() == null ? null : names.get(chat.getCourseId()), chat.getTitle(),
                        chat.getDifficulty(), chat.getUpdatedAt()))
                .toList();
    }

    @Transactional
    public ChatDto create(CreateChatRequest request) {
        long userId = currentUser.id();
        if (request.parentChatId() != null) {
            return helpChat(userId, request.parentChatId());
        }
        BotChat chat = new BotChat();
        chat.setUserId(userId);
        chat.setMode(BotMode.CHAT);
        chat.setCourseId(request.courseId() == null ? null : requireCourse(userId, request.courseId()).getId());
        chat.setTitle(NEW_CHAT_TITLE);
        return detail(chats.save(chat));
    }

    @Transactional(readOnly = true)
    public ChatDto get(long chatId) {
        return detail(owned(chatId));
    }

    @Transactional
    public ChatDto rename(long chatId, String title) {
        BotChat chat = owned(chatId);
        chat.setTitle(title.strip());
        return detail(chat);
    }

    @Transactional
    public void delete(long chatId) {
        chats.delete(owned(chatId));
    }

    public List<BankFileDto> upload(long chatId, List<MultipartFile> files) {
        BotChat chat = owned(chatId);
        if (chat.isTemporary()) {
            throw new BadRequestException("Help chats can't take file uploads.");
        }
        return bank.upload(scopeOf(chat, currentUser.id()), files, null).stream()
                .map(BankFileDto::from)
                .toList();
    }

    public SseEmitter send(long chatId, String body) {
        return send(chatId, body, List.of());
    }

    public SseEmitter send(long chatId, String body, List<Long> fileIds) {
        Turn turn = open(chatId, body, fileIds);
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        SseSink sink = new SseSink(emitter);
        try {
            streams.execute(() -> answer(turn, sink));
        } catch (RuntimeException e) {
            inFlight.remove(chatId);
            throw e;
        }
        return emitter;
    }

    public StatusDto status() {
        long userId = currentUser.id();
        Long ready = jdbc.queryForObject(
                "SELECT count(*) FROM bank_files WHERE user_id = ? AND status = 'READY'", Long.class, userId);
        return new StatusDto(botEnabled && claude.configured() && bank.enabled(),
                limits.paused(BotMode.CHAT), limits.paused(BotMode.PRACTICE),
                limits.remainingToday(BotMode.CHAT), limits.remainingToday(BotMode.PRACTICE),
                ready == null ? 0L : ready);
    }

    @Transactional
    public ChatDto setCourse(long chatId, long courseId) {
        long userId = currentUser.id();
        BotChat chat = owned(chatId);
        if (chat.getMode() != BotMode.CHAT || chat.isTemporary()) {
            throw new BadRequestException("Only a regular chat can be moved to a course.");
        }
        if (chat.getCourseId() != null) {
            if (chat.getCourseId() == courseId) {
                return detail(chat);
            }
            throw new BadRequestException("This chat already belongs to a course. Start a new chat for another one.");
        }
        requireCourse(userId, courseId);
        bank.moveChatFilesToCourse(userId, chatId, courseId);
        chat.setCourseId(courseId);
        chat.setUpdatedAt(Instant.now());
        return detail(chats.save(chat));
    }

    Turn open(long chatId, String body) {
        return open(chatId, body, List.of());
    }

    Turn open(long chatId, String body, List<Long> fileIds) {
        long userId = currentUser.id();
        BotChat chat = owned(chatId);
        if (chat.getMode() != BotMode.CHAT) {
            throw new BadRequestException("Practice answers go through the answer box.");
        }
        String text = body == null ? "" : body.strip();
        List<AttachmentDto> attached = attachments(chat, fileIds);
        if (text.isEmpty() && attached.isEmpty()) {
            throw new BadRequestException("Write something to send.");
        }
        limits.check(BotMode.CHAT);
        if (!inFlight.add(chatId)) {
            throw new TooManyRequestsException("StudilyBot is still answering in this chat. Wait for it to finish first.");
        }
        try {
            String question = text.isEmpty() ? overviewQuestion(attached) : text;
            List<BotMessage> previous = messages.findByChatIdOrderByIdAsc(chatId);
            boolean firstQuestion = previous.stream().noneMatch(message -> message.getRole() == BotRole.USER);
            messages.save(newMessage(chatId, BotRole.USER, text,
                    attached.isEmpty() ? null : botMessages.write(BotMeta.attachments(attached))));
            if (firstQuestion && untitled(chat.getTitle())) {
                chat.setTitle(titleFrom(text.isEmpty() ? attached.getFirst().name() : text));
            }
            chat.setUpdatedAt(Instant.now());
            chats.save(chat);
            return new Turn(userId, chatId, clip(question, MAX_QUESTION_CHARS), scopeOf(chat, userId),
                    scopeLabel(chat, userId), history(previous, botMessages));
        } catch (RuntimeException e) {
            inFlight.remove(chatId);
            throw e;
        }
    }

    void answer(Turn turn, SseSink sink) {
        try {
            boolean filesReady = retriever.readyFiles(turn.scope()) > 0;
            String searchQuery = turn.question();
            if (filesReady) {
                QueryRewriter.Rewrite rewrite = rewriter.rewrite(turn.history(), turn.question());
                if (rewrite.model() != null) {
                    usage.record(turn.userId(), AiFeature.BOT_CHAT, rewrite.model(), rewrite.inputTokens(),
                            rewrite.outputTokens(), true);
                }
                searchQuery = rewrite.query();
            }
            sink.send("meta", new MetaEvent(turn.chatId(), searchQuery));

            List<RetrievedChunk> chunks = filesReady
                    ? retriever.retrieve(turn.scope(), searchQuery, TOP_K, AiFeature.BOT_CHAT).chunks()
                    : List.of();
            AnswerAccumulator answer = new AnswerAccumulator(chunks);
            stream(turn, chunks, filesReady, answer, sink);

            BotMessage saved = messages.save(newMessage(turn.chatId(), BotRole.BOT, answerText(answer),
                    botMessages.write(BotMeta.citations(answer.citations()))));
            usage.record(turn.userId(), AiFeature.BOT_CHAT, modelOf(answer), answer.inputTokens(),
                    answer.outputTokens(), succeeded(answer));
            touch(turn.userId(), turn.chatId());
            sink.send("done", new DoneEvent(botMessages.dto(saved)));
            sink.complete();
        } catch (TooManyRequestsException e) {
            fail(sink, "BUSY", e.getMessage());
        } catch (RateLimitException | InternalServerException | SseException e) {
            log.warn("Claude was busy: {}", e.getMessage());
            fail(sink, "BUSY", "StudilyBot is busy right now. Try again in a moment.");
        } catch (AnthropicIoException e) {
            log.warn("Could not reach Claude: {}", e.getMessage());
            fail(sink, "NETWORK", "Couldn't reach StudilyBot. Try again in a moment.");
        } catch (RuntimeException e) {
            log.warn("StudilyBot answer failed", e);
            fail(sink, "FAILED", "Something went wrong while answering. Try again.");
        } finally {
            inFlight.remove(turn.chatId());
        }
    }

    private void stream(Turn turn, List<RetrievedChunk> chunks, boolean filesReady, AnswerAccumulator answer,
                        SseSink sink) {
        MessageCreateParams params = prompts.build(turn.history(), chunks, turn.question(), turn.scopeLabel(),
                filesReady);
        try (StreamResponse<RawMessageStreamEvent> stream = claude.client().messages().createStreaming(params)) {
            Iterator<RawMessageStreamEvent> events = stream.stream().iterator();
            while (events.hasNext() && !sink.closed()) {
                for (String piece : answer.accept(events.next())) {
                    sink.send("delta", new DeltaEvent(piece));
                }
            }
        } catch (RuntimeException e) {
            usage.record(turn.userId(), AiFeature.BOT_CHAT, modelOf(answer), answer.inputTokens(),
                    answer.outputTokens(), false);
            throw e;
        }
    }

    private ChatDto detail(BotChat chat) {
        List<MessageDto> thread = messages.findByChatIdOrderByIdAsc(chat.getId()).stream()
                .map(botMessages::dto)
                .toList();
        return new ChatDto(chat.getId(), chat.getMode(), chat.getCourseId(), courseName(chat), chat.getTitle(),
                chat.getDifficulty(), chat.getUpdatedAt(), chat.getTopic(), chat.isTemporary(),
                chat.getParentChatId(), thread, bank.chatFiles(chat.getId()));
    }

    private ChatDto helpChat(long userId, long parentId) {
        BotChat parent = chats.findByIdAndUserId(parentId, userId)
                .orElseThrow(() -> new NotFoundException("Chat not found"));
        if (parent.getMode() != BotMode.PRACTICE) {
            throw new BadRequestException("Help chats start from a practice session.");
        }
        BotChat help = chats.findFirstByParentChatIdAndUserIdOrderByIdDesc(parentId, userId).orElseGet(() -> {
            BotChat created = new BotChat();
            created.setUserId(userId);
            created.setMode(BotMode.CHAT);
            created.setCourseId(parent.getCourseId());
            created.setTitle(HELP_CHAT_TITLE);
            created.setTemporary(true);
            created.setParentChatId(parent.getId());
            return chats.save(created);
        });
        return detail(help);
    }

    private BotChat owned(long chatId) {
        return chats.findByIdAndUserId(chatId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Chat not found"));
    }

    private Course requireCourse(long userId, Long courseId) {
        return courses.findByIdAndUserId(courseId, userId)
                .orElseThrow(() -> new NotFoundException("Course not found"));
    }

    private String courseName(BotChat chat) {
        if (chat.getCourseId() == null) {
            return null;
        }
        return courses.findByIdAndUserId(chat.getCourseId(), chat.getUserId())
                .map(BotChatService::courseLabel)
                .orElse(null);
    }

    private String scopeLabel(BotChat chat, long userId) {
        if (chat.getCourseId() == null) {
            return CHAT_FILES_SCOPE;
        }
        return courses.findByIdAndUserId(chat.getCourseId(), userId)
                .map(BotChatService::courseLabel)
                .orElse("this course");
    }

    private void touch(long userId, long chatId) {
        chats.findByIdAndUserId(chatId, userId).ifPresent(chat -> {
            chat.setUpdatedAt(Instant.now());
            chats.save(chat);
        });
    }

    private static Scope scopeOf(BotChat chat, long userId) {
        return chat.getCourseId() != null
                ? Scope.course(userId, chat.getCourseId())
                : Scope.chat(userId, chat.getId());
    }

    private static BotMessage newMessage(long chatId, BotRole role, String content, String meta) {
        BotMessage message = new BotMessage();
        message.setChatId(chatId);
        message.setRole(role);
        message.setContent(content);
        message.setMeta(meta);
        return message;
    }

    private List<AttachmentDto> attachments(BotChat chat, List<Long> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return List.of();
        }
        if (fileIds.size() > MAX_ATTACHMENTS) {
            throw new BadRequestException("Attach up to " + MAX_ATTACHMENTS + " files to one message.");
        }
        if (chat.isTemporary()) {
            throw new BadRequestException("Help chats can't take file uploads.");
        }
        List<BankFile> owned = bank.ownedFiles(fileIds);
        for (BankFile file : owned) {
            boolean inScope = chat.getCourseId() != null
                    ? chat.getCourseId().equals(file.getCourseId())
                    : chat.getId().equals(file.getChatId());
            if (!inScope) {
                throw new BadRequestException("Attach files from this chat's file bank.");
            }
        }
        return owned.stream().map(file -> new AttachmentDto(file.getId(), file.getName())).toList();
    }

    static String overviewQuestion(List<AttachmentDto> attached) {
        String names = String.join(", ", attached.stream().map(AttachmentDto::name).toList());
        return "I just added " + names + ". Give me a short overview of what's in it.";
    }

    private static List<HistoryTurn> history(List<BotMessage> previous, BotMessages botMessages) {
        List<HistoryTurn> turns = previous.stream()
                .map(message -> new HistoryTurn(message.getRole() == BotRole.USER, historyText(message, botMessages)))
                .toList();
        return turns.subList(Math.max(0, turns.size() - HISTORY_MESSAGES), turns.size());
    }

    private static String historyText(BotMessage message, BotMessages botMessages) {
        if (message.getRole() != BotRole.USER || !message.getContent().isBlank()) {
            return message.getContent();
        }
        BotMeta meta = botMessages.read(message.getMeta());
        if (meta == null || meta.attachments() == null || meta.attachments().isEmpty()) {
            return message.getContent();
        }
        return overviewQuestion(meta.attachments());
    }

    private static boolean untitled(String title) {
        return NEW_CHAT_TITLE.equals(title) || HELP_CHAT_TITLE.equals(title);
    }

    static String titleFrom(String question) {
        String oneLine = question.replaceAll("\\s+", " ").strip();
        return oneLine.length() > TITLE_CHARS ? oneLine.substring(0, TITLE_CHARS - 1) + "…" : oneLine;
    }

    static String clip(String text, int max) {
        return text.length() > max ? text.substring(0, max) : text;
    }

    static String courseLabel(Course course) {
        return course.getCode() == null || course.getCode().isBlank()
                ? course.getName()
                : course.getCode() + " — " + course.getName();
    }

    private static String answerText(AnswerAccumulator answer) {
        if (refused(answer)) {
            return REFUSED;
        }
        return answer.text().isBlank() ? EMPTY_ANSWER : answer.text();
    }

    private static boolean succeeded(AnswerAccumulator answer) {
        return answer.stopReason() != null && !refused(answer);
    }

    private static boolean refused(AnswerAccumulator answer) {
        return StopReason.REFUSAL.equals(answer.stopReason());
    }

    private String modelOf(AnswerAccumulator answer) {
        return answer.model() == null ? prompts.model() : answer.model();
    }

    private static void fail(SseSink sink, String code, String message) {
        sink.send("error", new ErrorEvent(code, message));
        sink.complete();
    }

    @PreDestroy
    void shutdown() {
        streams.shutdownNow();
    }
}
