package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.GradeCategory;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.FeedImportDtos.ApplyRequest;
import com.rnave.studily.canvas.FeedImportDtos.ApplyResult;
import com.rnave.studily.canvas.FeedImportDtos.Conflict;
import com.rnave.studily.canvas.FeedImportDtos.CourseChoice;
import com.rnave.studily.canvas.FeedImportDtos.CourseDecision;
import com.rnave.studily.canvas.FeedImportDtos.CourseDecisions;
import com.rnave.studily.canvas.FeedImportDtos.ItemChoice;
import com.rnave.studily.canvas.FeedImportDtos.ItemDecision;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseMatcher;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.notification.NotificationRepository;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedImportConflictTest {

    private static final Instant MANUAL = Instant.parse("2026-10-02T07:00:00Z");
    private static final Instant CANVAS = Instant.parse("2026-10-03T06:59:00Z");

    private FeedImportRepository importRepository;
    private FeedImportStore store;
    private FeedIgnoredRefRepository ignoredRefRepository;
    private CourseRepository courseRepository;
    private AcademicItemRepository itemRepository;
    private CalendarEventRepository eventRepository;
    private FeedConflictService conflicts;
    private FeedImportService service;
    private User user;
    private FeedImport pending;
    private Course digitalLogic;

    @BeforeEach
    void setUp() {
        importRepository = mock(FeedImportRepository.class);
        store = new FeedImportStore(importRepository, JsonMapper.builder().build());
        ignoredRefRepository = mock(FeedIgnoredRefRepository.class);
        courseRepository = mock(CourseRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        eventRepository = mock(CalendarEventRepository.class);
        CourseService courseService = mock(CourseService.class);

        user = new User();
        user.setId(7L);

        digitalLogic = course(3L, "ENSC252", "ENSC 252");
        when(courseRepository.findByIdAndUserId(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(digitalLogic));
        when(courseRepository.findByUserIdOrderByNameAsc(7L)).thenReturn(List.of(digitalLogic));
        when(courseRepository.save(any(Course.class))).thenAnswer(inv -> inv.getArgument(0));
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(eventRepository.findByUserIdAndExternalUid(anyLong(), anyString())).thenReturn(Optional.empty());
        when(itemRepository.findByCourseIdOrderByDueAtAsc(anyLong())).thenReturn(List.of());
        when(eventRepository.findByUserIdAndCourseId(anyLong(), anyLong())).thenReturn(List.of());

        conflicts = new FeedConflictService(importRepository, store, courseRepository,
                new CourseMatcher(courseRepository), itemRepository, eventRepository);
        service = new FeedImportService(importRepository, store, ignoredRefRepository, courseService,
                courseRepository, mock(SemesterRepository.class), itemRepository, eventRepository,
                mock(NotificationRepository.class));

        pending = stored(canvasCourse(null, 3L, incoming("canvas-1", "Lab 2", CANVAS)));
    }

    private static Course course(long id, String name, String code) {
        Course c = new Course();
        c.setId(id);
        c.setName(name);
        c.setCode(code);
        return c;
    }

    private static StagedItem incoming(String uid, String title, Instant dueAt) {
        return new StagedItem(uid, uid, StagedKind.ITEM, ItemType.ASSIGNMENT, title, dueAt, null);
    }

    private static StagedCourse canvasCourse(Long linkedCourseId, Long matchCourseId, StagedItem... items) {
        return new StagedCourse("canvas:88", 88L, null, null, "Fundamentals of Digital Logic and Design",
                "ENSC252 D100", "#3b82f6", 9L, linkedCourseId, matchCourseId, new ArrayList<>(List.of(items)));
    }

    private FeedImport stored(StagedCourse course) {
        FeedImport entity = new FeedImport();
        entity.setId(5L);
        entity.setUser(user);
        entity.setProvider("CANVAS");
        entity.setPayload(store.write(new StagedPayload("CANVAS", 9L, List.of(course))));
        when(importRepository.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(entity));
        return entity;
    }

    private AcademicItem manualItem(long id, String title, Instant dueAt) {
        AcademicItem item = new AcademicItem();
        item.setId(id);
        item.setCourse(digitalLogic);
        item.setType(ItemType.ASSIGNMENT);
        item.setTitle(title);
        item.setDueAt(dueAt);
        item.setScore(8.0);
        item.setMaxScore(10.0);
        item.setWeight(5.0);
        item.setStatus(ItemStatus.DONE);
        when(itemRepository.findByCourseIdOrderByDueAtAsc(3L)).thenReturn(List.of(item));
        when(itemRepository.findByIdAndCourseUserId(id, 7L)).thenReturn(Optional.of(item));
        return item;
    }

    private static CourseDecisions decisions(CourseChoice choice) {
        return new CourseDecisions(List.of(new CourseDecision("canvas:88", choice, null, null)));
    }

    private static CourseDecision decision(CourseChoice choice) {
        return new CourseDecision("canvas:88", choice, null, null);
    }

    @Test
    void titlesMatchIgnoringCaseSpacingAndPunctuation() {
        assertThat(FeedConflictService.normalize("Lab 2")).isEqualTo(FeedConflictService.normalize("lab  2"));
        assertThat(FeedConflictService.normalize("Homework #1")).isEqualTo(FeedConflictService.normalize("homework 1"));
        assertThat(FeedConflictService.normalize("Lab 2")).isNotEqualTo(FeedConflictService.normalize("Lab 3"));
        assertThat(FeedConflictService.normalize(null)).isEmpty();
    }

    @Test
    void aMergedCourseFlagsTheManualItemWithTheSameTitle() {
        manualItem(40L, "lab  2", MANUAL);

        List<Conflict> found = conflicts.conflicts(7L, 5L, decisions(CourseChoice.MERGE));

        assertThat(found).hasSize(1);
        Conflict conflict = found.getFirst();
        assertThat(conflict.itemKey()).isEqualTo("canvas-1");
        assertThat(conflict.courseKey()).isEqualTo("canvas:88");
        assertThat(conflict.incoming().title()).isEqualTo("Lab 2");
        assertThat(conflict.existing().id()).isEqualTo(40L);
        assertThat(conflict.existing().kind()).isEqualTo(StagedKind.ITEM);
        assertThat(conflict.existing().dueAt()).isEqualTo(MANUAL);
        assertThat(conflict.existing().courseId()).isEqualTo(3L);
        assertThat(conflict.existing().courseCode()).isEqualTo("ENSC 252");
    }

    @Test
    void aDifferentTitleIsNotAConflict() {
        manualItem(40L, "Lab 3", MANUAL);

        assertThat(conflicts.conflicts(7L, 5L, decisions(CourseChoice.MERGE))).isEmpty();
    }

    @Test
    void addAnywayNextToASameCodeCourseStillFlagsItsItems() {
        manualItem(40L, "Lab 2", MANUAL);

        List<Conflict> found = conflicts.conflicts(7L, 5L, decisions(CourseChoice.ADD));

        assertThat(found).hasSize(1);
        assertThat(found.getFirst().existing().id()).isEqualTo(40L);
    }

    @Test
    void aLinkedCourseNeedsNoDecisionToBeChecked() {
        pending = stored(canvasCourse(3L, null, incoming("canvas-1", "Lab 2", CANVAS)));
        manualItem(40L, "Lab 2", MANUAL);

        List<Conflict> found = conflicts.conflicts(7L, 5L, new CourseDecisions(List.of()));

        assertThat(found).hasSize(1);
    }

    @Test
    void aSkippedCourseHasNoConflicts() {
        manualItem(40L, "Lab 2", MANUAL);

        assertThat(conflicts.conflicts(7L, 5L, decisions(CourseChoice.SKIP))).isEmpty();
    }

    @Test
    void anItemAlreadyImportedByUidIsNotAConflict() {
        manualItem(40L, "Lab 2", MANUAL);
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "canvas-1"))
                .thenReturn(Optional.of(new AcademicItem()));

        assertThat(conflicts.conflicts(7L, 5L, decisions(CourseChoice.MERGE))).isEmpty();
    }

    @Test
    void anExistingItemAlreadyCarryingTheSameUidIsNotAConflict() {
        AcademicItem item = manualItem(40L, "Lab 2", MANUAL);
        item.setExternalUid("canvas-1");

        assertThat(conflicts.conflicts(7L, 5L, decisions(CourseChoice.MERGE))).isEmpty();
    }

    @Test
    void anEventInTheCourseWithTheSameTitleIsAConflictToo() {
        CalendarEvent event = new CalendarEvent();
        event.setId(60L);
        event.setTitle("Lab 2");
        event.setStartAt(MANUAL);
        event.setCourse(digitalLogic);
        when(eventRepository.findByUserIdAndCourseId(7L, 3L)).thenReturn(List.of(event));

        List<Conflict> found = conflicts.conflicts(7L, 5L, decisions(CourseChoice.MERGE));

        assertThat(found).hasSize(1);
        assertThat(found.getFirst().existing().kind()).isEqualTo(StagedKind.EVENT);
        assertThat(found.getFirst().existing().type()).isNull();
    }

    @Test
    void theClosestExistingItemWinsAndEachIsUsedOnce() {
        Instant near = Instant.parse("2026-10-03T00:00:00Z");
        Instant far = Instant.parse("2026-09-01T00:00:00Z");
        AcademicItem a = new AcademicItem();
        a.setId(41L);
        a.setCourse(digitalLogic);
        a.setType(ItemType.ASSIGNMENT);
        a.setTitle("Lab 2");
        a.setDueAt(far);
        AcademicItem b = new AcademicItem();
        b.setId(42L);
        b.setCourse(digitalLogic);
        b.setType(ItemType.ASSIGNMENT);
        b.setTitle("Lab 2");
        b.setDueAt(near);
        when(itemRepository.findByCourseIdOrderByDueAtAsc(3L)).thenReturn(List.of(a, b));
        pending = stored(canvasCourse(null, 3L, incoming("canvas-1", "Lab 2", CANVAS),
                incoming("canvas-2", "lab 2", Instant.parse("2026-09-02T00:00:00Z"))));

        List<Conflict> found = conflicts.conflicts(7L, 5L, decisions(CourseChoice.MERGE));

        assertThat(found).hasSize(2);
        assertThat(found.get(0).existing().id()).isEqualTo(41L);
        assertThat(found.get(0).itemKey()).isEqualTo("canvas-2");
        assertThat(found.get(1).existing().id()).isEqualTo(42L);
        assertThat(found.get(1).itemKey()).isEqualTo("canvas-1");
    }

    @Test
    void conflictsOfAnotherUsersImportAreNotFound() {
        when(importRepository.findByIdAndUserId(5L, 8L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> conflicts.conflicts(8L, 5L, decisions(CourseChoice.ADD)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void conflictsOfAFinishedImportAreRefused() {
        pending.setStatus(FeedImport.Status.APPLIED);

        assertThatThrownBy(() -> conflicts.conflicts(7L, 5L, decisions(CourseChoice.ADD)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void replaceUpdatesTheTitleAndDateStampsTheUidAndKeepsTheGrade() {
        AcademicItem item = manualItem(40L, "lab  2", MANUAL);

        ApplyResult result = service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.REPLACE, 40L, StagedKind.ITEM))));

        assertThat(item.getTitle()).isEqualTo("Lab 2");
        assertThat(item.getDueAt()).isEqualTo(CANVAS);
        assertThat(item.getExternalUid()).isEqualTo("canvas-1");
        assertThat(item.getScore()).isEqualTo(8.0);
        assertThat(item.getMaxScore()).isEqualTo(10.0);
        assertThat(item.getWeight()).isEqualTo(5.0);
        assertThat(item.getStatus()).isEqualTo(ItemStatus.DONE);
        assertThat(item.getCourse()).isSameAs(digitalLogic);
        verify(itemRepository).save(item);
        assertThat(result).isEqualTo(new ApplyResult(0, 1, 0, 1, 0));
    }

    @Test
    void replaceMovesTheItemToTheTargetCourseAndDropsItsGradeCategory() {
        AcademicItem item = manualItem(40L, "Lab 2", MANUAL);
        Course old = course(4L, "Other", null);
        item.setCourse(old);
        item.setGradeCategory(new GradeCategory());

        service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.REPLACE, 40L, StagedKind.ITEM))));

        assertThat(item.getCourse()).isSameAs(digitalLogic);
        assertThat(item.getGradeCategory()).isNull();
    }

    @Test
    void replacingAnEventWithAnEventUpdatesItInPlace() {
        CalendarEvent event = new CalendarEvent();
        event.setId(60L);
        event.setTitle("Office hrs");
        event.setStartAt(MANUAL);
        event.setPlace("ASB");
        when(eventRepository.findByIdAndUserId(60L, 7L)).thenReturn(Optional.of(event));
        pending = stored(canvasCourse(null, 3L, new StagedItem("canvas-event-1", "canvas-event-1",
                StagedKind.EVENT, null, "Office hours", CANVAS, null)));

        service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-event-1", ItemChoice.REPLACE, 60L, StagedKind.EVENT))));

        assertThat(event.getTitle()).isEqualTo("Office hours");
        assertThat(event.getStartAt()).isEqualTo(CANVAS);
        assertThat(event.getPlace()).isEqualTo("ASB");
        assertThat(event.getExternalUid()).isEqualTo("canvas-event-1");
        assertThat(event.getCourse()).isSameAs(digitalLogic);
        verify(eventRepository).save(event);
    }

    @Test
    void replacingAnEventWithAnItemDeletesTheEventAndAddsTheItem() {
        CalendarEvent event = new CalendarEvent();
        event.setId(60L);
        event.setTitle("Lab 2");
        event.setStartAt(MANUAL);
        when(eventRepository.findByIdAndUserId(60L, 7L)).thenReturn(Optional.of(event));

        ApplyResult result = service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.REPLACE, 60L, StagedKind.EVENT))));

        verify(eventRepository).delete(event);
        ArgumentCaptor<AcademicItem> saved = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository).save(saved.capture());
        assertThat(saved.getValue().getExternalUid()).isEqualTo("canvas-1");
        assertThat(saved.getValue().getCourse()).isSameAs(digitalLogic);
        assertThat(result).isEqualTo(new ApplyResult(0, 1, 0, 1, 0));
    }

    @Test
    void replacingAnItemWithAnEventDeletesTheItemAndAddsTheEvent() {
        AcademicItem item = manualItem(40L, "Office hours", MANUAL);
        pending = stored(canvasCourse(null, 3L, new StagedItem("canvas-event-1", "canvas-event-1",
                StagedKind.EVENT, null, "Office hours", CANVAS, "ASB")));

        service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-event-1", ItemChoice.REPLACE, 40L, StagedKind.ITEM))));

        verify(itemRepository).delete(item);
        ArgumentCaptor<CalendarEvent> saved = ArgumentCaptor.forClass(CalendarEvent.class);
        verify(eventRepository).save(saved.capture());
        assertThat(saved.getValue().getExternalUid()).isEqualTo("canvas-event-1");
        assertThat(saved.getValue().getPlace()).isEqualTo("ASB");
    }

    @Test
    void replacingSomeoneElsesItemIsNotFoundAndWritesNothing() {
        when(itemRepository.findByIdAndCourseUserId(99L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.REPLACE, 99L, StagedKind.ITEM)))))
                .isInstanceOf(NotFoundException.class);
        verify(itemRepository, never()).save(any());
        verify(itemRepository, never()).delete(any());
    }

    @Test
    void replacingSomeoneElsesEventIsNotFound() {
        when(eventRepository.findByIdAndUserId(99L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.REPLACE, 99L, StagedKind.EVENT)))))
                .isInstanceOf(NotFoundException.class);
        verify(eventRepository, never()).delete(any());
    }

    @Test
    void replaceIsSkippedWhenTheIncomingUidAlreadyBelongsToAnotherRecord() {
        AcademicItem item = manualItem(40L, "Lab 2", MANUAL);
        AcademicItem other = new AcademicItem();
        other.setId(77L);
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "canvas-1"))
                .thenReturn(Optional.of(other));

        ApplyResult result = service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.REPLACE, 40L, StagedKind.ITEM))));

        assertThat(item.getExternalUid()).isNull();
        assertThat(result.itemsReplaced()).isZero();
        verify(itemRepository, never()).save(any());
    }

    @Test
    void skippingAConflictRemembersTheUidAndKeepsTheExistingItem() {
        AcademicItem item = manualItem(40L, "Lab 2", MANUAL);

        ApplyResult result = service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.SKIP, null, null))));

        ArgumentCaptor<FeedIgnoredRef> refs = ArgumentCaptor.forClass(FeedIgnoredRef.class);
        verify(ignoredRefRepository).save(refs.capture());
        assertThat(refs.getValue().getKind()).isEqualTo(FeedIgnoredRef.Kind.ITEM);
        assertThat(refs.getValue().getRef()).isEqualTo("canvas-1");
        assertThat(item.getTitle()).isEqualTo("Lab 2");
        verify(itemRepository, never()).save(any());
        assertThat(result).isEqualTo(new ApplyResult(0, 1, 0, 0, 1));
    }

    @Test
    void addingAConflictAnywayInsertsTheSecondItem() {
        manualItem(40L, "Lab 2", MANUAL);

        ApplyResult result = service.apply(user, 5L, new ApplyRequest(List.of(decision(CourseChoice.MERGE)),
                List.of(new ItemDecision("canvas-1", ItemChoice.ADD, null, null))));

        verify(itemRepository).save(any(AcademicItem.class));
        assertThat(result.itemsAdded()).isEqualTo(1);
    }
}
