package com.rnave.studily.parse;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.CourseDtos.MeetingBlockDto;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.course.MeetingKind;
import com.rnave.studily.parse.CourseParseDtos.CourseDraftDto;
import com.rnave.studily.parse.CourseParseDtos.DraftItemDto;
import com.rnave.studily.parse.ClaudeCourseParser.ParseOutcome;
import com.rnave.studily.semester.Semester;
import com.rnave.studily.semester.SemesterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(CourseParseService.class);

    private static final int MAX_ITEMS = 60;
    private static final int MAX_BLOCKS = 20;
    private static final int MAX_WARNINGS = 10;
    private static final int MAX_NAME = 255;
    private static final LocalTime PLACEHOLDER_START = LocalTime.of(9, 0);
    private static final LocalTime PLACEHOLDER_END = LocalTime.of(10, 0);

    private final DocumentExtractor extractor;
    private final ClaudeCourseParser parser;
    private final SemesterService semesterService;
    private final CourseParseUsageRepository usageRepository;
    private final CurrentUser currentUser;

    public CourseParseService(DocumentExtractor extractor, ClaudeCourseParser parser,
                              SemesterService semesterService,
                              CourseParseUsageRepository usageRepository, CurrentUser currentUser) {
        this.extractor = extractor;
        this.parser = parser;
        this.semesterService = semesterService;
        this.usageRepository = usageRepository;
        this.currentUser = currentUser;
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
        ParseOutcome outcome = parser.parse(input, context(semester, zone));
        return normalize(record(outcome), outcome.draft());
    }

    private Long record(ParseOutcome outcome) {
        try {
            CourseParseUsage usage = new CourseParseUsage();
            usage.setUser(currentUser.entity());
            usage.setModel(outcome.model());
            usage.setInputTokens(outcome.inputTokens());
            usage.setOutputTokens(outcome.outputTokens());
            return usageRepository.save(usage).getId();
        } catch (RuntimeException e) {
            log.warn("Could not record course parse usage: {}", e.getMessage());
            return null;
        }
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

    private CourseDraftDto normalize(Long parseId, CourseDraft draft) {
        List<String> warnings = new ArrayList<>(clean(draft.warnings(), MAX_WARNINGS));
        List<MeetingBlockDto> blocks = blocks(draft, warnings);
        List<DraftItemDto> items = items(draft, warnings);

        return new CourseDraftDto(
                parseId,
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
        boolean needTimes = false;

        for (CourseDraft.DraftBlock block : draft.meetingBlocks()) {
            if (block == null || out.size() >= MAX_BLOCKS) {
                continue;
            }
            DayOfWeek day = parseEnum(DayOfWeek.class, block.day());
            if (day == null) {
                dropped++;
                continue;
            }
            LocalTime start = parseTime(block.startTime());
            LocalTime end = parseTime(block.endTime());
            boolean timeUnknown = start == null || end == null;
            if (timeUnknown) {
                start = PLACEHOLDER_START;
                end = PLACEHOLDER_END;
                needTimes = true;
            } else if (!end.isAfter(start)) {
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

        if (needTimes && warnings.size() < MAX_WARNINGS) {
            warnings.add("The outline never says what time this class runs, so the times below are "
                    + "a placeholder. Set them before saving.");
        }
        if (dropped > 0 && warnings.size() < MAX_WARNINGS) {
            warnings.add("Skipped " + dropped + " class time" + (dropped == 1 ? "" : "s")
                    + " that could not be read. Add them by hand if they are missing.");
        }
        return List.copyOf(out);
    }

    private List<DraftItemDto> items(CourseDraft draft, List<String> warnings) {
        if (draft.items() == null) {
            return List.of();
        }
        List<DraftItemDto> out = new ArrayList<>();
        int undated = 0;

        for (CourseDraft.DraftItem item : draft.items()) {
            if (item == null || out.size() >= MAX_ITEMS) {
                continue;
            }
            String title = trim(item.title(), MAX_NAME);
            if (title == null) {
                continue;
            }
            LocalDateTime due = parseDateTime(item.dueAt());
            if (due == null) {
                undated++;
            }
            ItemType type = parseEnum(ItemType.class, item.type());
            if (type == null) {
                type = ItemType.ASSIGNMENT;
            }
            out.add(new DraftItemDto(
                    type,
                    title,
                    due == null ? null : due.toString(),
                    weight(item.weight()),
                    trim(item.location(), MAX_NAME)));
        }

        if (undated > 0 && warnings.size() < MAX_WARNINGS) {
            warnings.add(undated + " item" + (undated == 1 ? "" : "s")
                    + " came back without a due date. Fill the date in to save "
                    + (undated == 1 ? "it" : "them") + ".");
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
