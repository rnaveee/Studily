package com.rnave.studily.progress;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.progress.ProgressDtos.BadgeSummary;
import com.rnave.studily.progress.ProgressDtos.PublicProgressDto;
import com.rnave.studily.user.User;
import com.rnave.studily.user.UserRepository;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.lang.reflect.RecordComponent;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProgressControllerTest {

    private static final Instant NOW = Instant.parse("2026-10-07T18:00:00Z");

    private UserProgressRepository userProgressRepository;
    private UserRepository userRepository;
    private BadgeService badgeService;
    private ProgressController controller;

    @BeforeEach
    void setUp() {
        userProgressRepository = mock(UserProgressRepository.class);
        userRepository = mock(UserRepository.class);
        badgeService = mock(BadgeService.class);
        ProgressService service = new ProgressService(userProgressRepository, mock(XpEventRepository.class),
                mock(CoinTransactionRepository.class), mock(ChestRepository.class), userRepository, badgeService,
                new UserTimeZones(userRepository, "UTC"), mock(CurrentUser.class), Clock.fixed(NOW, ZoneOffset.UTC));
        controller = new ProgressController(service);

        User other = new User();
        other.setId(2L);
        other.setTimezone("America/Vancouver");
        when(userRepository.findById(2L)).thenReturn(Optional.of(other));
        when(badgeService.summary(2L)).thenReturn(new BadgeSummary(List.of(), 3, 24));
    }

    @Test
    void forUser_responseHasNoCoins() {
        UserProgress p = new UserProgress();
        p.setUserId(2L);
        p.setXp(2724);
        p.setLevel(5);
        p.setCoins(999);
        p.setStreakCurrent(4);
        p.setStreakLastDate(LocalDate.of(2026, 10, 7));
        when(userProgressRepository.findById(2L)).thenReturn(Optional.of(p));

        PublicProgressDto dto = controller.forUser(2L);
        JsonNode json = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(dto));

        assertThat(json.has("coins")).isFalse();
        assertThat(json.toString()).doesNotContain("999");
        assertThat(Arrays.stream(PublicProgressDto.class.getRecordComponents()).map(RecordComponent::getName))
                .doesNotContain("coins");
        assertThat(json.get("userId").asLong()).isEqualTo(2L);
        assertThat(json.get("level").asInt()).isEqualTo(5);
        assertThat(json.get("xpIntoLevel").asLong()).isEqualTo(424);
        assertThat(json.get("streakCurrent").asInt()).isEqualTo(4);
        assertThat(json.get("badgeTotal").asInt()).isEqualTo(24);
    }

    @Test
    void forUser_unknownUser_throwsNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.forUser(99L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void forUser_withoutProgressRow_reportsLevelOneWithoutCreatingRow() {
        when(userProgressRepository.findById(2L)).thenReturn(Optional.empty());

        PublicProgressDto dto = controller.forUser(2L);

        assertThat(dto.level()).isEqualTo(1);
        assertThat(dto.xp()).isZero();
        assertThat(dto.xpForNext()).isEqualTo(500);
        verify(userProgressRepository, never()).insertIfMissing(anyLong());
        verify(userProgressRepository, never()).findForUpdate(anyLong());
    }
}
