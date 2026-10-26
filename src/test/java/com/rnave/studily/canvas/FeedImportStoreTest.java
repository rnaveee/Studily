package com.rnave.studily.canvas;

import com.rnave.studily.canvas.FeedImportDtos.StageOutcome;
import com.rnave.studily.canvas.FeedImportDtos.StagedCourse;
import com.rnave.studily.canvas.FeedImportDtos.StagedItem;
import com.rnave.studily.canvas.FeedImportDtos.StagedKind;
import com.rnave.studily.canvas.FeedImportDtos.StagedPayload;
import com.rnave.studily.canvas.FeedImportDtos.StoredImport;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedImportStoreTest {

    private FeedImportRepository repository;
    private FeedImportStore store;
    private User user;

    @BeforeEach
    void setUp() {
        repository = mock(FeedImportRepository.class);
        store = new FeedImportStore(repository, JsonMapper.builder().build());
        user = new User();
        user.setId(7L);
        when(repository.save(any(FeedImport.class))).thenAnswer(inv -> {
            FeedImport saved = inv.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(5L);
            }
            return saved;
        });
    }

    private static StagedItem item(String uid) {
        return new StagedItem(uid, uid, StagedKind.ITEM, null, "Lab", Instant.parse("2026-10-02T07:00:00Z"), null);
    }

    private static StagedCourse course(String key, Long matchId, String... uids) {
        List<StagedItem> items = new ArrayList<>();
        for (String uid : uids) {
            items.add(item(uid));
        }
        return new StagedCourse(key, 1L, null, null, "Algorithms", "CMPT 225", "#3b82f6", 9L, null, matchId, items);
    }

    private static StageOutcome outcome(StagedCourse... courses) {
        return new StageOutcome(new StagedPayload("CANVAS", 9L, List.of(courses)), 2, 1, 0, false);
    }

    @Test
    void nothingNewMakesNoRowAndNoImportId() {
        StoredImport stored = store.save(user, 1L, outcome());

        assertThat(stored.result().importId()).isNull();
        verify(repository, never()).save(any());
    }

    @Test
    void aFirstStagingCreatesOnePendingRowWithTheJsonPayload() {
        StoredImport stored = store.save(user, 1L, outcome(course("canvas:1", 3L, "a", "b")));

        ArgumentCaptor<FeedImport> saved = ArgumentCaptor.forClass(FeedImport.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getFeedId()).isEqualTo(1L);
        assertThat(saved.getValue().getUser()).isSameAs(user);
        assertThat(saved.getValue().getStatus()).isEqualTo(FeedImport.Status.PENDING);
        assertThat(saved.getValue().getProvider()).isEqualTo("CANVAS");
        assertThat(store.read(saved.getValue()).courses().getFirst().items()).hasSize(2);
        assertThat(store.read(saved.getValue()).courses().getFirst().matchCourseId()).isEqualTo(3L);
        assertThat(stored.result().importId()).isEqualTo(5L);
        assertThat(stored.result().newCourses()).isEqualTo(1);
        assertThat(stored.result().newItems()).isEqualTo(2);
        assertThat(stored.result().itemsUpdated()).isEqualTo(2);
        assertThat(stored.result().eventsImported()).isEqualTo(1);
    }

    @Test
    void aSecondStagingMergesIntoTheFeedsPendingRowByKey() {
        FeedImport pending = new FeedImport();
        pending.setId(5L);
        pending.setUser(user);
        pending.setFeedId(1L);
        pending.setPayload(store.write(new StagedPayload("CANVAS", 9L,
                List.of(course("canvas:1", null, "a", "b"), course("canvas:2", null, "x")))));
        when(repository.findFirstByFeedIdAndStatus(1L, FeedImport.Status.PENDING)).thenReturn(Optional.of(pending));

        StoredImport stored = store.save(user, 1L, outcome(course("canvas:1", 3L, "b", "c")));

        verify(repository).save(pending);
        StagedPayload merged = store.read(pending);
        assertThat(merged.courses()).extracting(StagedCourse::key).containsExactly("canvas:1", "canvas:2");
        assertThat(merged.courses().getFirst().items()).extracting(StagedItem::key).containsExactly("a", "b", "c");
        assertThat(merged.courses().getFirst().matchCourseId()).isEqualTo(3L);
        assertThat(stored.result().importId()).isEqualTo(5L);
        assertThat(stored.payload().courses()).hasSize(2);
    }

    @Test
    void anUnsavedFeedAlwaysGetsItsOwnRow() {
        store.save(user, null, outcome(course("canvas:1", null, "a")));

        verify(repository, never()).findFirstByFeedIdAndStatus(any(), any());
        verify(repository).save(any(FeedImport.class));
    }
}
