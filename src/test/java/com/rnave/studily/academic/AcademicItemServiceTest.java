package com.rnave.studily.academic;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemDtos.AcademicItemRequest;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.recurrence.RecurrenceService;
import com.rnave.studily.recurrence.SeriesScope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AcademicItemServiceTest {

    private AcademicItemRepository itemRepository;
    private GradeCategoryRepository categoryRepository;
    private CourseService courseService;
    private CurrentUser currentUser;
    private RecurrenceService recurrenceService;
    private AcademicItemService itemService;

    private Course course;

    @BeforeEach
    void setUp() {
        itemRepository = mock(AcademicItemRepository.class);
        categoryRepository = mock(GradeCategoryRepository.class);
        courseService = mock(CourseService.class);
        currentUser = mock(CurrentUser.class);
        recurrenceService = new RecurrenceService("America/Toronto");
        itemService = new AcademicItemService(itemRepository, categoryRepository, courseService,
                recurrenceService, currentUser);

        course = new Course();
        course.setId(5L);
        course.setName("Calculus I");
        course.setColor("blue");
    }

    @Test
    void listForCourse_requiresOwnershipOfTheCourse() {
        when(courseService.requireOwned(5L)).thenReturn(course);
        when(itemRepository.findByCourseIdOrderByDueAtAsc(5L)).thenReturn(List.of());

        itemService.listForCourse(5L);

        verify(courseService).requireOwned(5L);
    }

    @Test
    void listForCourse_propagatesNotFoundWhenCourseNotOwned() {
        when(courseService.requireOwned(5L)).thenThrow(new NotFoundException("Course not found"));

        assertThatThrownBy(() -> itemService.listForCourse(5L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void create_defaultsStatusToTodoWhenNotProvided() {
        when(courseService.requireOwned(5L)).thenReturn(course);
        when(itemRepository.save(any(AcademicItem.class))).thenAnswer(inv -> inv.getArgument(0));

        AcademicItemRequest req = new AcademicItemRequest(
                ItemType.ASSIGNMENT, "Homework 1", Instant.parse("2026-08-01T00:00:00Z"), null, 10.0, null, null,
                null, null, null);

        AcademicItemDto dto = itemService.create(5L, req);

        assertThat(dto.status()).isEqualTo(ItemStatus.TODO);
        assertThat(dto.courseId()).isEqualTo(5L);
        assertThat(dto.courseName()).isEqualTo("Calculus I");
    }

    @Test
    void create_trimsBlankLocationToNull() {
        when(courseService.requireOwned(5L)).thenReturn(course);
        when(itemRepository.save(any(AcademicItem.class))).thenAnswer(inv -> inv.getArgument(0));

        AcademicItemRequest req = new AcademicItemRequest(
                ItemType.EXAM, "Midterm", Instant.now(), "   ", null, null, null, ItemStatus.TODO, null, null);

        AcademicItemDto dto = itemService.create(5L, req);

        assertThat(dto.location()).isNull();
    }

    @Test
    void create_takesTheItemTypeFromItsWeightCategory() {
        GradeCategory category = new GradeCategory();
        category.setId(7L);
        category.setCourse(course);
        category.setName("Midterm");
        category.setKind(ItemType.EXAM);
        category.setWeight(25.0);
        category.setColor("#ef4444");

        when(courseService.requireOwned(5L)).thenReturn(course);
        when(currentUser.id()).thenReturn(1L);
        when(categoryRepository.findByIdAndCourseUserId(7L, 1L)).thenReturn(Optional.of(category));
        when(itemRepository.save(any(AcademicItem.class))).thenAnswer(inv -> inv.getArgument(0));

        AcademicItemDto dto = itemService.create(5L, new AcademicItemRequest(
                ItemType.ASSIGNMENT, "Midterm 1", Instant.now(), null, 99.0, null, null, null, 7L, null));

        assertThat(dto.type()).isEqualTo(ItemType.EXAM);
        assertThat(dto.gradeCategoryId()).isEqualTo(7L);
        assertThat(dto.gradeCategoryName()).isEqualTo("Midterm");
        assertThat(dto.weight()).isNull();
    }

    @Test
    void create_rejectsAWeightCategoryFromAnotherCourse() {
        Course other = new Course();
        other.setId(6L);

        GradeCategory category = new GradeCategory();
        category.setId(7L);
        category.setCourse(other);
        category.setName("Midterm");
        category.setKind(ItemType.EXAM);
        category.setWeight(25.0);

        when(courseService.requireOwned(5L)).thenReturn(course);
        when(currentUser.id()).thenReturn(1L);
        when(categoryRepository.findByIdAndCourseUserId(7L, 1L)).thenReturn(Optional.of(category));

        assertThatThrownBy(() -> itemService.create(5L, new AcademicItemRequest(
                ItemType.EXAM, "Midterm 1", Instant.now(), null, null, null, null, null, 7L, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void update_rejectsItemNotOwnedByCaller() {
        when(currentUser.id()).thenReturn(1L);
        when(itemRepository.findByIdAndCourseUserId(99L, 1L)).thenReturn(Optional.empty());

        AcademicItemRequest req = new AcademicItemRequest(
                ItemType.ASSIGNMENT, "Title", Instant.now(), null, null, null, null, null, null, null);

        assertThatThrownBy(() -> itemService.update(99L, SeriesScope.OCCURRENCE, req)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void delete_onlyDeletesWhenOwned() {
        when(currentUser.id()).thenReturn(1L);
        when(itemRepository.findByIdAndCourseUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> itemService.delete(99L, SeriesScope.OCCURRENCE)).isInstanceOf(NotFoundException.class);
        verify(itemRepository, never()).deleteAll(any());
    }
}
