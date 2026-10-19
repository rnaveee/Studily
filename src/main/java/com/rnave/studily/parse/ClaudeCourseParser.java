package com.rnave.studily.parse;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Base64ImageSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.ImageBlockParam;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import com.anthropic.models.messages.ThinkingConfigAdaptive;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ServiceUnavailableException;
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
import java.util.function.Supplier;

@Component
public class ClaudeCourseParser {

    private static final Logger log = LoggerFactory.getLogger(ClaudeCourseParser.class);

    static final int PROMPT_VERSION = 2;
    static final int SCHEDULE_PROMPT_VERSION = 1;
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
            titled "Lab 2" due "2026-09-19T23:59", with its category set to whichever grading \
            row covers the labs. Entries in these columns are terse, such as "Lab 1" or \
            "Project"; keep the title exactly as printed rather than expanding it.

            5. Dates. Documents often print dates without a year, such as "14-OCT". Resolve them \
            against the semester date range you are given. If a date cannot be placed inside that \
            range, leave dueAt null and add a warning. Report the item either way; never drop one \
            just because its date would not resolve.

            6. Weights. Report one gradeCategories entry per row of the grading scheme, with the \
            name exactly as printed and its percentage. "Quizzes, Assignments and Labs 15%" is one \
            entry named "Quizzes, Assignments and Labs" worth 15; "Exam 1 25%" is another named \
            "Exam 1" worth 25. A row stays one entry even when it covers many separate pieces of \
            work: never divide it up and never copy its percentage onto the items.

            Then set each item's category to the name of the row it is graded under, spelled \
            exactly as you spelled it in gradeCategories. Leave category null when no row covers \
            the item. Set an item's own weight only when its row covers that single item and \
            nothing else, and leave a row's weight null when the scheme states no percentage for \
            it. If the percentages do not add up to 100, report them as printed and add a warning \
            saying what they total.

            7. Items. Include lab reports and lab deliverables, graded assignments, quizzes, \
            projects and exams that have a deadline or a scheduled date. Work through the whole \
            schedule table row by row, including its Due column, and then check your list against \
            the grading scheme: if the scheme names an exam, a project or a group of labs you have \
            not listed, find its dates in the schedule and add them. Do not include lecture topics, \
            readings, holidays, weeks marked as having no class, or a lab session whose row has \
            nothing due.

            8. The professor is the instructor of record, never a teaching assistant.

            9. Decide isCourseOutline first. If the document is not about a university course at \
            all, such as a biography, a meme, a receipt or unrelated text, set it to false and \
            stop: return nulls, empty lists and a single short warning, and do not describe the \
            document. If it is a course document but carries too little to work with, set it to \
            true and return nulls and empty lists with a warning saying so. A nearly empty result \
            is correct when the source is thin; a fabricated one never is.

            Keep warnings short, specific and addressed to the student.
            """;

    private static final String SCHEDULE_PROMPT = """
            You read screenshots of a university student's weekly class schedule, such as a             timetable or week view from their school's registration system, and list every course             on it so the student can add them all to their planner at once.

            Rules:

            1. Only report what the schedule shows. Never invent a course, a meeting or a time.             Leave a field null rather than guessing, and add a warning explaining what was unclear.

            2. Courses. Each distinct course code is one course, however many blocks it has.             "ENSC 220 LEC" and "ENSC 220 LAB" are the same course, ENSC 220, with two kinds of             meeting. Keep the code exactly as printed.

            3. Meetings. Every block drawn on the grid is one meetingBlocks entry: its weekday from             the column heading, its kind from the label (LEC is LECTURE, LAB is LAB, TUT is             TUTORIAL; a block with no label is a LECTURE), and its start and end times read off             the time axis in 24-hour HH:mm. Blocks usually start and end on the hour or half hour;             a block filling the 1 pm row and most of the 2 pm row ends at the line it stops on,             not at the next label. Report a room only when one is printed on the block.

            4. Names. When the schedule has a legend, timeline or list naming each course, match             it to the codes by colour or by order, and use that title as the name, such as             "Electric Circuits I". When nothing names a course, leave its name null.

            5. Colour. Report the colour each course's blocks are drawn in as a hex value.

            6. Dates. The dates in the column headings only show which week is on screen. They             are not the semester's start or end, and they never make a meeting a one-off.

            7. Decide isSchedule first. If the image is not a class schedule at all, set it to             false and stop: return an empty courses list and one short warning, without             describing the image.

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
        boolean vision = input.imagesOnly();
        String model = vision ? visionModel : textModel;
        Reply reply = call("Course parse", model, () -> paramsFor(model, vision, input, context));
        return new ParseOutcome(read(reply.json(), CourseDraft.class), model, reply.inputTokens(),
                reply.outputTokens());
    }

    public ScheduleOutcome parseSchedule(ExtractedInput input, String context) {
        boolean vision = input.imagesOnly();
        String model = vision ? visionModel : textModel;
        Reply reply = call("Schedule parse", model, () -> scheduleParamsFor(model, vision, input, context));
        return new ScheduleOutcome(read(reply.json(), ScheduleDraft.class), model, reply.inputTokens(),
                reply.outputTokens());
    }

    private record Reply(String json, long inputTokens, long outputTokens) {
    }

    private Reply call(String label, String model, Supplier<MessageCreateParams> params) {
        if (!enabled()) {
            throw new BadRequestException("Automatic course creation is not available right now.");
        }

        Message response;
        try {
            response = client().messages().create(params.get());
        } catch (Exception e) {
            log.error("{} request failed: {}", label, e.getMessage());
            throw new ServiceUnavailableException(
                    "Automatic course creation is busy right now. Please try again in a few minutes.");
        }

        log.info("{} used model={} input={} output={}",
                label, model, response.usage().inputTokens(), response.usage().outputTokens());

        if (response.stopReason().filter(StopReason.REFUSAL::equals).isPresent()) {
            log.warn("{} was refused by the model", label);
            throw new BadRequestException(UNREADABLE);
        }

        String json = response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(text -> text.text())
                .findFirst()
                .orElseThrow(() -> new BadRequestException(UNREADABLE));
        return new Reply(json, response.usage().inputTokens(), response.usage().outputTokens());
    }

    private static <T> T read(String json, Class<T> type) {
        try {
            return MAPPER.readValue(json, type);
        } catch (Exception e) {
            log.warn("Parse returned unreadable JSON: {}", e.getMessage());
            throw new BadRequestException(UNREADABLE);
        }
    }

    public record ParseOutcome(CourseDraft draft, String model, long inputTokens, long outputTokens) {
    }

    public record ScheduleOutcome(ScheduleDraft draft, String model, long inputTokens, long outputTokens) {
    }

    MessageCreateParams paramsFor(String model, boolean vision, ExtractedInput input, String context) {
        OutputConfig.Builder outputConfig = OutputConfig.builder()
                .format(CourseDraftSchema.format());

        return build(model, vision, SYSTEM_PROMPT, outputConfig, blocks(input, context, "Extract the course details."));
    }

    MessageCreateParams scheduleParamsFor(String model, boolean vision, ExtractedInput input, String context) {
        OutputConfig.Builder outputConfig = OutputConfig.builder()
                .format(ScheduleDraftSchema.format());
        return build(model, vision, SCHEDULE_PROMPT, outputConfig,
                blocks(input, context, "List every course on this schedule."));
    }

    private MessageCreateParams build(String model, boolean vision, String system,
                                      OutputConfig.Builder outputConfig, List<ContentBlockParam> blocks) {
        MessageCreateParams.Builder builder = MessageCreateParams.builder()
                .model(model)
                .maxTokens(MAX_TOKENS)
                .system(system);

        if (!vision) {
            builder = builder.thinking(ThinkingConfigAdaptive.builder().build());
            outputConfig = outputConfig.effort(OutputConfig.Effort.MEDIUM);
        } else if (supportsEffort(model)) {
            outputConfig = outputConfig.effort(OutputConfig.Effort.MEDIUM);
        }

        return builder
                .outputConfig(outputConfig.build())
                .addUserMessageOfBlockParams(blocks)
                .build();
    }

    static boolean supportsEffort(String model) {
        return model != null && !model.startsWith("claude-haiku-4") && !model.startsWith("claude-sonnet-4-5");
    }

    private List<ContentBlockParam> blocks(ExtractedInput input, String context, String ask) {
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
        prompt.append("\n\n").append(ask);

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
                client = AnthropicOkHttpClient.builder()
                        .apiKey(apiKey)
                        .timeout(java.time.Duration.ofSeconds(120))
                        .maxRetries(1)
                        .build();
            }
            return client;
        }
    }
}
