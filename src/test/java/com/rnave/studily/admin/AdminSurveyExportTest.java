package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.SurveySummary;
import com.rnave.studily.survey.SurveyDefinition;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdminSurveyExportTest {

    private static final SurveyDefinition DEFINITION = SurveyDefinition.FALL_2026;

    private static SurveySummary summary() {
        return new SurveySummary(DEFINITION.key(), 2, 10, 45.5, 2, 50.0, 1, 30.0, 2, 4.2, List.of());
    }

    @Test
    void rendersMetricsAndAnonymousRespondentsWithTextAnswers() {
        List<List<String[]>> respondents = List.of(
                List.<String[]>of(new String[]{"frequency", null, "About once a day"},
                        new String[]{"contact", null, "Yes"}),
                List.<String[]>of(new String[]{"frequency", null, "Rarely"}));

        String text = AdminSurveyService.render(summary(), DEFINITION, respondents, LocalDate.of(2026, 11, 19));

        assertThat(text).contains("45.5%", "NPS: 30.0", "Respondent 1", "Respondent 2",
                "frequency: About once a day", "frequency: Rarely");
        assertThat(text).doesNotContain("contact: Yes");
    }

    @Test
    void multilineTextAnswerStaysOnOneLine() {
        String textQuestion = DEFINITION.questions().stream()
                .filter(q -> q.type() == SurveyDefinition.Type.TEXT).findFirst().orElseThrow().id();
        List<List<String[]>> respondents = List.of(
                List.<String[]>of(new String[]{textQuestion, null, "line one\nline two"}));

        String text = AdminSurveyService.render(summary(), DEFINITION, respondents, LocalDate.of(2026, 11, 19));

        assertThat(text).contains(textQuestion + ": line one / line two");
    }
}
