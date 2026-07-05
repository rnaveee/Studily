package com.rnave.studily.flashcard;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "flashcards")
@Getter
@Setter
public class Flashcard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "set_id", nullable = false)
    private FlashcardSet set;

    @Column(nullable = false, columnDefinition = "text")
    private String front;

    @Column(nullable = false, columnDefinition = "text")
    private String back;

    @Column(nullable = false)
    private int position;
}
