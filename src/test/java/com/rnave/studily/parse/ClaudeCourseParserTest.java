package com.rnave.studily.parse;

import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.parse.ExtractedInput.ExtractedImage;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClaudeCourseParserTest {

    private static final String TEXT_MODEL = "claude-sonnet-5";
    private static final String VISION_MODEL = "claude-haiku-4-5";

    private ClaudeCourseParser parser(String apiKey, boolean featureEnabled) {
        return new ClaudeCourseParser(apiKey, featureEnabled, TEXT_MODEL, VISION_MODEL);
    }

    private ExtractedInput textInput() {
        return new ExtractedInput("Course Outline\nENSC 204", List.of());
    }

    private ExtractedInput imageInput() {
        return new ExtractedInput("", List.of(new ExtractedImage("image/png", new byte[]{1, 2, 3})));
    }

    @Test
    void enabled_requiresBothAKeyAndTheFeatureFlag() {
        assertThat(parser("sk-ant-test", true).enabled()).isTrue();
        assertThat(parser("  ", true).enabled()).isFalse();
        assertThat(parser(null, true).enabled()).isFalse();
        assertThat(parser("sk-ant-test", false).enabled()).isFalse();
    }

    @Test
    void parse_refusesWhenDisabledRatherThanCallingTheApi() {
        assertThatThrownBy(() -> parser("", true).parse(textInput(), "context"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not available");
    }

    @Test
    void paramsFor_alwaysSendsTheDraftSchema() {
        MessageCreateParams text =
                parser("sk-ant-test", true).paramsFor(TEXT_MODEL, false, textInput(), "context");
        MessageCreateParams vision =
                parser("sk-ant-test", true).paramsFor(VISION_MODEL, true, imageInput(), "context");

        assertThat(text.outputConfig().flatMap(OutputConfig::format)).isPresent();
        assertThat(vision.outputConfig().flatMap(OutputConfig::format)).isPresent();
    }

    @Test
    void paramsFor_keepsBothTheSchemaAndTheEffortOnTheTextModel() {
        MessageCreateParams text =
                parser("sk-ant-test", true).paramsFor(TEXT_MODEL, false, textInput(), "context");

        assertThat(text.thinking()).isPresent();
        assertThat(text.outputConfig().flatMap(OutputConfig::effort))
                .contains(OutputConfig.Effort.MEDIUM);
        assertThat(text.outputConfig().flatMap(OutputConfig::format)).isPresent();
    }

    @Test
    void paramsFor_sendsNoThinkingOrEffortOnTheVisionModel() {
        MessageCreateParams vision =
                parser("sk-ant-test", true).paramsFor(VISION_MODEL, true, imageInput(), "context");

        assertThat(vision.thinking()).isEmpty();
        assertThat(vision.outputConfig().flatMap(OutputConfig::effort)).isEmpty();
    }

    @Test
    void paramsFor_describesEveryDraftFieldInTheSchema() {
        String schema = parser("sk-ant-test", true)
                .paramsFor(TEXT_MODEL, false, textInput(), "context")
                .outputConfig().flatMap(OutputConfig::format).orElseThrow().toString();

        assertThat(schema)
                .contains("meetingBlocks").contains("items").contains("warnings")
                .contains("professor").contains("startTime").contains("dueAt")
                .contains("LECTURE").contains("TUTORIAL").contains("ASSIGNMENT").contains("SAT");
    }

    @Test
    void paramsFor_carriesTheDocumentTextAndContextIntoTheRequest() {
        MessageCreateParams params = parser("sk-ant-test", true)
                .paramsFor(TEXT_MODEL, false, textInput(), "Semester runs Sep to Dec");

        assertThat(params.toString())
                .contains("Semester runs Sep to Dec")
                .contains("ENSC 204");
    }

    @Test
    void imagesOnly_decidesWhichModelTheServiceWouldReach() {
        assertThat(imageInput().imagesOnly()).isTrue();
        assertThat(textInput().imagesOnly()).isFalse();
        assertThat(new ExtractedInput("text", List.of(new ExtractedImage("image/png", new byte[]{1})))
                .imagesOnly()).isFalse();
    }
}
