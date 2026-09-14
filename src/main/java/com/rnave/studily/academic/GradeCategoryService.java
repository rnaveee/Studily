package com.rnave.studily.academic;

import com.rnave.studily.academic.GradeCategoryDtos.GradeCategoryDto;
import com.rnave.studily.academic.GradeCategoryDtos.GradeCategoryRequest;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class GradeCategoryService {

    private final GradeCategoryRepository categoryRepository;
    private final AcademicItemRepository itemRepository;
    private final CourseService courseService;
    private final CurrentUser currentUser;

    public GradeCategoryService(GradeCategoryRepository categoryRepository,
                                AcademicItemRepository itemRepository,
                                CourseService courseService, CurrentUser currentUser) {
        this.categoryRepository = categoryRepository;
        this.itemRepository = itemRepository;
        this.courseService = courseService;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<GradeCategoryDto> listForCourse(Long courseId) {
        courseService.requireOwned(courseId);
        return categoryRepository.findByCourseIdOrderByPositionAscIdAsc(courseId)
                .stream().map(GradeCategoryDto::from).toList();
    }

    @Transactional
    public GradeCategoryDto create(Long courseId, GradeCategoryRequest req) {
        Course course = courseService.requireOwned(courseId);
        String name = req.name().trim();
        if (categoryRepository.existsByCourseIdAndNameIgnoreCase(courseId, name)) {
            throw new ConflictException("This course already has a weight called \"" + name + "\"");
        }
        GradeCategory category = new GradeCategory();
        category.setCourse(course);
        category.setColor(ItemTypes.nextColor(
                categoryRepository.findByCourseIdOrderByPositionAscIdAsc(courseId)
                        .stream().map(GradeCategory::getColor).toList()));
        apply(category, req, name);
        return GradeCategoryDto.from(categoryRepository.save(category));
    }

    @Transactional
    public GradeCategoryDto update(Long id, GradeCategoryRequest req) {
        GradeCategory category = requireOwned(id);
        Long courseId = category.getCourse().getId();
        String name = req.name().trim();
        if (categoryRepository.existsByCourseIdAndNameIgnoreCaseAndIdNot(courseId, name, id)) {
            throw new ConflictException("This course already has a weight called \"" + name + "\"");
        }
        apply(category, req, name);
        categoryRepository.save(category);

        for (AcademicItem item : itemRepository.findByGradeCategoryId(id)) {
            if (item.getType() != category.getKind()) {
                item.setType(category.getKind());
                itemRepository.save(item);
            }
        }
        return GradeCategoryDto.from(category);
    }

    @Transactional
    public void delete(Long id) {
        GradeCategory category = requireOwned(id);
        for (AcademicItem item : itemRepository.findByGradeCategoryId(id)) {
            item.setGradeCategory(null);
            itemRepository.save(item);
        }
        categoryRepository.delete(category);
    }

    @Transactional(readOnly = true)
    public GradeCategory requireOwned(Long id) {
        return categoryRepository.findByIdAndCourseUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Weight not found"));
    }

    private void apply(GradeCategory category, GradeCategoryRequest req, String name) {
        category.setName(name);
        category.setKind(ItemTypes.fromName(name));
        category.setWeight(req.weight());
        category.setPosition(req.position() == null ? 0 : req.position());
    }
}
