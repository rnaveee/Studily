package com.rnave.studily.calendar;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.calendar.CalendarEventDtos.CalendarEventDto;
import com.rnave.studily.calendar.CalendarEventDtos.CalendarEventRequest;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.recurrence.RecurrenceService;
import com.rnave.studily.recurrence.SeriesScope;
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
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private final AcademicItemRepository itemRepository;
    private final CalendarEventRepository eventRepository;
    private final EventCategoryRepository categoryRepository;
    private final RecurrenceService recurrenceService;
    private final CurrentUser currentUser;

    public CalendarController(AcademicItemRepository itemRepository, CalendarEventRepository eventRepository,
                              EventCategoryRepository categoryRepository, RecurrenceService recurrenceService,
                              CurrentUser currentUser) {
        this.itemRepository = itemRepository;
        this.eventRepository = eventRepository;
        this.categoryRepository = categoryRepository;
        this.recurrenceService = recurrenceService;
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
        EventCategory category = resolveCategory(req.categoryId());
        if (req.recurrence() == null) {
            return CalendarEventDto.from(eventRepository.save(newEvent(req, category, req.startAt(), null, null)));
        }

        RecurrenceService.Expansion expansion = recurrenceService.expand(req.startAt(), req.recurrence());
        List<CalendarEvent> events = new ArrayList<>(expansion.starts().size());
        for (Instant at : expansion.starts()) {
            events.add(newEvent(req, category, at, expansion.seriesId(), expansion.rule()));
        }
        return CalendarEventDto.from(eventRepository.saveAll(events).getFirst());
    }

    private CalendarEvent newEvent(CalendarEventRequest req, EventCategory category, Instant startAt,
                                   java.util.UUID seriesId, String rule) {
        CalendarEvent event = new CalendarEvent();
        event.setUser(currentUser.entity());
        event.setTitle(req.title().trim());
        event.setPlace(req.place() != null && !req.place().isBlank() ? req.place().trim() : null);
        event.setCategory(category);
        event.setStartAt(startAt);
        event.setSeriesId(seriesId);
        event.setRecurrenceRule(rule);
        return event;
    }

    @PutMapping("/events/{id}")
    @Transactional
    public CalendarEventDto updateEvent(@PathVariable Long id,
                                        @RequestParam(defaultValue = "OCCURRENCE") SeriesScope scope,
                                        @Valid @RequestBody CalendarEventRequest req) {
        CalendarEvent event = eventRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Event not found"));
        EventCategory category = resolveCategory(req.categoryId());

        for (CalendarEvent target : scopeOf(event, scope)) {
            target.setTitle(req.title().trim());
            target.setPlace(req.place() != null && !req.place().isBlank() ? req.place().trim() : null);
            target.setCategory(category);
            target.setStartAt(target == event
                    ? req.startAt()
                    : recurrenceService.withTimeOfDay(target.getStartAt(), req.startAt()));
            eventRepository.save(target);
        }
        return CalendarEventDto.from(event);
    }

    private List<CalendarEvent> scopeOf(CalendarEvent event, SeriesScope scope) {
        if (scope != SeriesScope.SERIES || event.getSeriesId() == null) {
            return List.of(event);
        }
        return eventRepository.findByUserIdAndSeriesId(currentUser.id(), event.getSeriesId());
    }

    private EventCategory resolveCategory(Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        return categoryRepository.findByIdAndUserId(categoryId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Category not found"));
    }

    @DeleteMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteEvent(@PathVariable Long id,
                            @RequestParam(defaultValue = "OCCURRENCE") SeriesScope scope) {
        CalendarEvent event = eventRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Event not found"));
        eventRepository.deleteAll(scopeOf(event, scope));
    }
}
