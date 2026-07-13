package com.rnave.studily.notification;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationPrefsService {

    private final NotificationPrefsRepository prefsRepository;

    public NotificationPrefsService(NotificationPrefsRepository prefsRepository) {
        this.prefsRepository = prefsRepository;
    }

    @Transactional(readOnly = true)
    public NotificationPrefs prefsFor(Long userId) {
        return prefsRepository.findById(userId).orElseGet(() -> {
            NotificationPrefs defaults = new NotificationPrefs();
            defaults.setUserId(userId);
            return defaults;
        });
    }

    @Transactional
    public NotificationPrefs update(Long userId, NotificationPrefs updated) {
        NotificationPrefs prefs = prefsFor(userId);
        prefs.setMessages(updated.isMessages());
        prefs.setClassReminders(updated.isClassReminders());
        prefs.setEventDayOf(updated.isEventDayOf());
        prefs.setItemWeekAhead(updated.isItemWeekAhead());
        prefs.setExamDayOf(updated.isExamDayOf());
        return prefsRepository.save(prefs);
    }
}
