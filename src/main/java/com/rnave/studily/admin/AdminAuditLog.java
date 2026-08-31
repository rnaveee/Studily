package com.rnave.studily.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "admin_audit_log")
@Getter
@Setter
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", nullable = false)
    private String actorName;

    @Column(nullable = false, length = 60)
    private String action;

    private String target;

    @Column(columnDefinition = "text")
    private String detail;

    @Column(length = 64)
    private String ip;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
