package com.rnave.studily.survey;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.ForbiddenException;
import com.rnave.studily.progress.Badge;
import com.rnave.studily.progress.BadgeRepository;
import com.rnave.studily.progress.BadgeService;
import com.rnave.studily.progress.BadgeSource;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ChestTier;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserBadge;
import com.rnave.studily.progress.UserBadgeRepository;
import com.rnave.studily.survey.SurveyDefinition.Item;
import com.rnave.studily.survey.SurveyDefinition.Question;
import com.rnave.studily.survey.SurveyDefinition.ShowIf;
import com.rnave.studily.survey.SurveyDefinition.Type;
import com.rnave.studily.survey.SurveyDtos.SubmitRequest;
import com.rnave.studily.survey.SurveyDtos.SurveyDto;
import com.rnave.studily.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SurveyService {

    static final String BADGE_CODE = "feedback";
    static final Duration MIN_ACCOUNT_AGE = Duration.ofDays(3);
    private static final Set<String> PLATFORMS = Set.of("ios", "android", "desktop");

    private final CurrentUser currentUser;
    private final ProgressService progressService;
    private final BadgeService badgeService;
    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final SurveyResponseRepository responseRepository;
    private final SurveyAnswerRepository answerRepository;
    private final SurveyPromptViews promptViews;
    private final Clock clock;
    private final boolean open;

    public SurveyService(CurrentUser currentUser, ProgressService progressService, BadgeService badgeService,
                         BadgeRepository badgeRepository, UserBadgeRepository userBadgeRepository,
                         SurveyResponseRepository responseRepository, SurveyAnswerRepository answerRepository,
                         SurveyPromptViews promptViews, Clock clock, @Value("${app.survey.open:true}") boolean open) {
        this.currentUser = currentUser;
        this.progressService = progressService;
        this.badgeService = badgeService;
        this.badgeRepository = badgeRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.responseRepository = responseRepository;
        this.answerRepository = answerRepository;
        this.promptViews = promptViews;
        this.clock = clock;
        this.open = open;
    }

    @Transactional(readOnly = true)
    public SurveyDto status() {
        User user = currentUser.entity();
        SurveyDefinition definition = SurveyDefinition.FALL_2026;
        boolean completed = responseRepository.existsByUserIdAndSurveyKey(user.getId(), definition.key());
        boolean promptSeen = promptViews.seen(user.getId(), definition.key());
        return new SurveyDto(definition.key(), open, eligible(user), completed, promptSeen, definition);
    }

    @Transactional
    public void markPromptSeen() {
        promptViews.markSeen(currentUser.id(), SurveyDefinition.FALL_2026.key());
    }

    @Transactional
    public ProgressDelta submit(SubmitRequest request) {
        SurveyDefinition definition = SurveyDefinition.FALL_2026;
        if (!definition.key().equals(request.key())) {
            throw new BadRequestException("Unknown survey");
        }
        if (!open) {
            throw new ForbiddenException("This survey is closed");
        }
        User user = currentUser.entity();
        if (!eligible(user)) {
            throw new ForbiddenException("Verify your email and use Studily for a few days to take this survey");
        }
        if (responseRepository.existsByUserIdAndSurveyKey(user.getId(), definition.key())) {
            throw new ConflictException("You already answered this survey");
        }
        List<Row> rows = validate(definition, request.answers());

        SurveyResponse response = new SurveyResponse();
        response.setUser(user);
        response.setSurveyKey(definition.key());
        response.setPlatform(platform(request.platform()));
        response.setStandalone(request.standalone());
        response.setCreatedAt(clock.instant());
        try {
            responseRepository.saveAndFlush(response);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("You already answered this survey");
        }
        List<SurveyAnswer> answers = new ArrayList<>();
        for (Row row : rows) {
            SurveyAnswer answer = new SurveyAnswer();
            answer.setResponse(response);
            answer.setQuestion(row.question());
            answer.setItem(row.item());
            answer.setValue(row.value());
            answers.add(answer);
        }
        answerRepository.saveAll(answers);

        ProgressDeltaBuilder delta = progressService.begin(user.getId());
        progressService.grantChest(delta, ChestSource.SURVEY, "survey:" + definition.key(), null, ChestTier.DIAMOND);
        if (!userBadgeRepository.existsByUserIdAndBadgeCode(user.getId(), BADGE_CODE)) {
            Badge badge = badgeRepository.findById(BADGE_CODE).orElse(null);
            if (badge != null) {
                UserBadge owned = badgeService.grant(user.getId(), badge, BadgeSource.EARNED);
                delta.addBadge(badgeService.toDto(badge, owned));
            }
        }
        return progressService.finish(delta);
    }

    private boolean eligible(User user) {
        return user.isEmailVerified()
                && !user.getCreatedAt().plus(MIN_ACCOUNT_AGE).isAfter(clock.instant());
    }

    private static String platform(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim().toLowerCase();
        return PLATFORMS.contains(value) ? value : "other";
    }

    private record Row(String question, String item, String value) {
    }

    private List<Row> validate(SurveyDefinition definition, Map<String, Object> raw) {
        Map<String, Question> known = definition.byId();
        for (String id : raw.keySet()) {
            if (!known.containsKey(id)) {
                throw new BadRequestException("Unknown question: " + id);
            }
        }
        Map<String, Object> accepted = new LinkedHashMap<>();
        List<Row> rows = new ArrayList<>();
        for (Question question : definition.questions()) {
            if (!visible(question, accepted)) {
                continue;
            }
            Object value = raw.get(question.id());
            switch (question.type()) {
                case SINGLE -> single(question, value, accepted, rows);
                case MULTI -> multi(question, value, accepted, rows);
                case MATRIX -> matrix(question, value, accepted, rows);
                case SCALE -> scale(question, value, accepted, rows);
                case TEXT -> text(question, value, accepted, rows);
            }
        }
        return rows;
    }

    private boolean visible(Question question, Map<String, Object> accepted) {
        ShowIf showIf = question.showIf();
        if (showIf == null) {
            return true;
        }
        Object source = accepted.get(showIf.question());
        if (source instanceof String single) {
            return showIf.values().contains(single);
        }
        if (source instanceof Map<?, ?> matrix) {
            return matrix.values().stream().anyMatch(showIf.values()::contains);
        }
        return false;
    }

    private void single(Question question, Object value, Map<String, Object> accepted, List<Row> rows) {
        if (value == null) {
            throw missing(question);
        }
        if (!(value instanceof String choice)) {
            throw invalid(question);
        }
        Set<String> allowed = new HashSet<>();
        if (question.optionsFrom() != null) {
            @SuppressWarnings("unchecked")
            Map<String, String> matrix = (Map<String, String>) accepted.get(question.optionsFrom());
            for (Map.Entry<String, String> entry : matrix.entrySet()) {
                if (question.showIf().values().contains(entry.getValue())) {
                    allowed.add(entry.getKey());
                }
            }
        } else {
            allowed.addAll(question.options());
        }
        if (!allowed.contains(choice)) {
            throw invalid(question);
        }
        accepted.put(question.id(), choice);
        rows.add(new Row(question.id(), null, choice));
    }

    private void multi(Question question, Object value, Map<String, Object> accepted, List<Row> rows) {
        if (!(value instanceof List<?> picks) || picks.isEmpty()) {
            throw missing(question);
        }
        Set<String> seen = new HashSet<>();
        for (Object pick : picks) {
            if (!(pick instanceof String choice) || !question.options().contains(choice) || !seen.add(choice)) {
                throw invalid(question);
            }
        }
        if (question.maxPicks() != null && seen.size() > question.maxPicks()) {
            throw new BadRequestException("Pick at most " + question.maxPicks() + " for: " + question.prompt());
        }
        accepted.put(question.id(), List.copyOf(seen));
        for (Object pick : picks) {
            rows.add(new Row(question.id(), null, (String) pick));
        }
    }

    private void matrix(Question question, Object value, Map<String, Object> accepted, List<Row> rows) {
        if (!(value instanceof Map<?, ?> given)) {
            throw missing(question);
        }
        Set<String> rowIds = new HashSet<>();
        for (Item item : question.rows()) {
            rowIds.add(item.id());
        }
        for (Object key : given.keySet()) {
            if (!rowIds.contains(key)) {
                throw invalid(question);
            }
        }
        Map<String, String> answers = new LinkedHashMap<>();
        for (Item item : question.rows()) {
            Object cell = given.get(item.id());
            if (cell == null) {
                throw missing(question);
            }
            if (!(cell instanceof String column) || !question.columns().contains(column)) {
                throw invalid(question);
            }
            answers.put(item.id(), column);
        }
        accepted.put(question.id(), answers);
        answers.forEach((item, column) -> rows.add(new Row(question.id(), item, column)));
    }

    private void scale(Question question, Object value, Map<String, Object> accepted, List<Row> rows) {
        if (value == null) {
            throw missing(question);
        }
        if (!(value instanceof Number number) || number.doubleValue() != Math.rint(number.doubleValue())) {
            throw invalid(question);
        }
        int chosen = number.intValue();
        if (chosen < question.min() || chosen > question.max()) {
            throw invalid(question);
        }
        accepted.put(question.id(), String.valueOf(chosen));
        rows.add(new Row(question.id(), null, String.valueOf(chosen)));
    }

    private void text(Question question, Object value, Map<String, Object> accepted, List<Row> rows) {
        if (value == null) {
            return;
        }
        if (!(value instanceof String raw)) {
            throw invalid(question);
        }
        String trimmed = raw.trim();
        if (trimmed.length() > SurveyDefinition.TEXT_LIMIT) {
            trimmed = trimmed.substring(0, SurveyDefinition.TEXT_LIMIT);
        }
        if (trimmed.isEmpty()) {
            return;
        }
        accepted.put(question.id(), trimmed);
        rows.add(new Row(question.id(), null, trimmed));
    }

    private static BadRequestException missing(Question question) {
        return new BadRequestException("Please answer: " + question.prompt());
    }

    private static BadRequestException invalid(Question question) {
        return new BadRequestException("Invalid answer for: " + question.prompt());
    }
}
