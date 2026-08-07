package com.rnave.studily.ics;

import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.ics.IcsDtos.ImportResult;
import com.rnave.studily.ics.IcsParser.ParsedCalendar;
import com.rnave.studily.ics.IcsParser.ParsedEvent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@Service
public class IcsService {

    private static final int MAX_EVENTS = 2000;
    private static final int MAX_SOURCE_CHARS = 4_000_000;

    private final CalendarEventRepository eventRepository;
    private final AcademicItemRepository itemRepository;
    private final IcsFetcher fetcher;
    private final CurrentUser currentUser;

    public IcsService(CalendarEventRepository eventRepository, AcademicItemRepository itemRepository,
                      IcsFetcher fetcher, CurrentUser currentUser) {
        this.eventRepository = eventRepository;
        this.itemRepository = itemRepository;
        this.fetcher = fetcher;
        this.currentUser = currentUser;
    }

    @Transactional
    public ImportResult importCalendar(String source, String timeZone) {
        String text = resolve(source);
        if (!text.toUpperCase(Locale.ROOT).contains("BEGIN:VCALENDAR")) {
            throw new BadRequestException("That does not look like an iCalendar (.ics) feed");
        }

        ParsedCalendar parsed = IcsParser.parse(text, zoneOf(timeZone), MAX_EVENTS);
        if (parsed.events().isEmpty()) {
            throw new BadRequestException("No events were found in that calendar");
        }

        Long userId = currentUser.id();
        Set<String> seen = new HashSet<>();
        int imported = 0;
        int updated = 0;
        int duplicates = 0;

        for (ParsedEvent event : parsed.events()) {
            String key = externalUid(event);
            if (!seen.add(key)) {
                duplicates++;
                continue;
            }
            CalendarEvent existing = eventRepository.findByUserIdAndExternalUid(userId, key).orElse(null);
            if (existing == null) {
                CalendarEvent created = new CalendarEvent();
                created.setUser(currentUser.entity());
                created.setTitle(event.title());
                created.setPlace(event.place());
                created.setStartAt(event.startAt());
                created.setExternalUid(key);
                eventRepository.save(created);
                imported++;
            } else {
                existing.setTitle(event.title());
                existing.setPlace(event.place());
                existing.setStartAt(event.startAt());
                eventRepository.save(existing);
                updated++;
            }
        }

        return new ImportResult(parsed.name(), imported, updated, parsed.skipped() + duplicates, parsed.truncated());
    }

    @Transactional(readOnly = true)
    public String export() {
        Long userId = currentUser.id();
        return IcsWriter.write(
                itemRepository.findByCourseUserId(userId),
                eventRepository.findByUserIdOrderByStartAtAsc(userId));
    }

    private String resolve(String source) {
        String trimmed = source.trim();
        if (trimmed.length() > MAX_SOURCE_CHARS) {
            throw new BadRequestException("That calendar is too large to import");
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("webcal://")) {
            return fetcher.fetch(trimmed);
        }
        return trimmed;
    }

    private ZoneId zoneOf(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(timeZone);
        } catch (RuntimeException e) {
            return ZoneId.systemDefault();
        }
    }

    private String externalUid(ParsedEvent event) {
        String base = event.uid() == null || event.uid().isBlank()
                ? event.title() + "|" + event.startAt()
                : event.uid();
        String key = event.recurring() ? base + "#" + event.startAt().getEpochSecond() : base;
        return key.length() <= 255 ? key : sha256(key);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
