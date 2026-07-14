package com.rnave.studily.notification;

import com.rnave.studily.push.PushPayload;
import com.rnave.studily.push.WebPushSender;
import com.rnave.studily.user.User;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class NotificationDispatcher {

    private final NotificationRepository notificationRepository;
    private final WebPushSender webPushSender;

    public NotificationDispatcher(NotificationRepository notificationRepository, WebPushSender webPushSender) {
        this.notificationRepository = notificationRepository;
        this.webPushSender = webPushSender;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void dispatch(User user, NotificationType type, Long relatedItemId,
                         String dedupKey, String title, String body, String url) {
        if (notificationRepository.existsByUserIdAndDedupKey(user.getId(), dedupKey)) {
            return;
        }
        Notification n = new Notification();
        n.setUser(user);
        n.setType(type);
        n.setRelatedItemId(relatedItemId);
        n.setDedupKey(dedupKey);
        n.setMessage(body);
        try {
            notificationRepository.saveAndFlush(n);
        } catch (DataIntegrityViolationException e) {
            return;
        }
        webPushSender.sendToUser(user.getId(), PushPayload.of(title, body, url), type.pushTtlSeconds());
    }
}
