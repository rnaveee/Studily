package com.rnave.studily.notification;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
public class ReminderScheduler {

    private static final DateTimeFormatter DUE_FMT =
            DateTimeFormatter.ofPattern("MMM d, HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final AcademicItemRepository itemRepository;
    private final NotificationRepository notificationRepository;
    private final long windowHours;

    public ReminderScheduler(AcademicItemRepository itemRepository,
                             NotificationRepository notificationRepository,
                             @Value("${app.reminders.window-hours}") long windowHours) {
        this.itemRepository = itemRepository;
        this.notificationRepository = notificationRepository;
        this.windowHours = windowHours;
    }

    @Scheduled(fixedRate = 3_600_000, initialDelay = 30_000)
    @Transactional
    public void generateDeadlineReminders() {
        Instant now = Instant.now();
        Instant until = now.plus(Duration.ofHours(windowHours));
        List<AcademicItem> upcoming =
                itemRepository.findByStatusNotAndDueAtBetween(ItemStatus.DONE, now, until);

        for (AcademicItem item : upcoming) {
            Long userId = item.getCourse().getUser().getId();
            if (notificationRepository.existsByUserIdAndTypeAndRelatedItemId(
                    userId, NotificationType.DEADLINE_REMINDER, item.getId())) {
                continue;
            }
            Notification n = new Notification();
            n.setUser(item.getCourse().getUser());
            n.setType(NotificationType.DEADLINE_REMINDER);
            n.setRelatedItemId(item.getId());
            n.setMessage("%s for %s is due %s".formatted(
                    item.getTitle(), item.getCourse().getName(), DUE_FMT.format(item.getDueAt())));
            notificationRepository.save(n);
        }
    }
}
