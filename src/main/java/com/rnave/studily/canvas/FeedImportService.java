package com.rnave.studily.canvas;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.ItemTypes;
import com.rnave.studily.calendar.CalendarEvent;
import com.rnave.studily.calendar.CalendarEventRepository;
import com.rnave.studily.canvas.FeedImportDtos.ApplyRequest;
import com.rnave.studily.canvas.FeedImportDtos.ApplyResult;
import com.rnave.studily.canvas.FeedImportDtos.CourseChoice;
import com.rnave.studily.canvas.FeedImportDtos.CourseDecision;
import com.rnave.studily.canvas.FeedImportDtos.FeedImportView;
import com.rnave.studily.canvas.FeedImportDtos.ItemChoice;
import com.rnave.studily.canvas.FeedImportDtos.ItemDecision;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourseView;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.MatchKeys;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseDtos.CourseDto;
import com.rnave.studily.course.CourseDtos.CourseRequest;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.course.CourseService;
import com.rnave.studily.notification.NotificationRepository;
import com.rnave.studily.notification.NotificationType;
import com.rnave.studily.semester.Semester;
import com.rnave.studily.semester.SemesterRepository;
import com.rnave.studily.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
public class FeedImportService {

    private final FeedImportRepository importRepository;
    private final FeedImportStore store;
    private final FeedIgnoredRefRepository ignoredRefRepository;
    private final CourseService courseService;
    private final CourseRepository courseRepository;
    private final SemesterRepository semesterRepository;
    private final AcademicItemRepository itemRepository;
    private final CalendarEventRepository eventRepository;
    private final NotificationRepository notificationRepository;

    public FeedImportService(FeedImportRepository importRepository, FeedImportStore store,
                             FeedIgnoredRefRepository ignoredRefRepository, CourseService courseService,
                             CourseRepository courseRepository, SemesterRepository semesterRepository,
                             AcademicItemRepository itemRepository, CalendarEventRepository eventRepository,
                             NotificationRepository notificationRepository) {
        this.importRepository = importRepository;
        this.store = store;
        this.ignoredRefRepository = ignoredRefRepository;
        this.courseService = courseService;
        this.courseRepository = courseRepository;
        this.semesterRepository = semesterRepository;
        this.itemRepository = itemRepository;
        this.eventRepository = eventRepository;
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public FeedImportView view(Long userId, Long id) {
        FeedImport entity = owned(userId, id);
        StagedPayload payload = store.read(entity);
        List<StagedCourseView> courses = new ArrayList<>();
        for (StagedCourse c : payload.courses()) {
            courses.add(new StagedCourseView(c.key(), c.canvasCourseId(), c.lmsProvider(), c.lmsCourseId(),
                    c.name(), c.code(), c.color(), c.semesterId(), c.linkedCourseId(), c.matchCourseId(),
                    c.items(), dto(userId, c.matchCourseId()), dto(userId, c.linkedCourseId())));
        }
        return new FeedImportView(entity.getId(), entity.getProvider(), entity.getStatus(),
                entity.getCreatedAt(), courses);
    }

    @Transactional
    public void dismiss(Long userId, Long id) {
        FeedImport entity = pending(userId, id);
        entity.setStatus(FeedImport.Status.DISMISSED);
        entity.setUpdatedAt(Instant.now());
        importRepository.save(entity);
        notificationRepository.markRead(userId, NotificationType.FEED_REVIEW, id);
    }

    @Transactional
    public ApplyResult apply(User user, Long id, ApplyRequest req) {
        Long userId = user.getId();
        FeedImport entity = pending(userId, id);
        StagedPayload payload = store.read(entity);

        Map<String, CourseDecision> courseDecisions = new HashMap<>();
        for (CourseDecision d : req.courses()) {
            courseDecisions.put(d.key(), d);
        }
        Map<String, ItemDecision> itemDecisions = new HashMap<>();
        if (req.items() != null) {
            for (ItemDecision d : req.items()) {
                itemDecisions.put(d.key(), d);
            }
        }

        int created = 0;
        int merged = 0;
        int added = 0;
        int replaced = 0;
        int skipped = 0;
        for (StagedCourse staged : payload.courses()) {
            Course target = staged.linkedCourseId() == null ? null
                    : courseRepository.findByIdAndUserId(staged.linkedCourseId(), userId).orElse(null);
            if (target == null) {
                CourseDecision decision = courseDecisions.get(staged.key());
                if (decision == null) {
                    throw new BadRequestException("Choose what to do with " + staged.name());
                }
                switch (decision.decision()) {
                    case SKIP -> {
                        ignore(userId, FeedIgnoredRef.Kind.COURSE, staged.key());
                        skipped += staged.items().size();
                        continue;
                    }
                    case ADD -> {
                        target = addCourse(userId, staged, decision.overrides());
                        created++;
                    }
                    case MERGE -> {
                        target = mergeCourse(userId, staged, decision);
                        merged++;
                    }
                }
            }
            for (StagedItem item : staged.items()) {
                ItemDecision itemDecision = itemDecisions.get(item.key());
                ItemChoice choice = itemDecision == null ? ItemChoice.ADD : itemDecision.decision();
                if (choice == ItemChoice.SKIP) {
                    ignore(userId, FeedIgnoredRef.Kind.ITEM, item.externalUid());
                    skipped++;
                } else if (choice == ItemChoice.REPLACE) {
                    if (replaceItem(user, target, item, itemDecision)) {
                        replaced++;
                    }
                } else if (addItem(user, target, item)) {
                    added++;
                }
            }
        }

        entity.setStatus(FeedImport.Status.APPLIED);
        entity.setUpdatedAt(Instant.now());
        importRepository.save(entity);
        notificationRepository.markRead(userId, NotificationType.FEED_REVIEW, id);
        return new ApplyResult(created, merged, added, replaced, skipped);
    }

    private Course addCourse(Long userId, StagedCourse staged, CourseRequest overrides) {
        CourseRequest request = overrides != null ? overrides
                : new CourseRequest(cap(staged.name()), staged.semesterId(), cap(staged.code()), null, null,
                staged.color(), null, null, List.of());
        CourseDto dto = courseService.create(request);
        Course course = courseRepository.findByIdAndUserId(dto.id(), userId)
                .orElseThrow(() -> new NotFoundException("Course not found"));
        stampLink(course, staged);
        return courseRepository.save(course);
    }

    private Course mergeCourse(Long userId, StagedCourse staged, CourseDecision decision) {
        Long targetId = decision.targetCourseId() != null ? decision.targetCourseId() : staged.matchCourseId();
        if (targetId == null) {
            throw new BadRequestException("Pick a course to merge " + staged.name() + " into");
        }
        Course target = courseRepository.findByIdAndUserId(targetId, userId)
                .orElseThrow(() -> new NotFoundException("Course not found"));
        CourseRequest o = decision.overrides();
        String name = o != null ? o.name() : staged.name();
        String code = trimToNull(o != null ? o.code() : staged.code());

        if (isBlank(target.getName()) || (CourseLabel.onlyCode(target.getName()) && !isBlank(name)
                && !CourseLabel.onlyCode(name))) {
            target.setName(cap(name));
        }
        String existingCode = trimToNull(target.getCode());
        if (code != null) {
            if (existingCode == null) {
                target.setCode(cap(code));
            } else if (isBareCode(existingCode) && sameBase(existingCode, code)) {
                target.setCode(cap(code));
            }
        }
        target.setCodeKey(MatchKeys.codeKey(target.getCode()));
        if (isBlank(target.getColor())) {
            target.setColor(o != null && !isBlank(o.color()) ? o.color() : staged.color());
        }
        if (o != null) {
            if (isBlank(target.getProfessor())) {
                target.setProfessor(trimToNull(o.professor()));
            }
            if (isBlank(target.getLocation())) {
                target.setLocation(trimToNull(o.location()));
            }
            if (target.getCredits() == null && o.credits() != null) {
                target.setCredits(BigDecimal.valueOf(o.credits()).setScale(2, RoundingMode.HALF_UP));
            }
            if (target.getTargetGrade() == null) {
                target.setTargetGrade(o.targetGrade());
            }
        }
        if (target.getSemester() == null) {
            Long semesterId = o != null && o.semesterId() != null ? o.semesterId() : staged.semesterId();
            if (semesterId != null) {
                Semester semester = semesterRepository.findByIdAndUserId(semesterId, userId).orElse(null);
                target.setSemester(semester);
            }
        }
        stampLink(target, staged);
        return courseRepository.save(target);
    }

    private void stampLink(Course course, StagedCourse staged) {
        if (staged.canvasCourseId() != null) {
            if (course.getCanvasCourseId() != null && !course.getCanvasCourseId().equals(staged.canvasCourseId())) {
                throw new BadRequestException("That course is already linked to a different Canvas course");
            }
            course.setCanvasCourseId(staged.canvasCourseId());
            course.setCanvasSyncedAt(Instant.now());
        }
        if (staged.lmsCourseId() != null) {
            if (course.getLmsCourseId() != null && !course.getLmsCourseId().equals(staged.lmsCourseId())) {
                throw new BadRequestException("That course is already linked to a different course");
            }
            course.setLmsProvider(staged.lmsProvider());
            course.setLmsCourseId(staged.lmsCourseId());
        }
    }

    private boolean addItem(User user, Course course, StagedItem item) {
        if (item.kind() == StagedKind.EVENT) {
            if (eventRepository.findByUserIdAndExternalUid(user.getId(), item.externalUid()).isPresent()) {
                return false;
            }
            CalendarEvent event = new CalendarEvent();
            event.setUser(user);
            event.setTitle(item.title());
            event.setPlace(item.place());
            event.setStartAt(item.dueAt());
            event.setCourse(course);
            event.setExternalUid(item.externalUid());
            eventRepository.save(event);
            return true;
        }
        if (itemRepository.findFirstByCourseUserIdAndExternalUidOrderByIdAsc(user.getId(), item.externalUid())
                .isPresent()) {
            return false;
        }
        AcademicItem created = new AcademicItem();
        created.setCourse(course);
        created.setExternalUid(item.externalUid());
        created.setType(item.type() != null ? item.type() : ItemTypes.fromName(item.title()));
        created.setTitle(item.title());
        created.setDueAt(item.dueAt());
        itemRepository.save(created);
        return true;
    }

    private boolean replaceItem(User user, Course target, StagedItem incoming, ItemDecision decision) {
        if (decision.existingId() == null || decision.existingKind() == null) {
            throw new BadRequestException("Choose which existing deadline to replace");
        }
        Long userId = user.getId();
        AcademicItem existingItem = null;
        CalendarEvent existingEvent = null;
        if (decision.existingKind() == StagedKind.ITEM) {
            existingItem = itemRepository.findByIdAndCourseUserId(decision.existingId(), userId)
                    .orElseThrow(() -> new NotFoundException("Item not found"));
        } else {
            existingEvent = eventRepository.findByIdAndUserId(decision.existingId(), userId)
                    .orElseThrow(() -> new NotFoundException("Event not found"));
        }
        if (uidUsedElsewhere(userId, incoming.externalUid(), decision)) {
            return false;
        }
        if (existingItem != null && incoming.kind() == StagedKind.ITEM) {
            existingItem.setTitle(incoming.title());
            existingItem.setDueAt(incoming.dueAt());
            existingItem.setExternalUid(incoming.externalUid());
            if (!Objects.equals(existingItem.getCourse().getId(), target.getId())) {
                existingItem.setCourse(target);
                existingItem.setGradeCategory(null);
            }
            itemRepository.save(existingItem);
            return true;
        }
        if (existingEvent != null && incoming.kind() == StagedKind.EVENT) {
            existingEvent.setTitle(incoming.title());
            existingEvent.setStartAt(incoming.dueAt());
            if (incoming.place() != null) {
                existingEvent.setPlace(incoming.place());
            }
            existingEvent.setExternalUid(incoming.externalUid());
            existingEvent.setCourse(target);
            eventRepository.save(existingEvent);
            return true;
        }
        if (existingItem != null) {
            itemRepository.delete(existingItem);
        } else {
            eventRepository.delete(existingEvent);
        }
        addItem(user, target, incoming);
        return true;
    }

    private boolean uidUsedElsewhere(Long userId, String externalUid, ItemDecision decision) {
        Optional<AcademicItem> item = itemRepository
                .findFirstByCourseUserIdAndExternalUidOrderByIdAsc(userId, externalUid);
        if (item.isPresent() && !(decision.existingKind() == StagedKind.ITEM
                && Objects.equals(item.get().getId(), decision.existingId()))) {
            return true;
        }
        Optional<CalendarEvent> event = eventRepository.findByUserIdAndExternalUid(userId, externalUid);
        return event.isPresent() && !(decision.existingKind() == StagedKind.EVENT
                && Objects.equals(event.get().getId(), decision.existingId()));
    }

    private void ignore(Long userId, FeedIgnoredRef.Kind kind, String ref) {
        if (ignoredRefRepository.existsByUserIdAndKindAndRef(userId, kind, ref)) {
            return;
        }
        FeedIgnoredRef entry = new FeedIgnoredRef();
        entry.setUserId(userId);
        entry.setKind(kind);
        entry.setRef(ref);
        ignoredRefRepository.save(entry);
    }

    private FeedImport owned(Long userId, Long id) {
        return importRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Import not found"));
    }

    private FeedImport pending(Long userId, Long id) {
        FeedImport entity = owned(userId, id);
        if (entity.getStatus() != FeedImport.Status.PENDING) {
            throw new ConflictException("This import was already handled");
        }
        return entity;
    }

    private CourseDto dto(Long userId, Long courseId) {
        if (courseId == null) {
            return null;
        }
        return courseRepository.findByIdAndUserId(courseId, userId).map(CourseDto::from).orElse(null);
    }

    private static boolean isBareCode(String code) {
        String base = CourseCodes.baseKey(code);
        return base != null && base.equals(MatchKeys.codeKey(code));
    }

    private static boolean sameBase(String a, String b) {
        String baseA = CourseCodes.baseKey(a);
        return baseA != null && baseA.equals(CourseCodes.baseKey(b));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String cap(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.length() <= 255 ? t : t.substring(0, 255);
    }
}
