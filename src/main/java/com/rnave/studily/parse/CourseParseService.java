package com.rnave.studily.parse;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.academic.ItemTypes;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.course.CourseDtos.MeetingBlockDto;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.course.MeetingKind;
import com.rnave.studily.parse.CourseParseDtos.CourseDraftDto;
import com.rnave.studily.parse.CourseParseDtos.DraftCategoryDto;
import com.rnave.studily.parse.CourseParseDtos.DraftItemDto;
import com.rnave.studily.parse.CourseParseDtos.ParseAvailabilityDto;
import com.rnave.studily.parse.CourseParseDtos.ScheduleCourseDto;
import com.rnave.studily.parse.CourseParseDtos.ScheduleDraftDto;
import com.rnave.studily.parse.ClaudeCourseParser.ParseOutcome;
import com.rnave.studily.parse.ClaudeCourseParser.ScheduleOutcome;
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
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class CourseParseService {

    private static final Logger log = LoggerFactory.getLogger(CourseParseService.class);

    private static final int MAX_ITEMS = 60;
    private static final int MAX_CATEGORIES = 20;
    private static final int MAX_CATEGORY_NAME = 60;
    private static final int MAX_BLOCKS = 20;
    private static final int MAX_WARNINGS = 10;
    private static final int MAX_NAME = 255;
    private static final int MAX_COURSES = 12;
    private static final Pattern HEX_COLOR = Pattern.compile("#[0-9a-fA-F]{6}");
    private static final LocalTime PLACEHOLDER_START = LocalTime.of(9, 0);
    private static final LocalTime PLACEHOLDER_END = LocalTime.of(10, 0);
    private static final String PLACEHOLDER_WARNING = "The outline never says what time this class runs, "
            + "so the times below are a placeholder. Set them before saving.";
    static final String NOT_A_SCHEDULE =
            "This doesn't look like a class schedule, so no courses were found. Try a screenshot of your weekly timetable.";
    static final String NOT_AN_OUTLINE =
            "This doesn't look like a course outline, so nothing was filled in. Try the course's syllabus or add it manually.";

    private final DocumentExtractor extractor;
    private final ClaudeCourseParser parser;
    private final SemesterService semesterService;
    private final CourseParseUsageRepository usageRepository;
    private final CurrentUser currentUser;
    private final CourseParseLimits limits;
    private final CourseParseCache cache;

    public CourseParseService(DocumentExtractor extractor, ClaudeCourseParser parser,
                              SemesterService semesterService,
                              CourseParseUsageRepository usageRepository, CurrentUser currentUser,
                              CourseParseLimits limits, CourseParseCache cache) {
        this.extractor = extractor;
        this.parser = parser;
        this.semesterService = semesterService;
        this.usageRepository = usageRepository;
        this.currentUser = currentUser;
        this.limits = limits;
        this.cache = cache;
    }

    public boolean enabled() {
        return parser.enabled();
    }

    public ParseAvailabilityDto availability() {
        if (!parser.enabled()) {
            return new ParseAvailabilityDto(false, limits.monthlyLimit(), 0, false);
        }
        return new ParseAvailabilityDto(true, limits.monthlyLimit(), limits.remaining(), limits.paused());
    }

    public CourseDraftDto parse(List<MultipartFile> files, String[] pages, String text, Long semesterId, String timeZone) {
        ExtractedInput input = extractor.extract(files, text, pages);
        if (input.isEmpty()) {
            throw new BadRequestException("Add a file or paste some text first.");
        }

        if (input.images().isEmpty() && !OutlineSignals.looksLikeOutline(input.text())) {
            throw new BadRequestException(NOT_AN_OUTLINE);
        }

        Semester semester = semesterId == null ? null : semesterService.requireOwned(semesterId);
        ZoneId zone = zoneOf(timeZone);
        String cacheKey = CourseParseCache.key(input, semester, zone);
        Optional<CourseDraft> cached = cache.lookup(cacheKey);
        if (cached.isPresent()) {
            return present(null, cached.get());
        }

        limits.check();
        ParseOutcome outcome = parser.parse(input, context(semester, zone));
        Long parseId = record(outcome.model(), outcome.inputTokens(), outcome.outputTokens());
        cache.store(cacheKey, outcome.draft(), outcome.model());
        return present(parseId, outcome.draft());
    }

    public ScheduleDraftDto parseSchedule(List<MultipartFile> files, String[] pages, Long semesterId, String timeZone) {
        ExtractedInput input = extractor.extract(files, null, pages);
        if (input.isEmpty()) {
            throw new BadRequestException("Add a screenshot of your schedule first.");
        }

        Semester semester = semesterId == null ? null : semesterService.requireOwned(semesterId);
        ZoneId zone = zoneOf(timeZone);
        String cacheKey = CourseParseCache.scheduleKey(input, semester, zone);
        Optional<ScheduleDraft> cached = cache.lookup(cacheKey, ScheduleDraft.class);
        if (cached.isPresent()) {
            return normalizeSchedule(null, cached.get());
        }

        limits.check();
        ScheduleOutcome outcome = parser.parseSchedule(input, scheduleContext(semester, zone));
        Long parseId = record(outcome.model(), outcome.inputTokens(), outcome.outputTokens());
        cache.store(cacheKey, outcome.draft(), outcome.model());
        return normalizeSchedule(parseId, outcome.draft());
    }

    private String scheduleContext(Semester semester, ZoneId zone) {
        StringBuilder sb = new StringBuilder();
        sb.append("Today's date is ").append(LocalDateTime.now(zone).toLocalDate())
                .append(". The student's time zone is ").append(zone.getId()).append(".");
        if (semester != null) {
            sb.append(" These courses belong to the ").append(semester.getTerm())
                    .append(' ').append(semester.getYear()).append(" semester.");
        }
        return sb.toString();
    }

    ScheduleDraftDto normalizeSchedule(Long parseId, ScheduleDraft draft) {
        List<String> warnings = new ArrayList<>(clean(draft.warnings(), MAX_WARNINGS));
        if (draft.notASchedule()) {
            return new ScheduleDraftDto(parseId, List.of(), List.of(NOT_A_SCHEDULE));
        }
        List<ScheduleCourseDto> courses = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        if (draft.courses() != null) {
            for (ScheduleDraft.ScheduleCourse course : draft.courses()) {
                if (course == null || courses.size() >= MAX_COURSES) {
                    continue;
                }
                String name = trim(course.name(), MAX_NAME);
                String code = trim(course.code(), MAX_NAME);
                if (name == null && code == null) {
                    continue;
                }
                String key = (code != null ? code : name).replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
                if (!seen.add(key)) {
                    continue;
                }
                String color = course.color() == null ? null : course.color().strip();
                if (color != null && !HEX_COLOR.matcher(color).matches()) {
                    color = null;
                }
                courses.add(new ScheduleCourseDto(name, code, color == null ? null : color.toLowerCase(Locale.ROOT),
                        blocks(course.meetingBlocks(), warnings)));
            }
        }
        if (courses.isEmpty() && warnings.isEmpty()) {
            warnings.add("No courses could be read from this schedule. Try a clearer screenshot or add them manually.");
        }
        return new ScheduleDraftDto(parseId, List.copyOf(courses), List.copyOf(warnings));
    }

    private CourseDraftDto present(Long parseId, CourseDraft draft) {
        if (!draft.notAnOutline()) {
            return normalize(parseId, draft);
        }
        return normalize(parseId, new CourseDraft(null, null, null, null,
                List.of(), List.of(), List.of(), List.of(NOT_AN_OUTLINE), false));
    }

    private Long record(String model, long inputTokens, long outputTokens) {
        try {
            CourseParseUsage usage = new CourseParseUsage();
            usage.setUser(currentUser.entity());
            usage.setModel(model);
            usage.setInputTokens(inputTokens);
            usage.setOutputTokens(outputTokens);
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
        List<MeetingBlockDto> blocks = blocks(draft.meetingBlocks(), warnings);
        Map<String, DraftCategoryDto> categories = categories(draft, warnings);
        List<DraftItemDto> items = items(draft, categories, warnings);

        return new CourseDraftDto(
                parseId,
                trim(draft.name(), MAX_NAME),
                trim(draft.code(), MAX_NAME),
                trim(draft.professor(), MAX_NAME),
                trim(draft.location(), MAX_NAME),
                blocks,
                List.copyOf(categories.values()),
                items,
                List.copyOf(warnings));
    }

    private Map<String, DraftCategoryDto> categories(CourseDraft draft, List<String> warnings) {
        Map<String, DraftCategoryDto> out = new LinkedHashMap<>();
        if (draft.gradeCategories() == null) {
            return out;
        }

        for (CourseDraft.DraftCategory category : draft.gradeCategories()) {
            if (category == null || out.size() >= MAX_CATEGORIES) {
                continue;
            }
            String name = trim(category.name(), MAX_CATEGORY_NAME);
            if (name == null) {
                continue;
            }
            Double weight = category.weight();
            if (weight != null && (weight < 0 || weight > 100)) {
                weight = null;
            }
            out.putIfAbsent(name.toLowerCase(Locale.ROOT),
                    new DraftCategoryDto(name, ItemTypes.fromName(name), weight));
        }

        double total = out.values().stream()
                .filter(c -> c.weight() != null)
                .mapToDouble(DraftCategoryDto::weight)
                .sum();
        if (total > 0 && Math.abs(total - 100) > 0.01 && warnings.size() < MAX_WARNINGS) {
            warnings.add("The grading scheme adds up to " + trimNumber(total)
                    + "%, not 100%. Check the weights before you save.");
        }
        return out;
    }

    private static String trimNumber(double value) {
        double rounded = Math.round(value * 100) / 100d;
        return rounded == Math.rint(rounded)
                ? String.valueOf((long) rounded)
                : String.valueOf(rounded);
    }

    private List<MeetingBlockDto> blocks(List<CourseDraft.DraftBlock> draftBlocks, List<String> warnings) {
        if (draftBlocks == null) {
            return List.of();
        }
        List<MeetingBlockDto> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        int dropped = 0;
        boolean needTimes = false;

        for (CourseDraft.DraftBlock block : draftBlocks) {
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

        if (needTimes && warnings.size() < MAX_WARNINGS && !warnings.contains(PLACEHOLDER_WARNING)) {
            warnings.add(PLACEHOLDER_WARNING);
        }
        if (dropped > 0 && warnings.size() < MAX_WARNINGS) {
            warnings.add("Skipped " + dropped + " class time" + (dropped == 1 ? "" : "s")
                    + " that could not be read. Add them by hand if they are missing.");
        }
        return List.copyOf(out);
    }

    private List<DraftItemDto> items(CourseDraft draft, Map<String, DraftCategoryDto> categories,
                                     List<String> warnings) {
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

            String categoryKey = trim(item.category(), MAX_CATEGORY_NAME);
            DraftCategoryDto category = categoryKey == null
                    ? null : categories.get(categoryKey.toLowerCase(Locale.ROOT));
            if (category != null) {
                type = category.kind();
            }

            out.add(new DraftItemDto(
                    type,
                    title,
                    due == null ? null : due.toString(),
                    category == null ? weight(item.weight()) : null,
                    trim(item.location(), MAX_NAME),
                    category == null ? null : category.name()));
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
