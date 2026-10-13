package com.rnave.studily.flashcard;

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
@Table(name = "flashcard_images")
@Getter
@Setter
public class FlashcardImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "image_key", nullable = false, unique = true, length = 32)
    private String imageKey;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(nullable = false, length = 32)
    private String contentType;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(nullable = false)
    private int sizeBytes;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
