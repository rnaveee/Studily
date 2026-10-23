package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.Paged;
import com.rnave.studily.admin.AdminDtos.SurveyContact;
import com.rnave.studily.admin.AdminDtos.SurveyCount;
import com.rnave.studily.admin.AdminDtos.SurveyMatrixRow;
import com.rnave.studily.admin.AdminDtos.SurveyQuestionSummary;
import com.rnave.studily.admin.AdminDtos.SurveySummary;
import com.rnave.studily.admin.AdminDtos.SurveyTextAnswer;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.survey.SurveyDefinition;
import com.rnave.studily.survey.SurveyDefinition.Item;
import com.rnave.studily.survey.SurveyDefinition.Question;
import com.rnave.studily.survey.SurveyDefinition.Type;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminSurveyService {

    private static final int TEXT_PAGE = 25;
    private static final Duration MIN_ACCOUNT_AGE = Duration.ofDays(3);

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public AdminSurveyService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public SurveySummary summary() {
        SurveyDefinition definition = SurveyDefinition.FALL_2026;
        String key = definition.key();
        Long responses = jdbc.queryForObject(
                "SELECT count(*) FROM survey_responses WHERE survey_key = ?", Long.class, key);
        Long eligible = jdbc.queryForObject(
                "SELECT count(*) FROM users WHERE email_verified AND created_at <= ?", Long.class,
                Timestamp.from(clock.instant().minus(MIN_ACCOUNT_AGE)));

        List<String> textIds = textIds(definition);
        String placeholders = String.join(", ", Collections.nCopies(textIds.size(), "?"));
        List<Object> countArgs = new ArrayList<>();
        countArgs.add(key);
        countArgs.addAll(textIds);
        Map<String, Map<String, Map<String, Long>>> counts = new HashMap<>();
        String countSql = "SELECT a.question, coalesce(a.item, '') AS item, a.value, count(*) AS n "
                + "FROM survey_answers a JOIN survey_responses r ON r.id = a.response_id "
                + "WHERE r.survey_key = ? AND a.question NOT IN (" + placeholders + ") "
                + "GROUP BY a.question, a.item, a.value";
        jdbc.query(countSql, rs -> {
            counts.computeIfAbsent(rs.getString("question"), k -> new HashMap<>())
                    .computeIfAbsent(rs.getString("item"), k -> new HashMap<>())
                    .put(rs.getString("value"), rs.getLong("n"));
        }, countArgs.toArray());

        Map<String, Long> respondents = new HashMap<>();
        jdbc.query("""
                SELECT a.question, count(DISTINCT a.response_id) AS n
                FROM survey_answers a JOIN survey_responses r ON r.id = a.response_id
                WHERE r.survey_key = ?
                GROUP BY a.question
                """, rs -> {
                    respondents.put(rs.getString("question"), rs.getLong("n"));
                }, key);

        List<SurveyQuestionSummary> questions = new ArrayList<>();
        for (Question question : definition.questions()) {
            questions.add(summarise(question, counts.getOrDefault(question.id(), Map.of()),
                    respondents.getOrDefault(question.id(), 0L)));
        }

        Map<String, Long> disappointed = counts.getOrDefault("disappointed", Map.of()).getOrDefault("", Map.of());
        long disappointedBase = disappointed.values().stream().mapToLong(Long::longValue).sum();
        Double pmfAll = percent(disappointed.getOrDefault("Very disappointed", 0L), disappointedBase);

        Map<String, Long> weekly = new HashMap<>();
        jdbc.query("""
                SELECT d.value, count(*) AS n
                FROM survey_answers d
                JOIN survey_responses r ON r.id = d.response_id
                JOIN survey_answers f ON f.response_id = d.response_id AND f.question = 'frequency'
                WHERE r.survey_key = ? AND d.question = 'disappointed'
                  AND f.value IN ('Several times a day', 'About once a day', 'A few times a week')
                GROUP BY d.value
                """, rs -> {
                    weekly.put(rs.getString("value"), rs.getLong("n"));
                }, key);
        long weeklyBase = weekly.values().stream().mapToLong(Long::longValue).sum();
        Double pmfWeekly = percent(weekly.getOrDefault("Very disappointed", 0L), weeklyBase);

        Map<String, Long> recommend = counts.getOrDefault("recommend", Map.of()).getOrDefault("", Map.of());
        long npsBase = recommend.values().stream().mapToLong(Long::longValue).sum();
        Double nps = null;
        if (npsBase > 0) {
            long promoters = 0;
            long detractors = 0;
            for (Map.Entry<String, Long> entry : recommend.entrySet()) {
                int score = Integer.parseInt(entry.getKey());
                if (score >= 9) {
                    promoters += entry.getValue();
                } else if (score <= 6) {
                    detractors += entry.getValue();
                }
            }
            nps = Math.round((promoters - detractors) * 1000.0 / npsBase) / 10.0;
        }

        Map<String, Long> ease = counts.getOrDefault("ease", Map.of()).getOrDefault("", Map.of());
        long easeBase = ease.values().stream().mapToLong(Long::longValue).sum();
        Double avgEase = null;
        if (easeBase > 0) {
            long total = 0;
            for (Map.Entry<String, Long> entry : ease.entrySet()) {
                total += Long.parseLong(entry.getKey()) * entry.getValue();
            }
            avgEase = Math.round(total * 100.0 / easeBase) / 100.0;
        }

        return new SurveySummary(key, responses == null ? 0 : responses, eligible == null ? 0 : eligible,
                pmfAll, disappointedBase, pmfWeekly, weeklyBase, nps, npsBase, avgEase, questions);
    }

    public Paged<SurveyTextAnswer> text(String question, int page) {
        SurveyDefinition definition = SurveyDefinition.FALL_2026;
        Question found = definition.questions().stream()
                .filter(q -> q.id().equals(question) && q.type() == Type.TEXT)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Not a written question"));
        int safePage = Math.max(page, 0);
        Long total = jdbc.queryForObject("""
                SELECT count(*) FROM survey_answers a JOIN survey_responses r ON r.id = a.response_id
                WHERE r.survey_key = ? AND a.question = ?
                """, Long.class, definition.key(), found.id());
        List<SurveyTextAnswer> items = jdbc.query("""
                SELECT u.username, r.created_at, a.value
                FROM survey_answers a
                JOIN survey_responses r ON r.id = a.response_id
                JOIN users u ON u.id = r.user_id
                WHERE r.survey_key = ? AND a.question = ?
                ORDER BY r.created_at DESC, a.id DESC
                LIMIT ? OFFSET ?
                """, (rs, i) -> new SurveyTextAnswer(rs.getString("username"),
                rs.getTimestamp("created_at").toInstant(), rs.getString("value")),
                definition.key(), found.id(), TEXT_PAGE, (long) safePage * TEXT_PAGE);
        long count = total == null ? 0 : total;
        return new Paged<>(items, (long) (safePage + 1) * TEXT_PAGE < count, count);
    }

    public List<SurveyContact> contacts() {
        return jdbc.query("""
                SELECT u.username, u.email, r.created_at
                FROM survey_answers a
                JOIN survey_responses r ON r.id = a.response_id
                JOIN users u ON u.id = r.user_id
                WHERE r.survey_key = ? AND a.question = 'contact' AND a.value = 'Yes'
                ORDER BY r.created_at DESC
                """, (rs, i) -> new SurveyContact(rs.getString("username"), rs.getString("email"),
                rs.getTimestamp("created_at").toInstant()), SurveyDefinition.FALL_2026.key());
    }

    private static List<String> textIds(SurveyDefinition definition) {
        return definition.questions().stream()
                .filter(q -> q.type() == Type.TEXT)
                .map(Question::id)
                .toList();
    }

    private static Double percent(long part, long base) {
        return base == 0 ? null : Math.round(part * 1000.0 / base) / 10.0;
    }

    private SurveyQuestionSummary summarise(Question question, Map<String, Map<String, Long>> byItem,
                                            long respondents) {
        String type = question.type().name();
        if (question.type() == Type.TEXT) {
            return new SurveyQuestionSummary(question.id(), question.step(), type, question.prompt(), respondents,
                    List.of(), null);
        }
        if (question.type() == Type.MATRIX) {
            List<SurveyMatrixRow> rows = new ArrayList<>();
            for (Item item : question.rows()) {
                Map<String, Long> values = byItem.getOrDefault(item.id(), Map.of());
                List<SurveyCount> row = new ArrayList<>();
                for (String column : question.columns()) {
                    row.add(new SurveyCount(column, values.getOrDefault(column, 0L)));
                }
                rows.add(new SurveyMatrixRow(item.id(), item.label(), row));
            }
            return new SurveyQuestionSummary(question.id(), question.step(), type, question.prompt(), respondents,
                    List.of(), rows);
        }
        Map<String, Long> values = byItem.getOrDefault("", Map.of());
        Map<String, Long> ordered = new LinkedHashMap<>();
        if (question.type() == Type.SCALE) {
            for (int n = question.min(); n <= question.max(); n++) {
                ordered.put(String.valueOf(n), values.getOrDefault(String.valueOf(n), 0L));
            }
        } else if (question.optionsFrom() != null) {
            SurveyDefinition.FALL_2026.byId().get(question.optionsFrom()).rows()
                    .forEach(row -> ordered.put(row.label(), values.getOrDefault(row.id(), 0L)));
        } else {
            for (String option : question.options()) {
                ordered.put(option, values.getOrDefault(option, 0L));
            }
        }
        List<SurveyCount> counts = ordered.entrySet().stream()
                .map(e -> new SurveyCount(e.getKey(), e.getValue()))
                .toList();
        return new SurveyQuestionSummary(question.id(), question.step(), type, question.prompt(), respondents,
                counts, null);
    }
}
