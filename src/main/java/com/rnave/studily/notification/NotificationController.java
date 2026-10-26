package com.rnave.studily.notification;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.PageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    static final List<NotificationType> CENTER_TYPES = List.of(
            NotificationType.ANNOUNCEMENT, NotificationType.FRIEND_REQUEST, NotificationType.FEED_REVIEW,
            NotificationType.FEED_UPDATE);

    private final NotificationRepository notificationRepository;
    private final CurrentUser currentUser;

    public NotificationController(NotificationRepository notificationRepository, CurrentUser currentUser) {
        this.notificationRepository = notificationRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public PageResponse<NotificationDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Slice<Notification> slice = notificationRepository.findByUserIdOrderByCreatedAtDescIdDesc(
                currentUser.id(),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        return new PageResponse<>(
                slice.getContent().stream().map(NotificationDto::from).toList(),
                slice.hasNext());
    }

    @GetMapping("/center")
    public PageResponse<NotificationDto> center(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Slice<Notification> slice = notificationRepository.findByUserIdAndTypeInAndDismissedFalseOrderByCreatedAtDescIdDesc(
                currentUser.id(), CENTER_TYPES,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        return new PageResponse<>(
                slice.getContent().stream().map(NotificationDto::from).toList(),
                slice.hasNext());
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount() {
        return Map.of("count", notificationRepository.countByUserIdAndReadFalseAndDismissedFalseAndTypeIn(
                currentUser.id(), CENTER_TYPES));
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void readAll() {
        notificationRepository.markAllRead(currentUser.id(), CENTER_TYPES);
    }

    @PostMapping("/clear")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void clear() {
        notificationRepository.dismissAll(currentUser.id(), CENTER_TYPES);
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void markRead(@PathVariable Long id) {
        Notification n = notificationRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        n.setRead(true);
    }

    public record NotificationDto(
            Long id, NotificationType type, String title, String message, String url,
            Long relatedItemId, boolean read, Instant createdAt) {

        static NotificationDto from(Notification n) {
            return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getMessage(), n.getUrl(),
                    n.getRelatedItemId(), n.isRead(), n.getCreatedAt());
        }
    }
}
