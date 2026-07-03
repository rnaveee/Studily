package com.rnave.studily.friend;

import com.rnave.studily.user.AvatarUrls;
import com.rnave.studily.user.User;

import java.time.Instant;

public class FriendDtos {

    public enum RelationshipStatus {
        SELF,
        NONE,
        FRIENDS,
        OUTGOING_PENDING,
        INCOMING_PENDING
    }

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
                    u.getYear(), u.getMajor(), u.getBio(), AvatarUrls.of(u));
        }
    }

    public record FriendRequestDto(
            Long id,
            PublicUserDto user,
            FriendRequestStatus status,
            Instant createdAt,
            Instant respondedAt) {
    }

    public record RelationshipDto(
            PublicUserDto user,
            RelationshipStatus status,
            Long requestId) {
    }
}
