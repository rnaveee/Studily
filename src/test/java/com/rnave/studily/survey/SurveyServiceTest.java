package com.rnave.studily.survey;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.progress.Badge;
import com.rnave.studily.progress.BadgeRepository;
import com.rnave.studily.progress.BadgeService;
import com.rnave.studily.progress.BadgeSource;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ChestTier;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserBadge;
import com.rnave.studily.progress.UserBadgeRepository;
import com.rnave.studily.progress.UserProgress;
import com.rnave.studily.survey.SurveyDtos.SubmitRequest;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SurveyServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-23T18:00:00Z");

    private ProgressService progressService;
    private BadgeService badgeService;
    private BadgeRepository badgeRepository;
    private UserBadgeRepository userBadgeRepository;
    private SurveyResponseRepository responseRepository;
    private SurveyAnswerRepository answerRepository;
    private SurveyPromptViews promptViews;
    private User user;
    private SurveyService service;

    @BeforeEach
    void setUp() {
        progressService = mock(ProgressService.class);
        badgeService = mock(BadgeService.class);
        badgeRepository = mock(BadgeRepository.class);
        userBadgeRepository = mock(UserBadgeRepository.class);
        responseRepository = mock(SurveyResponseRepository.class);
        answerRepository = mock(SurveyAnswerRepository.class);
        promptViews = mock(SurveyPromptViews.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        user = new User();
        user.setId(4L);
        user.setEmailVerified(true);
        user.setCreatedAt(NOW.minusSeconds(10 * 86_400L));
        when(currentUser.entity()).thenReturn(user);
        UserProgress progress = new UserProgress();
        progress.setUserId(4L);
        when(progressService.begin(4L)).thenAnswer(inv -> new ProgressDeltaBuilder(progress));
        service = newService(true);
    }

    private SurveyService newService(boolean open) {
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.entity()).thenReturn(user);
        when(currentUser.id()).thenReturn(4L);
        return new SurveyService(currentUser, progressService, badgeService, badgeRepository, userBadgeRepository,
                responseRepository, answerRepository, promptViews, Clock.fixed(NOW, ZoneOffset.UTC), open);
    }

    @Test
    void statusReportsWhetherThePromptWasShown() {
        when(promptViews.seen(4L, "fall-2026")).thenReturn(true);

        assertThat(service.status().promptSeen()).isTrue();
    }

    @Test
    void markPromptSeenRecordsItForTheCurrentSurvey() {
        service.markPromptSeen();

        verify(promptViews).markSeen(4L, "fall-2026");
    }

    private static Map<String, Object> usage(String value) {
        Map<String, Object> rows = new LinkedHashMap<>();
        SurveyDefinition.FALL_2026.byId().get("usage").rows().forEach(row -> rows.put(row.id(), value));
        return rows;
    }

    private static Map<String, Object> validAnswers() {
        Map<String, Object> answers = new LinkedHashMap<>();
        answers.put("year", "2nd year");
        answers.put("found", "Reddit");
        answers.put("frequency", "About once a day");
        answers.put("usage", usage("Sometimes"));
        answers.put("favourite", "flashcards");
        answers.put("other_apps", List.of("Notion"));
        answers.put("trouble", "No");
        answers.put("ease", 4);
        answers.put("roadmap", List.of("Notes"));
        answers.put("disappointed", "Very disappointed");
        answers.put("recommend", 9);
        answers.put("pay", "No, I'd stick with free");
        answers.put("contact", "No");
        return answers;
    }

    private SubmitRequest request(Map<String, Object> answers) {
        return new SubmitRequest("fall-2026", "ios", true, answers);
    }

    @Test
    void submit_unknownQuestion_isRejected() {
        Map<String, Object> answers = validAnswers();
        answers.put("nope", "x");

        assertThatThrownBy(() -> service.submit(request(answers))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void submit_optionNotInDefinition_isRejected() {
        Map<String, Object> answers = validAnswers();
        answers.put("year", "5th year");

        assertThatThrownBy(() -> service.submit(request(answers))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void submit_missingRequiredQuestion_isRejected() {
        Map<String, Object> answers = validAnswers();
        answers.remove("frequency");

        assertThatThrownBy(() -> service.submit(request(answers))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void submit_hiddenConditionalQuestionsAreNotRequiredAndTheirAnswersAreIgnored() {
        Map<String, Object> answers = validAnswers();
        answers.put("trouble_what", List.of("It was slow"));
        answers.put("price", "$2 a month");

        service.submit(request(answers));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SurveyAnswer>> saved = ArgumentCaptor.forClass(List.class);
        verify(answerRepository).saveAll(saved.capture());
        List<String> questions = saved.getValue().stream().map(SurveyAnswer::getQuestion).toList();
        assertThat(questions).doesNotContain("trouble_what", "price", "stopped_why", "found_other");
        assertThat(questions).contains("year", "usage", "favourite", "contact");
    }

    @Test
    void submit_visibleConditionalQuestionIsRequired() {
        Map<String, Object> answers = validAnswers();
        answers.put("trouble", "Yes, a little");

        assertThatThrownBy(() -> service.submit(request(answers))).isInstanceOf(BadRequestException.class);

        answers.put("trouble_what", List.of("It was slow"));
        service.submit(request(answers));
    }

    @Test
    void submit_moreThanThreeRoadmapPicks_isRejected() {
        Map<String, Object> answers = validAnswers();
        answers.put("roadmap", List.of("Notes", "Grade & GPA tracker", "Exam countdowns & study plans", "Other"));

        assertThatThrownBy(() -> service.submit(request(answers))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void submit_favouriteMustBeARowRatedOftenOrSometimes() {
        Map<String, Object> answers = validAnswers();
        Map<String, Object> rows = usage("Never tried");
        rows.put("flashcards", "Often");
        answers.put("usage", rows);
        answers.put("favourite", "calendar");

        assertThatThrownBy(() -> service.submit(request(answers))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void submit_scaleOutOfRange_isRejected() {
        Map<String, Object> answers = validAnswers();
        answers.put("recommend", 11);

        assertThatThrownBy(() -> service.submit(request(answers))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void submit_longTextIsTrimmedAndCapped() {
        Map<String, Object> answers = validAnswers();
        answers.put("one_thing", "  " + "a".repeat(1500) + "  ");
        answers.put("benefit", "   ");

        service.submit(request(answers));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SurveyAnswer>> saved = ArgumentCaptor.forClass(List.class);
        verify(answerRepository).saveAll(saved.capture());
        List<SurveyAnswer> rows = new ArrayList<>(saved.getValue());
        assertThat(rows).filteredOn(a -> a.getQuestion().equals("one_thing"))
                .singleElement().satisfies(a -> assertThat(a.getValue()).hasSize(1000));
        assertThat(rows).noneMatch(a -> a.getQuestion().equals("benefit"));
    }

    @Test
    void submit_duplicate_isAConflict() {
        when(responseRepository.existsByUserIdAndSurveyKey(4L, "fall-2026")).thenReturn(true);

        assertThatThrownBy(() -> service.submit(request(validAnswers()))).isInstanceOf(ConflictException.class);
        verify(responseRepository, never()).saveAndFlush(any());
    }

    @Test
    void submit_unverifiedOrNewAccount_isForbidden() {
        user.setEmailVerified(false);
        assertThatThrownBy(() -> service.submit(request(validAnswers()))).isInstanceOf(ForbiddenException.class);

        user.setEmailVerified(true);
        user.setCreatedAt(NOW.minusSeconds(86_400L));
        assertThatThrownBy(() -> service.submit(request(validAnswers()))).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void submit_whenClosed_isForbidden() {
        SurveyService closed = newService(false);

        assertThatThrownBy(() -> closed.submit(request(validAnswers()))).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void submit_grantsTheDiamondChestAndFeedbackBadge() {
        Badge badge = new Badge();
        UserBadge owned = new UserBadge();
        when(badgeRepository.findById("feedback")).thenReturn(java.util.Optional.of(badge));
        when(badgeService.grant(4L, badge, BadgeSource.EARNED)).thenReturn(owned);
        when(userBadgeRepository.existsByUserIdAndBadgeCode(4L, "feedback")).thenReturn(false);

        service.submit(request(validAnswers()));

        verify(progressService).grantChest(any(), eq(ChestSource.SURVEY), eq("survey:fall-2026"), isNull(),
                eq(ChestTier.DIAMOND));
        verify(badgeService).grant(4L, badge, BadgeSource.EARNED);
        verify(badgeService).toDto(badge, owned);
    }

    @Test
    void submit_doesNotRegrantTheBadgeWhenAlreadyOwned() {
        when(userBadgeRepository.existsByUserIdAndBadgeCode(4L, "feedback")).thenReturn(true);

        service.submit(request(validAnswers()));

        verify(badgeService, never()).grant(any(), any(), any());
    }

    @Test
    void status_reportsEligibilityAndCompletion() {
        when(responseRepository.existsByUserIdAndSurveyKey(4L, "fall-2026")).thenReturn(true);

        SurveyDtos.SurveyDto status = service.status();

        assertThat(status.open()).isTrue();
        assertThat(status.eligible()).isTrue();
        assertThat(status.completed()).isTrue();
    }
}
