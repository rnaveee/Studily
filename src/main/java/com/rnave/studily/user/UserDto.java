package com.rnave.studily.user;

import java.time.Instant;

public record UserDto(
        Long id,
        String email,
        String username,
        String name,
        String school,
        String schoolId,
        Integer year,
        String major,
        String bio,
        String avatarUrl,
        boolean emailVerified,
        Instant createdAt) {

    public static UserDto from(User u) {
        return new UserDto(
                u.getId(), u.getEmail(), u.getUsername(), u.getName(), u.getSchool(),
                u.getSchoolId(), u.getYear(), u.getMajor(), u.getBio(), AvatarUrls.of(u),
                u.isEmailVerified(), u.getCreatedAt());
    }
}
