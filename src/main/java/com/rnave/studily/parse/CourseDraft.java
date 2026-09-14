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
        List<String> warnings) {

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
            String kind,
            Double weight) {
    }
}
