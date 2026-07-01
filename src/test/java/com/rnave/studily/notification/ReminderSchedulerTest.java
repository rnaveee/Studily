package com.rnave.studily.notification;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.course.Course;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReminderSchedulerTest {

    private AcademicItemRepository itemRepository;
    private NotificationRepository notificationRepository;
    private ReminderScheduler scheduler;

    private User user;
    private AcademicItem item;

    @BeforeEach
    void setUp() {
        itemRepository = mock(AcademicItemRepository.class);
        notificationRepository = mock(NotificationRepository.class);
        scheduler = new ReminderScheduler(itemRepository, notificationRepository, 48);

        user = new User();
        user.setId(1L);

        Course course = new Course();
        course.setId(10L);
        course.setName("CMPT 300");
        course.setUser(user);

        item = new AcademicItem();
        item.setId(100L);
        item.setCourse(course);
        item.setTitle("Assignment 3");
        item.setDueAt(Instant.now().plusSeconds(3600));

        when(itemRepository.findByStatusNotAndDueAtBetween(eq(ItemStatus.DONE), any(), any()))
                .thenReturn(List.of(item));
    }

    @Test
    void createsReminderForUpcomingItemNotYetNotified() {
        when(notificationRepository.existsByUserIdAndTypeAndRelatedItemId(
                1L, NotificationType.DEADLINE_REMINDER, 100L)).thenReturn(false);

        scheduler.generateDeadlineReminders();

        verify(notificationRepository, times(1)).save(any(Notification.class));
    }

    @Test
    void skipsItemAlreadyNotified() {
        when(notificationRepository.existsByUserIdAndTypeAndRelatedItemId(
                1L, NotificationType.DEADLINE_REMINDER, 100L)).thenReturn(true);

        scheduler.generateDeadlineReminders();

        verify(notificationRepository, never()).save(any(Notification.class));
    }
}
