package com.rnave.studily.ics;

import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.ics.IcsDtos.SyncResult;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IcsServiceTest {

    private CalendarEventRepository eventRepository;
    private IcsService service;
    private User user;

    @BeforeEach
    void setUp() {
        eventRepository = mock(CalendarEventRepository.class);
        service = new IcsService(eventRepository, mock(AcademicItemRepository.class), mock(IcsFetcher.class),
                mock(CurrentUser.class));
        user = new User();
        user.setId(4L);
        when(eventRepository.findByUserIdAndExternalUid(anyLong(), anyString())).thenReturn(Optional.empty());
        when(eventRepository.findByUserIdAndFeedId(anyLong(), anyLong())).thenReturn(List.of());
    }

    private static String feed(String... events) {
        return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Personal\r\n" + String.join("", events)
                + "END:VCALENDAR\r\n";
    }

    private static String event(String uid, String summary, String start) {
        return "BEGIN:VEVENT\r\nUID:" + uid + "\r\nSUMMARY:" + summary + "\r\nDTSTART:" + start
                + "\r\nEND:VEVENT\r\n";
    }

    private static CalendarEvent stored(String uid, String title, String start, Long feedId) {
        CalendarEvent e = new CalendarEvent();
        e.setExternalUid(uid);
        e.setTitle(title);
        e.setStartAt(Instant.parse(start));
        e.setFeedId(feedId);
        return e;
    }

    @Test
    void newEventsAreAddedAndTiedToTheFeed() {
        SyncResult result = service.sync(user, feed(event("a@google.com", "Dentist", "20261030T220000Z")),
                "America/Vancouver", 9L, false);

        ArgumentCaptor<CalendarEvent> saved = ArgumentCaptor.forClass(CalendarEvent.class);
        verify(eventRepository).save(saved.capture());
        assertThat(saved.getValue().getFeedId()).isEqualTo(9L);
        assertThat(result.added()).singleElement().satisfies(a -> assertThat(a.title()).isEqualTo("Dentist"));
        assertThat(result.result().synced()).isTrue();
    }

    @Test
    void movedEventsAreReportedAndUnchangedOnesAreNot() {
        CalendarEvent moved = stored("a@google.com", "Club", "2026-10-30T22:00:00Z", 9L);
        CalendarEvent same = stored("b@google.com", "Gym", "2026-10-31T16:00:00Z", 9L);
        when(eventRepository.findByUserIdAndExternalUid(4L, "a@google.com")).thenReturn(Optional.of(moved));
        when(eventRepository.findByUserIdAndExternalUid(4L, "b@google.com")).thenReturn(Optional.of(same));

        SyncResult result = service.sync(user, feed(event("a@google.com", "Club", "20261030T230000Z"),
                event("b@google.com", "Gym", "20261031T160000Z")), "UTC", 9L, false);

        assertThat(result.changes()).singleElement().satisfies(c -> {
            assertThat(c.title()).isEqualTo("Club");
            assertThat(c.previousAt()).isEqualTo(Instant.parse("2026-10-30T22:00:00Z"));
        });
        assertThat(moved.getStartAt()).isEqualTo(Instant.parse("2026-10-30T23:00:00Z"));
        assertThat(result.added()).isEmpty();
    }

    @Test
    void eventsDeletedFromTheFeedAreRemovedButOnlyForThatFeed() {
        CalendarEvent kept = stored("a@google.com", "Club", "2026-10-30T22:00:00Z", 9L);
        CalendarEvent gone = stored("old@google.com", "Cancelled", "2026-10-29T22:00:00Z", 9L);
        when(eventRepository.findByUserIdAndExternalUid(4L, "a@google.com")).thenReturn(Optional.of(kept));
        when(eventRepository.findByUserIdAndFeedId(4L, 9L)).thenReturn(List.of(kept, gone));

        SyncResult result = service.sync(user, feed(event("a@google.com", "Club", "20261030T220000Z")),
                "UTC", 9L, false);

        verify(eventRepository).delete(gone);
        verify(eventRepository, never()).delete(kept);
        assertThat(result.result().removed()).isEqualTo(1);
    }

    @Test
    void oneOffImportsNeverRemoveAnything() {
        SyncResult result = service.sync(user, feed(event("a@google.com", "Club", "20261030T220000Z")),
                "UTC", null, false);

        verify(eventRepository, never()).findByUserIdAndFeedId(anyLong(), anyLong());
        verify(eventRepository, never()).delete(any());
        assertThat(result.result().synced()).isFalse();
    }

    @Test
    void eventsImportedBeforeSyncingAreAdoptedByTheFeed() {
        CalendarEvent earlier = stored("a@google.com", "Club", "2026-10-30T22:00:00Z", null);
        when(eventRepository.findByUserIdAndExternalUid(4L, "a@google.com")).thenReturn(Optional.of(earlier));

        service.sync(user, feed(event("a@google.com", "Club", "20261030T220000Z")), "UTC", 9L, false);

        assertThat(earlier.getFeedId()).isEqualTo(9L);
    }
}
