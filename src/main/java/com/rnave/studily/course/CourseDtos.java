package com.rnave.studily.course;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.ItemType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalTime;
import java.util.Comparator;
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
            String location,
            String color,
            List<MeetingBlockDto> meetingBlocks) {

        public static CourseDto from(Course c) {
            return new CourseDto(
                    c.getId(),
                    c.getSemester() != null ? c.getSemester().getId() : null,
                    c.getName(), c.getCode(), c.getProfessor(), c.getLocation(), c.getColor(),
                    c.getMeetingBlocks().stream().map(MeetingBlockDto::from).toList());
        }
    }

    public record CourseRequest(
            @NotBlank @Size(max = 255) String name,
            Long semesterId,
            @Size(max = 255) String code,
            @Size(max = 255) String professor,
            @Size(max = 255) String location,
            @Size(max = 50) String color,
            @Valid List<MeetingBlockDto> meetingBlocks) {
    }

    public record MatchItemDto(
            ItemType type,
            String title,
            Instant dueAt,
            Double weight,
            String location) {

        public static MatchItemDto from(AcademicItem item) {
            return new MatchItemDto(item.getType(), item.getTitle(), item.getDueAt(),
                    item.getWeight(), item.getLocation());
        }
    }

    public record CourseMatchDto(
            Long id,
            String name,
            String code,
            String professor,
            String location,
            String school,
            List<MeetingBlockDto> meetingBlocks,
            List<MatchItemDto> items,
            int userCount) {

        public static CourseMatchDto from(Course c, int userCount) {
            return new CourseMatchDto(
                    c.getId(), c.getName(), c.getCode(), c.getProfessor(), c.getLocation(),
                    c.getUser().getSchool(),
                    c.getMeetingBlocks().stream().map(MeetingBlockDto::from).toList(),
                    c.getItems().stream()
                            .sorted(Comparator.comparing(AcademicItem::getDueAt))
                            .map(MatchItemDto::from)
                            .toList(),
                    userCount);
        }
    }

    public record ImportRequest(@NotNull Long sourceCourseId, Long semesterId) {
    }
}
