package com.rnave.studily.academic;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemDtos.AcademicItemRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.recurrence.RecurrenceService;
import com.rnave.studily.recurrence.SeriesScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class AcademicItemService {

    private final AcademicItemRepository itemRepository;
    private final CourseService courseService;
    private final RecurrenceService recurrenceService;
    private final CurrentUser currentUser;

    public AcademicItemService(AcademicItemRepository itemRepository, CourseService courseService,
                               RecurrenceService recurrenceService, CurrentUser currentUser) {
        this.itemRepository = itemRepository;
        this.courseService = courseService;
        this.recurrenceService = recurrenceService;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<AcademicItemDto> listForCourse(Long courseId) {
        courseService.requireOwned(courseId);
        return itemRepository.findByCourseIdOrderByDueAtAsc(courseId)
                .stream().map(AcademicItemDto::from).toList();
    }

    @Transactional
    public AcademicItemDto create(Long courseId, AcademicItemRequest req) {
        Course course = courseService.requireOwned(courseId);
        if (req.recurrence() == null) {
            AcademicItem item = new AcademicItem();
            item.setCourse(course);
            apply(item, req);
            return AcademicItemDto.from(itemRepository.save(item));
        }

        RecurrenceService.Expansion expansion = recurrenceService.expand(req.dueAt(), req.recurrence());
        List<AcademicItem> items = new ArrayList<>(expansion.starts().size());
        for (Instant at : expansion.starts()) {
            AcademicItem item = new AcademicItem();
            item.setCourse(course);
            apply(item, req);
            item.setDueAt(at);
            item.setSeriesId(expansion.seriesId());
            item.setRecurrenceRule(expansion.rule());
            items.add(item);
        }
        return AcademicItemDto.from(itemRepository.saveAll(items).getFirst());
    }

    @Transactional
    public AcademicItemDto update(Long itemId, SeriesScope scope, AcademicItemRequest req) {
        AcademicItem item = requireOwned(itemId);
        apply(item, req);
        itemRepository.save(item);

        for (AcademicItem sibling : scopeOf(item, scope)) {
            if (sibling.getId().equals(item.getId())) {
                continue;
            }
            applyShared(sibling, req);
            sibling.setDueAt(recurrenceService.withTimeOfDay(sibling.getDueAt(), req.dueAt()));
            itemRepository.save(sibling);
        }
        return AcademicItemDto.from(item);
    }

    @Transactional
    public void delete(Long itemId, SeriesScope scope) {
        itemRepository.deleteAll(scopeOf(requireOwned(itemId), scope));
    }

    private List<AcademicItem> scopeOf(AcademicItem item, SeriesScope scope) {
        if (scope != SeriesScope.SERIES || item.getSeriesId() == null) {
            return List.of(item);
        }
        return itemRepository.findByCourseUserIdAndSeriesId(currentUser.id(), item.getSeriesId());
    }

    private AcademicItem requireOwned(Long itemId) {
        return itemRepository.findByIdAndCourseUserId(itemId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Item not found"));
    }

    private void applyShared(AcademicItem item, AcademicItemRequest req) {
        item.setType(req.type());
        item.setTitle(req.title().trim());
        item.setLocation(req.location() == null || req.location().isBlank() ? null : req.location().trim());
        item.setWeight(req.weight());
    }

    private void apply(AcademicItem item, AcademicItemRequest req) {
        item.setType(req.type());
        item.setTitle(req.title().trim());
        item.setDueAt(req.dueAt());
        item.setLocation(req.location() == null || req.location().isBlank() ? null : req.location().trim());
        item.setWeight(req.weight());
        item.setScore(req.score());
        item.setMaxScore(req.score() == null ? null : req.maxScore() == null ? 100d : req.maxScore());
        item.setStatus(req.status() == null ? ItemStatus.TODO : req.status());
    }
}
