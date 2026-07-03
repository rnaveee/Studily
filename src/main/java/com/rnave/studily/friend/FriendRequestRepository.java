package com.rnave.studily.friend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    List<FriendRequest> findByAddresseeIdAndStatusOrderByCreatedAtDesc(Long addresseeId, FriendRequestStatus status);

    List<FriendRequest> findByRequesterIdAndStatusOrderByCreatedAtDesc(Long requesterId, FriendRequestStatus status);

    List<FriendRequest> findByRequesterIdOrAddresseeId(Long requesterId, Long addresseeId);

    @Query("""
            select f from FriendRequest f
            where f.status = com.rnave.studily.friend.FriendRequestStatus.ACCEPTED
              and (f.requester.id = :userId or f.addressee.id = :userId)
            order by f.respondedAt desc
            """)
    List<FriendRequest> findFriendsOf(@Param("userId") Long userId);

    @Query("""
            select f from FriendRequest f
            where (f.requester.id = :a and f.addressee.id = :b)
               or (f.requester.id = :b and f.addressee.id = :a)
            """)
    Optional<FriendRequest> findBetween(@Param("a") Long a, @Param("b") Long b);
}
