package com.rnave.studily.survey;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public record SurveyDefinition(String key, int steps, List<Question> questions) {

    public enum Type {
        SINGLE,
        MULTI,
        MATRIX,
        SCALE,
        TEXT
    }

    public record Item(String id, String label) {
    }

    public record ShowIf(String question, List<String> values) {
    }

    public record Question(
            String id,
            int step,
            Type type,
            String prompt,
            List<String> options,
            List<Item> rows,
            List<String> columns,
            Integer min,
            Integer max,
            Integer maxPicks,
            boolean required,
            ShowIf showIf,
            String optionsFrom) {
    }

    public static final int TEXT_LIMIT = 1000;

    public static final SurveyDefinition FALL_2026 = build();

    public Map<String, Question> byId() {
        return questions.stream().collect(Collectors.toMap(Question::id, Function.identity()));
    }

    private static Question single(String id, int step, String prompt, List<String> options, ShowIf showIf) {
        return new Question(id, step, Type.SINGLE, prompt, options, null, null, null, null, null, true, showIf, null);
    }

    private static Question multi(String id, int step, String prompt, List<String> options, Integer maxPicks,
                                  ShowIf showIf) {
        return new Question(id, step, Type.MULTI, prompt, options, null, null, null, null, maxPicks, true, showIf, null);
    }

    private static Question text(String id, int step, String prompt, ShowIf showIf) {
        return new Question(id, step, Type.TEXT, prompt, null, null, null, null, null, null, false, showIf, null);
    }

    private static Question scale(String id, int step, String prompt, int min, int max) {
        return new Question(id, step, Type.SCALE, prompt, null, null, null, min, max, null, true, null, null);
    }

    private static SurveyDefinition build() {
        List<String> usageColumns = List.of("Often", "Sometimes", "Tried it, stopped", "Never tried",
                "Didn't know about it");
        List<Item> usageRows = List.of(
                new Item("dashboard", "Dashboard & weekly schedule"),
                new Item("courses", "Courses & syllabus upload"),
                new Item("calendar", "Calendar"),
                new Item("todos", "To-dos & reminders"),
                new Item("flashcards", "Flashcards"),
                new Item("generator", "AI flashcard generator"),
                new Item("sessions", "Study sessions & Pomodoro"),
                new Item("chat_ai", "AI chat"),
                new Item("tools", "Periodic table & calculator"),
                new Item("messages", "Messages"),
                new Item("friends", "Friends & schoolmates"),
                new Item("progress", "XP, badges & chests"),
                new Item("canvas", "Canvas import"),
                new Item("notifications", "Notifications"));
        ShowIf troubled = new ShowIf("trouble", List.of("Yes, a little", "Yes, a lot"));
        ShowIf wouldPay = new ShowIf("pay", List.of("Yes", "Maybe, if it's cheap"));
        List<Question> questions = List.of(
                single("year", 1, "What year of school are you in?", List.of("High school", "1st year", "2nd year",
                        "3rd year", "4th year or more", "Grad school", "Not a student"), null),
                single("found", 1, "How did you first hear about Studily?", List.of("A friend or classmate",
                        "Instagram", "TikTok", "Reddit", "A teacher, TA or club", "Searching online", "Other"), null),
                text("found_other", 1, "Where?", new ShowIf("found", List.of("Other"))),
                single("frequency", 1, "How often do you use Studily?", List.of("Several times a day",
                        "About once a day", "A few times a week", "About once a week", "Less than that"), null),
                new Question("usage", 2, Type.MATRIX, "How much do you use each of these?", null, usageRows,
                        usageColumns, null, null, null, true, null, null),
                new Question("favourite", 2, Type.SINGLE, "Which one would you miss most if it disappeared?", null,
                        null, null, null, null, null, true,
                        new ShowIf("usage", List.of("Often", "Sometimes")), "usage"),
                multi("stopped_why", 2, "What made you stop using {names}?", List.of("Confusing to use",
                        "Buggy or slow", "Didn't fit how I study", "I use another app for it",
                        "Forgot it was there", "Other"), null, new ShowIf("usage", List.of("Tried it, stopped"))),
                multi("other_apps", 2, "What else do you use for school?", List.of("Google Calendar", "Notion",
                        "Quizlet", "Anki", "ChatGPT or another AI", "My school's Canvas / D2L / Moodle app",
                        "Apple Notes or Reminders", "Discord", "A paper planner", "Nothing else", "Other"), null,
                        null),
                single("trouble", 3, "Have you had trouble with Studily?", List.of("No", "Yes, a little",
                        "Yes, a lot"), null),
                multi("trouble_what", 3, "What went wrong?", List.of("Something broke or showed an error",
                        "It was slow", "Couldn't find something", "Notifications didn't arrive",
                        "Something I saved went missing", "Looked wrong on my phone", "Signing in", "Other"), null,
                        troubled),
                text("trouble_details", 3,
                        "Tell us what happened: what you were doing and on which device", troubled),
                scale("ease", 3, "How easy is Studily to use?", 1, 5),
                multi("roadmap", 4, "Pick up to 3 things you'd want next", List.of(
                        "Full Canvas sync (assignments and grades update themselves)", "Grade & GPA tracker",
                        "AI tutor that answers from your own notes and slides",
                        "Study groups & shared study sessions", "Two-way Google/Apple Calendar sync",
                        "Exam countdowns & study plans", "Notes", "An app from the App Store / Play Store",
                        "Other"), 3, null),
                text("one_thing", 4, "What one thing would make Studily more useful for you?", null),
                single("disappointed", 5, "How would you feel if you could no longer use Studily?", List.of(
                        "Very disappointed", "Somewhat disappointed", "Not disappointed"), null),
                text("benefit", 5, "What's the main thing Studily does for you?", null),
                scale("recommend", 5, "How likely are you to recommend Studily to a friend?", 0, 10),
                single("pay", 5, "If a Studily Plus plan added more AI (more generated flashcards, an AI tutor on "
                        + "your notes), would you pay for it?", List.of("Yes", "Maybe, if it's cheap",
                        "No, I'd stick with free"), null),
                single("price", 5, "What's the most that would feel fair?", List.of("$2 a month", "$4 a month",
                        "$6 a month", "$10+ a month", "I'd rather pay once a semester"), wouldPay),
                single("contact", 5, "Can we email you a follow-up question?", List.of("Yes", "No"), null));
        return new SurveyDefinition("fall-2026", 5, questions);
    }
}
