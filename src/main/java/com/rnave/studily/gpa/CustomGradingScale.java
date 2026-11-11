package com.rnave.studily.gpa;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "custom_grading_scales")
@Getter
@Setter
public class CustomGradingScale {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(length = 40)
    private String name;

    @Column(nullable = false)
    private Instant updatedAt;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "custom_grading_scale_bands", joinColumns = @JoinColumn(name = "user_id"))
    @OrderBy("minPercent DESC")
    private List<CustomGradeBand> bands = new ArrayList<>();
}
