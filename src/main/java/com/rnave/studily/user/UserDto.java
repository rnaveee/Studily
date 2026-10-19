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
        FlairRef flair,
        boolean emailVerified,
        boolean admin,
        boolean welcomed,
        Instant createdAt,
        boolean suspended,
        Instant suspendedUntil,
        boolean banned) {

    public static UserDto from(User u, boolean admin, Flairs flairs) {
        boolean suspended = !admin && u.isSuspendedAt(Instant.now());
        return new UserDto(
                u.getId(), u.getEmail(), u.getUsername(), u.getName(), u.getSchool(),
                u.getSchoolId(), u.getYear(), u.getMajor(), u.getBio(), AvatarUrls.of(u), flairs.refOf(u),
                u.isEmailVerified(), admin, u.getWelcomedAt() != null, u.getCreatedAt(),
                suspended, suspended ? u.getSuspendedUntil() : null, suspended && u.isBanned());
    }
}
