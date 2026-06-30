package com.rnave.studily.semester;

import com.rnave.studily.semester.SemesterDtos.SemesterDto;
import com.rnave.studily.semester.SemesterDtos.SemesterRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/semesters")
public class SemesterController {

    private final SemesterService semesterService;

    public SemesterController(SemesterService semesterService) {
        this.semesterService = semesterService;
    }

    @GetMapping
    public List<SemesterDto> list() {
        return semesterService.list();
    }

    @GetMapping("/current")
    public Optional<SemesterDto> current() {
        return semesterService.current();
    }

    @GetMapping("/{id}")
    public SemesterDto get(@PathVariable Long id) {
        return semesterService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SemesterDto create(@Valid @RequestBody SemesterRequest req) {
        return semesterService.create(req);
    }

    @PutMapping("/{id}")
    public SemesterDto update(@PathVariable Long id, @Valid @RequestBody SemesterRequest req) {
        return semesterService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        semesterService.delete(id);
    }
}
