package com.rnave.studily.gpa;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
public class CustomGradeBand {

    @Column(name = "min_percent", nullable = false)
    private short minPercent;

    @Column(nullable = false, length = 4)
    private String letter;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal points;

    public CustomGradeBand(short minPercent, String letter, BigDecimal points) {
        this.minPercent = minPercent;
        this.letter = letter;
        this.points = points;
    }
}
