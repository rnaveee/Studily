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

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

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

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void markRead(@PathVariable Long id) {
        Notification n = notificationRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        n.setRead(true);
    }

    public record NotificationDto(
            Long id, NotificationType type, String message, Long relatedItemId,
            boolean read, Instant createdAt) {

        static NotificationDto from(Notification n) {
            return new NotificationDto(n.getId(), n.getType(), n.getMessage(),
                    n.getRelatedItemId(), n.isRead(), n.getCreatedAt());
        }
    }
}
