package com.rnave.studily.feynman;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.feynman.ClaudeFeynmanTutor.Outcome;
import com.rnave.studily.feynman.FeynmanDtos.ReportDto;
import com.rnave.studily.feynman.FeynmanDtos.SessionDto;
import com.rnave.studily.feynman.FeynmanDtos.TurnDto;
import com.rnave.studily.flashcard.generate.StudyDocumentReader;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.CourseParseUsage;
import com.rnave.studily.parse.CourseParseUsageRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeynmanServiceTest {

    private ClaudeFeynmanTutor tutor;
    private FeynmanLimits limits;
    private StudyDocumentReader reader;
    private FeynmanSessionRepository sessions;
    private FeynmanDocumentRepository documents;
    private FeynmanMessageRepository messages;
    private FeynmanAssessmentRepository assessments;
    private CourseParseUsageRepository usage;
    private FeynmanService service;

    private final List<FeynmanDocument> savedDocs = new ArrayList<>();
    private final List<FeynmanMessage> savedMessages = new ArrayList<>();
    private final List<FeynmanAssessment> savedAssessments = new ArrayList<>();
    private User user;

    private static final FeynmanPlan PLAN = new FeynmanPlan("Newton's laws", List.of(
            new FeynmanPlan.Concept("Newton's first law", "Objects keep moving.", List.of("inertia"), List.of(), "Slide 2"),
            new FeynmanPlan.Concept("Newton's second law", "F = ma.", List.of("F = ma"), List.of(), "Slide 3")));

    @BeforeEach
    void setUp() {
        tutor = mock(ClaudeFeynmanTutor.class);
        limits = mock(FeynmanLimits.class);
        reader = mock(StudyDocumentReader.class);
        sessions = mock(FeynmanSessionRepository.class);
        documents = mock(FeynmanDocumentRepository.class);
        messages = mock(FeynmanMessageRepository.class);
        assessments = mock(FeynmanAssessmentRepository.class);
        usage = mock(CourseParseUsageRepository.class);
        user = new User();
        user.setId(7L);
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(7L);
        when(currentUser.entity()).thenReturn(user);
        when(tutor.enabled()).thenReturn(true);
        when(reader.readText(anyString(), any())).thenReturn("=== Slide 1 ===\nInertia means objects keep moving.");

        when(sessions.save(any())).thenAnswer(inv -> {
            FeynmanSession s = inv.getArgument(0);
            if (s.getId() == null) {
                s.setId(1L);
            }
            return s;
        });
        when(documents.save(any())).thenAnswer(inv -> {
            FeynmanDocument d = inv.getArgument(0);
            d.setId((long) savedDocs.size() + 1);
            savedDocs.add(d);
            return d;
        });
        when(documents.findBySessionIdOrderByIdAsc(anyLong())).thenAnswer(inv -> List.copyOf(savedDocs));
        when(messages.save(any())).thenAnswer(inv -> {
            FeynmanMessage m = inv.getArgument(0);
            m.setId((long) savedMessages.size() + 1);
            savedMessages.add(m);
            return m;
        });
        when(messages.findBySessionIdOrderByIdAsc(anyLong())).thenAnswer(inv -> List.copyOf(savedMessages));
        when(messages.countBySessionIdAndRole(anyLong(), eq(FeynmanRole.USER))).thenAnswer(inv ->
                savedMessages.stream().filter(m -> m.getRole() == FeynmanRole.USER).count());
        when(assessments.save(any())).thenAnswer(inv -> {
            FeynmanAssessment a = inv.getArgument(0);
            savedAssessments.add(a);
            return a;
        });
        when(assessments.findBySessionIdOrderByIdAsc(anyLong())).thenAnswer(inv -> List.copyOf(savedAssessments));

        service = new FeynmanService(tutor, limits, reader, sessions, documents, messages, assessments, usage,
                currentUser);
    }

    private static List<MultipartFile> files(String... names) {
        return Arrays.stream(names)
                .map(n -> (MultipartFile) new MockMultipartFile("files", n, "text/plain",
                        "Inertia means objects keep moving.".getBytes(StandardCharsets.UTF_8)))
                .toList();
    }

    private static <T> Outcome<T> ok(T result, String model) {
        return new Outcome<>(result, model, 1_000, 200, true, null);
    }

    private static <T> Outcome<T> failed() {
        return new Outcome<>(null, "claude-haiku-5-5", 0, 0, false, ClaudeFeynmanTutor.FAILED);
    }

    private static FeynmanTurn turn(String concept, Integer score, boolean complete, String... bubbles) {
        return new FeynmanTurn(concept != null, concept, score, List.of("missed inertia"), false,
                List.of(bubbles), complete);
    }

    private FeynmanSession activeSession() {
        FeynmanSession session = new FeynmanSession();
        session.setId(1L);
        session.setUser(user);
        session.setTitle("Newton's laws");
        session.setPlan(ClaudeFeynmanTutor.JSON.writeValueAsString(PLAN));
        when(sessions.findByIdAndUserId(1L, 7L)).thenReturn(Optional.of(session));
        return session;
    }

    @Test
    void start_rejectsWhenStudilyBotIsDisabled() {
        when(tutor.enabled()).thenReturn(false);

        assertThatThrownBy(() -> service.start(null, null, files("a.txt")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("isn't available");
        verify(tutor, never()).plan(anyString(), any());
    }

    @Test
    void start_rejectsNoFilesAndTooManyFiles() {
        assertThatThrownBy(() -> service.start(null, null, List.of()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Add your lecture");
        assertThatThrownBy(() -> service.start(null, null, files("a.txt", "b.txt", "c.txt", "d.txt")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("up to 3 files");
        verify(tutor, never()).plan(anyString(), any());
    }

    @Test
    void start_rejectsTooMuchMaterialBeforeCallingTheModel() {
        when(reader.readText(anyString(), any())).thenReturn("x".repeat(FeynmanService.MAX_MATERIAL_CHARS + 1));

        assertThatThrownBy(() -> service.start(null, null, files("a.txt")))
                .hasMessageContaining("too much material");
        verify(tutor, never()).plan(anyString(), any());
    }

    @Test
    void start_savesTheDocumentsPlanAndOpeningMessageAndRecordsUsage() {
        when(tutor.plan(anyString(), eq("only the first law"))).thenReturn(ok(PLAN, "claude-sonnet-5-5"));

        SessionDto dto = service.start("  ", "only the first law", files("lecture.txt"));

        verify(limits).check();
        assertThat(dto.title()).isEqualTo("Newton's laws");
        assertThat(dto.focus()).isEqualTo("only the first law");
        assertThat(dto.status()).isEqualTo(FeynmanStatus.ACTIVE);
        assertThat(dto.documents()).singleElement().satisfies(d -> {
            assertThat(d.fileName()).isEqualTo("lecture.txt");
            assertThat(d.chars()).isPositive();
        });
        assertThat(dto.messages()).singleElement().satisfies(m -> {
            assertThat(m.role()).isEqualTo(FeynmanRole.BOT);
            assertThat(m.body()).contains("Newton's first law").contains("2 ideas");
        });
        ArgumentCaptor<FeynmanSession> session = ArgumentCaptor.forClass(FeynmanSession.class);
        verify(sessions).save(session.capture());
        assertThat(session.getValue().getPlan()).contains("Newton's second law");
        ArgumentCaptor<CourseParseUsage> row = ArgumentCaptor.forClass(CourseParseUsage.class);
        verify(usage).save(row.capture());
        assertThat(row.getValue().getFeature()).isEqualTo(AiFeature.FEYNMAN);
        assertThat(row.getValue().getModel()).isEqualTo("claude-sonnet-5-5");
        assertThat(row.getValue().isSucceeded()).isTrue();
    }

    @Test
    void start_keepsTheStudentsTitleAndCapsTheConcepts() {
        List<FeynmanPlan.Concept> many = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            many.add(new FeynmanPlan.Concept("Concept " + i, "s", List.of(), List.of(), null));
        }
        when(tutor.plan(anyString(), any())).thenReturn(ok(new FeynmanPlan("Topic", many), "m"));

        SessionDto dto = service.start("My midterm review", null, files("a.txt"));

        assertThat(dto.title()).isEqualTo("My midterm review");
        ArgumentCaptor<FeynmanSession> session = ArgumentCaptor.forClass(FeynmanSession.class);
        verify(sessions).save(session.capture());
        FeynmanPlan stored = ClaudeFeynmanTutor.JSON.readValue(session.getValue().getPlan(), FeynmanPlan.class);
        assertThat(stored.concepts()).hasSize(FeynmanService.MAX_CONCEPTS);
    }

    @Test
    void start_failsWithoutSavingWhenThePlanHasNoConcepts() {
        when(tutor.plan(anyString(), any())).thenReturn(ok(new FeynmanPlan("Topic", List.of()), "m"));

        assertThatThrownBy(() -> service.start(null, null, files("a.txt")))
                .hasMessageContaining("couldn't find anything");
        verify(sessions, never()).save(any());
    }

    @Test
    void get_hidesOtherUsersSessions() {
        when(sessions.findByIdAndUserId(99L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(99L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(99L)).isInstanceOf(NotFoundException.class);
        verify(sessions, never()).delete(any());
    }

    @Test
    void send_savesTheMessagesAndAClampedAssessmentForAPlanConcept() {
        activeSession();
        when(tutor.turn(any(), any(), any(), eq("Things keep moving"))).thenReturn(
                ok(turn("  newton's FIRST law ", 140, false, "Nice!", "What about friction?"), "claude-haiku-5-5"));

        TurnDto dto = service.send(1L, "  Things keep moving ");

        assertThat(dto.messages()).extracting(FeynmanDtos.MessageDto::body)
                .containsExactly("Things keep moving", "Nice!", "What about friction?");
        assertThat(dto.status()).isEqualTo(FeynmanStatus.ACTIVE);
        assertThat(savedAssessments).singleElement().satisfies(a -> {
            assertThat(a.getConcept()).isEqualTo("Newton's first law");
            assertThat(a.getScore()).isEqualTo(100);
            assertThat(a.getGaps()).isEqualTo("missed inertia");
            assertThat(a.getMessage().getRole()).isEqualTo(FeynmanRole.USER);
        });
        verify(limits).check();
    }

    @Test
    void send_ignoresAnAssessmentForAConceptOutsideThePlan() {
        activeSession();
        when(tutor.turn(any(), any(), any(), anyString()))
                .thenReturn(ok(turn("Quantum tunnelling", 80, false, "Hmm"), "m"));

        service.send(1L, "Something else");

        assertThat(savedAssessments).isEmpty();
        assertThat(savedMessages).hasSize(2);
    }

    @Test
    void send_savesNothingWhenTheModelFails() {
        activeSession();
        when(tutor.turn(any(), any(), any(), anyString())).thenReturn(failed());

        assertThatThrownBy(() -> service.send(1L, "Things keep moving"))
                .isInstanceOf(BadRequestException.class);
        assertThat(savedMessages).isEmpty();
        verify(usage, never()).save(any());
    }

    @Test
    void send_rejectsAFinishedSession() {
        FeynmanSession session = activeSession();
        session.setStatus(FeynmanStatus.COMPLETE);

        assertThatThrownBy(() -> service.send(1L, "hi"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("finished");
        verify(tutor, never()).turn(any(), any(), any(), anyString());
    }

    @Test
    void send_passesOnlyChatMessagesAsHistory() {
        FeynmanSession session = activeSession();
        FeynmanMessage opening = new FeynmanMessage();
        opening.setSession(session);
        opening.setRole(FeynmanRole.BOT);
        opening.setBody("Let's start");
        savedMessages.add(opening);
        when(tutor.turn(any(), any(), any(), anyString())).thenReturn(ok(turn(null, null, false, "Go on"), "m"));

        service.send(1L, "Okay");

        ArgumentCaptor<List<ClaudeFeynmanTutor.HistoryLine>> history = ArgumentCaptor.forClass(List.class);
        verify(tutor).turn(any(), any(), history.capture(), eq("Okay"));
        assertThat(history.getValue()).containsExactly(
                new ClaudeFeynmanTutor.HistoryLine(FeynmanRole.BOT, "Let's start"));
    }

    @Test
    void send_finishesTheSessionWhenTheLectureIsComplete() {
        FeynmanSession session = activeSession();
        when(tutor.turn(any(), any(), any(), anyString()))
                .thenReturn(ok(turn("Newton's second law", 60, true, "That's everything!"), "m"));
        when(tutor.report(any(), any())).thenReturn(ok(new FeynmanReport("Good work.", List.of("F = ma"),
                List.of(new FeynmanReport.Gap("Newton's second law", "Mass matters"))), "m"));

        TurnDto dto = service.send(1L, "Force equals mass times acceleration");

        assertThat(dto.status()).isEqualTo(FeynmanStatus.COMPLETE);
        assertThat(dto.score()).isEqualTo(60);
        assertThat(dto.messages()).last().satisfies(m -> assertThat(m.kind()).isEqualTo(FeynmanKind.REPORT));
        assertThat(session.getStatus()).isEqualTo(FeynmanStatus.COMPLETE);
        assertThat(session.getScore()).isEqualTo(60);
    }

    @Test
    void send_keepsTheTurnWhenTheAutomaticReportFails() {
        FeynmanSession session = activeSession();
        when(tutor.turn(any(), any(), any(), anyString()))
                .thenReturn(ok(turn("Newton's second law", 60, true, "That's everything!"), "m"));
        when(tutor.report(any(), any())).thenReturn(failed());

        TurnDto dto = service.send(1L, "F = ma");

        assertThat(dto.status()).isEqualTo(FeynmanStatus.ACTIVE);
        assertThat(dto.messages()).hasSize(2);
        assertThat(session.getStatus()).isEqualTo(FeynmanStatus.ACTIVE);
    }

    @Test
    void finish_requiresAtLeastOneAssessment() {
        activeSession();

        assertThatThrownBy(() -> service.finish(1L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("at least one");
        verify(tutor, never()).report(any(), any());
    }

    @Test
    void finish_storesTheReportAsJsonWithTheComputedScore() {
        FeynmanSession session = activeSession();
        savedAssessments.add(assessment(session, "Newton's first law", 40, true));
        savedAssessments.add(assessment(session, "Newton's first law", 90, false));
        savedAssessments.add(assessment(session, "Newton's second law", 70, false));
        when(tutor.report(any(), any())).thenReturn(ok(new FeynmanReport("Solid.", null, null), "m"));

        TurnDto dto = service.finish(1L);

        assertThat(dto.score()).isEqualTo(80);
        ReportDto report = ClaudeFeynmanTutor.JSON.readValue(dto.messages().get(0).body(), ReportDto.class);
        assertThat(report.score()).isEqualTo(80);
        assertThat(report.summary()).isEqualTo("Solid.");
        assertThat(report.strengths()).isEmpty();
        assertThat(report.concepts()).extracting(FeynmanDtos.ConceptScoreDto::score).containsExactly(90, 70);
        assertThat(report.concepts().get(0).didNotKnow()).isTrue();
    }

    @Test
    void addDocuments_isOnlyAllowedBeforeTheStudentStartsExplaining() {
        FeynmanSession session = activeSession();
        FeynmanMessage student = new FeynmanMessage();
        student.setSession(session);
        student.setRole(FeynmanRole.USER);
        student.setBody("hi");
        savedMessages.add(student);

        assertThatThrownBy(() -> service.addDocuments(1L, files("more.txt")))
                .hasMessageContaining("before you start");
        verify(tutor, never()).plan(anyString(), any());
    }

    @Test
    void addDocuments_replansOverEveryFileAndResetsTheOpening() {
        activeSession();
        FeynmanDocument first = new FeynmanDocument();
        first.setFileName("first.txt");
        first.setContent("FIRST FILE TEXT");
        savedDocs.add(first);
        when(tutor.plan(anyString(), any())).thenReturn(ok(PLAN, "m"));

        service.addDocuments(1L, files("second.txt"));

        ArgumentCaptor<String> material = ArgumentCaptor.forClass(String.class);
        verify(tutor).plan(material.capture(), any());
        assertThat(material.getValue()).contains("FIRST FILE TEXT").contains("second.txt");
        assertThat(savedDocs).hasSize(2);
        verify(messages, times(1)).save(any());
    }

    @Test
    void send_rejectsASecondRequestWhileTheFirstIsRunning() throws Exception {
        activeSession();
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(tutor.turn(any(), any(), any(), anyString())).thenAnswer(inv -> {
            entered.countDown();
            release.await(5, TimeUnit.SECONDS);
            return ok(turn(null, null, false, "ok"), "m");
        });
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<TurnDto> first = pool.submit(() -> service.send(1L, "one"));
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();

            assertThatThrownBy(() -> service.send(1L, "two")).isInstanceOf(TooManyRequestsException.class);

            release.countDown();
            assertThat(first.get(5, TimeUnit.SECONDS).messages()).hasSize(2);
        } finally {
            pool.shutdownNow();
        }
    }

    private static FeynmanAssessment assessment(FeynmanSession session, String concept, int score, boolean didNotKnow) {
        FeynmanAssessment a = new FeynmanAssessment();
        a.setSession(session);
        a.setConcept(concept);
        a.setScore(score);
        a.setDidNotKnow(didNotKnow);
        return a;
    }
}
