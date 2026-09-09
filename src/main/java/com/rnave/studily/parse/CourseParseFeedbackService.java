package com.rnave.studily.parse;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.parse.CourseParseDtos.ParseAccuracyDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class CourseParseFeedbackService {

    static final int MIN_SAMPLE = 20;
    private static final Duration WINDOW = Duration.ofDays(90);
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    private record Cached(ParseAccuracyDto accuracy, Instant computedAt) {}

    private final CourseParseUsageRepository usageRepository;
    private final CourseParseFeedbackRepository feedbackRepository;
    private final CurrentUser currentUser;
    private final AtomicReference<Cached> cache = new AtomicReference<>();

    public CourseParseFeedbackService(CourseParseUsageRepository usageRepository,
                                      CourseParseFeedbackRepository feedbackRepository,
                                      CurrentUser currentUser) {
        this.usageRepository = usageRepository;
        this.feedbackRepository = feedbackRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public void rate(Long parseId, ParseRating rating) {
        CourseParseUsage parse = usageRepository.findById(parseId)
                .orElseThrow(() -> new NotFoundException("That parse is no longer on record"));
        if (!parse.getUser().getId().equals(currentUser.id())) {
            throw new NotFoundException("That parse is no longer on record");
        }
        if (feedbackRepository.existsByParseId(parseId)) {
            return;
        }
        CourseParseFeedback feedback = new CourseParseFeedback();
        feedback.setParse(parse);
        feedback.setUser(currentUser.entity());
        feedback.setRating(rating);
        feedbackRepository.save(feedback);
        cache.set(null);
    }

    @Transactional(readOnly = true)
    public ParseAccuracyDto accuracy() {
        Cached cached = cache.get();
        if (cached != null && cached.computedAt().isAfter(Instant.now().minus(CACHE_TTL))) {
            return cached.accuracy();
        }
        Instant since = Instant.now().minus(WINDOW);
        long total = feedbackRepository.countByCreatedAtAfter(since);
        ParseAccuracyDto accuracy;
        if (total < MIN_SAMPLE) {
            accuracy = new ParseAccuracyDto(null, total);
        } else {
            long worked = feedbackRepository.countByRatingNotAndCreatedAtAfter(
                    ParseRating.INACCURATE, since);
            accuracy = new ParseAccuracyDto(Math.round(worked * 100.0 / total), total);
        }
        cache.set(new Cached(accuracy, Instant.now()));
        return accuracy;
    }
}
