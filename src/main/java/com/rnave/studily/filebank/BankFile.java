package com.rnave.studily.filebank;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "bank_files")
@Getter
@Setter
public class BankFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "course_id")
    private Long courseId;

    @Column(name = "chat_id")
    private Long chatId;

    @Column(nullable = false)
    private String name;

    @Column(name = "content_type", nullable = false, length = 150)
    private String contentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private BankFormat format;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BankFileKind kind = BankFileKind.OTHER;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Column(name = "storage_key", nullable = false, unique = true)
    private String storageKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BankFileStatus status = BankFileStatus.QUEUED;

    @Column(name = "status_detail")
    private String statusDetail;

    @Column(name = "page_count")
    private Integer pageCount;

    @Column(name = "chunk_count", nullable = false)
    private int chunkCount;

    @Column(name = "embedding_model", length = 60)
    private String embeddingModel;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @Column(name = "indexed_at")
    private Instant indexedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
