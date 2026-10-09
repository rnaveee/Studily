package com.rnave.studily.flashcard;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.flashcard.FlashcardRunDtos.CardResult;
import com.rnave.studily.flashcard.FlashcardRunDtos.FlashcardRunResult;
import com.rnave.studily.flashcard.FlashcardRunDtos.FlashcardRunStart;
import com.rnave.studily.flashcard.FlashcardRunDtos.RunCardDto;
import com.rnave.studily.flashcard.FlashcardRunDtos.XpReason;
import com.rnave.studily.progress.ChestService;
import com.rnave.studily.progress.ChestSource;
import com.rnave.studily.progress.ProgressDeltaBuilder;
import com.rnave.studily.progress.ProgressDtos.ProgressDelta;
import com.rnave.studily.progress.ProgressRateLimiter;
import com.rnave.studily.progress.ProgressService;
import com.rnave.studily.progress.UserProgress;
import com.rnave.studily.progress.XpSource;
import com.rnave.studily.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FlashcardRunService {

    static final int MAX_STARTS_PER_HOUR = 30;
    static final Duration MAX_RUN_AGE = Duration.ofHours(3);
    static final int MIN_CARDS = 5;
    static final int MAX_SCORED_CARDS = 40;
    static final int ACCURACY_BONUS = 20;
    static final long MIN_MILLIS_PER_CARD = 2_000;
    static final long MIN_MILLIS_PER_CARD_MATCH = 1_000;
    static final int DAILY_CAP = 300;
    static final int CHEST_MIN_CARDS = 10;
    static final double CHEST_CHANCE = 0.2;
    static final Set<FlashcardRunMode> GRADED_MODES = EnumSet.of(FlashcardRunMode.REVIEW, FlashcardRunMode.LEARN);

    private final FlashcardRunRepository runRepository;
    private final FlashcardSetService flashcardSetService;
    private final ProgressService progressService;
    private final ChestService chestService;
    private final ProgressRateLimiter rateLimiter;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    public FlashcardRunService(FlashcardRunRepository runRepository, FlashcardSetService flashcardSetService,
                               ProgressService progressService, ChestService chestService,
                               ProgressRateLimiter rateLimiter, CurrentUser currentUser, Clock clock,
                               ObjectMapper objectMapper) {
        this.runRepository = runRepository;
        this.flashcardSetService = flashcardSetService;
        this.progressService = progressService;
        this.chestService = chestService;
        this.rateLimiter = rateLimiter;
        this.currentUser = currentUser;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    record Score(int xp, XpReason reason) {
    }

    @Transactional
    public FlashcardRunStart start(Long setId, FlashcardRunMode mode) {
        User user = currentUser.entity();
        rateLimiter.check(user.getId());
        FlashcardSet set = flashcardSetService.requireViewable(setId, user.getId());
        UserProgress progress = progressService.ensure(user.getId());
        Instant now = clock.instant();
        if (runRepository.countByUserIdAndStartedAtAfter(user.getId(), now.minus(Duration.ofHours(1)))
                >= MAX_STARTS_PER_HOUR) {
            throw new TooManyRequestsException("You've started a lot of study runs. Take a short break and try again soon.");
        }
        FlashcardRun run = new FlashcardRun();
        run.setUser(user);
        run.setSet(set);
        run.setMode(mode);
        run.setStartedAt(now);
        run.setLocalDate(now.atZone(progressService.progressZone(progress, user)).toLocalDate());
        runRepository.save(run);
        return new FlashcardRunStart(run.getId(), run.getStartedAt());
    }

    @Transactional
    public FlashcardRunResult complete(Long runId, List<CardResult> submitted) {
        User user = currentUser.entity();
        rateLimiter.check(user.getId());
        ProgressDeltaBuilder delta = progressService.begin(user.getId());
        FlashcardRun run = runRepository.findByIdAndUserId(runId, user.getId())
                .orElseThrow(() -> new NotFoundException("Flashcard run not found"));
        if (run.getCompletedAt() != null) {
            throw new ConflictException("This run is already complete");
        }
        Instant now = clock.instant();
        if (now.isAfter(run.getStartedAt().plus(MAX_RUN_AGE))) {
            throw new BadRequestException("This run has expired");
        }
        if (run.getSet() == null) {
            throw new BadRequestException("This flashcard set no longer exists");
        }
        FlashcardSet set = flashcardSetService.requireViewable(run.getSet().getId(), user.getId());
        Map<Long, Flashcard> cards = set.getCards().stream()
                .filter(c -> c.getId() != null)
                .collect(Collectors.toMap(Flashcard::getId, Function.identity()));
        List<CardResult> results = submitted == null ? List.of() : submitted;
        Set<Long> seen = new HashSet<>();
        for (CardResult r : results) {
            if (r == null || r.cardId() == null) {
                throw new BadRequestException("Each result needs a card id");
            }
            if (!seen.add(r.cardId())) {
                throw new BadRequestException("Each card can only be reported once");
            }
            if (!cards.containsKey(r.cardId())) {
                throw new BadRequestException("That card isn't in this set");
            }
        }
        int cardCount = results.size();
        int correctCount = (int) results.stream().filter(CardResult::correct).count();

        Score score = score(run, user.getId(), cardCount, correctCount, now);
        int granted = progressService.grantXp(delta, XpSource.FLASHCARD_RUN, score.xp(),
                "flashcard-run:" + run.getId(), run.getId());

        run.setCompletedAt(now);
        run.setCardCount(cardCount);
        run.setCorrectCount(correctCount);
        run.setXpAwarded(granted);
        run.setXpReason(score.reason().name());
        run.setResultsJson(objectMapper.writeValueAsString(results));

        if (cardCount >= CHEST_MIN_CARDS && granted > 0) {
            chestService.maybeDrop(delta, ChestSource.FLASHCARD, "run:" + run.getId(), CHEST_CHANCE,
                    run.getLocalDate());
        }
        ProgressDelta result = progressService.finish(delta);
        List<RunCardDto> summary = results.stream()
                .map(r -> {
                    Flashcard card = cards.get(r.cardId());
                    return new RunCardDto(card.getId(), card.getFront(), card.getBack(), r.correct());
                })
                .toList();
        return new FlashcardRunResult(run.getId(), run.getMode(), cardCount, correctCount, granted,
                score.reason(), summary, result);
    }

    private Score score(FlashcardRun run, Long userId, int cardCount, int correctCount, Instant now) {
        if (cardCount < MIN_CARDS) {
            return new Score(0, XpReason.TOO_FEW);
        }
        long minMillisPerCard = run.getMode() == FlashcardRunMode.MATCH
                ? MIN_MILLIS_PER_CARD_MATCH : MIN_MILLIS_PER_CARD;
        if (Duration.between(run.getStartedAt(), now).toMillis() < minMillisPerCard * cardCount) {
            return new Score(0, XpReason.TOO_FAST);
        }
        int xp = 2 * Math.min(cardCount, MAX_SCORED_CARDS);
        if (GRADED_MODES.contains(run.getMode()) && correctCount * 5L >= cardCount * 4L) {
            xp += ACCURACY_BONUS;
        }
        long earlier = runRepository.countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(
                userId, run.getSet().getId(), run.getLocalDate(), 0);
        XpReason reason = XpReason.FULL;
        if (earlier >= 2) {
            return new Score(0, XpReason.REPEAT);
        }
        if (earlier == 1) {
            xp = (xp + 1) / 2;
            reason = XpReason.REDUCED;
        }
        int remaining = Math.max(0, DAILY_CAP - runRepository.sumXpByUserIdAndLocalDate(userId, run.getLocalDate()));
        if (xp > remaining) {
            xp = remaining;
            reason = XpReason.DAILY_CAP;
        }
        return new Score(xp, reason);
    }
}
