package com.rnave.studily.rag;

import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankFile;
import com.rnave.studily.filebank.BankFileRepository;
import com.rnave.studily.filebank.BankFormat;
import com.rnave.studily.filebank.FileStorage;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.AiUsageRecorder;
import com.rnave.studily.parse.CourseParseUsageRepository;
import com.rnave.studily.parse.CourseParseUsageRepository.ModelSpend;
import com.rnave.studily.user.UserTimeZones;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IngestionWorkerTest {

    private static final byte[] BYTES = {1, 2, 3};

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final BankFileRepository files = mock(BankFileRepository.class);
    private final CourseRepository courses = mock(CourseRepository.class);
    private final TextExtractor extractor = mock(TextExtractor.class);
    private final VoyageClient voyage = mock(VoyageClient.class);
    private final ChunkStore chunkStore = mock(ChunkStore.class);
    private final AiUsageRecorder usage = mock(AiUsageRecorder.class);
    private final CourseParseUsageRepository usageRows = mock(CourseParseUsageRepository.class);
    private final UserTimeZones timeZones = mock(UserTimeZones.class);
    private final FileStorage storage = mock(FileStorage.class);
    private final IngestionWorker worker = new IngestionWorker(jdbc, files, courses, providerOf(storage),
            extractor, new Chunker(), voyage, chunkStore, usage, usageRows, timeZones, 2.0, 6000);

    @BeforeEach
    void defaults() {
        when(timeZones.fallback()).thenReturn(ZoneOffset.UTC);
        when(files.findById(7L)).thenReturn(Optional.of(courseFile()));
        when(storage.get("bank/1/abc")).thenReturn(BYTES);
    }

    @Test
    void filesWaitWhenThisMonthsEmbeddingSpendIsOverTheBudget() {
        ModelSpend spend = mock(ModelSpend.class);
        when(spend.getModel()).thenReturn("voyage-4");
        when(spend.getInputTokens()).thenReturn(100_000_000L);
        when(spend.getOutputTokens()).thenReturn(0L);
        when(usageRows.spendSince(any(), eq(AiFeature.EMBEDDINGS))).thenReturn(List.of(spend));

        worker.process(7L, storage);

        verify(jdbc).update(contains("Waiting for indexing capacity"), eq(7L));
        verify(storage, never()).get(anyString());
        verify(voyage, never()).embedDocuments(anyList());
    }

    @Test
    void aFileIsReadEmbeddedAndCompletedWithItsCourseScope() {
        ExtractedDocument document = new ExtractedDocument(
                List.of(new Section("Ohm's law", "V = IR relates voltage to current.", 1)), 1, 0);
        when(extractor.extract(BYTES, BankFormat.PDF)).thenReturn(document);
        Course course = new Course();
        course.setCode("ENSC 220");
        course.setName("Circuits");
        when(courses.findById(3L)).thenReturn(Optional.of(course));
        when(voyage.embedDocuments(anyList())).thenReturn(
                new VoyageClient.Embeddings(List.of(new float[]{0.1f, 0.2f}), 500, "voyage-4"));

        worker.process(7L, storage);

        verify(chunkStore).completeFile(eq(7L), eq(1L), eq(3L), isNull(), anyList(), anyList(), eq(1),
                eq("voyage-4"), isNull());
        verify(usage).record(1L, AiFeature.EMBEDDINGS, "voyage-4", 500, 0, true);
    }

    @Test
    void aBankThatIsFullFailsPermanentlyWithoutEmbedding() {
        ExtractedDocument document = new ExtractedDocument(
                List.of(new Section(null, "Some lecture text about resistors.", 1)), 1, 0);
        when(extractor.extract(BYTES, BankFormat.PDF)).thenReturn(document);
        when(chunkStore.chunkCount(Scope.course(1L, 3L), 7L)).thenReturn(6000L);

        worker.process(7L, storage);

        verify(voyage, never()).embedDocuments(anyList());
        verify(jdbc).update(contains("CASE WHEN"), eq(true), eq(IngestionWorker.MAX_ATTEMPTS),
                eq("This file bank is full"), eq(7L));
    }

    @Test
    void anEmbeddingFailureRecordsFailedUsageAndSchedulesARetry() {
        ExtractedDocument document = new ExtractedDocument(
                List.of(new Section(null, "Some lecture text about resistors.", 1)), 1, 0);
        when(extractor.extract(BYTES, BankFormat.PDF)).thenReturn(document);
        when(voyage.embedDocuments(anyList())).thenThrow(new IllegalStateException("Voyage is down"));
        when(voyage.embedModel()).thenReturn("voyage-4");

        worker.process(7L, storage);

        verify(usage).record(1L, AiFeature.EMBEDDINGS, "voyage-4", 0, 0, false);
        verify(jdbc).update(contains("CASE WHEN"), eq(false), eq(IngestionWorker.MAX_ATTEMPTS),
                eq("Indexing hit a problem. It will be retried automatically."), eq(7L));
        verify(chunkStore, never()).completeFile(eq(7L), eq(1L), eq(3L), isNull(), anyList(), anyList(),
                any(), anyString(), any());
    }

    @Test
    void embeddingInputCarriesTheContextHeadingAndPages() {
        Chunk chunk = new Chunk(0, "Power", 3, 4, "P = VI");

        assertThat(IngestionWorker.embeddingInput("ENSC 220 Circuits · week-4.pdf", chunk))
                .isEqualTo("ENSC 220 Circuits · week-4.pdf · Power · p. 3-4\n\nP = VI");
    }

    private static ObjectProvider<FileStorage> providerOf(FileStorage storage) {
        @SuppressWarnings("unchecked")
        ObjectProvider<FileStorage> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(storage);
        return provider;
    }

    private static BankFile courseFile() {
        BankFile file = new BankFile();
        file.setId(7L);
        file.setUserId(1L);
        file.setCourseId(3L);
        file.setName("week-4.pdf");
        file.setFormat(BankFormat.PDF);
        file.setStorageKey("bank/1/abc");
        return file;
    }
}
