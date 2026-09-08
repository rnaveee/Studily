package com.rnave.studily.parse;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.course.CourseDtos.MeetingBlockDto;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.course.MeetingKind;
import com.rnave.studily.parse.CourseParseDtos.CourseDraftDto;
import com.rnave.studily.parse.CourseParseDtos.DraftItemDto;
import com.rnave.studily.semester.Semester;
import com.rnave.studily.semester.SemesterService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class CourseParseService {

    private static final int MAX_ITEMS = 60;
    private static final int MAX_BLOCKS = 20;
    private static final int MAX_WARNINGS = 10;
    private static final int MAX_NAME = 255;

    private final DocumentExtractor extractor;
    private final ClaudeCourseParser parser;
    private final SemesterService semesterService;

    public CourseParseService(DocumentExtractor extractor, ClaudeCourseParser parser,
                              SemesterService semesterService) {
        this.extractor = extractor;
        this.parser = parser;
        this.semesterService = semesterService;
    }

    public boolean enabled() {
        return parser.enabled();
    }

    public CourseDraftDto parse(List<MultipartFile> files, String text, Long semesterId, String timeZone) {
        ExtractedInput input = extractor.extract(files, text);
        if (input.isEmpty()) {
            throw new BadRequestException("Add a file or paste some text first.");
        }

        Semester semester = semesterId == null ? null : semesterService.requireOwned(semesterId);
        ZoneId zone = zoneOf(timeZone);
        CourseDraft draft = parser.parse(input, context(semester, zone));
        return normalize(draft, zone);
    }

    private String context(Semester semester, ZoneId zone) {
        StringBuilder sb = new StringBuilder();
        sb.append("Today's date is ").append(LocalDateTime.now(zone).toLocalDate())
                .append(". The student's time zone is ").append(zone.getId()).append(".");
        if (semester != null) {
            sb.append(" This course belongs to the ").append(semester.getTerm())
                    .append(' ').append(semester.getYear()).append(" semester");
            if (semester.getStartDate() != null && semester.getEndDate() != null) {
                sb.append(", which runs from ").append(semester.getStartDate())
                        .append(" to ").append(semester.getEndDate());
            }
            sb.append(". Resolve undated references against that range.");
        } else {
            sb.append(" No semester was selected, so resolve dates against the current academic year.");
        }
        return sb.toString();
    }

    private CourseDraftDto normalize(CourseDraft draft, ZoneId zone) {
        List<String> warnings = new ArrayList<>(clean(draft.warnings(), MAX_WARNINGS));
        List<MeetingBlockDto> blocks = blocks(draft, warnings);
        List<DraftItemDto> items = items(draft, zone, warnings);

        return new CourseDraftDto(
                trim(draft.name(), MAX_NAME),
                trim(draft.code(), MAX_NAME),
                trim(draft.professor(), MAX_NAME),
                trim(draft.location(), MAX_NAME),
                blocks,
                items,
                List.copyOf(warnings));
    }

    private List<MeetingBlockDto> blocks(CourseDraft draft, List<String> warnings) {
        if (draft.meetingBlocks() == null) {
            return List.of();
        }
        List<MeetingBlockDto> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        int dropped = 0;

        for (CourseDraft.DraftBlock block : draft.meetingBlocks()) {
            if (block == null || out.size() >= MAX_BLOCKS) {
                continue;
            }
            DayOfWeek day = parseEnum(DayOfWeek.class, block.day());
            LocalTime start = parseTime(block.startTime());
            LocalTime end = parseTime(block.endTime());
            if (day == null || start == null || end == null || !end.isAfter(start)) {
                dropped++;
                continue;
            }
            MeetingKind kind = parseEnum(MeetingKind.class, block.kind());
            if (kind == null) {
                kind = MeetingKind.LECTURE;
            }
            if (!seen.add(day + "|" + kind + "|" + start + "|" + end)) {
                continue;
            }
            out.add(new MeetingBlockDto(null, day, kind, start, end, trim(block.location(), MAX_NAME)));
        }

        if (dropped > 0 && warnings.size() < MAX_WARNINGS) {
            warnings.add("Skipped " + dropped + " class time" + (dropped == 1 ? "" : "s")
                    + " that could not be read. Add them by hand if they are missing.");
        }
        return List.copyOf(out);
    }

    private List<DraftItemDto> items(CourseDraft draft, ZoneId zone, List<String> warnings) {
        if (draft.items() == null) {
            return List.of();
        }
        List<DraftItemDto> out = new ArrayList<>();
        int dropped = 0;

        for (CourseDraft.DraftItem item : draft.items()) {
            if (item == null || out.size() >= MAX_ITEMS) {
                continue;
            }
            String title = trim(item.title(), MAX_NAME);
            LocalDateTime due = parseDateTime(item.dueAt());
            if (title == null || due == null) {
                dropped++;
                continue;
            }
            ItemType type = parseEnum(ItemType.class, item.type());
            if (type == null) {
                type = ItemType.ASSIGNMENT;
            }
            out.add(new DraftItemDto(
                    type,
                    title,
                    due.atZone(zone).toInstant(),
                    weight(item.weight()),
                    trim(item.location(), MAX_NAME)));
        }

        if (dropped > 0 && warnings.size() < MAX_WARNINGS) {
            warnings.add("Skipped " + dropped + " item" + (dropped == 1 ? "" : "s")
                    + " with no usable due date. Check the outline for anything missing.");
        }
        return List.copyOf(out);
    }

    private Double weight(Double value) {
        if (value == null || value < 0 || value > 1000) {
            return null;
        }
        return value;
    }

    private List<String> clean(List<String> values, int limit) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(v -> trim(v, 500))
                .limit(limit)
                .toList();
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, raw.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static LocalTime parseTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalTime.parse(raw.strip());
        } catch (DateTimeException e) {
            return null;
        }
    }

    private static LocalDateTime parseDateTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.strip();
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeException ignored) {
            try {
                return java.time.LocalDate.parse(value).atTime(23, 59);
            } catch (DateTimeException e) {
                return null;
            }
        }
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }
        String stripped = value.strip();
        if (stripped.isEmpty()) {
            return null;
        }
        return stripped.length() > max ? stripped.substring(0, max) : stripped;
    }

    private static ZoneId zoneOf(String timeZone) {
        if (timeZone == null || timeZone.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(timeZone.strip());
        } catch (DateTimeException e) {
            return ZoneId.systemDefault();
        }
    }
}
