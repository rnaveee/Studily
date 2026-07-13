package com.rnave.studily.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "notification_prefs")
@Getter
@Setter
public class NotificationPrefs {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private boolean messages = true;

    @Column(nullable = false)
    private boolean classReminders = true;

    @Column(nullable = false)
    private boolean eventDayOf = true;

    @Column(nullable = false)
    private boolean itemWeekAhead = true;

    @Column(nullable = false)
    private boolean examDayOf = true;
}
