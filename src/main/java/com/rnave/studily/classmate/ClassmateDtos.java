package com.rnave.studily.classmate;

import com.rnave.studily.user.User;

public class ClassmateDtos {

    public record PublicUserDto(
            Long id,
            String username,
            String name,
            String school,
            Integer year,
            String major,
            String bio,
            String avatarUrl) {

        public static PublicUserDto from(User u) {
            return new PublicUserDto(
                    u.getId(), u.getUsername(), u.getName(), u.getSchool(),
                    u.getYear(), u.getMajor(), u.getBio(), u.getAvatarUrl());
        }
    }

    public record ClassmateSuggestion(
            PublicUserDto user,
            String sharedCourseCode,
            String sharedCourseName) {
    }
}
