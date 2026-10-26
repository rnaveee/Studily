package com.rnave.studily.notification;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Slice<Notification> findByUserIdOrderByCreatedAtDescIdDesc(Long userId, Pageable pageable);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndTypeAndRelatedItemId(Long userId, NotificationType type, Long relatedItemId);

    boolean existsByUserIdAndDedupKey(Long userId, String dedupKey);

    Slice<Notification> findByUserIdAndTypeInOrderByCreatedAtDescIdDesc(
            Long userId, Collection<NotificationType> types, Pageable pageable);

    long countByUserIdAndReadFalseAndTypeIn(Long userId, Collection<NotificationType> types);

    @Modifying
    @Query("update Notification n set n.read = true "
            + "where n.user.id = :userId and n.read = false and n.type in :types")
    int markAllRead(@Param("userId") Long userId, @Param("types") Collection<NotificationType> types);

    @Modifying
    @Query("update Notification n set n.read = true "
            + "where n.type = :type and n.relatedItemId = :relatedItemId and n.read = false")
    int markReadByTypeAndRelatedItemId(
            @Param("type") NotificationType type, @Param("relatedItemId") Long relatedItemId);

    @Modifying
    @Query("update Notification n set n.read = true "
            + "where n.user.id = :userId and n.type = :type and n.relatedItemId = :relatedItemId")
    int markRead(@Param("userId") Long userId, @Param("type") NotificationType type,
                 @Param("relatedItemId") Long relatedItemId);
}
