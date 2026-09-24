package com.rnave.studily.parse;

import com.rnave.studily.parse.CourseDraft.DraftItem;
import com.rnave.studily.parse.ExtractedInput.ExtractedImage;
import com.rnave.studily.semester.Semester;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CourseParseCacheTest {

    private static final ZoneId ZONE = ZoneId.of("America/Vancouver");

    @Test
    void key_ignoresWhitespaceDifferences() {
        String a = CourseParseCache.key(new ExtractedInput("ENSC 204\n\n Outline  ", List.of()), null, ZONE);
        String b = CourseParseCache.key(new ExtractedInput("ENSC 204 Outline", List.of()), null, ZONE);

        assertThat(a).isEqualTo(b).hasSize(64);
    }

    @Test
    void key_changesWithContentSemesterZoneAndImages() {
        ExtractedInput text = new ExtractedInput("ENSC 204 Outline", List.of());
        String base = CourseParseCache.key(text, null, ZONE);

        assertThat(CourseParseCache.key(new ExtractedInput("ENSC 220 Outline", List.of()), null, ZONE))
                .isNotEqualTo(base);
        assertThat(CourseParseCache.key(text, null, ZoneId.of("America/Toronto"))).isNotEqualTo(base);
        assertThat(CourseParseCache.key(text, semester(2026), ZONE)).isNotEqualTo(base);
        assertThat(CourseParseCache.key(text, semester(2026), ZONE))
                .isNotEqualTo(CourseParseCache.key(text, semester(2027), ZONE));
        assertThat(CourseParseCache.key(new ExtractedInput("ENSC 204 Outline",
                List.of(new ExtractedImage("image/png", new byte[]{1}))), null, ZONE)).isNotEqualTo(base);
    }

    @Test
    void storedDraftRoundTripsIncludingTheOutlineFlag() {
        CourseParseCacheRepository repository = mock(CourseParseCacheRepository.class);
        CourseParseCache cache = new CourseParseCache(repository);
        CourseDraft draft = new CourseDraft("Circuits", "ENSC 220", null, null, List.of(), List.of(),
                List.of(new DraftItem("ASSIGNMENT", "Lab 2", "2026-09-19T23:59", null, null, "Labs")),
                List.of("note"), false);

        cache.store("k", draft, "claude-sonnet-5");
        ArgumentCaptor<CourseParseCacheEntry> saved = ArgumentCaptor.forClass(CourseParseCacheEntry.class);
        verify(repository).save(saved.capture());
        when(repository.findByCacheKeyAndCreatedAtAfter(eq("k"), any())).thenReturn(Optional.of(saved.getValue()));

        assertThat(cache.lookup("k")).contains(draft);
        verify(repository).recordHit("k");
    }

    private static Semester semester(int year) {
        Semester semester = new Semester();
        semester.setYear(year);
        semester.setStartDate(LocalDate.of(year, 9, 1));
        semester.setEndDate(LocalDate.of(year, 12, 15));
        return semester;
    }
}
