package com.rnave.studily.survey;

import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.survey.SurveyDtos.SubmitRequest;
import com.rnave.studily.survey.SurveyDtos.SurveyDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/survey")
public class SurveyController {

    private final SurveyService surveyService;

    public SurveyController(SurveyService surveyService) {
        this.surveyService = surveyService;
    }

    @GetMapping
    public SurveyDto status() {
        return surveyService.status();
    }

    @PostMapping
    public ProgressDelta submit(@Valid @RequestBody SubmitRequest body) {
        return surveyService.submit(body);
    }

    @PostMapping("/prompt-seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void promptSeen() {
        surveyService.markPromptSeen();
    }
}
