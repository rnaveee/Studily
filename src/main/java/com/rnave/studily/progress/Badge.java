package com.rnave.studily.progress;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "badges")
@Getter
@Setter
public class Badge {

    @Id
    @Column(length = 48)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BadgeCategory category;

    @Column(nullable = false, length = 64)
    private String title;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false, length = 128)
    private String imageKey;

    private Integer priceCoins;

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;
}
