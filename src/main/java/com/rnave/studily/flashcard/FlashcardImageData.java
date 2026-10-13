package com.rnave.studily.flashcard;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "flashcard_image_data")
@Getter
@Setter
public class FlashcardImageData {

    @Id
    @Column(name = "image_id")
    private Long imageId;

    @Column(nullable = false)
    private byte[] data;
}
