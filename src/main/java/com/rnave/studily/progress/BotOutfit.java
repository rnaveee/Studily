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
@Table(name = "bot_outfits")
@Getter
@Setter
public class BotOutfit {

    @Id
    @Column(length = 48)
    private String code;

    @Column(nullable = false, length = 64)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BotOutfitSlot slot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FlairRarity rarity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BotOutfitUnlock unlock;

    private Integer priceCoins;

    @Column(nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;
}
