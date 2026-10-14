package com.rnave.studily.parse;

import java.util.List;

public record ScheduleDraft(
        Boolean isSchedule,
        List<ScheduleCourse> courses,
        List<String> warnings) {

    public boolean notASchedule() {
        return Boolean.FALSE.equals(isSchedule);
    }

    public record ScheduleCourse(
            String name,
            String code,
            String color,
            List<CourseDraft.DraftBlock> meetingBlocks) {
    }
}
