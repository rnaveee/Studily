package com.rnave.studily.moderation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "report_evidence")
@Getter
@Setter
public class ReportEvidence {

    @Id
    @Column(name = "report_id")
    private Long reportId;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private byte[] data;
}
