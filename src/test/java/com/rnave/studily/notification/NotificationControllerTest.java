package com.rnave.studily.notification;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.PageResponse;
import com.rnave.studily.notification.NotificationController.NotificationDto;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.SliceImpl;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationControllerTest {

    private NotificationRepository notificationRepository;
    private NotificationController controller;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(7L);
        controller = new NotificationController(notificationRepository, currentUser);
    }

    @Test
    void center_returnsCenterTypesWithTitleAndUrl() {
        User user = new User();
        user.setId(7L);
        Notification n = new Notification();
        n.setId(3L);
        n.setUser(user);
        n.setType(NotificationType.FRIEND_REQUEST);
        n.setTitle("Sam sent you a friend request");
        n.setMessage("Open Friends to accept or decline.");
        n.setUrl("/friends");
        n.setRelatedItemId(9L);
        when(notificationRepository.findByUserIdAndTypeInAndDismissedFalseOrderByCreatedAtDescIdDesc(
                7L, NotificationController.CENTER_TYPES, PageRequest.of(0, 20)))
                .thenReturn(new SliceImpl<>(List.of(n), PageRequest.of(0, 20), false));

        PageResponse<NotificationDto> result = controller.center(0, 20);

        assertThat(result.items()).hasSize(1);
        NotificationDto dto = result.items().get(0);
        assertThat(dto.title()).isEqualTo("Sam sent you a friend request");
        assertThat(dto.url()).isEqualTo("/friends");
        assertThat(dto.type()).isEqualTo(NotificationType.FRIEND_REQUEST);
        assertThat(result.hasMore()).isFalse();
    }

    @Test
    void center_clampsPageAndSize() {
        when(notificationRepository.findByUserIdAndTypeInAndDismissedFalseOrderByCreatedAtDescIdDesc(any(), any(), any()))
                .thenReturn(new SliceImpl<>(List.of()));

        controller.center(-4, 5000);

        verify(notificationRepository).findByUserIdAndTypeInAndDismissedFalseOrderByCreatedAtDescIdDesc(
                7L, NotificationController.CENTER_TYPES, PageRequest.of(0, 100));
    }

    @Test
    void centerTypes_excludeReminders() {
        assertThat(NotificationController.CENTER_TYPES).containsExactlyInAnyOrder(
                NotificationType.ANNOUNCEMENT, NotificationType.FRIEND_REQUEST, NotificationType.FEED_REVIEW,
                NotificationType.FEED_UPDATE);
    }

    @Test
    void unreadCount_countsUnreadCenterTypesForTheCaller() {
        when(notificationRepository.countByUserIdAndReadFalseAndDismissedFalseAndTypeIn(7L, NotificationController.CENTER_TYPES))
                .thenReturn(4L);

        assertThat(controller.unreadCount()).containsEntry("count", 4L);
    }

    @Test
    void readAll_marksOnlyCenterTypesForTheCaller() {
        controller.readAll();

        verify(notificationRepository).markAllRead(7L, NotificationController.CENTER_TYPES);
    }

    @Test
    void clear_hidesOnlyCenterTypesForTheCaller() {
        controller.clear();

        verify(notificationRepository).dismissAll(7L, NotificationController.CENTER_TYPES);
    }
}
