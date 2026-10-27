package com.rnave.studily.canvas;

import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.FeedImportDtos.FeedChange;
import com.rnave.studily.canvas.FeedImportDtos.FeedStageResult;
import com.rnave.studily.canvas.FeedImportDtos.StageOutcome;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.canvas.FeedImportDtos.StoredImport;
import com.rnave.studily.canvas.SchoolFeedDtos.SchoolFeedList;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.DeadLinkException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.ics.IcsDtos.AddedEvent;
import com.rnave.studily.ics.IcsDtos.ImportResult;
import com.rnave.studily.ics.IcsDtos.SyncResult;
import com.rnave.studily.ics.IcsService;
import com.rnave.studily.notification.NotificationDispatcher;
import com.rnave.studily.notification.NotificationType;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SchoolFeedServiceTest {

    private static final String URL = "https://school.instructure.com/feeds/calendars/user_secret.ics";
    private static final Instant NOW = Instant.parse("2026-10-25T12:00:00Z");

    private SchoolFeedRepository repository;
    private CanvasFeedService canvasFeedService;
    private FeedImportStore importStore;
    private NotificationDispatcher dispatcher;
    private FeedUrlCipher cipher;
    private IcsService icsService;
    private SchoolFeedService service;
    private User user;
    private List<SchoolFeed> saved;

    @BeforeEach
    void setUp() {
        repository = mock(SchoolFeedRepository.class);
        canvasFeedService = mock(CanvasFeedService.class);
        importStore = mock(FeedImportStore.class);
        dispatcher = mock(NotificationDispatcher.class);
        icsService = mock(IcsService.class);
        cipher = new FeedUrlCipher(FeedUrlCipherTest.keyOf(3));
        service = newService(cipher);
        user = new User();
        user.setId(7L);
        saved = new ArrayList<>();
        when(repository.save(any(SchoolFeed.class))).thenAnswer(inv -> {
            SchoolFeed feed = inv.getArgument(0);
            saved.add(feed);
            return feed;
        });
        when(repository.findByUserIdAndUrlHash(anyLong(), anyString())).thenReturn(Optional.empty());
        when(canvasFeedService.stage(any(), any())).thenReturn(outcome());
        when(importStore.save(any(), any(), any())).thenReturn(stored(5L));
    }

    private SchoolFeedService newService(FeedUrlCipher c) {
        return new SchoolFeedService(repository, c, canvasFeedService, importStore, dispatcher, icsService,
                Clock.fixed(NOW, ZoneOffset.UTC), 6);
    }

    private static StagedItem stagedItem(String key) {
        return new StagedItem(key, key, StagedKind.ITEM, null, "Lab", NOW, null);
    }

    private static StagedPayload payload(String... itemKeys) {
        List<StagedItem> items = new ArrayList<>();
        for (String key : itemKeys) {
            items.add(stagedItem(key));
        }
        return new StagedPayload("CANVAS", 9L, List.of(new StagedCourse("canvas:1", 1L, null, null,
                "Algorithms", "CMPT 225", "#3b82f6", 9L, null, null, items)));
    }

    private static StageOutcome outcome() {
        return new StageOutcome(payload("a", "b"), 0, 0, 0, false, List.of());
    }

    private static StoredImport stored(Long importId) {
        return new StoredImport(new FeedStageResult(importId, "CANVAS", 1, 2, 0, 0, false),
                payload("b", "a"));
    }

    private FeedRequest request(String source, Boolean keepSynced) {
        return new FeedRequest(source, "America/Toronto", 9L, keepSynced);
    }

    private SchoolFeed storedFeed(long id) {
        SchoolFeed feed = new SchoolFeed();
        feed.setId(id);
        feed.setUser(user);
        feed.setProvider("CANVAS");
        feed.setHost("school.instructure.com");
        feed.setUrlCiphertext(cipher.encrypt(URL));
        feed.setUrlHash(SchoolFeedService.sha256(URL));
        feed.setTimeZone("America/Toronto");
        feed.setCreatedAt(NOW.minus(Duration.ofDays(2)));
        feed.setLastSyncedAt(NOW.minus(Duration.ofHours(7)));
        feed.setEnabled(true);
        return feed;
    }

    @Test
    void savesAnEncryptedRowForUrlSources() {
        service.remember(user, request(URL, null), "CANVAS");

        assertThat(saved).hasSize(1);
        SchoolFeed feed = saved.get(0);
        assertThat(feed.getUrlCiphertext()).startsWith("v1:").doesNotContain("user_secret");
        assertThat(cipher.decrypt(feed.getUrlCiphertext())).isEqualTo(URL);
        assertThat(feed.getHost()).isEqualTo("school.instructure.com");
        assertThat(feed.getProvider()).isEqualTo("CANVAS");
        assertThat(feed.getSemesterId()).isEqualTo(9L);
        assertThat(feed.getLastSuccessAt()).isEqualTo(NOW);
        assertThat(feed.getUrlHash()).hasSize(64);
    }

    @Test
    void doesNotSavePastedIcsText() {
        service.remember(user, request("BEGIN:VCALENDAR\nEND:VCALENDAR", null), "CANVAS");

        verify(repository, never()).save(any());
    }

    @Test
    void doesNotSaveWhenKeepSyncedIsFalse() {
        service.remember(user, request(URL, false), "CANVAS");

        verify(repository, never()).save(any());
    }

    @Test
    void doesNotSaveWhenTheCipherIsDisabled() {
        SchoolFeedService disabled = newService(new FeedUrlCipher(""));

        disabled.remember(user, request(URL, null), "CANVAS");

        verify(repository, never()).save(any());
        assertThat(disabled.list(user).available()).isFalse();
    }

    @Test
    void webcalAndHttpsFormsOfTheSameLinkShareAHash() {
        service.remember(user, request("webcal://School.Instructure.com/feeds/calendars/user_secret.ics", null),
                "CANVAS");
        service.remember(user, request(URL, null), "CANVAS");

        assertThat(saved.get(0).getUrlHash()).isEqualTo(saved.get(1).getUrlHash());
    }

    @Test
    void reimportingAnExistingLinkReEnablesItAndResetsFailures() {
        SchoolFeed existing = storedFeed(1L);
        existing.setEnabled(false);
        existing.setFailureCount(5);
        existing.setLastError("It failed");
        when(repository.findByUserIdAndUrlHash(7L, existing.getUrlHash())).thenReturn(Optional.of(existing));

        service.remember(user, request(URL, null), "CANVAS");

        assertThat(saved).containsExactly(existing);
        assertThat(existing.isEnabled()).isTrue();
        assertThat(existing.getFailureCount()).isZero();
        assertThat(existing.getLastError()).isNull();
        assertThat(existing.getLastSyncedAt()).isEqualTo(NOW);
        verify(repository, never()).countByUserId(anyLong());
    }

    @Test
    void capsSavedFeedsAtFivePerUser() {
        when(repository.countByUserId(7L)).thenReturn(5L);

        service.remember(user, request(URL, null), "CANVAS");

        verify(repository, never()).save(any());
    }

    @Test
    void listNeverContainsTheUrl() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findByUserIdOrderByCreatedAtAsc(7L)).thenReturn(List.of(feed));

        SchoolFeedList list = service.list(user);

        assertThat(list.available()).isTrue();
        assertThat(list.feeds()).hasSize(1);
        assertThat(list.feeds().get(0).toString()).doesNotContain("user_secret").doesNotContain("v1:");
        assertThat(list.feeds().get(0).host()).isEqualTo("school.instructure.com");
    }

    @Test
    void otherUsersGetANotFound() {
        when(repository.findByIdAndUserId(1L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.syncNow(user, 1L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(user, 1L)).isInstanceOf(NotFoundException.class);
        verify(repository, never()).delete(any());
    }

    @Test
    void deleteRemovesTheOwnersRow() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findByIdAndUserId(1L, 7L)).thenReturn(Optional.of(feed));

        service.delete(user, 1L);

        verify(repository).delete(feed);
    }

    @Test
    void syncNowIsRateLimitedPerFeed() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findByIdAndUserId(1L, 7L)).thenReturn(Optional.of(feed));

        FeedStageResult first = service.syncNow(user, 1L);

        assertThat(first.importId()).isEqualTo(5L);
        assertThat(first.newItems()).isEqualTo(2);
        assertThatThrownBy(() -> service.syncNow(user, 1L)).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void syncNowRefusesAStoppedFeed() {
        SchoolFeed feed = storedFeed(1L);
        feed.setEnabled(false);
        when(repository.findByIdAndUserId(1L, 7L)).thenReturn(Optional.of(feed));

        assertThatThrownBy(() -> service.syncNow(user, 1L)).isInstanceOf(BadRequestException.class);
        verify(canvasFeedService, never()).stage(any(), any());
    }

    @Test
    void dueSelectionAsksForFeedsOlderThanSixHours() {
        when(repository.findDueIds(any(Instant.class), any(Pageable.class))).thenReturn(List.of(4L));

        assertThat(service.dueFeedIds()).containsExactly(4L);
        verify(repository).findDueIds(NOW.minus(Duration.ofHours(6)), org.springframework.data.domain.PageRequest.of(0, 20));
    }

    @Test
    void successResetsFailuresAndDecryptsTheUrl() {
        SchoolFeed feed = storedFeed(1L);
        feed.setFailureCount(3);
        feed.setLastError("old");
        when(repository.findById(1L)).thenReturn(Optional.of(feed));

        service.syncDue(1L);

        org.mockito.ArgumentCaptor<FeedRequest> captor = org.mockito.ArgumentCaptor.forClass(FeedRequest.class);
        verify(canvasFeedService).stage(eq(user), captor.capture());
        assertThat(captor.getValue().source()).isEqualTo(URL);
        assertThat(captor.getValue().keepSynced()).isFalse();
        assertThat(feed.getFailureCount()).isZero();
        assertThat(feed.getLastError()).isNull();
        assertThat(feed.getLastSyncedAt()).isEqualTo(NOW);
        assertThat(feed.getLastSuccessAt()).isEqualTo(NOW);
    }

    @Test
    void failureIncrementsAndRecordsAUserSafeError() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));
        when(canvasFeedService.stage(any(), any())).thenThrow(new RuntimeException("boom " + URL));

        assertThatThrownBy(() -> service.syncDue(1L)).isInstanceOf(RuntimeException.class);

        assertThat(feed.getFailureCount()).isEqualTo(1);
        assertThat(feed.isEnabled()).isTrue();
        assertThat(feed.getLastSyncedAt()).isEqualTo(NOW);
        assertThat(feed.getLastError()).isEqualTo(SchoolFeedService.GENERIC_ERROR).doesNotContain("user_secret");
    }

    @Test
    void deadLinkStatusDisablesTheFeed() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));
        when(canvasFeedService.stage(any(), any())).thenThrow(new DeadLinkException("That link returned HTTP 404"));

        assertThatThrownBy(() -> service.syncDue(1L)).isInstanceOf(DeadLinkException.class);

        assertThat(feed.isEnabled()).isFalse();
        assertThat(feed.getLastError()).isEqualTo(SchoolFeedService.DEAD_LINK_MESSAGE);
    }

    @Test
    void fiveConsecutiveFailuresDisableTheFeed() {
        SchoolFeed feed = storedFeed(1L);
        feed.setFailureCount(4);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));
        when(canvasFeedService.stage(any(), any())).thenThrow(new BadRequestException("That link returned HTTP 500"));

        assertThatThrownBy(() -> service.syncDue(1L)).isInstanceOf(BadRequestException.class);

        assertThat(feed.getFailureCount()).isEqualTo(5);
        assertThat(feed.isEnabled()).isFalse();
        assertThat(feed.getLastError()).contains("5 times").contains("HTTP 500");
    }

    @Test
    void suspendedUsersAreSkippedButPushedBackInTheQueue() {
        SchoolFeed feed = storedFeed(1L);
        user.setBanned(true);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));

        service.syncDue(1L);

        verify(canvasFeedService, never()).stage(any(), any());
        assertThat(feed.getLastSyncedAt()).isEqualTo(NOW);
        assertThat(feed.getFailureCount()).isZero();
    }

    @Test
    void disabledFeedsAreNotSynced() {
        SchoolFeed feed = storedFeed(1L);
        feed.setEnabled(false);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));

        service.syncDue(1L);

        verify(canvasFeedService, never()).stage(any(), any());
    }

    @Test
    void rememberReturnsTheSavedFeedId() {
        when(repository.save(any(SchoolFeed.class))).thenAnswer(inv -> {
            SchoolFeed feed = inv.getArgument(0);
            feed.setId(12L);
            return feed;
        });

        assertThat(service.remember(user, request(URL, null), "CANVAS")).isEqualTo(12L);
        assertThat(service.remember(user, request("BEGIN:VCALENDAR", null), "CANVAS")).isNull();
    }

    @Test
    void syncStagesIntoTheFeedsPendingImportAndNotifiesOnce() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));

        service.syncDue(1L);

        verify(importStore).save(eq(user), eq(1L), any(StageOutcome.class));
        verify(dispatcher).dispatch(eq(user), eq(NotificationType.FEED_REVIEW), eq(5L),
                startsWith("feed-review:1:"), eq("New courses and deadlines from Canvas"),
                eq("1 new course and 2 new deadlines from Canvas. Tap to review before anything is added."),
                eq("/imports/5"));
    }

    @Test
    void syncNotifiesWhenAnImportedDeadlineMoved() {
        SchoolFeed feed = storedFeed(1L);
        feed.setTimeZone("America/Vancouver");
        when(repository.findById(1L)).thenReturn(Optional.of(feed));
        when(importStore.save(any(), any(), any())).thenReturn(stored(null));
        FeedChange moved = new FeedChange("canvas-assignment-9", "Lab 4", null, "ENSC252 D100",
                Instant.parse("2026-10-24T06:59:00Z"), Instant.parse("2026-10-23T07:00:00Z"));
        when(canvasFeedService.stage(any(), any())).thenReturn(
                new StageOutcome(new StagedPayload("CANVAS", 9L, List.of()), 1, 0, 0, false, List.of(moved)));

        service.syncDue(1L);

        verify(dispatcher).dispatch(eq(user), eq(NotificationType.FEED_UPDATE), eq(1L),
                startsWith("feed-update:1:"), eq("A deadline changed on Canvas"),
                eq("Lab 4 (ENSC252 D100) is now due Fri Oct 23, 11:59 PM."), eq("/calendar"));
        verify(dispatcher, never()).dispatch(any(), eq(NotificationType.FEED_REVIEW), any(), any(), any(),
                any(), any());
    }

    @Test
    void syncDoesNotSendAChangeNotificationWhenNothingChanged() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));

        service.syncDue(1L);

        verify(dispatcher, never()).dispatch(any(), eq(NotificationType.FEED_UPDATE), any(), any(), any(),
                any(), any());
        verify(dispatcher, times(1)).dispatch(any(), eq(NotificationType.FEED_REVIEW), any(), any(), any(),
                any(), any());
    }

    @Test
    void describesRenamesAndCapsTheList() {
        Instant at = Instant.parse("2026-11-06T08:00:00Z");
        List<FeedChange> changes = List.of(
                new FeedChange("u1", "Lab 5 (updated)", "Lab 5", "ENSC252 D100", at, null),
                new FeedChange("u2", "Lab 6", null, null, at, at.minusSeconds(3600)),
                new FeedChange("u3", "Lab 7", null, "ENSC252 D100", at, at.minusSeconds(60)),
                new FeedChange("u4", "Lab 8", null, "ENSC252 D100", at, at.minusSeconds(60)));

        String text = SchoolFeedService.describeChanges(changes, ZoneId.of("Etc/GMT+8"));

        assertThat(text).isEqualTo("Lab 5 was renamed to Lab 5 (updated) (ENSC252 D100). "
                + "Lab 6 is now due Fri Nov 6, 12:00 AM. Lab 7 (ENSC252 D100) is now due Fri Nov 6, 12:00 AM. "
                + "And 1 more.");
    }

    @Test
    void namesASingleNewDeadline() {
        StagedPayload payload = new StagedPayload("CANVAS", 9L, List.of(new StagedCourse("canvas:1", 1L, null,
                null, "ENSC252 D100", "ENSC252 D100", "#3b82f6", 9L, 4L, null,
                List.of(new StagedItem("k", "k", StagedKind.ITEM, null, "Lab 7", NOW, null)))));

        assertThat(SchoolFeedService.headline(payload, "Canvas")).isEqualTo("New deadlines from Canvas");
        assertThat(SchoolFeedService.announcement(payload, "Canvas"))
                .isEqualTo("Lab 7 (ENSC252 D100) was added on Canvas. Tap to review before it shows up in Studily.");
    }

    private SchoolFeed calendarFeed() {
        SchoolFeed feed = storedFeed(3L);
        feed.setProvider("ICS");
        feed.setHost("calendar.google.com");
        feed.setTimeZone("America/Vancouver");
        when(repository.findById(3L)).thenReturn(Optional.of(feed));
        when(icsService.fetchText(URL)).thenReturn("BEGIN:VCALENDAR");
        return feed;
    }

    private static SyncResult calendarResult(List<AddedEvent> added, List<FeedChange> changes, int removed) {
        return new SyncResult(new ImportResult("Personal", added.size(), 4, 0, false, removed, true), added,
                changes);
    }

    @Test
    void calendarLinksSyncThroughTheCalendarImporterAndReportEverything() {
        SchoolFeed feed = calendarFeed();
        Instant at = Instant.parse("2026-10-30T22:00:00Z");
        when(icsService.sync(eq(user), eq("BEGIN:VCALENDAR"), eq("America/Vancouver"), eq(3L), eq(false)))
                .thenReturn(calendarResult(List.of(new AddedEvent("Dentist", at)),
                        List.of(new FeedChange("u1", "Club", null, null, at.plusSeconds(3600), at)), 1));

        service.syncDue(3L);

        verify(canvasFeedService, never()).stage(any(), any());
        verify(dispatcher).dispatch(eq(user), eq(NotificationType.FEED_UPDATE), eq(3L),
                startsWith("feed-update:3:"), eq("Google Calendar updated"),
                eq("New event: Dentist (Fri Oct 30, 3:00 PM). Club moved to Fri Oct 30, 4:00 PM. 1 event removed."),
                eq("/calendar"));
        assertThat(feed.getLastSuccessAt()).isEqualTo(NOW);
    }

    @Test
    void calendarSyncWithNothingNewSendsNoNotification() {
        calendarFeed();
        when(icsService.sync(any(), any(), any(), any(), eq(false)))
                .thenReturn(calendarResult(List.of(), List.of(), 0));

        service.syncDue(3L);

        verify(dispatcher, never()).dispatch(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void describesManyNewCalendarEventsCompactly() {
        Instant at = Instant.parse("2026-11-02T17:00:00Z");
        String text = SchoolFeedService.describeCalendar(List.of(new AddedEvent("A", at), new AddedEvent("B", at),
                new AddedEvent("C", at)), List.of(), 2, java.time.ZoneId.of("Etc/GMT+8"));

        assertThat(text).isEqualTo("3 new events: A (Mon Nov 2, 9:00 AM), B (Mon Nov 2, 9:00 AM) and 1 more. "
                + "2 events removed.");
        assertThat(SchoolFeedService.calendarLabel("example.com")).isEqualTo("Your calendar");
    }

    @Test
    void syncDoesNotNotifyWhenNothingNewWasStaged() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));
        when(importStore.save(any(), any(), any())).thenReturn(stored(null));

        service.syncDue(1L);

        verify(dispatcher, never()).dispatch(any(), any(), any(), any(), any(), any(), any());
        assertThat(feed.getFailureCount()).isZero();
    }

    @Test
    void aFailedNotificationDoesNotCountAsAFailedSync() {
        SchoolFeed feed = storedFeed(1L);
        when(repository.findById(1L)).thenReturn(Optional.of(feed));
        org.mockito.Mockito.doThrow(new RuntimeException("push down")).when(dispatcher)
                .dispatch(any(), any(), any(), any(), any(), any(), any());

        service.syncDue(1L);

        assertThat(feed.getFailureCount()).isZero();
        assertThat(feed.getLastSuccessAt()).isEqualTo(NOW);
    }

    @Test
    void theFingerprintIgnoresOrderButNotContent() {
        assertThat(SchoolFeedService.fingerprint(payload("a", "b")))
                .isEqualTo(SchoolFeedService.fingerprint(payload("b", "a")))
                .hasSize(12);
        assertThat(SchoolFeedService.fingerprint(payload("a", "b")))
                .isNotEqualTo(SchoolFeedService.fingerprint(payload("a", "b", "c")));
    }
}
