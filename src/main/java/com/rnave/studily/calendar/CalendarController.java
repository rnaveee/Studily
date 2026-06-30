package com.rnave.studily.calendar;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.config.CurrentUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private final AcademicItemRepository itemRepository;
    private final CurrentUser currentUser;

    public CalendarController(AcademicItemRepository itemRepository, CurrentUser currentUser) {
        this.itemRepository = itemRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<AcademicItemDto> items(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) Long semesterId) {
        List<?> items = semesterId != null
                ? itemRepository.findByCourseUserIdAndCourseSemesterIdAndDueAtBetweenOrderByDueAtAsc(
                        currentUser.id(), semesterId, from, to)
                : itemRepository.findByCourseUserIdAndDueAtBetweenOrderByDueAtAsc(
                        currentUser.id(), from, to);
        return items.stream()
                .map(i -> AcademicItemDto.from((com.rnave.studily.academic.AcademicItem) i))
                .toList();
    }
}
