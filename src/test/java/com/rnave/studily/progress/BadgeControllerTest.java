package com.rnave.studily.progress;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.flashcard.FlashcardRunRepository;
import com.rnave.studily.friend.FriendRequestRepository;
import com.rnave.studily.studysession.StudySessionRepository;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BadgeControllerTest {

    private UserRepository userRepository;
    private UserBadgeRepository userBadgeRepository;
    private BadgeController controller;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userBadgeRepository = mock(UserBadgeRepository.class);
        BadgeService service = new BadgeService(mock(BadgeRepository.class), userBadgeRepository, userRepository,
                mock(UserProgressRepository.class), mock(FriendRequestRepository.class),
                mock(StudySessionRepository.class), mock(FlashcardRunRepository.class), mock(ProgressService.class),
                mock(CurrentUser.class), Clock.fixed(Instant.parse("2026-10-07T18:00:00Z"), ZoneOffset.UTC),
                "https://badges.studily.ca/badges/v1", "2026-10-11");
        controller = new BadgeController(service);
    }

    @Test
    void forUser_unknownUser_throwsNotFound() {
        when(userRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> controller.forUser(99L)).isInstanceOf(NotFoundException.class);
        verify(userBadgeRepository, never()).findByUserId(anyLong());
    }
}
