package com.rnave.studily.conversation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "message_attachments")
@Getter
@Setter
public class MessageAttachment {

    @Id
    @Column(name = "message_id")
    private Long messageId;

    @Column(nullable = false)
    private byte[] data;
}
