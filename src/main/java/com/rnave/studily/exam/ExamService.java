package com.rnave.studily.exam;

import com.rnave.studily.academic.AcademicItem;
import com.rnave.studily.academic.AcademicItemRepository;
import com.rnave.studily.academic.GradeCategory;
import com.rnave.studily.academic.GradeCategoryRepository;
import com.rnave.studily.academic.Grades;
import com.rnave.studily.academic.ItemStatus;
import com.rnave.studily.academic.ItemType;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.exam.ExamDtos.LinkRequest;
import com.rnave.studily.exam.ExamDtos.PlanDayDto;
import com.rnave.studily.exam.ExamDtos.PlanDto;
import com.rnave.studily.exam.ExamDtos.PlanSetDto;
import com.rnave.studily.exam.ExamDtos.PlanTaskDto;
import com.rnave.studily.exam.ExamDtos.PlanTodoDto;
import com.rnave.studily.exam.ExamDtos.UpcomingExamDto;
import com.rnave.studily.flashcard.Flashcard;
import com.rnave.studily.flashcard.FlashcardSet;
import com.rnave.studily.flashcard.FlashcardSetRepository;
import com.rnave.studily.todo.Todo;
import com.rnave.studily.todo.TodoRepository;
import com.rnave.studily.user.UserTimeZones;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ExamService {

    private final AcademicItemRepository itemRepository;
    private final GradeCategoryRepository categoryRepository;
    private final ExamStudyLinkRepository linkRepository;
    private final FlashcardSetRepository setRepository;
    private final TodoRepository todoRepository;
    private final CurrentUser currentUser;
    private final UserTimeZones timeZones;

    public ExamService(AcademicItemRepository itemRepository, GradeCategoryRepository categoryRepository,
                       ExamStudyLinkRepository linkRepository, FlashcardSetRepository setRepository,
                       TodoRepository todoRepository, CurrentUser currentUser, UserTimeZones timeZones) {
        this.itemRepository = itemRepository;
        this.categoryRepository = categoryRepository;
        this.linkRepository = linkRepository;
        this.setRepository = setRepository;
        this.todoRepository = todoRepository;
        this.currentUser = currentUser;
        this.timeZones = timeZones;
    }

    @Transactional(readOnly = true)
    public List<UpcomingExamDto> upcoming(Long semesterId) {
        Long userId = currentUser.id();
        ZoneId zone = timeZones.zoneFor(currentUser.entity());
        Instant now = Instant.now();
        LocalDate today = now.atZone(zone).toLocalDate();

        List<AcademicItem> exams = semesterId != null
                ? itemRepository.findByCourseUserIdAndCourseSemesterIdAndTypeAndStatusNotAndDueAtAfterOrderByDueAtAsc(
                        userId, semesterId, ItemType.EXAM, ItemStatus.DONE, now)
                : itemRepository.findByCourseUserIdAndTypeAndStatusNotAndDueAtAfterOrderByDueAtAsc(
                        userId, ItemType.EXAM, ItemStatus.DONE, now);

        Map<Long, List<ExamStudyLink>> linksByExam = exams.isEmpty() ? Map.of()
                : linkRepository.findByExamIdIn(exams.stream().map(AcademicItem::getId).toList()).stream()
                        .collect(Collectors.groupingBy(l -> l.getExam().getId()));

        Map<Long, CourseContext> contexts = new HashMap<>();
        List<UpcomingExamDto> out = new ArrayList<>();
        for (AcademicItem exam : exams) {
            Course course = exam.getCourse();
            CourseContext ctx = contexts.computeIfAbsent(course.getId(), id -> contextFor(course));
            List<ExamStudyLink> links = linksByExam.getOrDefault(exam.getId(), List.of());
            Double weight = ctx.weightOf(exam);
            Double needed = exam.getScore() != null ? null
                    : NeededOnExam.percent(ctx.grade.percent(), ctx.grade.totalWeight(), weight,
                            course.getTargetGrade());
            out.add(new UpcomingExamDto(
                    exam.getId(), exam.getTitle(), exam.getDueAt(),
                    course.getId(), course.getName(), course.getCode(), course.getColor(),
                    StudyPlanner.daysLeft(today, exam.getDueAt().atZone(zone).toLocalDate()),
                    weight, ctx.grade.percent(), course.getTargetGrade(), needed,
                    (int) links.stream().filter(l -> l.getFlashcardSet() != null).count(),
                    (int) links.stream().filter(l -> l.getTodo() != null).count()));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public PlanDto plan(Long examId) {
        AcademicItem exam = requireOwnedExam(examId);
        return buildPlan(exam, timeZones.zoneFor(currentUser.entity()), Instant.now());
    }

    @Transactional
    public PlanDto link(Long examId, LinkRequest req) {
        if ((req.flashcardSetId() == null) == (req.todoId() == null)) {
            throw new BadRequestException("Link exactly one flashcard set or one task");
        }
        AcademicItem exam = requireOwnedExam(examId);
        Long userId = currentUser.id();
        ExamStudyLink link = new ExamStudyLink();
        link.setExam(exam);
        if (req.flashcardSetId() != null) {
            FlashcardSet set = setRepository.findByIdAndUserId(req.flashcardSetId(), userId)
                    .orElseThrow(() -> new NotFoundException("Flashcard set not found"));
            if (linkRepository.existsByExamIdAndFlashcardSetId(examId, set.getId())) {
                throw new ConflictException("That set is already in the study plan");
            }
            link.setFlashcardSet(set);
        } else {
            Todo todo = todoRepository.findByIdAndUserId(req.todoId(), userId)
                    .orElseThrow(() -> new NotFoundException("Task not found"));
            if (linkRepository.existsByExamIdAndTodoId(examId, todo.getId())) {
                throw new ConflictException("That task is already in the study plan");
            }
            link.setTodo(todo);
        }
        linkRepository.save(link);
        return buildPlan(exam, timeZones.zoneFor(currentUser.entity()), Instant.now());
    }

    @Transactional
    public PlanDto unlink(Long examId, Long linkId) {
        AcademicItem exam = requireOwnedExam(examId);
        ExamStudyLink link = linkRepository.findByIdAndExamId(linkId, examId)
                .orElseThrow(() -> new NotFoundException("Link not found"));
        linkRepository.delete(link);
        return buildPlan(exam, timeZones.zoneFor(currentUser.entity()), Instant.now());
    }

    @Transactional(readOnly = true)
    public String todayTarget(AcademicItem exam, ZoneId zone, Instant now) {
        if (linkRepository.findByExamIdOrderByIdAsc(exam.getId()).isEmpty()) {
            return null;
        }
        PlanDto plan = buildPlan(exam, zone, now);
        List<String> parts = new ArrayList<>();
        if (plan.todayCards() > 0) {
            parts.add("review %d card%s".formatted(plan.todayCards(), plan.todayCards() == 1 ? "" : "s"));
        }
        int tasks = plan.days().isEmpty() ? 0 : plan.days().get(0).todos().size();
        if (tasks > 0) {
            parts.add("finish %d task%s".formatted(tasks, tasks == 1 ? "" : "s"));
        }
        return parts.isEmpty() ? null : "Today's plan: " + String.join(" and ", parts) + ".";
    }

    PlanDto buildPlan(AcademicItem exam, ZoneId zone, Instant now) {
        LocalDate today = now.atZone(zone).toLocalDate();
        LocalDate examDate = exam.getDueAt().atZone(zone).toLocalDate();
        Instant startOfToday = today.atStartOfDay(zone).toInstant();

        List<PlanSetDto> sets = new ArrayList<>();
        List<PlanTodoDto> todos = new ArrayList<>();
        List<Long> openTodoIds = new ArrayList<>();
        Map<Long, String> openTodoTitles = new HashMap<>();
        int remaining = 0;

        for (ExamStudyLink link : linkRepository.findByExamIdOrderByIdAsc(exam.getId())) {
            FlashcardSet set = link.getFlashcardSet();
            if (set != null) {
                List<Flashcard> cards = set.completeCards();
                int left = (int) cards.stream()
                        .filter(c -> c.getDueAt() == null || !c.getDueAt().isAfter(exam.getDueAt()))
                        .filter(c -> c.getLastReviewedAt() == null || c.getLastReviewedAt().isBefore(startOfToday))
                        .count();
                remaining += left;
                sets.add(new PlanSetDto(link.getId(), set.getId(), set.getTitle(), cards.size(), left));
            }
            Todo todo = link.getTodo();
            if (todo != null) {
                boolean done = todo.getCompletedAt() != null;
                todos.add(new PlanTodoDto(link.getId(), todo.getId(), todo.getTitle(), done));
                if (!done) {
                    openTodoIds.add(todo.getId());
                    openTodoTitles.put(todo.getId(), todo.getTitle());
                }
            }
        }

        StudyPlanner.Plan plan = StudyPlanner.plan(remaining, openTodoIds, today, examDate);
        List<PlanDayDto> days = plan.days().stream()
                .map(d -> new PlanDayDto(d.date(), d.cards(),
                        d.todoIds().stream().map(id -> new PlanTaskDto(id, openTodoTitles.get(id))).toList(),
                        d.today()))
                .toList();

        Course course = exam.getCourse();
        return new PlanDto(exam.getId(), exam.getTitle(), exam.getDueAt(), course.getId(), course.getName(),
                plan.daysLeft(), plan.remainingCards(), plan.todayCards(), sets, todos, days);
    }

    private AcademicItem requireOwnedExam(Long examId) {
        AcademicItem item = itemRepository.findByIdAndCourseUserId(examId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        if (item.getType() != ItemType.EXAM) {
            throw new NotFoundException("Exam not found");
        }
        return item;
    }

    private CourseContext contextFor(Course course) {
        List<AcademicItem> items = itemRepository.findByCourseIdOrderByDueAtAsc(course.getId());
        List<GradeCategory> categories = categoryRepository.findByCourseIdOrderByPositionAscIdAsc(course.getId());
        return new CourseContext(items, categories, Grades.of(items, categories));
    }

    private record CourseContext(List<AcademicItem> items, List<GradeCategory> categories,
                                 Grades.CourseGrade grade) {

        Double weightOf(AcademicItem exam) {
            return Grades.effectiveWeight(exam, categories, Grades.countsByCategory(items));
        }
    }
}
