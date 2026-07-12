package com.rnave.studily.calendar;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.calendar.CalendarEventDtos.CalendarEventDto;
import com.rnave.studily.calendar.CalendarEventDtos.CalendarEventRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private final AcademicItemRepository itemRepository;
    private final CalendarEventRepository eventRepository;
    private final CurrentUser currentUser;

    public CalendarController(AcademicItemRepository itemRepository, CalendarEventRepository eventRepository,
                              CurrentUser currentUser) {
        this.itemRepository = itemRepository;
        this.eventRepository = eventRepository;
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

    @GetMapping("/events")
    @Transactional(readOnly = true)
    public List<CalendarEventDto> events(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return eventRepository.findByUserIdAndStartAtBetweenOrderByStartAtAsc(currentUser.id(), from, to)
                .stream()
                .map(CalendarEventDto::from)
                .toList();
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CalendarEventDto createEvent(@Valid @RequestBody CalendarEventRequest req) {
        CalendarEvent event = new CalendarEvent();
        event.setUser(currentUser.entity());
        event.setTitle(req.title().trim());
        event.setPlace(req.place() != null && !req.place().isBlank() ? req.place().trim() : null);
        event.setStartAt(req.startAt());
        return CalendarEventDto.from(eventRepository.save(event));
    }

    @PutMapping("/events/{id}")
    @Transactional
    public CalendarEventDto updateEvent(@PathVariable Long id, @Valid @RequestBody CalendarEventRequest req) {
        CalendarEvent event = eventRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Event not found"));
        event.setTitle(req.title().trim());
        event.setPlace(req.place() != null && !req.place().isBlank() ? req.place().trim() : null);
        event.setStartAt(req.startAt());
        return CalendarEventDto.from(eventRepository.save(event));
    }

    @DeleteMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteEvent(@PathVariable Long id) {
        CalendarEvent event = eventRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Event not found"));
        eventRepository.delete(event);
    }
}
