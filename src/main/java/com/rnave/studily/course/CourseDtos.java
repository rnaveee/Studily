package com.rnave.studily.course;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.util.List;

public class CourseDtos {

    public record MeetingBlockDto(
            Long id,
            @NotNull DayOfWeek dayOfWeek,
            @NotNull LocalTime startTime,
            @NotNull LocalTime endTime) {

        public static MeetingBlockDto from(MeetingBlock mb) {
            return new MeetingBlockDto(mb.getId(), mb.getDayOfWeek(), mb.getStartTime(), mb.getEndTime());
        }
    }

    public record CourseDto(
            Long id,
            Long semesterId,
            String name,
            String code,
            String professor,
            String color,
            List<MeetingBlockDto> meetingBlocks) {

        public static CourseDto from(Course c) {
            return new CourseDto(
                    c.getId(),
                    c.getSemester() != null ? c.getSemester().getId() : null,
                    c.getName(), c.getCode(), c.getProfessor(), c.getColor(),
                    c.getMeetingBlocks().stream().map(MeetingBlockDto::from).toList());
        }
    }

    public record CourseRequest(
            @NotBlank @Size(max = 255) String name,
            Long semesterId,
            @Size(max = 255) String code,
            @Size(max = 255) String professor,
            @Size(max = 50) String color,
            @Valid List<MeetingBlockDto> meetingBlocks) {
    }
}
