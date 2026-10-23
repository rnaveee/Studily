package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.Paged;
import com.rnave.studily.admin.AdminDtos.SurveyContact;
import com.rnave.studily.admin.AdminDtos.SurveySummary;
import com.rnave.studily.admin.AdminDtos.SurveyTextAnswer;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/survey")
public class AdminSurveyController {

    private final AdminSurveyService surveyService;

    public AdminSurveyController(AdminSurveyService surveyService) {
        this.surveyService = surveyService;
    }

    @ModelAttribute
    void requireAdminContext(HttpServletRequest request) {
        AdminController.admin(request);
    }

    @GetMapping("/summary")
    public SurveySummary summary() {
        return surveyService.summary();
    }

    @GetMapping("/text")
    public Paged<SurveyTextAnswer> text(@RequestParam String question,
                                        @RequestParam(defaultValue = "0") int page) {
        return surveyService.text(question, page);
    }

    @GetMapping("/contacts")
    public List<SurveyContact> contacts() {
        return surveyService.contacts();
    }
}
