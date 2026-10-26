package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.FeedImportDtos.ApplyRequest;
import com.rnave.studily.canvas.FeedImportDtos.ApplyResult;
import com.rnave.studily.canvas.FeedImportDtos.CourseChoice;
import com.rnave.studily.canvas.FeedImportDtos.CourseDecision;
import com.rnave.studily.canvas.FeedImportDtos.FeedImportView;
import com.rnave.studily.canvas.FeedImportDtos.ItemChoice;
import com.rnave.studily.canvas.FeedImportDtos.ItemDecision;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.course.CourseDtos.CourseRequest;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.notification.NotificationRepository;
import com.rnave.studily.notification.NotificationType;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedImportServiceTest {

    private static final Instant DUE = Instant.parse("2026-10-02T07:00:00Z");

    private FeedImportRepository importRepository;
    private FeedImportStore store;
    private FeedIgnoredRefRepository ignoredRefRepository;
    private CourseService courseService;
    private CourseRepository courseRepository;
    private AcademicItemRepository itemRepository;
    private CalendarEventRepository eventRepository;
    private NotificationRepository notificationRepository;
    private FeedImportService service;
    private User user;
    private FeedImport pending;

    @BeforeEach
    void setUp() {
        importRepository = mock(FeedImportRepository.class);
        store = new FeedImportStore(importRepository, JsonMapper.builder().build());
        ignoredRefRepository = mock(FeedIgnoredRefRepository.class);
        courseService = mock(CourseService.class);
        courseRepository = mock(CourseRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        eventRepository = mock(CalendarEventRepository.class);
        notificationRepository = mock(NotificationRepository.class);
        SemesterRepository semesterRepository = mock(SemesterRepository.class);

        user = new User();
        user.setId(7L);

        when(courseRepository.save(any(Course.class))).thenAnswer(inv -> inv.getArgument(0));
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(eventRepository.findByUserIdAndExternalUid(anyLong(), anyString())).thenReturn(Optional.empty());

        service = new FeedImportService(importRepository, store, ignoredRefRepository, courseService,
                courseRepository, semesterRepository, itemRepository, eventRepository, notificationRepository);

        pending = stored(List.of(canvasCourse(null, 3L)));
    }

    private static StagedItem item(String uid, StagedKind kind, String title) {
        return new StagedItem(uid, uid, kind, kind == StagedKind.ITEM ? ItemType.ASSIGNMENT : null, title, DUE,
                kind == StagedKind.EVENT ? "ASB 10900" : null);
    }

    private static StagedCourse canvasCourse(Long linkedCourseId, Long matchCourseId) {
        return new StagedCourse("canvas:88", 88L, null, null, "Fundamentals of Digital Logic and Design",
                "ENSC252 D100", "#3b82f6", 9L, linkedCourseId, matchCourseId,
                new ArrayList<>(List.of(item("canvas-assignment-1", StagedKind.ITEM, "Lab 2"),
                        item("canvas-event-2", StagedKind.EVENT, "Office hours"))));
    }

    private FeedImport stored(List<StagedCourse> courses) {
        FeedImport entity = new FeedImport();
        entity.setId(5L);
        entity.setUser(user);
        entity.setProvider("CANVAS");
        entity.setPayload(store.write(new StagedPayload("CANVAS", 9L, courses)));
        when(importRepository.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(entity));
        return entity;
    }

    private static Course existing(long id, String name, String code) {
        Course c = new Course();
        c.setId(id);
        c.setName(name);
        c.setCode(code);
        return c;
    }

    private static ApplyRequest request(CourseDecision course, ItemDecision... items) {
        return new ApplyRequest(List.of(course), List.of(items));
    }

    private static CourseDecision decision(CourseChoice choice) {
        return new CourseDecision("canvas:88", choice, null, null);
    }

    @Test
    void addCreatesTheCourseStampsTheCanvasLinkAndAddsEveryItem() {
        Course created = existing(11L, "Fundamentals of Digital Logic and Design", "ENSC252 D100");
        when(courseService.create(any(CourseRequest.class))).thenReturn(dto(11L));
        when(courseRepository.findByIdAndUserId(11L, 7L)).thenReturn(Optional.of(created));

        ApplyResult result = service.apply(user, 5L, request(decision(CourseChoice.ADD)));

        ArgumentCaptor<CourseRequest> req = ArgumentCaptor.forClass(CourseRequest.class);
        verify(courseService).create(req.capture());
        assertThat(req.getValue().name()).isEqualTo("Fundamentals of Digital Logic and Design");
        assertThat(req.getValue().code()).isEqualTo("ENSC252 D100");
        assertThat(req.getValue().semesterId()).isEqualTo(9L);
        assertThat(created.getCanvasCourseId()).isEqualTo(88L);
        assertThat(created.getCanvasSyncedAt()).isNotNull();

        ArgumentCaptor<AcademicItem> items = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository).save(items.capture());
        assertThat(items.getValue().getCourse()).isSameAs(created);
        assertThat(items.getValue().getExternalUid()).isEqualTo("canvas-assignment-1");
        assertThat(items.getValue().getTitle()).isEqualTo("Lab 2");
        assertThat(items.getValue().getType()).isEqualTo(ItemType.ASSIGNMENT);
        assertThat(items.getValue().getDueAt()).isEqualTo(DUE);

        ArgumentCaptor<CalendarEvent> events = ArgumentCaptor.forClass(CalendarEvent.class);
        verify(eventRepository).save(events.capture());
        assertThat(events.getValue().getCourse()).isSameAs(created);
        assertThat(events.getValue().getUser()).isSameAs(user);
        assertThat(events.getValue().getPlace()).isEqualTo("ASB 10900");
        assertThat(events.getValue().getExternalUid()).isEqualTo("canvas-event-2");

        assertThat(result).isEqualTo(new ApplyResult(1, 0, 2, 0, 0));
        assertThat(pending.getStatus()).isEqualTo(FeedImport.Status.APPLIED);
        verify(notificationRepository).markRead(7L, NotificationType.FEED_REVIEW, 5L);
    }

    @Test
    void addUsesTheEditedOverridesInsteadOfTheStagedValues() {
        Course created = existing(11L, "Digital Logic", "ENSC 252");
        CourseRequest overrides = new CourseRequest("Digital Logic", 4L, "ENSC 252", "Dr. Lee", null, "#ef4444",
                null, null, List.of());
        when(courseService.create(any(CourseRequest.class))).thenReturn(dto(11L));
        when(courseRepository.findByIdAndUserId(11L, 7L)).thenReturn(Optional.of(created));

        service.apply(user, 5L, request(new CourseDecision("canvas:88", CourseChoice.ADD, overrides, null)));

        verify(courseService).create(overrides);
    }

    @Test
    void mergeKeepsTheExistingValuesReplacesACodeOnlyNameAndStampsTheLink() {
        Course target = existing(3L, "ENSC252", "ENSC 252");
        target.setColor("#10b981");
        target.setProfessor("Dr. Kim");
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(target));

        ApplyResult result = service.apply(user, 5L, request(decision(CourseChoice.MERGE)));

        assertThat(target.getName()).isEqualTo("Fundamentals of Digital Logic and Design");
        assertThat(target.getCode()).isEqualTo("ENSC252 D100");
        assertThat(target.getCodeKey()).isEqualTo("ENSC252D100");
        assertThat(target.getColor()).isEqualTo("#10b981");
        assertThat(target.getProfessor()).isEqualTo("Dr. Kim");
        assertThat(target.getCanvasCourseId()).isEqualTo(88L);
        verify(courseService, never()).create(any());

        ArgumentCaptor<AcademicItem> items = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository).save(items.capture());
        assertThat(items.getValue().getCourse()).isSameAs(target);
        assertThat(result).isEqualTo(new ApplyResult(0, 1, 2, 0, 0));
    }

    @Test
    void mergeFillsEmptyFieldsButKeepsARealNameAndAnExistingSectionCode() {
        Course target = existing(3L, "Digital Logic", "ENSC252 D200");
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(target));

        service.apply(user, 5L, request(decision(CourseChoice.MERGE)));

        assertThat(target.getName()).isEqualTo("Digital Logic");
        assertThat(target.getCode()).isEqualTo("ENSC252 D200");
        assertThat(target.getColor()).isEqualTo("#3b82f6");
    }

    @Test
    void mergeFillsABlankCodeAndKeepsTheNameWhenTheIncomingNameIsOnlyTheCode() {
        StagedCourse codeOnly = new StagedCourse("canvas:88", 88L, null, null, "ENSC252 D100", "ENSC252 D100",
                "#3b82f6", 9L, null, 3L, new ArrayList<>(List.of(item("canvas-assignment-1", StagedKind.ITEM, "Lab 2"))));
        pending = stored(List.of(codeOnly));
        Course target = existing(3L, "Fundamentals of Digital Logic and Design", null);
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(target));

        service.apply(user, 5L, request(decision(CourseChoice.MERGE)));

        assertThat(target.getName()).isEqualTo("Fundamentals of Digital Logic and Design");
        assertThat(target.getCode()).isEqualTo("ENSC252 D100");
    }

    @Test
    void mergeUsesTheChosenTargetInsteadOfTheSuggestion() {
        Course chosen = existing(4L, "ENSC 252", null);
        when(courseRepository.findByIdAndUserId(4L, 7L)).thenReturn(Optional.of(chosen));

        service.apply(user, 5L, request(new CourseDecision("canvas:88", CourseChoice.MERGE, null, 4L)));

        assertThat(chosen.getCanvasCourseId()).isEqualTo(88L);
        verify(courseRepository, never()).findByIdAndUserId(3L, 7L);
    }

    @Test
    void mergeIntoSomeoneElsesCourseIsNotFound() {
        when(courseRepository.findByIdAndUserId(99L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(user, 5L,
                request(new CourseDecision("canvas:88", CourseChoice.MERGE, null, 99L))))
                .isInstanceOf(NotFoundException.class);
        verify(itemRepository, never()).save(any());
    }

    @Test
    void mergeIntoACourseLinkedToADifferentCanvasCourseIsRefused() {
        Course target = existing(3L, "ENSC252", null);
        target.setCanvasCourseId(1L);
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.apply(user, 5L, request(decision(CourseChoice.MERGE))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void mergeWithoutAnyTargetIsABadRequest() {
        pending = stored(List.of(canvasCourse(null, null)));

        assertThatThrownBy(() -> service.apply(user, 5L, request(decision(CourseChoice.MERGE))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void skipRemembersTheCourseAndAddsNothing() {
        ApplyResult result = service.apply(user, 5L, request(decision(CourseChoice.SKIP)));

        ArgumentCaptor<FeedIgnoredRef> refs = ArgumentCaptor.forClass(FeedIgnoredRef.class);
        verify(ignoredRefRepository).save(refs.capture());
        assertThat(refs.getValue().getKind()).isEqualTo(FeedIgnoredRef.Kind.COURSE);
        assertThat(refs.getValue().getRef()).isEqualTo("canvas:88");
        assertThat(refs.getValue().getUserId()).isEqualTo(7L);
        verify(itemRepository, never()).save(any());
        verify(eventRepository, never()).save(any());
        assertThat(result).isEqualTo(new ApplyResult(0, 0, 0, 0, 2));
        assertThat(pending.getStatus()).isEqualTo(FeedImport.Status.APPLIED);
    }

    @Test
    void aSkippedItemIsRememberedAndTheOthersAreStillAdded() {
        Course target = existing(3L, "ENSC252", null);
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(target));

        ApplyResult result = service.apply(user, 5L, request(decision(CourseChoice.MERGE),
                new ItemDecision("canvas-assignment-1", ItemChoice.SKIP)));

        ArgumentCaptor<FeedIgnoredRef> refs = ArgumentCaptor.forClass(FeedIgnoredRef.class);
        verify(ignoredRefRepository).save(refs.capture());
        assertThat(refs.getValue().getKind()).isEqualTo(FeedIgnoredRef.Kind.ITEM);
        assertThat(refs.getValue().getRef()).isEqualTo("canvas-assignment-1");
        verify(itemRepository, never()).save(any());
        verify(eventRepository).save(any(CalendarEvent.class));
        assertThat(result.itemsAdded()).isEqualTo(1);
        assertThat(result.itemsSkipped()).isEqualTo(1);
    }

    @Test
    void anAlreadyIgnoredRefIsNotWrittenTwice() {
        when(ignoredRefRepository.existsByUserIdAndKindAndRef(7L, FeedIgnoredRef.Kind.COURSE, "canvas:88"))
                .thenReturn(true);

        service.apply(user, 5L, request(decision(CourseChoice.SKIP)));

        verify(ignoredRefRepository, never()).save(any());
    }

    @Test
    void aLinkedCourseNeedsNoDecisionAndReceivesItsItems() {
        pending = stored(List.of(canvasCourse(3L, null)));
        Course linked = existing(3L, "Digital Logic", "ENSC 252");
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(linked));

        ApplyResult result = service.apply(user, 5L, new ApplyRequest(List.of(), List.of()));

        ArgumentCaptor<AcademicItem> items = ArgumentCaptor.forClass(AcademicItem.class);
        verify(itemRepository).save(items.capture());
        assertThat(items.getValue().getCourse()).isSameAs(linked);
        assertThat(result).isEqualTo(new ApplyResult(0, 0, 2, 0, 0));
    }

    @Test
    void anItemThatAlreadyExistsIsNotAddedTwice() {
        Course target = existing(3L, "ENSC252", null);
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(target));
        when(itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(7L, "canvas-assignment-1"))
                .thenReturn(Optional.of(new AcademicItem()));

        ApplyResult result = service.apply(user, 5L, request(decision(CourseChoice.MERGE)));

        verify(itemRepository, never()).save(any());
        assertThat(result.itemsAdded()).isEqualTo(1);
    }

    @Test
    void aMissingCourseDecisionIsABadRequestAndNothingIsWritten() {
        assertThatThrownBy(() -> service.apply(user, 5L, new ApplyRequest(List.of(), List.of())))
                .isInstanceOf(BadRequestException.class);
        verify(itemRepository, never()).save(any());
        assertThat(pending.getStatus()).isEqualTo(FeedImport.Status.PENDING);
    }

    @Test
    void replaceIsNotSupportedYet() {
        assertThatThrownBy(() -> service.apply(user, 5L, request(decision(CourseChoice.ADD),
                new ItemDecision("canvas-assignment-1", ItemChoice.REPLACE))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void anotherUsersImportIsNotFoundForEveryAction() {
        User other = new User();
        other.setId(8L);
        when(importRepository.findByIdAndUserId(5L, 8L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.view(8L, 5L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.dismiss(8L, 5L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.apply(other, 5L, request(decision(CourseChoice.ADD))))
                .isInstanceOf(NotFoundException.class);
        verify(courseService, never()).create(any());
        verify(itemRepository, never()).save(any());
    }

    @Test
    void aFinishedImportCannotBeAppliedOrDismissedAgain() {
        pending.setStatus(FeedImport.Status.APPLIED);

        assertThatThrownBy(() -> service.apply(user, 5L, request(decision(CourseChoice.ADD))))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.dismiss(7L, 5L)).isInstanceOf(ConflictException.class);
    }

    @Test
    void dismissMarksTheImportAndItsNotification() {
        service.dismiss(7L, 5L);

        assertThat(pending.getStatus()).isEqualTo(FeedImport.Status.DISMISSED);
        verify(notificationRepository).markRead(eq(7L), eq(NotificationType.FEED_REVIEW), eq(5L));
    }

    @Test
    void viewIncludesTheMatchedAndLinkedCourses() {
        pending = stored(List.of(canvasCourse(null, 3L)));
        Course match = existing(3L, "ENSC252", null);
        when(courseRepository.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(match));

        FeedImportView view = service.view(7L, 5L);

        assertThat(view.id()).isEqualTo(5L);
        assertThat(view.status()).isEqualTo(FeedImport.Status.PENDING);
        assertThat(view.courses()).hasSize(1);
        assertThat(view.courses().getFirst().match().id()).isEqualTo(3L);
        assertThat(view.courses().getFirst().linked()).isNull();
        assertThat(view.courses().getFirst().items()).hasSize(2);
    }

    private static CourseDto dto(long id) {
        return new CourseDto(id, null, "x", null, null, null, null, null, null, List.of());
    }
}
