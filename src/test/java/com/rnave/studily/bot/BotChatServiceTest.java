package com.rnave.studily.bot;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.ObjectMappers;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.services.blocking.MessageService;
import com.rnave.studily.bot.BotDtos.AttachmentDto;
import com.rnave.studily.bot.BotDtos.ChatDto;
import com.rnave.studily.bot.BotDtos.ChatSummaryDto;
import com.rnave.studily.bot.BotDtos.CitationDto;
import com.rnave.studily.bot.BotDtos.CreateChatRequest;
import com.rnave.studily.bot.BotDtos.MessageDto;
import com.rnave.studily.bot.BotDtos.StatusDto;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankFile;
import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.filebank.BankService;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.rag.ClaudeConnection;
import com.rnave.studily.rag.QueryRewriter;
import com.rnave.studily.rag.QueryRewriter.HistoryTurn;
import com.rnave.studily.rag.QueryRewriter.Rewrite;
import com.rnave.studily.rag.RetrievedChunk;
import com.rnave.studily.rag.Retriever;
import com.rnave.studily.rag.Retriever.Retrieval;
import com.rnave.studily.rag.Scope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BotChatServiceTest {

    private static final long USER = 7L;

    private static final RetrievedChunk CHUNK = new RetrievedChunk(11, 3, "Lecture 8.pdf", BankFileKind.LECTURE,
            true, 12, 12, "Power", "P = VI", 0.9);

    private static final String MESSAGE_START = """
            {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant",
             "model":"claude-haiku-5-5","content":[],"stop_reason":null,"stop_sequence":null,
             "usage":{"input_tokens":40,"output_tokens":1,"cache_read_input_tokens":0,
                      "cache_creation_input_tokens":0}}}""";
    private static final String TEXT_BLOCK = """
            {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}""";
    private static final String BLOCK_STOP = """
            {"type":"content_block_stop","index":0}""";
    private static final String END_TURN = """
            {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":9}}""";
    private static final String REFUSAL = """
            {"type":"message_delta","delta":{"stop_reason":"refusal","stop_sequence":null},"usage":{"output_tokens":3}}""";
    private static final String MESSAGE_STOP = """
            {"type":"message_stop"}""";

    private final Map<Long, BotChat> store = new HashMap<>();
    private final List<BotMessage> thread = new ArrayList<>();
    private long nextChatId = 1;
    private long nextMessageId = 1;

    private BotChatRepository chats;
    private BotMessageRepository messages;
    private CourseRepository courses;
    private CurrentUser currentUser;
    private BotLimits limits;
    private BankService bank;
    private QueryRewriter rewriter;
    private Retriever retriever;
    private ClaudeConnection claude;
    private MessageService messagesApi;
    private AiUsageRecorder usage;
    private JdbcTemplate jdbc;
    private BotMessages botMessages;
    private BotChatService service;

    @BeforeEach
    void setUp() {
        chats = mock(BotChatRepository.class);
        messages = mock(BotMessageRepository.class);
        courses = mock(CourseRepository.class);
        currentUser = mock(CurrentUser.class);
        limits = mock(BotLimits.class);
        bank = mock(BankService.class);
        rewriter = mock(QueryRewriter.class);
        retriever = mock(Retriever.class);
        claude = mock(ClaudeConnection.class);
        usage = mock(AiUsageRecorder.class);
        jdbc = mock(JdbcTemplate.class);
        messagesApi = mock(MessageService.class);
        botMessages = new BotMessages(JsonMapper.builder().build());

        AnthropicClient client = mock(AnthropicClient.class);
        when(client.messages()).thenReturn(messagesApi);
        when(claude.configured()).thenReturn(true);
        when(claude.client()).thenReturn(client);
        when(currentUser.id()).thenReturn(USER);
        when(bank.enabled()).thenReturn(true);
        when(retriever.readyFiles(any())).thenReturn(0L);
        when(retriever.retrieve(any(), anyString(), anyInt(), any())).thenReturn(new Retrieval(List.of()));
        when(rewriter.rewrite(anyList(), anyString()))
                .thenAnswer(inv -> new Rewrite(inv.getArgument(1), null, 0, 0));

        Course course = new Course();
        course.setId(5L);
        course.setName("Circuits");
        course.setCode("ENSC 220");
        when(courses.findByIdAndUserId(5L, USER)).thenReturn(Optional.of(course));
        when(courses.findByUserIdOrderByNameAsc(USER)).thenReturn(List.of(course));

        when(chats.save(any(BotChat.class))).thenAnswer(inv -> {
            BotChat chat = inv.getArgument(0);
            if (chat.getId() == null) {
                chat.setId(nextChatId++);
            }
            store.put(chat.getId(), chat);
            return chat;
        });
        when(chats.findByIdAndUserId(any(), any())).thenAnswer(inv -> {
            Long userId = inv.getArgument(1);
            return Optional.ofNullable(store.get(inv.<Long>getArgument(0)))
                    .filter(chat -> chat.getUserId().equals(userId));
        });
        when(chats.findFirstByParentChatIdAndUserIdOrderByIdDesc(any(), any())).thenAnswer(inv ->
                store.values().stream()
                        .filter(chat -> inv.<Long>getArgument(0).equals(chat.getParentChatId()))
                        .max(Comparator.comparing(BotChat::getId)));
        doAnswer(inv -> {
            store.remove(inv.<BotChat>getArgument(0).getId());
            return null;
        }).when(chats).delete(any());

        when(messages.save(any(BotMessage.class))).thenAnswer(inv -> {
            BotMessage message = inv.getArgument(0);
            if (message.getId() == null) {
                message.setId(nextMessageId++);
            }
            thread.add(message);
            return message;
        });
        when(messages.findByChatIdOrderByIdAsc(any())).thenAnswer(inv ->
                thread.stream().filter(message -> message.getChatId().equals(inv.<Long>getArgument(0))).toList());

        service = new BotChatService(chats, messages, courses, currentUser, limits, bank, rewriter, retriever,
                new ChatPromptBuilder("claude-haiku-5-5", 2048), claude, usage, botMessages, jdbc, true);
    }

    @Test
    void anotherUsersChatIsNotFoundForEveryAction() {
        BotChat theirs = chat(BotMode.CHAT, 5L, false);
        theirs.setUserId(99L);
        long id = theirs.getId();

        assertThatThrownBy(() -> service.get(id)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.rename(id, "Stolen")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(id)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.upload(id, List.of())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.send(id, "hi")).isInstanceOf(NotFoundException.class);

        verify(chats, never()).delete(any());
        verify(bank, never()).upload(any(), any(), any());
        verify(limits, never()).check(any());
        verify(claude, never()).client();
    }

    @Test
    void aMissingChatIsNotFoundBeforeAnyLimitOrModelCall() {
        assertThatThrownBy(() -> service.send(999L, "hi")).isInstanceOf(NotFoundException.class);

        verify(limits, never()).check(any());
        verify(claude, never()).client();
        assertThat(thread).isEmpty();
    }

    @Test
    void limitsAreCheckedBeforeAnyModelCallOrSavedMessage() {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(retriever.readyFiles(any())).thenReturn(2L);
        doThrow(new TooManyRequestsException("StudilyBot is resting for today.")).when(limits).check(BotMode.CHAT);

        assertThatThrownBy(() -> service.send(chat.getId(), "What is power?"))
                .isInstanceOf(TooManyRequestsException.class);

        verify(rewriter, never()).rewrite(any(), any());
        verify(retriever, never()).retrieve(any(), any(), anyInt(), any());
        verify(claude, never()).client();
        assertThat(thread).isEmpty();
    }

    @Test
    void helpChatsOnlyStartFromAPracticeSessionAndAreReused() {
        BotChat chatMode = chat(BotMode.CHAT, 5L, false);
        BotChat practice = chat(BotMode.PRACTICE, 5L, false);

        assertThatThrownBy(() -> service.create(new CreateChatRequest(null, chatMode.getId())))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(new CreateChatRequest(null, 999L)))
                .isInstanceOf(NotFoundException.class);

        ChatDto help = service.create(new CreateChatRequest(null, practice.getId()));
        assertThat(help.temporary()).isTrue();
        assertThat(help.mode()).isEqualTo(BotMode.CHAT);
        assertThat(help.parentChatId()).isEqualTo(practice.getId());
        assertThat(help.courseId()).isEqualTo(5L);

        ChatDto again = service.create(new CreateChatRequest(null, practice.getId()));
        assertThat(again.id()).isEqualTo(help.id());

        assertThatThrownBy(() -> service.upload(help.id(), List.of())).isInstanceOf(BadRequestException.class);
        verify(bank, never()).upload(any(), any(), any());
    }

    @Test
    void uploadsGoToTheCourseBankOrTheChatsOwnBankAfterTheOwnershipCheck() {
        BotChat inCourse = chat(BotMode.CHAT, 5L, false);
        BotChat loose = chat(BotMode.CHAT, null, false);
        List<MultipartFile> files = List.of();

        service.upload(inCourse.getId(), files);
        service.upload(loose.getId(), files);

        verify(bank).upload(Scope.course(USER, 5L), files, null);
        verify(bank).upload(Scope.chat(USER, loose.getId()), files, null);
    }

    @Test
    void rewriteUsageIsRecordedAndTheQuestionIsClippedBeforeItIsUsed() throws Exception {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(retriever.readyFiles(Scope.course(USER, 5L))).thenReturn(2L);
        when(rewriter.rewrite(anyList(), anyString())).thenReturn(
                new Rewrite("power formula P = VI", "claude-haiku-5-5", 120, 9));
        when(retriever.retrieve(any(), anyString(), anyInt(), any())).thenReturn(new Retrieval(List.of(CHUNK)));
        replyWith(MESSAGE_START, TEXT_BLOCK, textDelta("Power is P = VI."), BLOCK_STOP, END_TURN, MESSAGE_STOP);

        service.answer(service.open(chat.getId(), "x".repeat(2500)), sink());

        verify(rewriter).rewrite(anyList(), eq("x".repeat(2000)));
        verify(usage).record(USER, AiFeature.BOT_CHAT, "claude-haiku-5-5", 120, 9, true);
        verify(retriever).retrieve(Scope.course(USER, 5L), "power formula P = VI", 8, AiFeature.BOT_CHAT);
        verify(usage).record(USER, AiFeature.BOT_CHAT, "claude-haiku-5-5", 40, 9, true);
    }

    @Test
    void onlyTheLastEightEarlierMessagesReachTheRewriter() throws Exception {
        BotChat chat = chat(BotMode.CHAT, null, false);
        for (int i = 0; i < 10; i++) {
            seed(chat.getId(), i % 2 == 0 ? BotRole.USER : BotRole.BOT, "m" + i);
        }
        when(retriever.readyFiles(any())).thenReturn(1L);
        replyWith(MESSAGE_START, TEXT_BLOCK, textDelta("ok"), BLOCK_STOP, END_TURN, MESSAGE_STOP);

        service.answer(service.open(chat.getId(), "latest"), sink());

        ArgumentCaptor<List<HistoryTurn>> history = ArgumentCaptor.forClass(List.class);
        verify(rewriter).rewrite(history.capture(), eq("latest"));
        assertThat(history.getValue()).hasSize(BotChatService.HISTORY_MESSAGES);
        assertThat(history.getValue().getFirst().text()).isEqualTo("m2");
        assertThat(history.getValue().getLast().text()).isEqualTo("m9");
    }

    @Test
    void citationsArePersistedOnTheBotMessageAndComeBackOnTheChat() throws Exception {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(retriever.readyFiles(any())).thenReturn(1L);
        when(retriever.retrieve(any(), anyString(), anyInt(), any())).thenReturn(new Retrieval(List.of(CHUNK)));
        replyWith(MESSAGE_START, TEXT_BLOCK, citationDelta(0, "P = VI"), textDelta("Power is P = VI."),
                BLOCK_STOP, END_TURN, MESSAGE_STOP);

        service.answer(service.open(chat.getId(), "What is power?"), sink());

        BotMessage reply = thread.getLast();
        assertThat(reply.getRole()).isEqualTo(BotRole.BOT);
        assertThat(reply.getContent()).isEqualTo("Power is P = VI.");
        assertThat(reply.getMeta()).contains("Lecture 8.pdf").contains("\"secret\":null");

        MessageDto shown = service.get(chat.getId()).messages().getLast();
        assertThat(shown.citations()).containsExactly(new CitationDto(0, 3, "Lecture 8.pdf", 12, 12, "P = VI", true));
    }

    @Test
    void theTitleComesFromTheFirstQuestionClippedToSixtyCharacters() throws Exception {
        BotChat chat = chat(BotMode.CHAT, null, false);
        replyWith(MESSAGE_START, TEXT_BLOCK, textDelta("ok"), BLOCK_STOP, END_TURN, MESSAGE_STOP);
        service.answer(service.open(chat.getId(),
                        "  What is the difference between\n series and parallel circuits in a lab report?  "),
                sink());

        replyWith(MESSAGE_START, TEXT_BLOCK, textDelta("ok"), BLOCK_STOP, END_TURN, MESSAGE_STOP);
        service.answer(service.open(chat.getId(), "A later question"), sink());

        String title = store.get(chat.getId()).getTitle();
        assertThat(title).isEqualTo("What is the difference between series and parallel circuits…");
        assertThat(title).hasSize(60);
    }

    @Test
    void aRenamedChatKeepsItsTitleThroughTheFirstQuestion() throws Exception {
        BotChat chat = chat(BotMode.CHAT, null, false);
        service.rename(chat.getId(), "Exam prep");
        replyWith(MESSAGE_START, TEXT_BLOCK, textDelta("ok"), BLOCK_STOP, END_TURN, MESSAGE_STOP);

        service.answer(service.open(chat.getId(), "What is power?"), sink());

        assertThat(store.get(chat.getId()).getTitle()).isEqualTo("Exam prep");
    }

    @Test
    void oneAnswerInFlightPerChat() throws Exception {
        BotChat chat = chat(BotMode.CHAT, null, false);
        BotChatService.Turn first = service.open(chat.getId(), "first");

        assertThatThrownBy(() -> service.open(chat.getId(), "second")).isInstanceOf(TooManyRequestsException.class);
        assertThat(thread).hasSize(1);

        replyWith(MESSAGE_START, TEXT_BLOCK, textDelta("ok"), BLOCK_STOP, END_TURN, MESSAGE_STOP);
        service.answer(first, sink());

        assertThatCode(() -> service.open(chat.getId(), "third")).doesNotThrowAnyException();
    }

    @Test
    void withNoReadyFilesTheBotAnswersWithoutRetrievalAndSaysSo() throws Exception {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        replyWith(MESSAGE_START, TEXT_BLOCK, textDelta("Power is work per time."), BLOCK_STOP, END_TURN,
                MESSAGE_STOP);

        service.answer(service.open(chat.getId(), "What is power?"), sink());

        verify(retriever, never()).retrieve(any(), any(), anyInt(), any());
        verify(rewriter, never()).rewrite(any(), any());
        ArgumentCaptor<MessageCreateParams> params = ArgumentCaptor.forClass(MessageCreateParams.class);
        verify(messagesApi).createStreaming(params.capture());
        assertThat(params.getValue().system().orElseThrow().string().orElseThrow())
                .contains("No searchable files apply to this question");
        assertThat(thread.getLast().getContent()).isEqualTo("Power is work per time.");
    }

    @Test
    void aBusyRetrievalSavesNoAnswerAndReleasesTheChat() throws Exception {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(retriever.readyFiles(any())).thenReturn(1L);
        when(retriever.retrieve(any(), anyString(), anyInt(), any()))
                .thenThrow(new TooManyRequestsException("StudilyBot is busy, try again in a moment."));

        service.answer(service.open(chat.getId(), "What is power?"), sink());

        assertThat(thread).extracting(BotMessage::getRole).containsExactly(BotRole.USER);
        verify(messagesApi, never()).createStreaming(any(MessageCreateParams.class));
        assertThatCode(() -> service.open(chat.getId(), "again")).doesNotThrowAnyException();
    }

    @Test
    void aFailedModelCallRecordsAFailedUsageRowAndSavesNoAnswer() {
        BotChat chat = chat(BotMode.CHAT, null, false);
        when(messagesApi.createStreaming(any(MessageCreateParams.class)))
                .thenThrow(new IllegalStateException("upstream down"));

        service.answer(service.open(chat.getId(), "What is power?"), sink());

        verify(usage).record(USER, AiFeature.BOT_CHAT, "claude-haiku-5-5", 0, 0, false);
        assertThat(thread).extracting(BotMessage::getRole).containsExactly(BotRole.USER);
    }

    @Test
    void aRefusedAnswerIsSavedAsTheRefusalAndRecordedAsFailed() throws Exception {
        BotChat chat = chat(BotMode.CHAT, null, false);
        replyWith(MESSAGE_START, REFUSAL, MESSAGE_STOP);

        service.answer(service.open(chat.getId(), "something refused"), sink());

        assertThat(thread.getLast().getContent()).isEqualTo(BotChatService.REFUSED);
        verify(usage).record(USER, AiFeature.BOT_CHAT, "claude-haiku-5-5", 40, 3, false);
    }

    @Test
    void statusCountsTheUsersReadyFilesAndReportsWhatIsOn() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq(USER))).thenReturn(3L);
        when(limits.paused(BotMode.PRACTICE)).thenReturn(true);
        when(limits.remainingToday(BotMode.CHAT)).thenReturn(4);

        StatusDto status = service.status();

        assertThat(status.enabled()).isTrue();
        assertThat(status.readyFiles()).isEqualTo(3);
        assertThat(status.practicePaused()).isTrue();
        assertThat(status.chatPaused()).isFalse();
        assertThat(status.chatRemainingToday()).isEqualTo(4);

        when(bank.enabled()).thenReturn(false);
        assertThat(service.status().enabled()).isFalse();
    }

    @Test
    void listNamesTheCourseOfEachChat() {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(chats.findByUserIdAndModeAndTemporaryFalseOrderByUpdatedAtDesc(USER, BotMode.CHAT))
                .thenReturn(List.of(chat));

        List<ChatSummaryDto> list = service.list(BotMode.CHAT);

        assertThat(list).extracting(ChatSummaryDto::courseName).containsExactly("ENSC 220 — Circuits");
    }

    @Test
    void renameTrimsTheTitleAndDeleteRemovesTheChat() {
        BotChat chat = chat(BotMode.CHAT, null, false);

        ChatDto renamed = service.rename(chat.getId(), "  Exam prep  ");
        assertThat(renamed.title()).isEqualTo("Exam prep");

        service.delete(chat.getId());
        assertThatThrownBy(() -> service.get(chat.getId())).isInstanceOf(NotFoundException.class);
    }

    @Test
    void attachedFilesMustComeFromTheChatsOwnBank() {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(bank.ownedFiles(List.of(21L))).thenReturn(List.of(bankFile(21L, "Other.pdf", 6L, null)));

        assertThatThrownBy(() -> service.open(chat.getId(), "What is this?", List.of(21L)))
                .isInstanceOf(BadRequestException.class);

        assertThat(thread).isEmpty();
        verify(limits, never()).check(any());
    }

    @Test
    void someoneElsesFileIsNotFoundBeforeAnythingIsSaved() {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(bank.ownedFiles(List.of(21L))).thenThrow(new NotFoundException("File not found"));

        assertThatThrownBy(() -> service.open(chat.getId(), "hi", List.of(21L)))
                .isInstanceOf(NotFoundException.class);

        assertThat(thread).isEmpty();
    }

    @Test
    void aBlankMessageNeedsAnAttachment() {
        BotChat chat = chat(BotMode.CHAT, 5L, false);

        assertThatThrownBy(() -> service.open(chat.getId(), "   ", List.of()))
                .isInstanceOf(BadRequestException.class);

        assertThat(thread).isEmpty();
        verify(limits, never()).check(any());
    }

    @Test
    void anAttachmentOnlyMessageAsksForAnOverviewAndKeepsTheFilesOnTheMessage() {
        BotChat chat = chat(BotMode.CHAT, 5L, false);
        when(bank.ownedFiles(List.of(21L))).thenReturn(List.of(bankFile(21L, "Lecture 9.pdf", 5L, null)));

        BotChatService.Turn turn = service.open(chat.getId(), "  ", List.of(21L));

        assertThat(turn.question()).contains("Lecture 9.pdf");
        BotMessage sent = thread.getFirst();
        assertThat(sent.getContent()).isEmpty();
        assertThat(store.get(chat.getId()).getTitle()).isEqualTo("Lecture 9.pdf");
        MessageDto shown = service.get(chat.getId()).messages().getFirst();
        assertThat(shown.attachments()).containsExactly(new AttachmentDto(21L, "Lecture 9.pdf"));
    }

    @Test
    void aChatWithNoCourseTakesFilesFromItsOwnBank() {
        BotChat loose = chat(BotMode.CHAT, null, false);
        when(bank.ownedFiles(List.of(22L))).thenReturn(List.of(bankFile(22L, "notes.md", null, loose.getId())));

        BotChatService.Turn turn = service.open(loose.getId(), "Summarise", List.of(22L));

        assertThat(turn.question()).isEqualTo("Summarise");
        assertThat(service.get(loose.getId()).messages().getFirst().attachments())
                .containsExactly(new AttachmentDto(22L, "notes.md"));
    }

    @Test
    void aChatWithNoCourseAdoptsOneAndBringsItsFilesAlong() {
        BotChat loose = chat(BotMode.CHAT, null, false);

        ChatDto moved = service.setCourse(loose.getId(), 5L);

        assertThat(moved.courseId()).isEqualTo(5L);
        assertThat(store.get(loose.getId()).getCourseId()).isEqualTo(5L);
        verify(bank).moveChatFilesToCourse(USER, loose.getId(), 5L);
    }

    @Test
    void onlyAPlainChatWithoutACourseCanAdoptAnOwnedCourse() {
        BotChat inCourse = chat(BotMode.CHAT, 5L, false);
        BotChat help = chat(BotMode.CHAT, null, true);
        BotChat practice = chat(BotMode.PRACTICE, null, false);
        BotChat loose = chat(BotMode.CHAT, null, false);
        when(courses.findByIdAndUserId(8L, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setCourse(inCourse.getId(), 6L)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.setCourse(help.getId(), 5L)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.setCourse(practice.getId(), 5L)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.setCourse(loose.getId(), 8L)).isInstanceOf(NotFoundException.class);
        assertThat(service.setCourse(inCourse.getId(), 5L).courseId()).isEqualTo(5L);

        assertThat(store.get(loose.getId()).getCourseId()).isNull();
        verify(bank, never()).moveChatFilesToCourse(anyLong(), anyLong(), anyLong());
    }

    private static BankFile bankFile(long id, String name, Long courseId, Long chatId) {
        BankFile file = new BankFile();
        file.setId(id);
        file.setUserId(USER);
        file.setName(name);
        file.setCourseId(courseId);
        file.setChatId(chatId);
        return file;
    }

    private BotChat chat(BotMode mode, Long courseId, boolean temporary) {
        BotChat chat = new BotChat();
        chat.setUserId(USER);
        chat.setMode(mode);
        chat.setCourseId(courseId);
        chat.setTitle("New chat");
        chat.setTemporary(temporary);
        return chats.save(chat);
    }

    private void seed(long chatId, BotRole role, String content) {
        BotMessage message = new BotMessage();
        message.setId(nextMessageId++);
        message.setChatId(chatId);
        message.setRole(role);
        message.setContent(content);
        thread.add(message);
    }

    private void replyWith(String... events) throws Exception {
        List<RawMessageStreamEvent> parsed = new ArrayList<>();
        for (String json : events) {
            parsed.add(ObjectMappers.jsonMapper().readValue(json, RawMessageStreamEvent.class));
        }
        StreamResponse<RawMessageStreamEvent> response = mock(StreamResponse.class);
        when(response.stream()).thenReturn(parsed.stream());
        when(messagesApi.createStreaming(any(MessageCreateParams.class))).thenReturn(response);
    }

    private static SseSink sink() {
        return new SseSink(new SseEmitter());
    }

    private static String textDelta(String text) {
        return """
                {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"%s"}}"""
                .formatted(text);
    }

    private static String citationDelta(int searchResultIndex, String citedText) {
        return """
                {"type":"content_block_delta","index":0,"delta":{"type":"citations_delta","citation":{
                 "type":"search_result_location","source":"studily:file/3#chunk-11","title":"Lecture 8.pdf, p. 12",
                 "cited_text":"%s","search_result_index":%d,"start_block_index":0,"end_block_index":1}}}"""
                .formatted(citedText, searchResultIndex);
    }
}
