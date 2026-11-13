package com.rnave.studily.donation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StripeEventRepository extends JpaRepository<StripeEvent, String> {

    @Modifying
    @Query(value = "INSERT INTO stripe_events (event_id, type, received_at) VALUES (:id, :type, now()) "
            + "ON CONFLICT (event_id) DO NOTHING", nativeQuery = true)
    int insertIfAbsent(@Param("id") String id, @Param("type") String type);
}
