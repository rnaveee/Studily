package com.rnave.studily.bot;

import com.rnave.studily.bot.BotDtos.AnswerResultDto;
import com.rnave.studily.bot.BotDtos.BotMeta;
import com.rnave.studily.bot.BotDtos.ChatDto;
import com.rnave.studily.bot.BotDtos.CitationDto;
import com.rnave.studily.bot.BotDtos.MessageDto;
import com.rnave.studily.bot.BotDtos.ProblemDto;
import com.rnave.studily.bot.BotDtos.ProblemSecret;
import com.rnave.studily.bot.BotDtos.StartPracticeRequest;
import com.rnave.studily.bot.BotDtos.Verdict;
import com.rnave.studily.bot.PracticeTutor.GradeDraft;
import com.rnave.studily.bot.PracticeTutor.Intent;
import com.rnave.studily.bot.PracticeTutor.Outcome;
import com.rnave.studily.bot.PracticeTutor.Photo;
import com.rnave.studily.bot.PracticeTutor.ProblemDraft;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankFileKind;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.rag.RetrievedChunk;
import com.rnave.studily.rag.Retriever;
import com.rnave.studily.rag.Scope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PracticeServiceTest {

    private static final long USER = 7L;
    private static final long COURSE = 3L;
    private static final String MODEL = "claude-sonnet-5-5";
    private static final String GRADE_MODEL = "claude-haiku-5-5";
    private static final long EIGHT_MB = 8L * 1024 * 1024;
    private static final String STATEMENT = "A 2 kg block accelerates at 2 m/s^2 on a frictionless floor. "
            + "What net force acts on it?";
    private static final String SOLUTION = "Newton's second law gives F = ma = 2 kg x 2 m/s^2 = 4 N.";
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00, 0x10};

    private BotChatRepository chats;
    private BotMessageRepository messages;
    private BotMessages botMessages;
    private CourseRepository courses;
    private Retriever retriever;
    private PracticeTutor tutor;
    private BotLimits limits;
    private AiUsageRecorder usage;
    private CurrentUser currentUser;
    private PracticeService service;

    private final List<BotChat> savedChats = new ArrayList<>();
    private final List<BotMessage> savedMessages = new ArrayList<>();
    private final List<RetrievedChunk> excerpts = List.of(
            new RetrievedChunk(101L, 11L, "Lecture 8.pdf", BankFileKind.LECTURE, true, 12, 12, "Moments",
                    "Torque is r times F.", 0.9),
            new RetrievedChunk(102L, 12L, "Exam 1.pdf", BankFileKind.PRACTICE_EXAM, true, 3, 4, null,
                    "A 2 kg block slides down a ramp.", 0.8),
            new RetrievedChunk(103L, 13L, "Notes.docx", BankFileKind.NOTES, false, null, null, null,
                    "Work equals force times distance.", null));

    @BeforeEach
    void setUp() {
        chats = mock(BotChatRepository.class);
        messages = mock(BotMessageRepository.class);
        botMessages = new BotMessages(JsonMapper.builder().build());
        courses = mock(CourseRepository.class);
        retriever = mock(Retriever.class);
        tutor = mock(PracticeTutor.class);
        limits = mock(BotLimits.class);
        usage = mock(AiUsageRecorder.class);
        currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(USER);
        when(tutor.enabled()).thenReturn(true);
        when(retriever.readyFiles(any())).thenReturn(4L);
        when(retriever.sample(any(), anyInt(), any())).thenReturn(excerpts);
        when(retriever.retrieve(any(), anyString(), anyInt(), any())).thenReturn(new Retriever.Retrieval(excerpts));

        Course course = new Course();
        course.setId(COURSE);
        course.setName("Physics 1");
        when(courses.findByIdAndUserId(COURSE, USER)).thenReturn(Optional.of(course));

        when(chats.save(any())).thenAnswer(inv -> {
            BotChat chat = inv.getArgument(0);
            if (chat.getId() == null) {
                chat.setId(200L + savedChats.size());
                savedChats.add(chat);
            }
            return chat;
        });
        when(messages.save(any())).thenAnswer(inv -> {
            BotMessage message = inv.getArgument(0);
            message.setId(300L + savedMessages.size());
            savedMessages.add(message);
            return message;
        });
        when(messages.findByChatIdOrderByIdAsc(anyLong())).thenAnswer(inv -> {
            long chatId = inv.getArgument(0);
            return savedMessages.stream().filter(m -> m.getChatId() == chatId).toList();
        });

        service = service(EIGHT_MB);
    }

    private PracticeService service(long maxPhotoBytes) {
        return new PracticeService(chats, messages, botMessages, courses, retriever, tutor, limits, usage,
                currentUser, maxPhotoBytes);
    }

    @Test
    void start_courseOwnedByAnotherUserIsA404() {
        when(courses.findByIdAndUserId(COURSE, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null)))
                .isInstanceOf(NotFoundException.class);
        verify(tutor, never()).problem(any(), any(), any(), any());
        verify(chats, never()).save(any());
    }

    @Test
    void start_withoutReadyFilesIsA400AndSavesNothing() {
        when(retriever.readyFiles(any())).thenReturn(0L);

        assertThatThrownBy(() -> service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(PracticeService.NO_FILES);
        verify(limits, never()).check(any());
        verify(tutor, never()).problem(any(), any(), any(), any());
        verify(chats, never()).save(any());
    }

    @Test
    void start_classModeSamplesPracticeExamsAndAssignmentsAndFlagsARealProblem() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", true, List.of(2)));

        ChatDto chat = service.start(new StartPracticeRequest(COURSE, Difficulty.CLASS, null));

        verify(retriever).sample(Scope.course(USER, COURSE), 10,
                Set.of(BankFileKind.PRACTICE_EXAM, BankFileKind.ASSIGNMENT));
        verify(retriever, never()).retrieve(any(), anyString(), anyInt(), any());
        ProblemDto problem = chat.messages().get(0).problem();
        assertThat(problem.fromClass()).isTrue();
        assertThat(problem.sources()).extracting(CitationDto::fileName).containsExactly("Exam 1.pdf");
    }

    @Test
    void start_studyModesSampleLecturesAndNotesInsteadOfPastWork() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        service.start(new StartPracticeRequest(COURSE, Difficulty.HARD, null));

        verify(retriever).sample(Scope.course(USER, COURSE), 10, Set.of(BankFileKind.LECTURE, BankFileKind.NOTES));
    }

    @Test
    void start_onlyClassModeCanBeFlaggedFromClass() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", true, List.of(1)));

        ChatDto chat = service.start(new StartPracticeRequest(COURSE, Difficulty.MEDIUM, null));

        assertThat(chat.messages().get(0).problem().fromClass()).isFalse();
    }

    @Test
    void start_withATopicRetrievesByTopicAndTitlesTheChatAfterIt() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        ChatDto chat = service.start(new StartPracticeRequest(COURSE, Difficulty.MEDIUM, "Torque"));

        verify(retriever).retrieve(Scope.course(USER, COURSE), "Torque", 10, AiFeature.BOT_PRACTICE);
        verify(retriever, never()).sample(any(), anyInt(), any());
        assertThat(chat.title()).isEqualTo("Torque");
        assertThat(chat.topic()).isEqualTo("Torque");
    }

    @Test
    void start_withoutATopicTitlesTheChatWithTheCourseAndDifficulty() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        ChatDto chat = service.start(new StartPracticeRequest(COURSE, Difficulty.MEDIUM, null));

        assertThat(chat.title()).isEqualTo("Physics 1 · Medium");
        assertThat(chat.courseId()).isEqualTo(COURSE);
        assertThat(chat.mode()).isEqualTo(BotMode.PRACTICE);
        assertThat(chat.difficulty()).isEqualTo(Difficulty.MEDIUM);
        assertThat(savedChats).hasSize(1);
        assertThat(savedChats.get(0).isTemporary()).isFalse();
    }

    @Test
    void start_topicWithNoMatchesIsA400BeforeAnyModelCall() {
        when(retriever.retrieve(any(), anyString(), anyInt(), any())).thenReturn(new Retriever.Retrieval(List.of()));

        assertThatThrownBy(() -> service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, "Quantum")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Quantum");
        verify(tutor, never()).problem(any(), any(), any(), any());
        verify(chats, never()).save(any());
    }

    @Test
    void start_savesTheSecretOnlyInTheMessageMeta() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        ChatDto chat = service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null));

        BotMessage problem = savedMessages.get(0);
        assertThat(problem.getKind()).isEqualTo(BotMessageKind.PROBLEM);
        assertThat(problem.getContent()).isEqualTo(STATEMENT);
        BotMeta meta = botMessages.read(problem.getMeta());
        assertThat(meta.secret()).isEqualTo(new ProblemSecret(SOLUTION, "4 N"));
        assertThat(meta.problem().number()).isEqualTo(1);
        assertThat(chat.messages()).singleElement().satisfies(message -> {
            assertThat(message.kind()).isEqualTo(BotMessageKind.PROBLEM);
            assertThat(message.content()).isEqualTo(STATEMENT);
        });
    }

    @Test
    void start_checksTheLimitBeforeRetrievingOrCallingClaude() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null));

        InOrder order = inOrder(limits, retriever, tutor);
        order.verify(limits).check(BotMode.PRACTICE);
        order.verify(retriever).sample(any(), anyInt(), any());
        order.verify(tutor).problem(any(), any(), any(), any());
    }

    @Test
    void start_aLimitHitStopsBeforeAnyModelCall() {
        doThrow(new TooManyRequestsException("StudilyBot is resting for today.")).when(limits)
                .check(BotMode.PRACTICE);

        assertThatThrownBy(() -> service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null)))
                .isInstanceOf(TooManyRequestsException.class);
        verify(retriever, never()).sample(any(), anyInt(), any());
        verify(tutor, never()).problem(any(), any(), any(), any());
    }

    @Test
    void start_recordsTheProblemUsageUnderBotPractice() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null));

        verify(usage).record(USER, AiFeature.BOT_PRACTICE, MODEL, 1_200, 800, true);
    }

    @Test
    void start_aFailedProblemIsBilledButNothingIsSaved() {
        when(tutor.problem(any(), any(), any(), any())).thenReturn(new Outcome<ProblemDraft>(null, MODEL, 900, 0));

        assertThatThrownBy(() -> service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(PracticeTutor.FAILED);
        verify(usage).record(USER, AiFeature.BOT_PRACTICE, MODEL, 900, 0, false);
        verify(chats, never()).save(any());
        assertThat(savedMessages).isEmpty();
    }

    @Test
    void start_aProblemWithoutASolutionIsRejected() {
        stubProblem(problemOutcome(STATEMENT, " ", "4 N", false, List.of(1)));

        assertThatThrownBy(() -> service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null)))
                .isInstanceOf(BadRequestException.class);
        verify(chats, never()).save(any());
    }

    @Test
    void start_citationsKeepOnlyRealExcerptNumbersOnce() {
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, Arrays.asList(2, 9, null, 2, 1)));

        ChatDto chat = service.start(new StartPracticeRequest(COURSE, Difficulty.MEDIUM, null));

        List<CitationDto> sources = chat.messages().get(0).problem().sources();
        assertThat(sources).extracting(CitationDto::index).containsExactly(2, 1);
        assertThat(sources.get(0).page()).isEqualTo(3);
        assertThat(sources.get(0).pageTo()).isEqualTo(4);
        assertThat(sources.get(0).previewable()).isTrue();
    }

    @Test
    void next_numbersTheProblemAndPassesEarlierStatementsAndTheTopic() {
        practiceChat(5L, Difficulty.MEDIUM, "Torque");
        seedProblem(5L, 1, "Earlier problem", "Old solution", "2 Nm");
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        MessageDto next = service.next(5L);

        assertThat(next.kind()).isEqualTo(BotMessageKind.PROBLEM);
        assertThat(next.problem().number()).isEqualTo(2);
        verify(retriever).retrieve(Scope.course(USER, COURSE), "Torque", 10, AiFeature.BOT_PRACTICE);
        verify(tutor).problem(eq(Difficulty.MEDIUM), eq("Torque"), any(), eq(List.of("Earlier problem")));
    }

    @Test
    void next_passesOnlyTheLastTwentyEarlierProblems() {
        practiceChat(5L, Difficulty.EASY, null);
        IntStream.rangeClosed(1, 25).forEach(i -> seedProblem(5L, i, "Problem " + i, SOLUTION, "4 N"));
        stubProblem(problemOutcome(STATEMENT, SOLUTION, "4 N", false, List.of(1)));

        MessageDto next = service.next(5L);

        assertThat(next.problem().number()).isEqualTo(26);
        List<String> expected = IntStream.rangeClosed(6, 25).mapToObj(i -> "Problem " + i).toList();
        verify(tutor).problem(any(), any(), any(), eq(expected));
    }

    @Test
    void next_ofAnotherUsersChatIsA404AndCallsNothing() {
        when(chats.findByIdAndUserId(9L, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.next(9L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.reveal(9L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.answer(9L, "4 N", null)).isInstanceOf(NotFoundException.class);
        verify(tutor, never()).problem(any(), any(), any(), any());
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void aChatThatIsNotPracticeIsA404() {
        BotChat chat = practiceChat(5L, Difficulty.EASY, null);
        chat.setMode(BotMode.CHAT);

        assertThatThrownBy(() -> service.next(5L)).isInstanceOf(NotFoundException.class);
        verify(tutor, never()).problem(any(), any(), any(), any());
    }

    @Test
    void reveal_savesAnIncorrectGradeCarryingTheSolution() {
        practiceChat(5L, Difficulty.EASY, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");

        MessageDto reveal = service.reveal(5L);

        assertThat(reveal.kind()).isEqualTo(BotMessageKind.GRADE);
        assertThat(reveal.role()).isEqualTo(BotRole.BOT);
        assertThat(reveal.grade().verdict()).isEqualTo(Verdict.INCORRECT);
        assertThat(reveal.grade().feedback()).isEqualTo("Here's the worked solution.");
        assertThat(reveal.grade().solution()).isEqualTo(SOLUTION);
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void reveal_withoutAProblemIsA400() {
        practiceChat(5L, Difficulty.EASY, null);

        assertThatThrownBy(() -> service.reveal(5L))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(PracticeService.NO_PROBLEM);
    }

    @Test
    void answer_aCorrectAnswerGetsAGradeWithTheSolution() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        stubGrade(gradeOutcome(Intent.ANSWER, Verdict.CORRECT, "Spot on.", List.of("F = ma with the right numbers")));

        AnswerResultDto result = service.answer(5L, " 4 N ", null);

        assertThat(result.userMessage().content()).isEqualTo("4 N");
        assertThat(result.grade().kind()).isEqualTo(BotMessageKind.GRADE);
        assertThat(result.grade().grade().verdict()).isEqualTo(Verdict.CORRECT);
        assertThat(result.grade().grade().solution()).isEqualTo(SOLUTION);
        assertThat(result.helpChatId()).isNull();
        assertThat(result.question()).isNull();
        verify(tutor).grade(STATEMENT, new ProblemSecret(SOLUTION, "4 N"), "4 N", null);
        verify(usage).record(USER, AiFeature.BOT_PRACTICE, GRADE_MODEL, 400, 120, true);
    }

    @Test
    void answer_partialAndIncorrectGradesNeverShowTheSolution() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");

        for (Verdict verdict : List.of(Verdict.PARTIAL, Verdict.INCORRECT)) {
            stubGrade(gradeOutcome(Intent.ANSWER, verdict, "Check your units.", List.of("Step one")));

            AnswerResultDto result = service.answer(5L, "2 N", null);

            assertThat(result.grade().grade().verdict()).isEqualTo(verdict);
            assertThat(result.grade().grade().solution()).isNull();
        }
    }

    @Test
    void answer_aQuestionOpensAHelpChatAndSavesNoGrade() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        stubGrade(gradeOutcome(Intent.QUESTION, Verdict.INCORRECT, "", List.of()));

        AnswerResultDto result = service.answer(5L, "What does net force mean?", null);

        assertThat(result.grade()).isNull();
        assertThat(result.question()).isEqualTo("What does net force mean?");
        assertThat(result.helpChatId()).isEqualTo(200L);
        assertThat(savedMessages).noneMatch(m -> m.getKind() == BotMessageKind.GRADE);
        assertThat(savedChats).hasSize(1);
        BotChat help = savedChats.get(0);
        assertThat(help.getMode()).isEqualTo(BotMode.CHAT);
        assertThat(help.isTemporary()).isTrue();
        assertThat(help.getParentChatId()).isEqualTo(5L);
        assertThat(help.getCourseId()).isEqualTo(COURSE);
        assertThat(help.getUserId()).isEqualTo(USER);
        assertThat(help.getTitle()).isEqualTo("Question about problem 1");
    }

    @Test
    void answer_aQuestionReusesTheExistingHelpChat() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        BotChat existing = new BotChat();
        existing.setId(77L);
        existing.setTemporary(true);
        existing.setParentChatId(5L);
        when(chats.findFirstByParentChatIdAndUserIdOrderByIdDesc(5L, USER)).thenReturn(Optional.of(existing));
        stubGrade(gradeOutcome(Intent.QUESTION, Verdict.INCORRECT, "", List.of()));

        AnswerResultDto result = service.answer(5L, "Why?", null);

        assertThat(result.helpChatId()).isEqualTo(77L);
        assertThat(savedChats).isEmpty();
    }

    @Test
    void answer_photoOnlyIsSentAsAJpegAndCaptionedInTheChat() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        stubGrade(gradeOutcome(Intent.ANSWER, Verdict.PARTIAL, "Check your units.", List.of()));
        MockMultipartFile photo = new MockMultipartFile("photo", "work.jpg", "image/jpeg", JPEG);

        AnswerResultDto result = service.answer(5L, null, photo);

        ArgumentCaptor<Photo> sent = ArgumentCaptor.forClass(Photo.class);
        verify(tutor).grade(eq(STATEMENT), any(ProblemSecret.class), isNull(), sent.capture());
        assertThat(sent.getValue().mimeType()).isEqualTo("image/jpeg");
        assertThat(sent.getValue().bytes()).isEqualTo(JPEG);
        assertThat(result.userMessage().content()).isEqualTo("📷 Photo of my work");
        assertThat(savedMessages)
                .filteredOn(m -> m.getRole() == BotRole.USER)
                .singleElement()
                .satisfies(m -> assertThat(m.getMeta()).isNull());
    }

    @Test
    void answer_rejectsAPhotoThatIsNotJpegPngOrWebpBeforeAnyModelCall() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        MockMultipartFile gif = new MockMultipartFile("photo", "work.gif", "image/gif",
                "GIF89a".getBytes(StandardCharsets.US_ASCII));

        assertThatThrownBy(() -> service.answer(5L, null, gif))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Photos must be JPEG, PNG or WebP.");
        verify(limits, never()).check(any());
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void answer_rejectsAPhotoOverTheSizeLimitBeforeAnyModelCall() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        PracticeService small = service(JPEG.length - 1);
        MockMultipartFile tooBig = new MockMultipartFile("photo", "work.jpg", "image/jpeg", JPEG);

        assertThatThrownBy(() -> small.answer(5L, null, tooBig))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("too big");
        verify(limits, never()).check(any());
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void answer_needsTextOrAPhoto() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");

        assertThatThrownBy(() -> service.answer(5L, "   ", null)).isInstanceOf(BadRequestException.class);
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void answer_aLimitHitStopsBeforeGradingAndSavesNothing() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        doThrow(new TooManyRequestsException("StudilyBot is resting for today.")).when(limits)
                .check(BotMode.PRACTICE);

        assertThatThrownBy(() -> service.answer(5L, "4 N", null)).isInstanceOf(TooManyRequestsException.class);
        verify(tutor, never()).grade(any(), any(), any(), any());
        assertThat(savedMessages).noneMatch(m -> m.getRole() == BotRole.USER);
    }

    @Test
    void answer_checksTheLimitBeforeGrading() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        stubGrade(gradeOutcome(Intent.ANSWER, Verdict.CORRECT, "Yes.", List.of()));

        service.answer(5L, "4 N", null);

        InOrder order = inOrder(limits, tutor);
        order.verify(limits).check(BotMode.PRACTICE);
        order.verify(tutor).grade(any(), any(), any(), any());
    }

    @Test
    void answer_aFailedGradeIsBilledAndNothingIsSaved() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");
        when(tutor.grade(any(), any(), any(), any()))
                .thenReturn(new Outcome<GradeDraft>(null, GRADE_MODEL, 500, 0));
        int before = savedMessages.size();

        assertThatThrownBy(() -> service.answer(5L, "4 N", null)).isInstanceOf(BadRequestException.class);
        verify(usage).record(USER, AiFeature.BOT_PRACTICE, GRADE_MODEL, 500, 0, false);
        assertThat(savedMessages).hasSize(before);
    }

    @Test
    void answer_textOverTheLimitIsRejectedBeforeGrading() {
        practiceChat(5L, Difficulty.MEDIUM, null);
        seedProblem(5L, 1, STATEMENT, SOLUTION, "4 N");

        assertThatThrownBy(() -> service.answer(5L, "x".repeat(4001), null)).isInstanceOf(BadRequestException.class);
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void answer_beforeAnyProblemIsA400() {
        practiceChat(5L, Difficulty.MEDIUM, null);

        assertThatThrownBy(() -> service.answer(5L, "4 N", null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage(PracticeService.NO_PROBLEM);
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void whenStudilyBotIsOffNothingRuns() {
        when(tutor.enabled()).thenReturn(false);

        assertThatThrownBy(() -> service.start(new StartPracticeRequest(COURSE, Difficulty.EASY, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.answer(5L, "4 N", null)).isInstanceOf(BadRequestException.class);
        verify(tutor, never()).problem(any(), any(), any(), any());
        verify(tutor, never()).grade(any(), any(), any(), any());
    }

    @Test
    void photoMimeReadsTheMagicBytes() {
        assertThat(PracticeService.photoMime(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0}))
                .isEqualTo("image/jpeg");
        assertThat(PracticeService.photoMime(new byte[]{(byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47,
                (byte) 0x0D, (byte) 0x0A, (byte) 0x1A, (byte) 0x0A})).isEqualTo("image/png");
        assertThat(PracticeService.photoMime("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo("image/webp");
        assertThat(PracticeService.photoMime("RIFF\u0000\u0000\u0000\u0000WAVEfmt ".getBytes(StandardCharsets.US_ASCII)))
                .isNull();
        assertThat(PracticeService.photoMime("GIF89a".getBytes(StandardCharsets.US_ASCII))).isNull();
        assertThat(PracticeService.photoMime(new byte[]{(byte) 0xFF, (byte) 0xD8})).isNull();
        assertThat(PracticeService.photoMime(new byte[0])).isNull();
    }

    private BotChat practiceChat(long id, Difficulty difficulty, String topic) {
        BotChat chat = new BotChat();
        chat.setId(id);
        chat.setUserId(USER);
        chat.setMode(BotMode.PRACTICE);
        chat.setCourseId(COURSE);
        chat.setTitle("Physics 1 · Medium");
        chat.setDifficulty(difficulty);
        chat.setTopic(topic);
        when(chats.findByIdAndUserId(id, USER)).thenReturn(Optional.of(chat));
        return chat;
    }

    private void seedProblem(long chatId, int number, String statement, String solution, String finalAnswer) {
        BotMessage message = new BotMessage();
        message.setId(900L + savedMessages.size());
        message.setChatId(chatId);
        message.setRole(BotRole.BOT);
        message.setKind(BotMessageKind.PROBLEM);
        message.setContent(statement);
        message.setMeta(botMessages.write(BotMeta.problem(new ProblemDto(number, statement, false, List.of()),
                new ProblemSecret(solution, finalAnswer))));
        savedMessages.add(message);
    }

    private static Outcome<ProblemDraft> problemOutcome(String statement, String solution, String finalAnswer,
                                                        boolean fromClass, List<Integer> sources) {
        return new Outcome<>(new ProblemDraft(statement, solution, finalAnswer, fromClass, sources), MODEL, 1_200,
                800);
    }

    private static Outcome<GradeDraft> gradeOutcome(Intent intent, Verdict verdict, String feedback,
                                                    List<String> steps) {
        return new Outcome<>(new GradeDraft(intent, verdict, feedback, steps), GRADE_MODEL, 400, 120);
    }

    private void stubProblem(Outcome<ProblemDraft> outcome) {
        when(tutor.problem(any(), any(), any(), any())).thenReturn(outcome);
    }

    private void stubGrade(Outcome<GradeDraft> outcome) {
        when(tutor.grade(any(), any(), any(), any())).thenReturn(outcome);
    }
}
