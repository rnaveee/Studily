package com.rnave.studily.ics;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.ics.IcsDtos.FeedLinkCreated;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CalendarFeedServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-25T12:00:00Z");

    private CalendarFeedTokenRepository repository;
    private UserRepository userRepository;
    private IcsService icsService;
    private CalendarFeedService service;
    private User user;

    @BeforeEach
    void setUp() {
        repository = mock(CalendarFeedTokenRepository.class);
        userRepository = mock(UserRepository.class);
        icsService = mock(IcsService.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        user = new User();
        user.setId(5L);
        when(currentUser.id()).thenReturn(5L);
        when(userRepository.findById(5L)).thenReturn(Optional.of(user));
        when(repository.findById(5L)).thenReturn(Optional.empty());
        service = new CalendarFeedService(repository, userRepository, icsService, currentUser,
                Clock.fixed(NOW, ZoneOffset.UTC), "https://studily.ca/");
    }

    private static String tokenOf(FeedLinkCreated created) {
        String url = created.httpsUrl();
        return url.substring(url.lastIndexOf('/') + 1, url.length() - ".ics".length());
    }

    private CalendarFeedToken tokenFor(String raw) {
        CalendarFeedToken token = new CalendarFeedToken();
        token.setUserId(5L);
        token.setTokenHash(CalendarFeedService.hash(raw));
        token.setCreatedAt(NOW.minusSeconds(1000));
        when(repository.findByTokenHash(CalendarFeedService.hash(raw))).thenReturn(Optional.of(token));
        return token;
    }

    @Test
    void create_buildsHttpsAndWebcalUrlsAndStoresOnlyTheHash() {
        FeedLinkCreated created = service.createOrRotate();

        String token = tokenOf(created);
        assertThat(created.httpsUrl()).startsWith("https://studily.ca/api/public/calendar/").endsWith(".ics");
        assertThat(created.webcalUrl()).isEqualTo(created.httpsUrl().replaceFirst("^https", "webcal"));
        assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]+");
        assertThat(created.createdAt()).isEqualTo(NOW);
        org.mockito.ArgumentCaptor<CalendarFeedToken> saved = org.mockito.ArgumentCaptor.forClass(CalendarFeedToken.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getTokenHash())
                .isEqualTo(CalendarFeedService.hash(token)).hasSize(64).isNotEqualTo(token);
    }

    @Test
    void rotate_replacesTheHashSoTheOldTokenNoLongerMatches() {
        CalendarFeedToken existing = tokenFor("old-token");
        existing.setLastFetchedAt(NOW.minusSeconds(10));
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        FeedLinkCreated created = service.createOrRotate();

        assertThat(existing.getTokenHash()).isEqualTo(CalendarFeedService.hash(tokenOf(created)));
        assertThat(existing.getTokenHash()).isNotEqualTo(CalendarFeedService.hash("old-token"));
        assertThat(existing.getLastFetchedAt()).isNull();
        assertThat(existing.getCreatedAt()).isEqualTo(NOW);
    }

    @Test
    void status_reportsExistenceWithoutAToken() {
        assertThat(service.status().exists()).isFalse();

        CalendarFeedToken existing = tokenFor("t");
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        assertThat(service.status().exists()).isTrue();
        assertThat(service.status().createdAt()).isEqualTo(existing.getCreatedAt());
    }

    @Test
    void delete_removesTheCallersLink() {
        service.delete();

        verify(repository).deleteById(5L);
    }

    @Test
    void feed_returnsTheCalendarAndTouchesLastFetchedWithTenMinuteCutoff() {
        tokenFor("good");
        when(icsService.exportFor(5L)).thenReturn("BEGIN:VCALENDAR");

        assertThat(service.feed("good")).contains("BEGIN:VCALENDAR");

        verify(repository).touch(5L, NOW, NOW.minusSeconds(600));
    }

    @Test
    void feed_unknownTokenIsEmpty() {
        when(repository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThat(service.feed("nope")).isEmpty();
        assertThat(service.feed("")).isEmpty();
        assertThat(service.feed(null)).isEmpty();
        verify(icsService, never()).exportFor(any());
    }

    @Test
    void feed_bannedOrSuspendedUserIsEmpty() {
        tokenFor("t");

        user.setBanned(true);
        assertThat(service.feed("t")).isEmpty();

        user.setBanned(false);
        user.setSuspendedUntil(NOW.plusSeconds(3600));
        assertThat(service.feed("t")).isEmpty();

        verify(icsService, never()).exportFor(any());
        verify(repository, never()).touch(any(), any(), any());
    }
}
