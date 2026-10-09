package com.rnave.studily.studysession;

import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.StreakRestoreService;
import com.rnave.studily.studysession.StudySessionDtos.StreakRestoreResult;
import com.rnave.studily.studysession.StudySessionDtos.StreakWeekDto;
import com.rnave.studily.studysession.StudySessionDtos.StudySessionDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StudySessionControllerTest {

    private StudySessionService service;
    private StreakRestoreService streakRestoreService;
    private StudySessionController controller;

    @BeforeEach
    void setUp() {
        service = mock(StudySessionService.class);
        streakRestoreService = mock(StreakRestoreService.class);
        controller = new StudySessionController(service, streakRestoreService);
    }

    @Test
    void restoreStreak_restoresBeforeReadingTheWeek() {
        ProgressDelta delta = mock(ProgressDelta.class);
        StreakWeekDto week = mock(StreakWeekDto.class);
        when(streakRestoreService.restore()).thenReturn(delta);
        when(service.streakWeek()).thenReturn(week);

        StreakRestoreResult result = controller.restoreStreak();

        InOrder order = inOrder(streakRestoreService, service);
        order.verify(streakRestoreService).restore();
        order.verify(service).streakWeek();
        assertThat(result.streak()).isSameAs(week);
        assertThat(result.delta()).isSameAs(delta);
    }

    @Test
    void active_noOpenSession_returnsNoContent() {
        when(service.active()).thenReturn(Optional.empty());

        ResponseEntity<StudySessionDto> response = controller.active();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(response.getBody()).isNull();
    }

    @Test
    void active_openSession_returnsIt() {
        Instant now = Instant.parse("2026-10-07T17:00:00Z");
        StudySessionDto dto = new StudySessionDto(5L, StudySessionMode.TIMER, StudySessionStatus.ACTIVE, 2, 30, 0,
                60, now, null, 1, null, null, 0, 0, BigDecimal.ONE.doubleValue(), List.of(), List.of(), now);
        when(service.active()).thenReturn(Optional.of(dto));

        ResponseEntity<StudySessionDto> response = controller.active();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isSameAs(dto);
    }
}
