package com.rnave.studily.flashcard.generate;

import com.rnave.studily.flashcard.generate.StudyDocument.Figure;
import com.rnave.studily.flashcard.generate.StudyDocument.Page;
import com.rnave.studily.flashcard.generate.StudyDocument.Picture;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ModelInputTest {

    private static Picture picture(int width, int height) {
        return new Picture(new byte[] {1}, "image/jpeg", width, height);
    }

    @Test
    void select_takesPictureOnlyPagesFirstThenFiguresThenTextHeavyPages() {
        List<Page> pages = List.of(
                new Page(1, "x".repeat(250), picture(1024, 576)),
                new Page(2, "", picture(1024, 576)),
                new Page(3, "y".repeat(20), null));
        List<Figure> figures = List.of(new Figure(1, 3, picture(600, 400)));
        StudyDocument doc = new StudyDocument("a.pdf", FileKind.PDF, "Page", pages, figures);

        ClaudeFlashcardGenerator.ModelInput input = ClaudeFlashcardGenerator.select(doc);

        assertThat(input.renderPages()).containsExactly(2, 1);
        assertThat(input.figureIds()).containsExactly(1);
        assertThat(input.references()).containsExactlyInAnyOrder("page-1", "page-2", "figure-1");
    }

    @Test
    void select_staysUnderTheInputBudgetSoHaikuKeepsItsLowerPrice() {
        List<Page> pages = new ArrayList<>();
        for (int i = 1; i <= 80; i++) {
            pages.add(new Page(i, "", picture(1600, 1200)));
        }
        StudyDocument doc = new StudyDocument("scan.pdf", FileKind.PDF, "Page", pages, List.of());

        ClaudeFlashcardGenerator.ModelInput input = ClaudeFlashcardGenerator.select(doc);

        assertThat(input.estimatedTokens()).isLessThanOrEqualTo(ClaudeFlashcardGenerator.INPUT_TOKEN_BUDGET);
        assertThat(input.renderPages().size()).isLessThanOrEqualTo(ClaudeFlashcardGenerator.MAX_IMAGES);
        assertThat(input.renderPages()).isNotEmpty();
    }

    @Test
    void blocks_labelEveryImageWithItsReference() {
        List<Page> pages = List.of(new Page(1, "Glass box", picture(1024, 576)));
        List<Figure> figures = List.of(new Figure(1, 1, picture(400, 300)));
        StudyDocument doc = new StudyDocument("a.pptx", FileKind.PPTX, "Slide", pages, figures);

        var blocks = ClaudeFlashcardGenerator.blocks(doc, ClaudeFlashcardGenerator.select(doc));

        assertThat(blocks).hasSize(5);
        assertThat(blocks.get(0).asText().text()).contains("=== Slide 1 ===").contains("reference page-1");
        assertThat(blocks.get(1).isImage()).isTrue();
        assertThat(blocks.get(2).asText().text()).contains("reference figure-1");
        assertThat(blocks.get(4).asText().text()).contains("Make flashcards");
    }
}
