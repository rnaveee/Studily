package com.rnave.studily.academic;

import com.rnave.studily.academic.GradeCategoryDtos.GradeCategoryDto;
import com.rnave.studily.academic.GradeCategoryDtos.GradeCategoryRequest;
import com.rnave.studily.config.ConflictException;
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

class GradeCategoryServiceTest {

    private GradeCategoryRepository categoryRepository;
    private AcademicItemRepository itemRepository;
    private CourseService courseService;
    private CurrentUser currentUser;
    private GradeCategoryService categoryService;

    private Course course;

    @BeforeEach
    void setUp() {
        categoryRepository = mock(GradeCategoryRepository.class);
        itemRepository = mock(AcademicItemRepository.class);
        courseService = mock(CourseService.class);
        currentUser = mock(CurrentUser.class);
        categoryService = new GradeCategoryService(categoryRepository, itemRepository,
                courseService, currentUser);

        course = new Course();
        course.setId(5L);
        course.setName("Circuits");
    }

    private GradeCategory existing(Long id, String name, ItemType kind, double weight) {
        GradeCategory category = new GradeCategory();
        category.setId(id);
        category.setCourse(course);
        category.setName(name);
        category.setKind(kind);
        category.setWeight(weight);
        category.setColor("#3b82f6");
        return category;
    }

    private AcademicItem itemIn(GradeCategory category) {
        AcademicItem item = new AcademicItem();
        item.setCourse(course);
        item.setType(category.getKind());
        item.setTitle("Lab 1");
        item.setDueAt(Instant.parse("2026-09-19T23:59:00Z"));
        item.setGradeCategory(category);
        return item;
    }

    @Test
    void create_requiresOwnershipOfTheCourse() {
        when(courseService.requireOwned(5L)).thenThrow(new NotFoundException("Course not found"));

        assertThatThrownBy(() -> categoryService.create(5L,
                new GradeCategoryRequest("Assignments", 15.0, null)))
                .isInstanceOf(NotFoundException.class);
        verify(categoryRepository, never()).save(any());
    }

    @Test
    void create_takesTheFirstUnusedColourAndReadsTheKindFromTheName() {
        when(courseService.requireOwned(5L)).thenReturn(course);
        when(categoryRepository.save(any(GradeCategory.class))).thenAnswer(inv -> inv.getArgument(0));

        GradeCategoryDto dto = categoryService.create(5L,
                new GradeCategoryRequest("  Assignments  ", 15.0, null));

        assertThat(dto.name()).isEqualTo("Assignments");
        assertThat(dto.color()).isEqualTo("#3b82f6");
        assertThat(dto.kind()).isEqualTo(ItemType.ASSIGNMENT);
        assertThat(dto.weight()).isEqualTo(15.0);
        assertThat(dto.courseId()).isEqualTo(5L);
    }

    @Test
    void create_rejectsADuplicateNameOnTheSameCourse() {
        when(courseService.requireOwned(5L)).thenReturn(course);
        when(categoryRepository.existsByCourseIdAndNameIgnoreCase(5L, "Assignments")).thenReturn(true);

        assertThatThrownBy(() -> categoryService.create(5L,
                new GradeCategoryRequest("Assignments", 15.0, null)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void update_retypesTheItemsWhenTheKindChanges() {
        GradeCategory category = existing(7L, "Midterm", ItemType.ASSIGNMENT, 25.0);
        AcademicItem item = itemIn(category);
        when(currentUser.id()).thenReturn(1L);
        when(categoryRepository.findByIdAndCourseUserId(7L, 1L)).thenReturn(Optional.of(category));
        when(categoryRepository.save(any(GradeCategory.class))).thenAnswer(inv -> inv.getArgument(0));
        when(itemRepository.findByGradeCategoryId(7L)).thenReturn(List.of(item));

        categoryService.update(7L, new GradeCategoryRequest("Midterm", 25.0, null));

        assertThat(item.getType()).isEqualTo(ItemType.EXAM);
        verify(itemRepository).save(item);
    }

    @Test
    void delete_leavesTheItemsBehindWithoutACategory() {
        GradeCategory category = existing(7L, "Assignments", ItemType.ASSIGNMENT, 15.0);
        AcademicItem item = itemIn(category);
        when(currentUser.id()).thenReturn(1L);
        when(categoryRepository.findByIdAndCourseUserId(7L, 1L)).thenReturn(Optional.of(category));
        when(itemRepository.findByGradeCategoryId(7L)).thenReturn(List.of(item));

        categoryService.delete(7L);

        assertThat(item.getGradeCategory()).isNull();
        verify(itemRepository).save(item);
        verify(categoryRepository).delete(category);
    }

    @Test
    void delete_rejectsACategoryOwnedBySomeoneElse() {
        when(currentUser.id()).thenReturn(1L);
        when(categoryRepository.findByIdAndCourseUserId(7L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> categoryService.delete(7L)).isInstanceOf(NotFoundException.class);
        verify(categoryRepository, never()).delete(any(GradeCategory.class));
    }
}
