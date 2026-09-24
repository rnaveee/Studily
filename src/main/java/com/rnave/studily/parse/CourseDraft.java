package com.rnave.studily.parse;

import java.util.List;

public record CourseDraft(
        String name,
        String code,
        String professor,
        String location,
        List<DraftBlock> meetingBlocks,
        List<DraftCategory> gradeCategories,
        List<DraftItem> items,
        List<String> warnings,
        Boolean isCourseOutline) {

    public CourseDraft(String name, String code, String professor, String location,
                       List<DraftBlock> meetingBlocks, List<DraftCategory> gradeCategories,
                       List<DraftItem> items, List<String> warnings) {
        this(name, code, professor, location, meetingBlocks, gradeCategories, items, warnings, true);
    }

    public boolean notAnOutline() {
        return Boolean.FALSE.equals(isCourseOutline);
    }

    public record DraftBlock(
            String day,
            String kind,
            String startTime,
            String endTime,
            String location) {
    }

    public record DraftItem(
            String type,
            String title,
            String dueAt,
            Double weight,
            String location,
            String category) {
    }

    public record DraftCategory(
            String name,
            Double weight) {
    }
}
