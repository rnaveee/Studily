package com.rnave.studily.flashcard.generate;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.flashcard.FlashcardImageService;
import com.rnave.studily.flashcard.FlashcardImageService.FlashcardImageDto;
import com.rnave.studily.flashcard.FlashcardSetService;
import com.rnave.studily.flashcard.generate.ClaudeFlashcardGenerator.Outcome;
import com.rnave.studily.flashcard.generate.FlashcardGenDtos.GeneratedDeckDto;
import com.rnave.studily.flashcard.generate.GenResult.GenCard;
import com.rnave.studily.flashcard.generate.StudyDocument.Figure;
import com.rnave.studily.flashcard.generate.StudyDocument.Page;
import com.rnave.studily.flashcard.generate.StudyDocument.Picture;
import com.rnave.studily.parse.AiFeature;
import com.rnave.studily.parse.CourseParseCache;
import com.rnave.studily.parse.CourseParseUsage;
import com.rnave.studily.parse.CourseParseUsageRepository;
import com.rnave.studily.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashcardGenServiceTest {

    private StudyDocumentReader reader;
    private ClaudeFlashcardGenerator generator;
    private FlashcardGenLimits limits;
    private CourseParseCache cache;
    private CourseParseUsageRepository usage;
    private FlashcardImageService images;
    private FlashcardSetService sets;
    private FlashcardGenService service;

    private final StudyDocument doc = new StudyDocument("lecture.txt", FileKind.TEXT, "Slide",
            List.of(new Page(1, "", new Picture(new byte[] {1}, "image/jpeg", 1024, 576)),
                    new Page(2, "Glass box text", null)),
            List.of(new Figure(1, 2, new Picture(new byte[] {2}, "image/jpeg", 400, 300))));

    @BeforeEach
    void setUp() {
        reader = mock(StudyDocumentReader.class);
        generator = mock(ClaudeFlashcardGenerator.class);
        limits = mock(FlashcardGenLimits.class);
        cache = mock(CourseParseCache.class);
        usage = mock(CourseParseUsageRepository.class);
        images = mock(FlashcardImageService.class);
        sets = mock(FlashcardSetService.class);
        CurrentUser currentUser = mock(CurrentUser.class);
        when(currentUser.id()).thenReturn(7L);
        when(currentUser.entity()).thenReturn(new User());
        when(generator.enabled()).thenReturn(true);
        when(generator.model()).thenReturn("claude-haiku-5-5");
        when(reader.read(anyString(), any())).thenReturn(doc);
        when(cache.lookup(anyString(), eq(GenResult.class))).thenReturn(Optional.empty());
        when(limits.remaining()).thenReturn(19);
        when(images.storeGenerated(eq(7L), anyString(), any()))
                .thenAnswer(inv -> new FlashcardImageDto("k" + System.nanoTime(), 10, 10));
        service = new FlashcardGenService(reader, generator, limits, cache, usage, images, sets, currentUser);
    }

    private static List<MultipartFile> files(String... names) {
        return java.util.Arrays.stream(names)
                .map(n -> (MultipartFile) new MockMultipartFile("files", n, "text/plain",
                        "Notes about projections.".getBytes(StandardCharsets.UTF_8)))
                .toList();
    }

    private static GenResult result(GenCard... cards) {
        return new GenResult("Lecture 3: Multiview Drawings", List.of(cards));
    }

    @Test
    void generate_callsTheModelRecordsUsageCachesAndStoresEachImageOnce() {
        when(generator.generate(any(), any())).thenReturn(new Outcome(result(
                new GenCard("What does the glass box show?", "Six views", "figure-1", "page-1", 2),
                new GenCard("Which plane is not hinged?", "The back plane", "figure-1", null, 2)),
                4_000, 1_500, true, null));

        GeneratedDeckDto deck = service.generate(null, files("lecture.txt"));

        assertThat(deck.title()).isEqualTo("Lecture 3: Multiview Drawings");
        assertThat(deck.cards()).hasSize(2);
        assertThat(deck.cards().get(0).frontImage()).isEqualTo(deck.cards().get(1).frontImage());
        assertThat(deck.cards().get(0).backImage()).isNotNull();
        assertThat(deck.cards().get(0).sourceLabel()).isEqualTo("Slide 2");
        assertThat(deck.remaining()).isEqualTo(19);
        verify(images, times(2)).storeGenerated(eq(7L), anyString(), any());
        verify(limits).check(1);
        verify(cache).store(anyString(), any(GenResult.class), eq("claude-haiku-5-5"));
        ArgumentCaptor<CourseParseUsage> row = ArgumentCaptor.forClass(CourseParseUsage.class);
        verify(usage).save(row.capture());
        assertThat(row.getValue().getFeature()).isEqualTo(AiFeature.FLASHCARDS);
        assertThat(row.getValue().isSucceeded()).isTrue();
        assertThat(row.getValue().getInputTokens()).isEqualTo(4_000);
    }

    @Test
    void generate_aCacheHitSkipsTheModelAndTheAllowance() {
        when(cache.lookup(anyString(), eq(GenResult.class)))
                .thenReturn(Optional.of(result(new GenCard("Q", "A", null, null, 1))));

        GeneratedDeckDto deck = service.generate(null, files("lecture.txt"));

        assertThat(deck.cards()).hasSize(1);
        verify(generator, never()).generate(any(), any());
        verify(limits, never()).check(anyInt());
        verify(usage, never()).save(any());
    }

    @Test
    void generate_aRefusalIsBilledButNotCountedOrCached() {
        when(generator.generate(any(), any()))
                .thenReturn(new Outcome(null, 3_000, 40, true, "Couldn't make cards from this file."));

        assertThatThrownBy(() -> service.generate(null, files("lecture.txt")))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Couldn't make cards from this file.");

        ArgumentCaptor<CourseParseUsage> row = ArgumentCaptor.forClass(CourseParseUsage.class);
        verify(usage).save(row.capture());
        assertThat(row.getValue().isSucceeded()).isFalse();
        verify(cache, never()).store(anyString(), any(), anyString());
    }

    @Test
    void generate_oneBadFileOfTwoBecomesAWarning() {
        StudyDocument other = new StudyDocument("b.txt", FileKind.TEXT, "Section",
                List.of(new Page(1, "Other notes", null)), List.of());
        when(reader.read(eq("b.txt"), any())).thenReturn(other);
        when(generator.generate(eq(doc), any()))
                .thenReturn(new Outcome(result(new GenCard("Q", "A", null, null, 1)), 100, 50, true, null));
        when(generator.generate(eq(other), any()))
                .thenReturn(new Outcome(null, 0, 0, false, ClaudeFlashcardGenerator.FAILED));

        GeneratedDeckDto deck = service.generate(null, files("a.txt", "b.txt"));

        assertThat(deck.cards()).hasSize(1);
        assertThat(deck.warnings()).anyMatch(w -> w.startsWith("b.txt: "));
        verify(limits).check(2);
    }

    @Test
    void generate_intoASetFlagsCardsItAlreadyHas() {
        when(sets.ownedCardFronts(5L)).thenReturn(List.of("What is a MITER line?"));
        when(generator.generate(any(), any())).thenReturn(new Outcome(result(
                new GenCard("What is a miter line?", "A 45° line", null, null, 1),
                new GenCard("What are folding lines?", "Hinges of the glass box", null, null, 1)),
                100, 50, true, null));

        GeneratedDeckDto deck = service.generate(5L, files("lecture.txt"));

        assertThat(deck.cards()).extracting(c -> c.duplicate()).containsExactly(true, false);
        assertThat(deck.warnings()).anyMatch(w -> w.contains("already in this set"));
    }

    @Test
    void generate_intoSomeoneElsesSetIsNotFoundBeforeAnythingIsSpent() {
        when(sets.ownedCardFronts(9L)).thenThrow(new NotFoundException("Flashcard set not found"));

        assertThatThrownBy(() -> service.generate(9L, files("lecture.txt")))
                .isInstanceOf(NotFoundException.class);
        verify(generator, never()).generate(any(), any());
    }

    @Test
    void generate_keepsCardsWithoutPicturesWhenImageStorageIsFull() {
        when(images.storeGenerated(eq(7L), anyString(), any())).thenThrow(new ConflictException("full"));
        when(generator.generate(any(), any())).thenReturn(new Outcome(result(
                new GenCard("What does the glass box show?", "Six views", null, "figure-1", 2),
                new GenCard("", "Picture-only front", "figure-1", null, 2)),
                100, 50, true, null));

        GeneratedDeckDto deck = service.generate(null, files("lecture.txt"));

        assertThat(deck.cards()).singleElement().satisfies(card -> assertThat(card.backImage()).isNull());
        assertThat(deck.warnings()).anyMatch(w -> w.contains("storage is full"));
    }

    @Test
    void generate_rejectsTooManyFilesAndUnreadableTypesBeforeReading() {
        assertThatThrownBy(() -> service.generate(null, files("a.txt", "b.txt", "c.txt", "d.txt")))
                .hasMessageContaining("at most 3");
        MockMultipartFile exe = new MockMultipartFile("files", "virus.pdf", "application/pdf",
                new byte[] {'M', 'Z', 0, 0, 3});
        assertThatThrownBy(() -> service.generate(null, List.of(exe)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageStartingWith("virus.pdf: ");
        verify(reader, never()).read(anyString(), any());
    }

    @Test
    void name_stripsPathsAndControlCharacters() {
        MockMultipartFile file = new MockMultipartFile("files", "..\\..\\C:\\evil\u0000<b>.pdf", null, new byte[] {1});

        assertThat(FlashcardGenService.name(file)).isEqualTo("evilb.pdf");
    }
}
