package com.rnave.studily.semester;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.semester.SemesterDtos.SemesterDto;
import com.rnave.studily.semester.SemesterDtos.SemesterRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class SemesterService {

    private final SemesterRepository semesterRepository;
    private final CurrentUser currentUser;

    public SemesterService(SemesterRepository semesterRepository, CurrentUser currentUser) {
        this.semesterRepository = semesterRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<SemesterDto> list() {
        return semesterRepository.findByUserIdOrderByYearDescTermAsc(currentUser.id())
                .stream().map(SemesterDto::from).toList();
    }

    @Transactional(readOnly = true)
    public SemesterDto get(Long id) {
        return SemesterDto.from(requireOwned(id));
    }

    @Transactional(readOnly = true)
    public Optional<SemesterDto> current() {
        LocalDate today = LocalDate.now();
        return semesterRepository
                .findFirstByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateDesc(
                        currentUser.id(), today, today)
                .map(SemesterDto::from);
    }

    @Transactional
    public SemesterDto create(SemesterRequest req) {
        Long userId = currentUser.id();
        if (semesterRepository.existsByUserIdAndTermAndYear(userId, req.term(), req.year())) {
            throw new ConflictException(req.term() + " " + req.year() + " already exists");
        }
        Semester s = new Semester();
        s.setUser(currentUser.entity());
        apply(s, req);
        return SemesterDto.from(semesterRepository.save(s));
    }

    @Transactional
    public SemesterDto update(Long id, SemesterRequest req) {
        Semester s = requireOwned(id);
        apply(s, req);
        return SemesterDto.from(semesterRepository.save(s));
    }

    @Transactional
    public void delete(Long id) {
        semesterRepository.delete(requireOwned(id));
    }

    @Transactional(readOnly = true)
    public Semester requireOwned(Long id) {
        return semesterRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Semester not found"));
    }

    private void apply(Semester s, SemesterRequest req) {
        s.setTerm(req.term());
        s.setYear(req.year());
        LocalDate start = req.startDate() != null ? req.startDate() : defaultStart(req.term(), req.year());
        LocalDate end = req.endDate() != null ? req.endDate() : defaultEnd(req.term(), req.year());
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("End date must be after start date");
        }
        s.setStartDate(start);
        s.setEndDate(end);
    }

    private static LocalDate defaultStart(SemesterTerm term, int year) {
        return switch (term) {
            case FALL -> LocalDate.of(year, 9, 1);
            case SPRING -> LocalDate.of(year, 1, 1);
            case SUMMER -> LocalDate.of(year, 5, 1);
            case WINTER -> LocalDate.of(year, 12, 1);
        };
    }

    private static LocalDate defaultEnd(SemesterTerm term, int year) {
        return switch (term) {
            case FALL -> LocalDate.of(year, 12, 31);
            case SPRING -> LocalDate.of(year, 4, 30);
            case SUMMER -> LocalDate.of(year, 8, 31);
            case WINTER -> LocalDate.of(year + 1, 1, 31);
        };
    }
}
