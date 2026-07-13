package com.rnave.studily.notification;

import com.rnave.studily.config.CurrentUser;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/notifications")
public class NotificationPrefsController {

    private final NotificationPrefsService prefsService;
    private final CurrentUser currentUser;

    public NotificationPrefsController(NotificationPrefsService prefsService, CurrentUser currentUser) {
        this.prefsService = prefsService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public PrefsDto get() {
        return PrefsDto.from(prefsService.prefsFor(currentUser.id()));
    }

    @PutMapping
    public PrefsDto update(@Valid @RequestBody PrefsDto body) {
        NotificationPrefs updated = new NotificationPrefs();
        updated.setMessages(body.messages());
        updated.setClassReminders(body.classReminders());
        updated.setEventDayOf(body.eventDayOf());
        updated.setItemWeekAhead(body.itemWeekAhead());
        updated.setExamDayOf(body.examDayOf());
        return PrefsDto.from(prefsService.update(currentUser.id(), updated));
    }

    public record PrefsDto(
            @NotNull Boolean messages,
            @NotNull Boolean classReminders,
            @NotNull Boolean eventDayOf,
            @NotNull Boolean itemWeekAhead,
            @NotNull Boolean examDayOf) {

        static PrefsDto from(NotificationPrefs prefs) {
            return new PrefsDto(prefs.isMessages(), prefs.isClassReminders(),
                    prefs.isEventDayOf(), prefs.isItemWeekAhead(), prefs.isExamDayOf());
        }
    }
}
