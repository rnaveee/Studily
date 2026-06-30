package com.rnave.studily.semester;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class SemesterDtos {

    public record SemesterDto(
            Long id,
            SemesterTerm term,
            Integer year,
            String label,
            LocalDate startDate,
            LocalDate endDate) {

        public static SemesterDto from(Semester s) {
            return new SemesterDto(
                    s.getId(), s.getTerm(), s.getYear(),
                    toLabel(s.getTerm(), s.getYear()),
                    s.getStartDate(), s.getEndDate());
        }

        private static String toLabel(SemesterTerm term, Integer year) {
            String t = switch (term) {
                case FALL -> "Fall";
                case SPRING -> "Spring";
                case SUMMER -> "Summer";
                case WINTER -> "Winter";
            };
            return t + " " + year;
        }
    }

    public record SemesterRequest(
            @NotNull SemesterTerm term,
            @NotNull @Min(2000) @Max(2100) Integer year,
            LocalDate startDate,
            LocalDate endDate) {
    }
}
