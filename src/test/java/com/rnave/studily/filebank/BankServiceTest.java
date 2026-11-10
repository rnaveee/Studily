package com.rnave.studily.filebank;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseRepository;
import com.rnave.studily.filebank.BankDtos.BankStatusDto;
import com.rnave.studily.rag.Scope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BankServiceTest {

    private static final long USER = 7L;
    private static final long COURSE = 3L;
    private static final long CHAT = 9L;
    private static final long MB = 1024L * 1024;
    private static final long GB = 1024 * MB;

    private BankFileRepository files;
    private CourseRepository courses;
    private CurrentUser currentUser;
    private InMemoryStorage storage;
    private PagePreviewRenderer previews;
    private List<BankFile> saved;
    private BankService service;

    @BeforeEach
    void setUp() {
        files = mock(BankFileRepository.class);
        courses = mock(CourseRepository.class);
        currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(USER);
        storage = new InMemoryStorage(true);
        previews = mock(PagePreviewRenderer.class);
        saved = new ArrayList<>();
        when(files.saveAndFlush(any(BankFile.class))).thenAnswer(invocation -> {
            BankFile file = invocation.getArgument(0);
            file.setId(saved.size() + 1L);
            saved.add(file);
            return file;
        });
        when(courses.findByIdAndUserId(COURSE, USER)).thenReturn(Optional.of(mock(Course.class)));
        service = service(MB, 10, 300, GB);
    }

    @Test
    void uploadStoresTheFileUnderABankKeyAndRecordsTheRow() {
        byte[] bytes = pdf("one");

        List<BankFile> out = service.upload(Scope.course(USER, COURSE), List.of(file("Lecture 8 slides.pdf", bytes)), null);

        assertThat(out).hasSize(1);
        BankFile row = out.get(0);
        assertThat(row.getUserId()).isEqualTo(USER);
        assertThat(row.getCourseId()).isEqualTo(COURSE);
        assertThat(row.getChatId()).isNull();
        assertThat(row.getName()).isEqualTo("Lecture 8 slides.pdf");
        assertThat(row.getFormat()).isEqualTo(BankFormat.PDF);
        assertThat(row.getContentType()).isEqualTo("application/pdf");
        assertThat(row.getKind()).isEqualTo(BankFileKind.LECTURE);
        assertThat(row.getSizeBytes()).isEqualTo(bytes.length);
        assertThat(row.getSha256()).isEqualTo(BankService.sha256(bytes));
        assertThat(row.getStorageKey()).startsWith("bank/7/");
        assertThat(storage.get(row.getStorageKey())).isEqualTo(bytes);
    }

    @Test
    void anExplicitKindWinsOverTheGuess() {
        List<BankFile> out = service.upload(Scope.course(USER, COURSE),
                List.of(file("Lecture 8.pdf", pdf("two"))), BankFileKind.PRACTICE_EXAM);

        assertThat(out.get(0).getKind()).isEqualTo(BankFileKind.PRACTICE_EXAM);
    }

    @Test
    void uploadReturnsTheExistingRowWhenTheSameFileIsAlreadyInTheScope() {
        byte[] bytes = pdf("same");
        BankFile existing = fileWithId(41L);
        when(files.findByCourseIdAndSha256(COURSE, BankService.sha256(bytes))).thenReturn(Optional.of(existing));

        List<BankFile> out = service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", bytes)), null);

        assertThat(out).containsExactly(existing);
        assertThat(storage.keys()).isEmpty();
        verify(files, never()).saveAndFlush(any());
    }

    @Test
    void aFileSentTwiceInOneRequestIsStoredOnce() {
        byte[] bytes = pdf("twice");

        List<BankFile> out = service.upload(Scope.course(USER, COURSE),
                List.of(file("a.pdf", bytes), file("copy of a.pdf", bytes)), null);

        assertThat(out).hasSize(2);
        assertThat(out.get(0)).isSameAs(out.get(1));
        assertThat(saved).hasSize(1);
        assertThat(storage.keys()).hasSize(1);
    }

    @Test
    void chatUploadsGoToTheChatBankWithoutCheckingCourses() {
        List<BankFile> out = service.upload(Scope.chat(USER, CHAT),
                List.of(file("notes.txt", "hello".getBytes(StandardCharsets.UTF_8))), null);

        BankFile row = out.get(0);
        assertThat(row.getChatId()).isEqualTo(CHAT);
        assertThat(row.getCourseId()).isNull();
        assertThat(row.getKind()).isEqualTo(BankFileKind.NOTES);
        verify(courses, never()).findByIdAndUserId(any(), any());
    }

    @Test
    void chatUploadsDedupeAgainstTheChatNotTheCourse() {
        byte[] bytes = "same".getBytes(StandardCharsets.UTF_8);
        BankFile existing = fileWithId(55L);
        when(files.findByChatIdAndSha256(CHAT, BankService.sha256(bytes))).thenReturn(Optional.of(existing));

        List<BankFile> out = service.upload(Scope.chat(USER, CHAT), List.of(file("a.txt", bytes)), null);

        assertThat(out).containsExactly(existing);
    }

    @Test
    void uploadToSomeoneElsesCourseIsNotFoundAndStoresNothing() {
        when(courses.findByIdAndUserId(COURSE, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", pdf("x"))), null))
                .isInstanceOf(NotFoundException.class);
        assertThat(storage.keys()).isEmpty();
    }

    @Test
    void courseFilesOfSomeoneElsesCourseAreNotFound() {
        when(courses.findByIdAndUserId(COURSE, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.courseFiles(COURSE)).isInstanceOf(NotFoundException.class);
        verify(files, never()).findByCourseIdAndUserIdOrderByCreatedAtDesc(any(), any());
    }

    @Test
    void uploadIsRefusedWhenItWouldGoOverTheQuota() {
        service = service(MB, 10, 300, 100);
        when(files.totalBytes(USER)).thenReturn(60L);

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", pdfOfSize(50))), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("go over");
        assertThat(storage.keys()).isEmpty();
    }

    @Test
    void uploadIsRefusedWhenTheUserHasTooManyFiles() {
        service = service(MB, 10, 2, GB);
        when(files.countByUserId(USER)).thenReturn(2L);

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", pdf("y"))), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("holds 2 files");
        assertThat(storage.keys()).isEmpty();
    }

    @Test
    void duplicatesDoNotCountAgainstTheQuotaOrFileLimit() {
        service = service(MB, 10, 1, 100);
        byte[] bytes = pdf("already");
        when(files.countByUserId(USER)).thenReturn(1L);
        when(files.totalBytes(USER)).thenReturn(100L);
        when(files.findByCourseIdAndSha256(COURSE, BankService.sha256(bytes))).thenReturn(Optional.of(fileWithId(8L)));

        List<BankFile> out = service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", bytes)), null);

        assertThat(out).hasSize(1);
    }

    @Test
    void uploadRejectsAFileOverTheSizeLimit() {
        service = service(100, 10, 300, GB);

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", pdfOfSize(101))), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("or smaller");
    }

    @Test
    void uploadRejectsMoreFilesThanOneRequestMayCarry() {
        service = service(MB, 2, 300, GB);

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE),
                List.of(file("a.pdf", pdf("1")), file("b.pdf", pdf("2")), file("c.pdf", pdf("3"))), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("up to 2 files");
        assertThat(storage.keys()).isEmpty();
    }

    @Test
    void anUnsupportedFileStopsTheWholeRequestBeforeAnythingIsStored() {
        byte[] garbage = {0x00, 0x01, 0x02, 0x03};

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE),
                List.of(file("a.pdf", pdf("ok")), file("b.exe", garbage)), null))
                .isInstanceOf(BadRequestException.class);
        assertThat(storage.keys()).isEmpty();
        assertThat(saved).isEmpty();
    }

    @Test
    void uploadIsRefusedWhenStorageIsNotConfigured() {
        storage = new InMemoryStorage(false);
        service = service(MB, 10, 300, GB);

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", pdf("z"))), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("isn't set up");
    }

    @Test
    void uploadsAreRateLimitedToTwentyAMinute() {
        byte[] bytes = pdf("busy");
        when(files.findByCourseIdAndSha256(COURSE, BankService.sha256(bytes))).thenReturn(Optional.of(fileWithId(1L)));

        for (int i = 0; i < 20; i++) {
            service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", bytes)), null);
        }

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", bytes)), null))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void uploadDeletesTheStoredObjectWhenTheRowCannotBeSaved() {
        when(files.saveAndFlush(any(BankFile.class))).thenThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", pdf("c"))), null))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("db down");
        assertThat(storage.keys()).isEmpty();
    }

    @Test
    void aRaceOnTheSameFileReturnsTheRowThatWon() {
        byte[] bytes = pdf("race");
        BankFile winner = fileWithId(77L);
        when(files.findByCourseIdAndSha256(COURSE, BankService.sha256(bytes)))
                .thenReturn(Optional.empty(), Optional.of(winner));
        when(files.saveAndFlush(any(BankFile.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        List<BankFile> out = service.upload(Scope.course(USER, COURSE), List.of(file("a.pdf", bytes)), null);

        assertThat(out).containsExactly(winner);
        assertThat(storage.keys()).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "midterm_review.pdf, PRACTICE_EXAM",
            "Final Exam 2023.pdf, PRACTICE_EXAM",
            "Sample questions.docx, PRACTICE_EXAM",
            "Practice set A.pdf, PRACTICE_EXAM",
            "HW3 solutions.pdf, ASSIGNMENT",
            "Homework 4.docx, ASSIGNMENT",
            "pset4.pdf, ASSIGNMENT",
            "Problem Set 5.pdf, ASSIGNMENT",
            "Lab 2 handout.pdf, ASSIGNMENT",
            "Tutorial 3.pdf, ASSIGNMENT",
            "Lecture 8 slides.pptx, LECTURE",
            "Week03.pdf, LECTURE",
            "Chapter 4.pdf, LECTURE",
            "ch12.pdf, LECTURE",
            "Unit 2 overview.pdf, LECTURE",
            "Chemistry notes.pdf, NOTES",
            "notes.txt, NOTES",
            "Chemistry syllabus.pdf, OTHER",
            "Sampling distributions.pdf, OTHER",
            "random.pdf, OTHER"
    })
    void guessKindReadsTheFileName(String fileName, BankFileKind expected) {
        assertThat(BankService.guessKind(fileName)).isEqualTo(expected);
    }

    @Test
    void guessKindHandlesMissingNames() {
        assertThat(BankService.guessKind(null)).isEqualTo(BankFileKind.OTHER);
        assertThat(BankService.guessKind("")).isEqualTo(BankFileKind.OTHER);
    }

    @Test
    void ownedFilesIsNotFoundWhenAnyIdIsMissingOrNotOwned() {
        when(files.findByIdInAndUserId(List.of(1L, 2L), USER)).thenReturn(List.of(fileWithId(1L)));

        assertThatThrownBy(() -> service.ownedFiles(List.of(1L, 2L))).isInstanceOf(NotFoundException.class);
    }

    @Test
    void ownedFilesComeBackInTheRequestedOrder() {
        BankFile one = fileWithId(1L);
        BankFile two = fileWithId(2L);
        when(files.findByIdInAndUserId(List.of(2L, 1L), USER)).thenReturn(List.of(one, two));

        assertThat(service.ownedFiles(List.of(2L, 1L))).containsExactly(two, one);
    }

    @Test
    void deletingSomeoneElsesFileIsNotFound() {
        when(files.findByIdAndUserId(5L, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(5L)).isInstanceOf(NotFoundException.class);
        verify(files, never()).delete(any(BankFile.class));
    }

    @Test
    void retryRequeuesAFailedFileAndResetsItsAttempts() {
        BankFile failed = fileWithId(12L);
        failed.setStatus(BankFileStatus.FAILED);
        failed.setStatusDetail("Could not read");
        failed.setAttempts(5);
        when(files.findByIdAndUserId(12L, USER)).thenReturn(Optional.of(failed));

        BankFileDto dto = service.retry(12L);

        assertThat(dto.status()).isEqualTo(BankFileStatus.QUEUED);
        assertThat(dto.statusDetail()).isNull();
        assertThat(failed.getAttempts()).isZero();
    }

    @Test
    void retryRefusesAFileThatDidNotFail() {
        BankFile ready = fileWithId(13L);
        ready.setStatus(BankFileStatus.READY);
        when(files.findByIdAndUserId(13L, USER)).thenReturn(Optional.of(ready));

        assertThatThrownBy(() -> service.retry(13L)).isInstanceOf(BadRequestException.class);
        assertThat(ready.getStatus()).isEqualTo(BankFileStatus.READY);
    }

    @Test
    void setKindChangesOnlyTheKind() {
        BankFile file = fileWithId(14L);
        file.setKind(BankFileKind.OTHER);
        when(files.findByIdAndUserId(14L, USER)).thenReturn(Optional.of(file));

        BankFileDto dto = service.setKind(14L, BankFileKind.NOTES);

        assertThat(dto.kind()).isEqualTo(BankFileKind.NOTES);
        assertThat(file.getName()).isEqualTo("file-14");
    }

    @Test
    void statusReportsTheUsersUsageAndTheLimits() {
        when(files.totalBytes(USER)).thenReturn(500L);
        when(files.countByUserId(USER)).thenReturn(4L);

        assertThat(service.status()).isEqualTo(new BankStatusDto(true, 500L, GB, 4L, 300, MB, 10));
    }

    @Test
    void previewOfAFileWithoutPagesIsNotFound() {
        BankFile docx = fileWithId(20L);
        docx.setFormat(BankFormat.DOCX);
        when(files.findByIdAndUserId(20L, USER)).thenReturn(Optional.of(docx));

        assertThatThrownBy(() -> service.previewPng(20L, 1)).isInstanceOf(NotFoundException.class);
        verify(previews, never()).render(any(), any(), any(), anyInt());
    }

    @Test
    void previewOfPageZeroIsNotFound() {
        BankFile pdf = fileWithId(21L);
        pdf.setFormat(BankFormat.PDF);
        when(files.findByIdAndUserId(21L, USER)).thenReturn(Optional.of(pdf));

        assertThatThrownBy(() -> service.previewPng(21L, 0)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void previewRendersThePageFromStorage() {
        byte[] bytes = pdf("preview");
        BankFile pdf = fileWithId(22L);
        pdf.setFormat(BankFormat.PDF);
        pdf.setName("deck.pdf");
        pdf.setStorageKey("bank/7/preview");
        storage.put("bank/7/preview", bytes, "application/pdf");
        when(files.findByIdAndUserId(22L, USER)).thenReturn(Optional.of(pdf));
        byte[] png = {1, 2, 3};
        when(previews.render(BankFormat.PDF, "deck.pdf", bytes, 2)).thenReturn(png);

        assertThat(service.previewPng(22L, 2)).isEqualTo(png);
    }

    private BankService service(long maxFileBytes, int maxFilesPerRequest, int maxFilesPerUser, long quotaBytes) {
        return new BankService(files, courses, currentUser, storage, new UploadInspector(), previews,
                maxFileBytes, maxFilesPerRequest, maxFilesPerUser, quotaBytes);
    }

    private static BankFile fileWithId(long id) {
        BankFile file = new BankFile();
        file.setId(id);
        file.setName("file-" + id);
        file.setFormat(BankFormat.PDF);
        return file;
    }

    private static MultipartFile file(String name, byte[] bytes) {
        return new MockMultipartFile("files", name, null, bytes);
    }

    private static byte[] pdf(String tag) {
        return ("%PDF-1.4 " + tag).getBytes(StandardCharsets.US_ASCII);
    }

    private static byte[] pdfOfSize(int size) {
        byte[] bytes = new byte[size];
        byte[] header = "%PDF-".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(header, 0, bytes, 0, Math.min(header.length, size));
        for (int i = header.length; i < size; i++) {
            bytes[i] = 'x';
        }
        return bytes;
    }

    private static final class InMemoryStorage implements FileStorage {

        private final Map<String, byte[]> objects = new HashMap<>();
        private final boolean configured;

        InMemoryStorage(boolean configured) {
            this.configured = configured;
        }

        @Override
        public boolean configured() {
            return configured;
        }

        @Override
        public void put(String key, byte[] data, String contentType) {
            objects.put(key, data);
        }

        @Override
        public byte[] get(String key) {
            byte[] data = objects.get(key);
            if (data == null) {
                throw new IllegalStateException("missing " + key);
            }
            return data;
        }

        @Override
        public void delete(String key) {
            objects.remove(key);
        }

        Set<String> keys() {
            return objects.keySet();
        }
    }
}
