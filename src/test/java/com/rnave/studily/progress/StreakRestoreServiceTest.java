package com.rnave.studily.progress;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.StreakRestoreService.BrokenStreak;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StreakRestoreServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-09T18:00:00Z");
    private static final ZoneId VANCOUVER = ZoneId.of("America/Vancouver");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 9);

    private ChestRepository chestRepository;
    private StreakRestoreRepository restoreRepository;
    private ProgressService progressService;
    private StreakRestoreService service;
    private User user;
    private UserProgress progress;

    private final List<StreakRestore> restores = new ArrayList<>();
    private final List<Chest> chests = new ArrayList<>();

    @BeforeEach
    void setUp() {
        UserProgressRepository userProgressRepository = mock(UserProgressRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        BadgeService badgeService = mock(BadgeService.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        chestRepository = mock(ChestRepository.class);
        restoreRepository = mock(StreakRestoreRepository.class);

        user = new User();
        user.setId(1L);
        user.setTimezone(VANCOUVER.getId());
        progress = new UserProgress();
        progress.setUserId(1L);

        when(currentUser.entity()).thenReturn(user);
        when(currentUser.id()).thenReturn(1L);
        when(userRepository.getReferenceById(anyLong())).thenReturn(user);
        when(userProgressRepository.findForUpdate(1L)).thenReturn(Optional.of(progress));
        when(userProgressRepository.findById(1L)).thenReturn(Optional.of(progress));
        when(badgeService.evaluate(anyLong())).thenReturn(List.of());
        when(chestRepository.save(any(Chest.class))).thenAnswer(inv -> {
            chests.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(restoreRepository.save(any(StreakRestore.class))).thenAnswer(inv -> {
            restores.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(restoreRepository.countByUserIdAndUsedOnBetween(anyLong(), any(LocalDate.class), any(LocalDate.class)))
                .thenAnswer(inv -> restores.stream()
                        .filter(r -> !r.getUsedOn().isBefore(inv.getArgument(1))
                                && !r.getUsedOn().isAfter(inv.getArgument(2)))
                        .count());

        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        progressService = new ProgressService(userProgressRepository, mock(XpEventRepository.class),
                mock(CoinTransactionRepository.class), chestRepository, userRepository, badgeService,
                mock(FlairService.class), new UserTimeZones(userRepository, "UTC"), currentUser, clock);
        service = new StreakRestoreService(progressService, restoreRepository, userRepository,
                new ProgressRateLimiter(), currentUser, clock);
    }

    private void streak(int current, LocalDate lastDay) {
        progress.setStreakCurrent(current);
        progress.setStreakBest(Math.max(progress.getStreakBest(), current));
        progress.setStreakLastDate(lastDay);
    }

    private void usedRestore(LocalDate usedOn) {
        StreakRestore r = new StreakRestore();
        r.setRestoredDate(usedOn.minusDays(1));
        r.setUsedOn(usedOn);
        restores.add(r);
    }

    @Test
    void brokenStreak_studiedYesterday_isNotBroken() {
        streak(12, TODAY.minusDays(1));

        assertThat(service.brokenStreak(progress, TODAY)).isEmpty();
    }

    @Test
    void brokenStreak_oneMissedDay_offersTheLostStreak() {
        streak(12, TODAY.minusDays(2));

        assertThat(service.brokenStreak(progress, TODAY)).contains(
                new BrokenStreak(12, List.of(TODAY.minusDays(1)), false));
    }

    @Test
    void brokenStreak_missedWeekend_needsTwoRestores() {
        streak(12, LocalDate.of(2026, 10, 2));

        Optional<BrokenStreak> broken = service.brokenStreak(progress, LocalDate.of(2026, 10, 5));

        assertThat(broken).get().satisfies(b -> assertThat(b.missedDays())
                .containsExactly(LocalDate.of(2026, 10, 3), LocalDate.of(2026, 10, 4)));
    }

    @Test
    void brokenStreak_threeMissedDays_isGoneForGood() {
        streak(12, TODAY.minusDays(4));

        assertThat(service.brokenStreak(progress, TODAY)).isEmpty();
    }

    @Test
    void brokenStreak_restartedTodayAfterGap_offersTheLostStreak() {
        streak(1, TODAY);
        progress.setStreakLost(9);
        progress.setStreakLostLastDate(TODAY.minusDays(3));

        assertThat(service.brokenStreak(progress, TODAY)).contains(
                new BrokenStreak(9, List.of(TODAY.minusDays(2), TODAY.minusDays(1)), true));
    }

    @Test
    void brokenStreak_restartedYesterday_isNoLongerRestorable() {
        streak(1, TODAY.minusDays(1));
        progress.setStreakLost(9);
        progress.setStreakLostLastDate(TODAY.minusDays(3));

        assertThat(service.brokenStreak(progress, TODAY)).isEmpty();
    }

    @Test
    void restore_missedDays_bridgesTheGapAtTheSameLength() {
        streak(12, TODAY.minusDays(3));

        service.restore();

        assertThat(progress.getStreakCurrent()).isEqualTo(12);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY.minusDays(1));
        assertThat(progressService.effectiveStreak(progress, VANCOUVER)).isEqualTo(12);
        assertThat(restores).extracting(StreakRestore::getRestoredDate)
                .containsExactly(TODAY.minusDays(2), TODAY.minusDays(1));
        assertThat(restores).allSatisfy(r -> {
            assertThat(r.getUsedOn()).isEqualTo(TODAY);
            assertThat(r.getCreatedAt()).isEqualTo(NOW);
        });
        assertThat(service.restoresLeft(1L, TODAY)).isZero();
    }

    @Test
    void restore_thenStudyingToday_continuesTheStreak() {
        streak(12, TODAY.minusDays(2));
        service.restore();

        progressService.recordQualifiedDay(progressService.begin(1L), TODAY);

        assertThat(progress.getStreakCurrent()).isEqualTo(13);
        assertThat(progress.getStreakLost()).isZero();
    }

    @Test
    void restore_afterRestartingToday_mergesTheStreaksAndPaysTheChest() {
        progress.setStreakBest(6);
        streak(1, TODAY);
        progress.setStreakLost(6);
        progress.setStreakLostLastDate(TODAY.minusDays(2));

        ProgressDelta delta = service.restore();

        assertThat(progress.getStreakCurrent()).isEqualTo(7);
        assertThat(progress.getStreakBest()).isEqualTo(7);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY);
        assertThat(progress.getStreakLost()).isZero();
        assertThat(progress.getStreakLostLastDate()).isNull();
        assertThat(chests).singleElement().satisfies(c -> {
            assertThat(c.getSource()).isEqualTo(ChestSource.STREAK);
            assertThat(c.getSourceRef()).isEqualTo("streak:2026-10-09");
        });
        assertThat(delta.chests()).hasSize(1);
    }

    @Test
    void restore_notEnoughRestoresLeft_throwsAndSavesNothing() {
        usedRestore(LocalDate.of(2026, 10, 5));
        streak(12, TODAY.minusDays(3));

        assertThatThrownBy(() -> service.restore())
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Not enough streak restores left this week");
        assertThat(restores).hasSize(1);
        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY.minusDays(3));
    }

    @Test
    void restore_restoresUsedLastWeek_doNotCount() {
        usedRestore(LocalDate.of(2026, 10, 2));
        usedRestore(LocalDate.of(2026, 10, 3));
        streak(12, TODAY.minusDays(3));

        service.restore();

        assertThat(progress.getStreakLastDate()).isEqualTo(TODAY.minusDays(1));
    }

    @Test
    void restore_nothingBroken_throws() {
        streak(12, TODAY.minusDays(1));

        assertThatThrownBy(() -> service.restore())
                .isInstanceOf(BadRequestException.class)
                .hasMessage("There's no streak to restore");
        assertThat(restores).isEmpty();
    }

    @Test
    void restore_twice_secondOneIsRefused() {
        streak(12, TODAY.minusDays(2));
        service.restore();

        assertThatThrownBy(() -> service.restore()).isInstanceOf(BadRequestException.class);
        assertThat(restores).hasSize(1);
    }

    @Test
    void restoresLeft_weekRunsSundayToSaturday() {
        usedRestore(LocalDate.of(2026, 10, 4));

        assertThat(service.restoresLeft(1L, LocalDate.of(2026, 10, 10))).isEqualTo(1);
        assertThat(service.restoresLeft(1L, LocalDate.of(2026, 10, 11))).isEqualTo(2);
    }

    @Test
    void weekStart_isTheSundayOnOrBefore() {
        assertThat(StreakRestoreService.weekStart(LocalDate.of(2026, 10, 4))).isEqualTo(LocalDate.of(2026, 10, 4));
        assertThat(StreakRestoreService.weekStart(LocalDate.of(2026, 10, 10))).isEqualTo(LocalDate.of(2026, 10, 4));
    }
}
