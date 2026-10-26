package com.rnave.studily.canvas;

import com.rnave.studily.canvas.FeedImportDtos.FeedStageResult;
import com.rnave.studily.canvas.FeedImportDtos.StageOutcome;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.canvas.FeedImportDtos.StoredImport;
import com.rnave.studily.user.User;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class FeedImportStore {

    private final FeedImportRepository repository;
    private final ObjectMapper objectMapper;

    public FeedImportStore(FeedImportRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public StoredImport save(User user, Long feedId, StageOutcome outcome) {
        StagedPayload fresh = outcome.payload();
        if (fresh.courses().isEmpty()) {
            return new StoredImport(result(null, fresh, outcome), fresh);
        }
        FeedImport entity = feedId == null ? null
                : repository.findFirstByFeedIdAndStatus(feedId, FeedImport.Status.PENDING).orElse(null);
        StagedPayload payload = fresh;
        if (entity == null) {
            entity = new FeedImport();
            entity.setUser(user);
            entity.setFeedId(feedId);
        } else {
            payload = merge(read(entity), fresh);
        }
        entity.setProvider(payload.provider());
        entity.setPayload(write(payload));
        entity.setUpdatedAt(Instant.now());
        FeedImport saved = repository.save(entity);
        return new StoredImport(result(saved.getId(), payload, outcome), payload);
    }

    public StagedPayload read(FeedImport entity) {
        try {
            return objectMapper.readValue(entity.getPayload(), StagedPayload.class);
        } catch (JacksonException e) {
            throw new IllegalStateException("Stored import payload is unreadable", e);
        }
    }

    public String write(StagedPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JacksonException e) {
            throw new IllegalStateException("Could not store the import payload", e);
        }
    }

    static StagedPayload merge(StagedPayload existing, StagedPayload fresh) {
        Map<String, StagedCourse> merged = new LinkedHashMap<>();
        for (StagedCourse course : existing.courses()) {
            merged.put(course.key(), course);
        }
        for (StagedCourse course : fresh.courses()) {
            StagedCourse previous = merged.get(course.key());
            if (previous == null) {
                merged.put(course.key(), course);
                continue;
            }
            Map<String, StagedItem> items = new LinkedHashMap<>();
            for (StagedItem item : previous.items()) {
                items.put(item.key(), item);
            }
            for (StagedItem item : course.items()) {
                items.put(item.key(), item);
            }
            merged.put(course.key(), new StagedCourse(course.key(), course.canvasCourseId(),
                    course.lmsProvider(), course.lmsCourseId(), course.name(), course.code(), course.color(),
                    course.semesterId(), course.linkedCourseId(), course.matchCourseId(),
                    new ArrayList<>(items.values())));
        }
        return new StagedPayload(fresh.provider(), fresh.semesterId(), new ArrayList<>(merged.values()));
    }

    static FeedStageResult result(Long importId, StagedPayload payload, StageOutcome outcome) {
        List<StagedCourse> courses = payload.courses();
        int newCourses = (int) courses.stream().filter(c -> c.linkedCourseId() == null).count();
        int newItems = courses.stream().mapToInt(c -> c.items().size()).sum();
        return new FeedStageResult(importId, payload.provider(), newCourses, newItems,
                outcome.itemsUpdated(), outcome.eventsImported(), outcome.truncated());
    }
}
