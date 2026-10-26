package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.FeedImportDtos.Conflict;
import com.rnave.studily.canvas.FeedImportDtos.CourseChoice;
import com.rnave.studily.canvas.FeedImportDtos.CourseDecision;
import com.rnave.studily.canvas.FeedImportDtos.CourseDecisions;
import com.rnave.studily.canvas.FeedImportDtos.ExistingItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseMatcher;
import com.rnave.studily.course.CourseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class FeedConflictService {

    private final FeedImportRepository importRepository;
    private final FeedImportStore store;
    private final CourseRepository courseRepository;
    private final CourseMatcher courseMatcher;
    private final AcademicItemRepository itemRepository;
    private final CalendarEventRepository eventRepository;

    public FeedConflictService(FeedImportRepository importRepository, FeedImportStore store,
                               CourseRepository courseRepository, CourseMatcher courseMatcher,
                               AcademicItemRepository itemRepository, CalendarEventRepository eventRepository) {
        this.importRepository = importRepository;
        this.store = store;
        this.courseRepository = courseRepository;
        this.courseMatcher = courseMatcher;
        this.itemRepository = itemRepository;
        this.eventRepository = eventRepository;
    }

    @Transactional(readOnly = true)
    public List<Conflict> conflicts(Long userId, Long id, CourseDecisions req) {
        FeedImport entity = importRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Import not found"));
        if (entity.getStatus() != FeedImport.Status.PENDING) {
            throw new ConflictException("This import was already handled");
        }
        StagedPayload payload = store.read(entity);
        Map<String, CourseDecision> decisions = new HashMap<>();
        for (CourseDecision d : req.courses()) {
            decisions.put(d.key(), d);
        }

        Map<Long, List<Candidate>> candidatesByCourse = new HashMap<>();
        List<Pair> pairs = new ArrayList<>();
        for (StagedCourse staged : payload.courses()) {
            List<Course> targets = targets(userId, staged, decisions.get(staged.key()));
            if (targets.isEmpty()) {
                continue;
            }
            List<Candidate> candidates = new ArrayList<>();
            for (Course course : targets) {
                candidates.addAll(candidatesByCourse.computeIfAbsent(course.getId(), cid -> load(userId, course)));
            }
            for (StagedItem incoming : staged.items()) {
                String wanted = normalize(incoming.title());
                if (wanted.isEmpty() || alreadyImported(userId, incoming)) {
                    continue;
                }
                for (Candidate candidate : candidates) {
                    if (!wanted.equals(candidate.normalized())) {
                        continue;
                    }
                    if (candidate.externalUid() != null && candidate.externalUid().equals(incoming.externalUid())) {
                        continue;
                    }
                    long gap = Math.abs(Duration.between(incoming.dueAt(), candidate.view().dueAt()).toSeconds());
                    pairs.add(new Pair(staged.key(), incoming, candidate, gap));
                }
            }
        }

        pairs.sort(Comparator.comparingLong(Pair::gap));
        Set<String> usedExisting = new HashSet<>();
        Set<String> usedIncoming = new HashSet<>();
        List<Conflict> conflicts = new ArrayList<>();
        for (Pair pair : pairs) {
            String existingKey = pair.candidate().view().kind() + ":" + pair.candidate().view().id();
            if (usedIncoming.contains(pair.incoming().key()) || usedExisting.contains(existingKey)) {
                continue;
            }
            usedIncoming.add(pair.incoming().key());
            usedExisting.add(existingKey);
            conflicts.add(new Conflict(pair.incoming().key(), pair.courseKey(), pair.incoming(),
                    pair.candidate().view()));
        }
        conflicts.sort(Comparator.comparing((Conflict c) -> c.existing().dueAt())
                .thenComparing(c -> c.existing().id()));
        return conflicts;
    }

    private List<Course> targets(Long userId, StagedCourse staged, CourseDecision decision) {
        List<Course> out = new ArrayList<>();
        if (staged.linkedCourseId() != null) {
            courseRepository.findByIdAndUserId(staged.linkedCourseId(), userId).ifPresent(out::add);
            return out;
        }
        if (decision == null || decision.decision() == CourseChoice.SKIP) {
            return out;
        }
        if (decision.decision() == CourseChoice.MERGE) {
            Long targetId = decision.targetCourseId() != null ? decision.targetCourseId() : staged.matchCourseId();
            if (targetId != null) {
                courseRepository.findByIdAndUserId(targetId, userId).ifPresent(out::add);
            }
            return out;
        }
        String name = decision.overrides() != null ? decision.overrides().name() : staged.name();
        String code = decision.overrides() != null ? decision.overrides().code() : staged.code();
        Long semesterId = decision.overrides() != null && decision.overrides().semesterId() != null
                ? decision.overrides().semesterId() : staged.semesterId();
        Set<Long> seen = new LinkedHashSet<>();
        for (Course course : courseMatcher.similar(userId, name, code, semesterId, false)) {
            if (seen.add(course.getId())) {
                out.add(course);
            }
        }
        return out;
    }

    private List<Candidate> load(Long userId, Course course) {
        List<Candidate> out = new ArrayList<>();
        for (AcademicItem item : itemRepository.findByCourseIdOrderByDueAtAsc(course.getId())) {
            out.add(new Candidate(new ExistingItem(item.getId(), StagedKind.ITEM, item.getTitle(), item.getType(),
                    item.getDueAt(), course.getId(), course.getName(), course.getCode()),
                    item.getExternalUid(), normalize(item.getTitle())));
        }
        for (CalendarEvent event : eventRepository.findByUserIdAndCourseId(userId, course.getId())) {
            out.add(new Candidate(new ExistingItem(event.getId(), StagedKind.EVENT, event.getTitle(), null,
                    event.getStartAt(), course.getId(), course.getName(), course.getCode()),
                    event.getExternalUid(), normalize(event.getTitle())));
        }
        return out;
    }

    private boolean alreadyImported(Long userId, StagedItem incoming) {
        return itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(userId, incoming.externalUid())
                .isPresent()
                || eventRepository.findByUserIdAndExternalUid(userId, incoming.externalUid()).isPresent();
    }

    static String normalize(String title) {
        if (title == null) {
            return "";
        }
        return title.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    private record Candidate(ExistingItem view, String externalUid, String normalized) {
    }

    private record Pair(String courseKey, StagedItem incoming, Candidate candidate, long gap) {
    }
}
