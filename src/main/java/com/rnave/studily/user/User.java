package com.rnave.studily.user;

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
@Table(name = "users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, unique = true)
    private String username;

    private String name;
    private String school;
    private String schoolId;
    private Integer year;
    private String major;

    @Column(length = 1000)
    private String bio;

    private byte[] avatarImage;
    private String avatarContentType;

    @Column(nullable = false)
    private int avatarVersion = 0;

    @Column(nullable = false)
    private int tokenVersion = 0;

    @Column(nullable = false)
    private boolean emailVerified = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
