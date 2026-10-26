package com.rnave.studily.exam;

import com.rnave.studily.exam.ExamDtos.LinkRequest;
import com.rnave.studily.exam.ExamDtos.PlanDto;
import com.rnave.studily.exam.ExamDtos.UpcomingExamDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ExamController {

    private final ExamService examService;

    public ExamController(ExamService examService) {
        this.examService = examService;
    }

    @GetMapping("/api/exams/upcoming")
    public List<UpcomingExamDto> upcoming(@RequestParam(required = false) Long semesterId) {
        return examService.upcoming(semesterId);
    }

    @GetMapping("/api/exams/{itemId}/plan")
    public PlanDto plan(@PathVariable Long itemId) {
        return examService.plan(itemId);
    }

    @PostMapping("/api/exams/{itemId}/links")
    @ResponseStatus(HttpStatus.CREATED)
    public PlanDto link(@PathVariable Long itemId, @Valid @RequestBody LinkRequest req) {
        return examService.link(itemId, req);
    }

    @DeleteMapping("/api/exams/{itemId}/links/{linkId}")
    public PlanDto unlink(@PathVariable Long itemId, @PathVariable Long linkId) {
        return examService.unlink(itemId, linkId);
    }
}
