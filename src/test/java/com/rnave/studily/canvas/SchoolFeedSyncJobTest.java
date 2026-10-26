package com.rnave.studily.canvas;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SchoolFeedSyncJobTest {

    @Test
    void syncsEveryDueFeedEvenWhenOneThrows() {
        SchoolFeedService service = mock(SchoolFeedService.class);
        when(service.isAvailable()).thenReturn(true);
        when(service.dueFeedIds()).thenReturn(List.of(1L, 2L, 3L));
        doThrow(new RuntimeException("boom")).when(service).syncDue(2L);

        new SchoolFeedSyncJob(service).run();

        verify(service).syncDue(1L);
        verify(service).syncDue(2L);
        verify(service).syncDue(3L);
    }

    @Test
    void doesNothingWhenEncryptionIsNotConfigured() {
        SchoolFeedService service = mock(SchoolFeedService.class);
        when(service.isAvailable()).thenReturn(false);

        new SchoolFeedSyncJob(service).run();

        verify(service, never()).dueFeedIds();
    }
}
