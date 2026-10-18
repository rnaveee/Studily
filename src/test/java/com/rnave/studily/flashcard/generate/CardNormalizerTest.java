package com.rnave.studily.flashcard.generate;

import com.rnave.studily.flashcard.generate.GenResult.GenCard;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CardNormalizerTest {

    private static final Set<String> SHOWN = Set.of("figure-1", "page-2");

    private static List<CardNormalizer.Card> normalize(GenCard... cards) {
        return CardNormalizer.normalize(new GenResult("Title", List.of(cards)), SHOWN, 5);
    }

    @Test
    void normalize_trimsTextAndKeepsValidReferences() {
        List<CardNormalizer.Card> cards = normalize(
                new GenCard("  What is V = IR?  ", "\n\nOhm's law\n\n\n\nfor resistors ", "FIGURE-1", "page-2", 3));

        assertThat(cards).singleElement().satisfies(card -> {
            assertThat(card.front()).isEqualTo("What is V = IR?");
            assertThat(card.back()).isEqualTo("Ohm's law\n\nfor resistors");
            assertThat(card.frontRef()).isEqualTo("figure-1");
            assertThat(card.backRef()).isEqualTo("page-2");
            assertThat(card.sourcePage()).isEqualTo(3);
        });
    }

    @Test
    void normalize_dropsReferencesTheModelWasNeverShown() {
        List<CardNormalizer.Card> cards = normalize(new GenCard("Q", "A", "figure-9", "page-7", 1));

        assertThat(cards).singleElement().satisfies(card -> {
            assertThat(card.frontRef()).isNull();
            assertThat(card.backRef()).isNull();
        });
    }

    @Test
    void normalize_movesAWholePageImageFromTheFrontToTheBack() {
        List<CardNormalizer.Card> cards = normalize(new GenCard("Which view is this?", "Top view", "page-2", null, 2));

        assertThat(cards).singleElement().satisfies(card -> {
            assertThat(card.frontRef()).isNull();
            assertThat(card.backRef()).isEqualTo("page-2");
        });
    }

    @Test
    void normalize_dropsIncompleteAndDuplicateCards() {
        List<CardNormalizer.Card> cards = normalize(
                new GenCard("", "Answer with no question", null, null, 1),
                new GenCard("Question with no answer", " ", null, null, 1),
                new GenCard("What is a miter line?", "A 45° line", null, null, 1),
                new GenCard("what is a MITER line", "Same card again", null, null, 1),
                new GenCard("", "", "figure-1", "figure-1", 1));

        assertThat(cards).extracting(CardNormalizer.Card::front).containsExactly("What is a miter line?");
    }

    @Test
    void normalize_capsLengthsCardCountAndBadPageNumbers() {
        List<GenCard> many = new ArrayList<>();
        for (int i = 0; i < 70; i++) {
            many.add(new GenCard("Question " + i, "x".repeat(3_000), null, null, i == 0 ? 99 : 1));
        }

        List<CardNormalizer.Card> cards = CardNormalizer.normalize(new GenResult("T", many), SHOWN, 5);

        assertThat(cards).hasSize(CardNormalizer.MAX_CARDS_PER_FILE);
        assertThat(cards.get(0).back()).hasSize(CardNormalizer.MAX_BACK).endsWith("…");
        assertThat(cards.get(0).sourcePage()).isNull();
    }
}
