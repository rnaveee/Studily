package com.rnave.studily.parse;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.GlobalRateLimitFilter;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.parse.CourseParseDtos.CourseDraftDto;
import com.rnave.studily.parse.CourseParseDtos.ParseAccuracyDto;
import com.rnave.studily.parse.CourseParseDtos.ParseAvailabilityDto;
import com.rnave.studily.parse.CourseParseDtos.ParseFeedbackRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/courses/parse")
public class CourseParseController {

    private static final long PARSE_WINDOW_MS = 24 * 60 * 60_000L;
    private static final int PARSE_LIMIT = 8;
    private static final int PARSE_LIMIT_PER_IP = 20;

    private final SlidingWindowRateLimiter parseLimiter =
            new SlidingWindowRateLimiter(PARSE_LIMIT, PARSE_WINDOW_MS);
    private final SlidingWindowRateLimiter parseIpLimiter =
            new SlidingWindowRateLimiter(PARSE_LIMIT_PER_IP, PARSE_WINDOW_MS);

    private final CourseParseService courseParseService;
    private final CourseParseFeedbackService feedbackService;
    private final CurrentUser currentUser;

    public CourseParseController(CourseParseService courseParseService,
                                 CourseParseFeedbackService feedbackService,
                                 CurrentUser currentUser) {
        this.courseParseService = courseParseService;
        this.feedbackService = feedbackService;
        this.currentUser = currentUser;
    }

    @GetMapping("/enabled")
    public ParseAvailabilityDto enabled() {
        return new ParseAvailabilityDto(courseParseService.enabled());
    }

    @GetMapping("/accuracy")
    public ParseAccuracyDto accuracy() {
        return feedbackService.accuracy();
    }

    @PostMapping("/feedback")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void feedback(@Valid @RequestBody ParseFeedbackRequest request) {
        feedbackService.rate(request.parseId(), request.rating());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CourseDraftDto parse(
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "text", required = false) String text,
            @RequestParam(value = "semesterId", required = false) Long semesterId,
            @RequestParam(value = "timeZone", required = false) String timeZone,
            HttpServletRequest request) {

        if (!parseLimiter.tryConsume("user:" + currentUser.id())) {
            throw new TooManyRequestsException(
                    "You have reached today's limit for automatic course creation. Add this one manually or try again tomorrow.");
        }
        if (!parseIpLimiter.tryConsume("ip:" + GlobalRateLimitFilter.clientIp(request))) {
            throw new TooManyRequestsException(
                    "Too many automatic course requests from this network today. Add this one manually or try again tomorrow.");
        }
        return courseParseService.parse(files, text, semesterId, timeZone);
    }

    @Scheduled(fixedRate = 10 * PARSE_WINDOW_MS)
    void evictStaleParseWindows() {
        parseLimiter.evictStale();
        parseIpLimiter.evictStale();
    }
}
