package com.rnave.studily.parse;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.course.DayOfWeek;
import com.rnave.studily.course.MeetingKind;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.parse.ClaudeCourseParser.ParseOutcome;
import com.rnave.studily.parse.CourseDraft.DraftBlock;
import com.rnave.studily.parse.CourseDraft.DraftItem;
import com.rnave.studily.parse.CourseParseDtos.CourseDraftDto;
import com.rnave.studily.semester.SemesterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CourseParseServiceTest {

    private static final String ZONE = "America/Vancouver";

    private DocumentExtractor extractor;
    private ClaudeCourseParser parser;
    private CourseParseService service;

    @BeforeEach
    void setUp() {
        extractor = mock(DocumentExtractor.class);
        parser = mock(ClaudeCourseParser.class);
        SemesterService semesterService = mock(SemesterService.class);
        CourseParseUsageRepository usageRepository = mock(CourseParseUsageRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        service = new CourseParseService(
                extractor, parser, semesterService, usageRepository, currentUser);

        when(extractor.extract(any(), any()))
                .thenReturn(new ExtractedInput("outline text", List.of()));
    }

    private CourseDraftDto run(CourseDraft draft) {
        when(parser.parse(any(), anyString()))
                .thenReturn(new ParseOutcome(draft, "claude-sonnet-5", 2400, 900));
        return service.parse(List.of(), "outline text", null, ZONE);
    }

    @Test
    void parse_mapsCourseFieldsAndTrimsThem() {
        CourseDraftDto dto = run(new CourseDraft(
                "  Graphical Communication for Engineering  ", "ENSC 204",
                "Dr. Shervin Jannesar", "B9200", List.of(), List.of(), List.of()));

        assertThat(dto.name()).isEqualTo("Graphical Communication for Engineering");
        assertThat(dto.code()).isEqualTo("ENSC 204");
        assertThat(dto.professor()).isEqualTo("Dr. Shervin Jannesar");
        assertThat(dto.location()).isEqualTo("B9200");
    }

    @Test
    void parse_blankStringsBecomeNull() {
        CourseDraftDto dto = run(new CourseDraft(
                "Circuits", "   ", null, "", List.of(), List.of(), List.of()));

        assertThat(dto.code()).isNull();
        assertThat(dto.professor()).isNull();
        assertThat(dto.location()).isNull();
    }

    @Test
    void parse_keepsValidBlocksAndDefaultsKindToLecture() {
        CourseDraftDto dto = run(draftWithBlocks(
                new DraftBlock("TUE", null, "12:30", "14:20", "B 9201"),
                new DraftBlock("thu", "lab", "12:30", "14:20", null)));

        assertThat(dto.meetingBlocks()).hasSize(2);
        assertThat(dto.meetingBlocks().get(0).dayOfWeek()).isEqualTo(DayOfWeek.TUE);
        assertThat(dto.meetingBlocks().get(0).kind()).isEqualTo(MeetingKind.LECTURE);
        assertThat(dto.meetingBlocks().get(0).startTime()).isEqualTo(LocalTime.of(12, 30));
        assertThat(dto.meetingBlocks().get(0).location()).isEqualTo("B 9201");
        assertThat(dto.meetingBlocks().get(1).kind()).isEqualTo(MeetingKind.LAB);
    }

    @Test
    void parse_dropsBlocksThatDoNotEndAfterTheyStart() {
        CourseDraftDto dto = run(draftWithBlocks(
                new DraftBlock("MON", "LECTURE", "14:20", "12:30", null),
                new DraftBlock("MON", "LECTURE", "10:00", "10:00", null),
                new DraftBlock("MON", "LECTURE", "09:00", "10:00", null)));

        assertThat(dto.meetingBlocks()).hasSize(1);
        assertThat(dto.warnings()).anyMatch(w -> w.contains("Skipped 2 class times"));
    }

    @Test
    void parse_dropsBlocksWithUnreadableDayOrTime() {
        CourseDraftDto dto = run(draftWithBlocks(
                new DraftBlock("Tuesday", "LECTURE", "12:30", "14:20", null),
                new DraftBlock("TUE", "LECTURE", "12.30pm", "14:20", null)));

        assertThat(dto.meetingBlocks()).isEmpty();
        assertThat(dto.warnings()).anyMatch(w -> w.contains("Skipped 2 class times"));
    }

    @Test
    void parse_deduplicatesIdenticalBlocks() {
        CourseDraftDto dto = run(draftWithBlocks(
                new DraftBlock("TUE", "LECTURE", "12:30", "14:20", "B 9201"),
                new DraftBlock("TUE", "LECTURE", "12:30", "14:20", "B 9201")));

        assertThat(dto.meetingBlocks()).hasSize(1);
    }

    @Test
    void parse_resolvesItemDatesInTheStudentsZone() {
        CourseDraftDto dto = run(draftWithItems(
                new DraftItem("EXAM", "Exam 1 - Drawing", "2026-10-14T23:59", 25.0, null)));

        assertThat(dto.items()).hasSize(1);
        assertThat(dto.items().get(0).type()).isEqualTo(ItemType.EXAM);
        assertThat(dto.items().get(0).weight()).isEqualTo(25.0);
        assertThat(dto.items().get(0).dueAt())
                .isEqualTo(ZonedDateTime.of(2026, 10, 14, 23, 59, 0, 0, ZoneId.of(ZONE)).toInstant());
    }

    @Test
    void parse_acceptsBareDatesAndDefaultsThemToEndOfDay() {
        CourseDraftDto dto = run(draftWithItems(
                new DraftItem("ASSIGNMENT", "Assignment 1", "2026-09-16", null, null)));

        assertThat(dto.items().get(0).dueAt())
                .isEqualTo(ZonedDateTime.of(2026, 9, 16, 23, 59, 0, 0, ZoneId.of(ZONE)).toInstant());
    }

    @Test
    void parse_dropsItemsWithNoUsableDateOrTitle() {
        CourseDraftDto dto = run(draftWithItems(
                new DraftItem("EXAM", "Exam 3", null, null, null),
                new DraftItem("EXAM", "Exam 2", "sometime in November", null, null),
                new DraftItem("ASSIGNMENT", "  ", "2026-10-14T23:59", null, null),
                new DraftItem("ASSIGNMENT", "Assignment 5", "2026-11-18T23:59", null, null)));

        assertThat(dto.items()).hasSize(1);
        assertThat(dto.items().get(0).title()).isEqualTo("Assignment 5");
        assertThat(dto.warnings()).anyMatch(w -> w.contains("Skipped 3 items"));
    }

    @Test
    void parse_defaultsUnknownItemTypeToAssignment() {
        CourseDraftDto dto = run(draftWithItems(
                new DraftItem("QUIZ", "Pop quiz", "2026-10-14T23:59", null, null)));

        assertThat(dto.items().get(0).type()).isEqualTo(ItemType.ASSIGNMENT);
    }

    @Test
    void parse_discardsOutOfRangeWeights() {
        CourseDraftDto dto = run(draftWithItems(
                new DraftItem("EXAM", "Exam 1", "2026-10-14T23:59", -5.0, null),
                new DraftItem("EXAM", "Exam 2", "2026-11-18T23:59", 5000.0, null)));

        assertThat(dto.items()).hasSize(2);
        assertThat(dto.items()).allMatch(i -> i.weight() == null);
    }

    @Test
    void parse_survivesNullListsAndNullEntriesFromTheModel() {
        CourseDraftDto dto = run(new CourseDraft(
                "Circuits", null, null, null,
                Arrays.asList((DraftBlock) null), Arrays.asList((DraftItem) null), null));

        assertThat(dto.meetingBlocks()).isEmpty();
        assertThat(dto.items()).isEmpty();
        assertThat(dto.warnings()).isEmpty();
    }

    @Test
    void parse_passesModelWarningsThrough() {
        CourseDraftDto dto = run(new CourseDraft(
                "Circuits", null, null, null, List.of(), List.of(),
                Arrays.asList("Quizzes, Assignments and Labs share 15% between them.", null, "  ")));

        assertThat(dto.warnings()).containsExactly(
                "Quizzes, Assignments and Labs share 15% between them.");
    }

    @Test
    void parse_capsTheNumberOfItemsKept() {
        List<DraftItem> many = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            many.add(new DraftItem("ASSIGNMENT", "Item " + i, "2026-10-14T23:59", null, null));
        }
        CourseDraftDto dto = run(new CourseDraft(
                "Circuits", null, null, null, List.of(), many, List.of()));

        assertThat(dto.items()).hasSize(60);
    }

    private CourseDraft draftWithBlocks(DraftBlock... blocks) {
        return new CourseDraft("Circuits", null, null, null,
                Arrays.asList(blocks), List.of(), List.of());
    }

    private CourseDraft draftWithItems(DraftItem... items) {
        return new CourseDraft("Circuits", null, null, null,
                List.of(), Arrays.asList(items), List.of());
    }
}
