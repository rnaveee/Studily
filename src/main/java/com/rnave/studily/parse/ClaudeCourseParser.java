package com.rnave.studily.parse;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.ThinkingConfigAdaptive;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.parse.ExtractedInput.ExtractedImage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Component
public class ClaudeCourseParser {

    private static final Logger log = LoggerFactory.getLogger(ClaudeCourseParser.class);

    private static final long MAX_TOKENS = 16_000;
    private static final String UNREADABLE =
            "Could not read that document. Try again, or add the course manually.";

    private static final String SYSTEM_PROMPT = """
            You extract structured course information from university course outlines, syllabi, \
            course web pages, and screenshots of them, so a student can review it and save it into \
            their planner.

            Rules:

            1. Only report what the document states or clearly implies. Never invent a value. \
            Leave a field null rather than guessing, and add a warning explaining what was missing.

            2. Weekly class times. If the document states a pattern directly, such as \
            "Tuesday and Thursday, 12:30 PM - 2:20 PM", use it. If it instead gives a table of \
            individual class dates, work out the weekday those dates fall on and report the \
            recurring pattern. Never treat office hours, exam dates, holidays or one-off sessions \
            as weekly class times; office hours in particular are not lectures. Emit one entry per \
            weekday, so a class meeting Tuesday and Thursday produces two entries.

            Many outlines give the days but never the clock time. When that happens, still report \
            the weekday and leave startTime and endTime null, and add a warning saying the time \
            was not stated. Never invent a time, and never borrow one from office hours.

            3. Lab and tutorial sections are often listed as date ranges, such as "14 to 18-SEP", \
            because each student attends one section within that window. That is not a weekly \
            pattern you can report, so keep it out of meetingBlocks and add a warning saying lab \
            times vary by section. This rule is about class times only. Leaving a lab section out \
            of meetingBlocks never means leaving lab work out of items: a lab report, a lab \
            deliverable or anything else with a date still belongs in items under rule 7.

            4. Schedule tables. Outlines often carry a Due column, or one headed Deliverable or \
            Hand-in, beside the week and date columns. Every entry in that column is an item, and \
            its deadline is the date on its own row, not the week the work was handed out. When \
            that row gives a range, use the last day of the range. A row reading \
            "Lab 2 | 15 to 19-SEP" in a semester running through 2026 therefore produces an item \
            titled "Lab 2" due "2026-09-19T23:59". Entries in these columns are terse, such as \
            "Lab 1" or "Project"; keep the title exactly as printed rather than expanding it.

            5. Dates. Documents often print dates without a year, such as "14-OCT". Resolve them \
            against the semester date range you are given. If a date cannot be placed inside that \
            range, leave dueAt null and add a warning. Report the item either way; never drop one \
            just because its date would not resolve.

            6. Weights. Take these from the grading scheme. When a single grading row covers a \
            group of items, such as "Quizzes, Assignments and Labs 15%", that 15% belongs to the \
            whole group. Do not copy it onto each item and do not divide it up: leave those items' \
            weight null and add a warning naming the group and its total.

            7. Items. Include lab reports and lab deliverables, graded assignments, quizzes, \
            projects and exams that have a deadline or a scheduled date. Work through the whole \
            schedule table row by row, including its Due column, and then check your list against \
            the grading scheme: if the scheme names an exam, a project or a group of labs you have \
            not listed, find its dates in the schedule and add them. Do not include lecture topics, \
            readings, holidays, weeks marked as having no class, or a lab session whose row has \
            nothing due.

            8. The professor is the instructor of record, never a teaching assistant.

            9. If the document is not a course outline, or carries too little to work with, return \
            nulls and empty lists with a warning saying so. A nearly empty result is correct when \
            the source is thin; a fabricated one never is.

            Keep warnings short, specific and addressed to the student.
            """;

    private static final JsonMapper MAPPER = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private final String apiKey;
    private final boolean featureEnabled;
    private final String textModel;
    private final String visionModel;
    private volatile AnthropicClient client;

    public ClaudeCourseParser(
            @Value("${app.parse.api-key}") String apiKey,
            @Value("${app.parse.enabled}") boolean featureEnabled,
            @Value("${app.parse.model.text}") String textModel,
            @Value("${app.parse.model.vision}") String visionModel) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.featureEnabled = featureEnabled;
        this.textModel = textModel;
        this.visionModel = visionModel;
        if (!enabled()) {
            log.warn("ANTHROPIC_API_KEY not set, automatic course creation is disabled");
        }
    }

    public boolean enabled() {
        return featureEnabled && !apiKey.isBlank();
    }

    public ParseOutcome parse(ExtractedInput input, String context) {
        if (!enabled()) {
            throw new BadRequestException("Automatic course creation is not available right now.");
        }

        boolean vision = input.imagesOnly();
        String model = vision ? visionModel : textModel;

        Message response;
        try {
            response = client().messages().create(paramsFor(model, vision, input, context));
        } catch (Exception e) {
            log.warn("Course parse request failed: {}", e.getMessage());
            throw new BadRequestException(UNREADABLE);
        }

        log.info("Course parse used model={} input={} output={}",
                model, response.usage().inputTokens(), response.usage().outputTokens());

        String json = response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(text -> text.text())
                .findFirst()
                .orElseThrow(() -> new BadRequestException(UNREADABLE));

        try {
            return new ParseOutcome(
                    MAPPER.readValue(json, CourseDraft.class),
                    model,
                    response.usage().inputTokens(),
                    response.usage().outputTokens());
        } catch (Exception e) {
            log.warn("Course parse returned unreadable JSON: {}", e.getMessage());
            throw new BadRequestException(UNREADABLE);
        }
    }

    public record ParseOutcome(CourseDraft draft, String model, long inputTokens, long outputTokens) {
    }

    MessageCreateParams paramsFor(String model, boolean vision, ExtractedInput input, String context) {
        OutputConfig.Builder outputConfig = OutputConfig.builder()
                .format(CourseDraftSchema.format());

        MessageCreateParams.Builder builder = MessageCreateParams.builder()
                .model(model)
                .maxTokens(MAX_TOKENS)
                .system(SYSTEM_PROMPT);

        if (!vision) {
            builder = builder.thinking(ThinkingConfigAdaptive.builder().build());
            outputConfig = outputConfig.effort(OutputConfig.Effort.MEDIUM);
        }

        return builder
                .outputConfig(outputConfig.build())
                .addUserMessageOfBlockParams(blocks(input, context))
                .build();
    }

    private List<ContentBlockParam> blocks(ExtractedInput input, String context) {
        List<ContentBlockParam> blocks = new ArrayList<>();
        for (ExtractedImage image : input.images()) {
            blocks.add(ContentBlockParam.ofImage(ImageBlockParam.builder()
                    .source(Base64ImageSource.builder()
                            .mediaType(Base64ImageSource.MediaType.IMAGE_PNG)
                            .data(Base64.getEncoder().encodeToString(image.data()))
                            .build())
                    .build()));
        }

        StringBuilder prompt = new StringBuilder(context);
        if (input.text() != null && !input.text().isBlank()) {
            prompt.append("\n\nDocument text:\n\n").append(input.text());
        }
        prompt.append("\n\nExtract the course details.");

        blocks.add(ContentBlockParam.ofText(
                TextBlockParam.builder().text(prompt.toString()).build()));
        return blocks;
    }

    private AnthropicClient client() {
        AnthropicClient existing = client;
        if (existing != null) {
            return existing;
        }
        synchronized (this) {
            if (client == null) {
                client = AnthropicOkHttpClient.builder().apiKey(apiKey).build();
            }
            return client;
        }
    }
}
