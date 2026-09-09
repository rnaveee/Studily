package com.rnave.studily.parse;

import com.rnave.studily.academic.ItemType;
import com.rnave.studily.course.CourseDtos.MeetingBlockDto;

import java.util.List;

public class CourseParseDtos {

    public record DraftItemDto(
            ItemType type,
            String title,
            String dueAt,
            Double weight,
            String location) {
    }

    public record CourseDraftDto(
            String name,
            String code,
            String professor,
            String location,
            List<MeetingBlockDto> meetingBlocks,
            List<DraftItemDto> items,
            List<String> warnings) {
    }

    public record ParseAvailabilityDto(boolean enabled) {
    }
}
