package com.rnave.studily.exam;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.GradeCategoryRepository;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.exam.ExamDtos.LinkRequest;
import com.rnave.studily.exam.ExamDtos.PlanDto;
import com.rnave.studily.exam.ExamDtos.UpcomingExamDto;
import com.rnave.studily.flashcard.Flashcard;
import com.rnave.studily.flashcard.FlashcardSet;
import com.rnave.studily.flashcard.FlashcardSetRepository;
import com.rnave.studily.todo.Todo;
import com.rnave.studily.todo.TodoRepository;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExamServiceTest {

    private AcademicItemRepository itemRepository;
    private GradeCategoryRepository categoryRepository;
    private ExamStudyLinkRepository linkRepository;
    private FlashcardSetRepository setRepository;
    private TodoRepository todoRepository;
    private CurrentUser currentUser;
    private ExamService service;

    private User user;
    private Course course;
    private AcademicItem exam;

    @BeforeEach
    void setUp() {
        itemRepository = mock(AcademicItemRepository.class);
        categoryRepository = mock(GradeCategoryRepository.class);
        linkRepository = mock(ExamStudyLinkRepository.class);
        setRepository = mock(FlashcardSetRepository.class);
        todoRepository = mock(TodoRepository.class);
        currentUser = mock(CurrentUser.class);
        service = new ExamService(itemRepository, categoryRepository, linkRepository, setRepository,
                todoRepository, currentUser, new UserTimeZones(mock(UserRepository.class), "UTC"));

        user = new User();
        user.setId(1L);
        when(currentUser.id()).thenReturn(1L);
        when(currentUser.entity()).thenReturn(user);

        course = new Course();
        course.setId(10L);
        course.setName("BIO 101");
        course.setUser(user);
        course.setTargetGrade(85.0);

        exam = item(5L, ItemType.EXAM, "Midterm", 40.0, null);
        exam.setDueAt(Instant.now().plus(3, ChronoUnit.DAYS).plus(2, ChronoUnit.HOURS));

        when(itemRepository.findByIdAndCourseUserId(5L, 1L)).thenReturn(Optional.of(exam));
        when(linkRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private AcademicItem item(long id, ItemType type, String title, Double weight, Double score) {
        AcademicItem i = new AcademicItem();
        i.setId(id);
        i.setCourse(course);
        i.setType(type);
        i.setTitle(title);
        i.setDueAt(Instant.now().minus(10, ChronoUnit.DAYS));
        i.setWeight(weight);
        i.setScore(score);
        i.setMaxScore(score == null ? null : 100.0);
        return i;
    }

    private FlashcardSet setWithCards(long id, int cards) {
        FlashcardSet set = new FlashcardSet();
        set.setId(id);
        set.setUser(user);
        set.setTitle("Cells");
        for (int n = 0; n < cards; n++) {
            Flashcard card = new Flashcard();
            card.setId(id * 100 + n);
            card.setSet(set);
            card.setFront("f" + n);
            card.setBack("b" + n);
            card.setDueAt(Instant.now());
            set.getCards().add(card);
        }
        return set;
    }

    @Test
    void upcomingComputesTheGradeNeededOnEachExam() {
        AcademicItem graded = item(6L, ItemType.ASSIGNMENT, "Quiz", 60.0, 80.0);
        when(itemRepository.findByCourseUserIdAndTypeAndStatusNotAndDueAtAfterOrderByDueAtAsc(
                any(), any(), any(), any())).thenReturn(List.of(exam));
        when(itemRepository.findByCourseIdOrderByDueAtAsc(10L)).thenReturn(List.of(graded, exam));
        when(categoryRepository.findByCourseIdOrderByPositionAscIdAsc(10L)).thenReturn(List.of());
        when(linkRepository.findByExamIdIn(any())).thenReturn(List.of());

        List<UpcomingExamDto> result = service.upcoming(null);

        assertThat(result).hasSize(1);
        UpcomingExamDto dto = result.get(0);
        assertThat(dto.daysLeft()).isBetween(3L, 4L);
        assertThat(dto.weight()).isEqualTo(40.0);
        assertThat(dto.currentPercent()).isEqualTo(80.0);
        assertThat(dto.targetGrade()).isEqualTo(85.0);
        assertThat(dto.neededPercent()).isCloseTo(92.5, org.assertj.core.api.Assertions.within(1e-9));
    }

    @Test
    void upcomingHasNoNeededGradeWithoutATarget() {
        course.setTargetGrade(null);
        AcademicItem graded = item(6L, ItemType.ASSIGNMENT, "Quiz", 60.0, 80.0);
        when(itemRepository.findByCourseUserIdAndTypeAndStatusNotAndDueAtAfterOrderByDueAtAsc(
                any(), any(), any(), any())).thenReturn(List.of(exam));
        when(itemRepository.findByCourseIdOrderByDueAtAsc(10L)).thenReturn(List.of(graded, exam));
        when(linkRepository.findByExamIdIn(any())).thenReturn(List.of());

        assertThat(service.upcoming(null).get(0).neededPercent()).isNull();
    }

    @Test
    void upcomingWithASemesterUsesTheSemesterQuery() {
        when(itemRepository.findByCourseUserIdAndCourseSemesterIdAndTypeAndStatusNotAndDueAtAfterOrderByDueAtAsc(
                any(), any(), any(), any(), any())).thenReturn(List.of());

        assertThat(service.upcoming(7L)).isEmpty();
        verify(itemRepository, never()).findByCourseUserIdAndTypeAndStatusNotAndDueAtAfterOrderByDueAtAsc(
                any(), any(), any(), any());
    }

    @Test
    void linkingASetPutsItsRemainingCardsInThePlan() {
        FlashcardSet set = setWithCards(20L, 8);
        when(setRepository.findByIdAndUserId(20L, 1L)).thenReturn(Optional.of(set));
        when(linkRepository.existsByExamIdAndFlashcardSetId(5L, 20L)).thenReturn(false);
        ExamStudyLink saved = new ExamStudyLink();
        saved.setId(99L);
        saved.setExam(exam);
        saved.setFlashcardSet(set);
        when(linkRepository.findByExamIdOrderByIdAsc(5L)).thenReturn(List.of(saved));

        PlanDto plan = service.link(5L, new LinkRequest(20L, null));

        verify(linkRepository).save(any());
        assertThat(plan.sets()).hasSize(1);
        assertThat(plan.sets().get(0).remainingCards()).isEqualTo(8);
        assertThat(plan.remainingCards()).isEqualTo(8);
        assertThat(plan.days()).isNotEmpty();
        assertThat(plan.days().get(0).today()).isTrue();
        assertThat(plan.todayCards()).isEqualTo(plan.days().get(0).cards());
    }

    @Test
    void cardsReviewedTodayDoNotCountAsRemaining() {
        FlashcardSet set = setWithCards(20L, 4);
        set.getCards().get(0).setLastReviewedAt(Instant.now());
        ExamStudyLink saved = new ExamStudyLink();
        saved.setId(99L);
        saved.setExam(exam);
        saved.setFlashcardSet(set);
        when(linkRepository.findByExamIdOrderByIdAsc(5L)).thenReturn(List.of(saved));

        assertThat(service.plan(5L).sets().get(0).remainingCards()).isEqualTo(3);
    }

    @Test
    void cardsDueAfterTheExamDoNotCountAsRemaining() {
        FlashcardSet set = setWithCards(20L, 4);
        set.getCards().get(0).setDueAt(exam.getDueAt().plus(1, ChronoUnit.DAYS));
        ExamStudyLink saved = new ExamStudyLink();
        saved.setId(99L);
        saved.setExam(exam);
        saved.setFlashcardSet(set);
        when(linkRepository.findByExamIdOrderByIdAsc(5L)).thenReturn(List.of(saved));

        assertThat(service.plan(5L).sets().get(0).remainingCards()).isEqualTo(3);
    }

    @Test
    void completedTasksStayLinkedButLeaveTheSchedule() {
        Todo open = todo(30L, "Read ch. 4", false);
        Todo done = todo(31L, "Past paper", true);
        ExamStudyLink a = todoLink(1L, open);
        ExamStudyLink b = todoLink(2L, done);
        when(linkRepository.findByExamIdOrderByIdAsc(5L)).thenReturn(List.of(a, b));

        PlanDto plan = service.plan(5L);

        assertThat(plan.todos()).hasSize(2);
        assertThat(plan.days().stream().flatMap(d -> d.todos().stream()).map(t -> t.todoId()))
                .containsExactly(30L);
    }

    @Test
    void anotherUsersExamIsNotFoundForEveryOperation() {
        when(itemRepository.findByIdAndCourseUserId(5L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.plan(5L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.link(5L, new LinkRequest(20L, null)))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.unlink(5L, 1L)).isInstanceOf(NotFoundException.class);
        verify(linkRepository, never()).save(any());
    }

    @Test
    void anItemThatIsNotAnExamIsNotFound() {
        exam.setType(ItemType.ASSIGNMENT);

        assertThatThrownBy(() -> service.plan(5L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anotherUsersFlashcardSetCannotBeLinked() {
        when(setRepository.findByIdAndUserId(20L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.link(5L, new LinkRequest(20L, null)))
                .isInstanceOf(NotFoundException.class);
        verify(linkRepository, never()).save(any());
    }

    @Test
    void anotherUsersTaskCannotBeLinked() {
        when(todoRepository.findByIdAndUserId(30L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.link(5L, new LinkRequest(null, 30L)))
                .isInstanceOf(NotFoundException.class);
        verify(linkRepository, never()).save(any());
    }

    @Test
    void aLinkFromAnotherExamCannotBeUnlinked() {
        when(linkRepository.findByIdAndExamId(77L, 5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.unlink(5L, 77L)).isInstanceOf(NotFoundException.class);
        verify(linkRepository, never()).delete(any());
    }

    @Test
    void unlinkRemovesTheLink() {
        ExamStudyLink link = new ExamStudyLink();
        link.setId(77L);
        link.setExam(exam);
        when(linkRepository.findByIdAndExamId(77L, 5L)).thenReturn(Optional.of(link));

        service.unlink(5L, 77L);

        verify(linkRepository).delete(link);
    }

    @Test
    void linkingTheSameSetTwiceConflicts() {
        FlashcardSet set = setWithCards(20L, 2);
        when(setRepository.findByIdAndUserId(20L, 1L)).thenReturn(Optional.of(set));
        when(linkRepository.existsByExamIdAndFlashcardSetId(5L, 20L)).thenReturn(true);

        assertThatThrownBy(() -> service.link(5L, new LinkRequest(20L, null)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void linkNeedsExactlyOneTarget() {
        assertThatThrownBy(() -> service.link(5L, new LinkRequest(null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.link(5L, new LinkRequest(20L, 30L)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void todayTargetIsNullWithoutLinksAndDescribesTheDayWithThem() {
        when(linkRepository.findByExamIdOrderByIdAsc(5L)).thenReturn(List.of());
        assertThat(service.todayTarget(exam, java.time.ZoneId.of("UTC"), Instant.now())).isNull();

        FlashcardSet set = setWithCards(20L, 9);
        ExamStudyLink link = new ExamStudyLink();
        link.setId(1L);
        link.setExam(exam);
        link.setFlashcardSet(set);
        when(linkRepository.findByExamIdOrderByIdAsc(5L)).thenReturn(List.of(link));

        assertThat(service.todayTarget(exam, java.time.ZoneId.of("UTC"), Instant.now()))
                .contains("review");
    }

    private Todo todo(long id, String title, boolean completed) {
        Todo t = new Todo();
        t.setId(id);
        t.setUser(user);
        t.setTitle(title);
        if (completed) {
            t.setCompletedAt(Instant.now());
        }
        return t;
    }

    private ExamStudyLink todoLink(long id, Todo todo) {
        ExamStudyLink link = new ExamStudyLink();
        link.setId(id);
        link.setExam(exam);
        link.setTodo(todo);
        return link;
    }
}
