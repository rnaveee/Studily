package com.rnave.studily.semester;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.semester.SemesterDtos.SemesterDto;
import com.rnave.studily.semester.SemesterDtos.SemesterRequest;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SemesterServiceTest {

    private SemesterRepository semesterRepository;
    private CurrentUser currentUser;
    private SemesterService semesterService;

    @BeforeEach
    void setUp() {
        semesterRepository = mock(SemesterRepository.class);
        currentUser = mock(CurrentUser.class);
        semesterService = new SemesterService(semesterRepository, currentUser);
    }

    @Test
    void create_rejectsDuplicateTermAndYearForTheSameUser() {
        when(currentUser.id()).thenReturn(1L);
        when(semesterRepository.existsByUserIdAndTermAndYear(1L, SemesterTerm.FALL, 2026)).thenReturn(true);

        SemesterRequest req = new SemesterRequest(SemesterTerm.FALL, 2026, null, null);

        assertThatThrownBy(() -> semesterService.create(req)).isInstanceOf(ConflictException.class);
    }

    @Test
    void create_fillsInDefaultDateRangeForTerm() {
        when(currentUser.id()).thenReturn(1L);
        when(currentUser.entity()).thenReturn(new User());
        when(semesterRepository.existsByUserIdAndTermAndYear(1L, SemesterTerm.FALL, 2026)).thenReturn(false);
        when(semesterRepository.save(any(Semester.class))).thenAnswer(inv -> inv.getArgument(0));

        SemesterDto dto = semesterService.create(new SemesterRequest(SemesterTerm.FALL, 2026, null, null));

        assertThat(dto.startDate()).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(dto.endDate()).isEqualTo(LocalDate.of(2026, 12, 31));
    }

    @Test
    void create_winterDefaultRangeSpansIntoTheFollowingYear() {
        when(currentUser.id()).thenReturn(1L);
        when(currentUser.entity()).thenReturn(new User());
        when(semesterRepository.existsByUserIdAndTermAndYear(1L, SemesterTerm.WINTER, 2026)).thenReturn(false);
        when(semesterRepository.save(any(Semester.class))).thenAnswer(inv -> inv.getArgument(0));

        SemesterDto dto = semesterService.create(new SemesterRequest(SemesterTerm.WINTER, 2026, null, null));

        assertThat(dto.startDate()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(dto.endDate()).isEqualTo(LocalDate.of(2027, 1, 31));
    }

    @Test
    void create_rejectsExplicitEndDateOnOrBeforeStartDate() {
        when(currentUser.id()).thenReturn(1L);
        when(semesterRepository.existsByUserIdAndTermAndYear(1L, SemesterTerm.FALL, 2026)).thenReturn(false);

        SemesterRequest req = new SemesterRequest(
                SemesterTerm.FALL, 2026, LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 1));

        assertThatThrownBy(() -> semesterService.create(req)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void requireOwned_rejectsAnotherUsersSemester() {
        when(currentUser.id()).thenReturn(1L);
        when(semesterRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> semesterService.requireOwned(99L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void current_queriesRepositoryScopedToCallerAndTodaysDate() {
        when(currentUser.id()).thenReturn(1L);
        ArgumentCaptor<LocalDate> fromCaptor = ArgumentCaptor.forClass(LocalDate.class);
        ArgumentCaptor<LocalDate> toCaptor = ArgumentCaptor.forClass(LocalDate.class);
        when(semesterRepository.findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                eq(1L), fromCaptor.capture(), toCaptor.capture())).thenReturn(Optional.empty());

        Optional<SemesterDto> result = semesterService.current();

        assertThat(result).isEmpty();
        assertThat(fromCaptor.getValue()).isEqualTo(LocalDate.now());
        assertThat(toCaptor.getValue()).isEqualTo(LocalDate.now());
    }
}
