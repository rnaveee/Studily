package com.rnave.studily.academic;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemDtos.AcademicItemRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
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
    private CourseService courseService;
    private CurrentUser currentUser;
    private AcademicItemService itemService;

    private Course course;

    @BeforeEach
    void setUp() {
        itemRepository = mock(AcademicItemRepository.class);
        courseService = mock(CourseService.class);
        currentUser = mock(CurrentUser.class);
        itemService = new AcademicItemService(itemRepository, courseService, currentUser);

        course = new Course();
        course.setId(5L);
        course.setName("CMPT 225");
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
                ItemType.ASSIGNMENT, "Homework 1", Instant.parse("2026-08-01T00:00:00Z"), null, 10.0, null);

        AcademicItemDto dto = itemService.create(5L, req);

        assertThat(dto.status()).isEqualTo(ItemStatus.TODO);
        assertThat(dto.courseId()).isEqualTo(5L);
        assertThat(dto.courseName()).isEqualTo("CMPT 225");
    }

    @Test
    void create_trimsBlankLocationToNull() {
        when(courseService.requireOwned(5L)).thenReturn(course);
        when(itemRepository.save(any(AcademicItem.class))).thenAnswer(inv -> inv.getArgument(0));

        AcademicItemRequest req = new AcademicItemRequest(
                ItemType.EXAM, "Midterm", Instant.now(), "   ", null, ItemStatus.TODO);

        AcademicItemDto dto = itemService.create(5L, req);

        assertThat(dto.location()).isNull();
    }

    @Test
    void update_rejectsItemNotOwnedByCaller() {
        when(currentUser.id()).thenReturn(1L);
        when(itemRepository.findByIdAndCourseUserId(99L, 1L)).thenReturn(Optional.empty());

        AcademicItemRequest req = new AcademicItemRequest(
                ItemType.ASSIGNMENT, "Title", Instant.now(), null, null, null);

        assertThatThrownBy(() -> itemService.update(99L, req)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void delete_onlyDeletesWhenOwned() {
        when(currentUser.id()).thenReturn(1L);
        when(itemRepository.findByIdAndCourseUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> itemService.delete(99L)).isInstanceOf(NotFoundException.class);
        verify(itemRepository, never()).delete(any());
    }
}
