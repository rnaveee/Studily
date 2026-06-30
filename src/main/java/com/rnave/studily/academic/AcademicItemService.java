package com.rnave.studily.academic;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemDtos.AcademicItemRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AcademicItemService {

    private final AcademicItemRepository itemRepository;
    private final CourseService courseService;
    private final CurrentUser currentUser;

    public AcademicItemService(AcademicItemRepository itemRepository, CourseService courseService,
                               CurrentUser currentUser) {
        this.itemRepository = itemRepository;
        this.courseService = courseService;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<AcademicItemDto> listForCourse(Long courseId) {
        courseService.requireOwned(courseId); // ownership check
        return itemRepository.findByCourseIdOrderByDueAtAsc(courseId)
                .stream().map(AcademicItemDto::from).toList();
    }

    @Transactional
    public AcademicItemDto create(Long courseId, AcademicItemRequest req) {
        Course course = courseService.requireOwned(courseId);
        AcademicItem item = new AcademicItem();
        item.setCourse(course);
        apply(item, req);
        return AcademicItemDto.from(itemRepository.save(item));
    }

    @Transactional
    public AcademicItemDto update(Long itemId, AcademicItemRequest req) {
        AcademicItem item = requireOwned(itemId);
        apply(item, req);
        return AcademicItemDto.from(itemRepository.save(item));
    }

    @Transactional
    public void delete(Long itemId) {
        itemRepository.delete(requireOwned(itemId));
    }

    private AcademicItem requireOwned(Long itemId) {
        return itemRepository.findByIdAndCourseUserId(itemId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Item not found"));
    }

    private void apply(AcademicItem item, AcademicItemRequest req) {
        item.setType(req.type());
        item.setTitle(req.title().trim());
        item.setDueAt(req.dueAt());
        item.setLocation(req.location() == null || req.location().isBlank() ? null : req.location().trim());
        item.setWeight(req.weight());
        item.setStatus(req.status() == null ? ItemStatus.TODO : req.status());
    }
}
