package com.rnave.studily.parse;

import com.rnave.studily.config.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PageSelectionTest {

    @Test
    void blankOrAllMeansEveryPage() {
        assertThat(PageSelection.parse(null).all()).isTrue();
        assertThat(PageSelection.parse("  ").all()).isTrue();
        assertThat(PageSelection.parse("All").all()).isTrue();
        assertThat(PageSelection.parse("").resolve(3, "a.pdf", "page")).containsExactly(1, 2, 3);
    }

    @Test
    void rangesSinglesAndOpenEndsResolveInOrderWithoutRepeats() {
        assertThat(PageSelection.parse("8-11").resolve(20, "a.pdf", "page")).containsExactly(8, 9, 10, 11);
        assertThat(PageSelection.parse("9-end").resolve(12, "a.pdf", "page")).containsExactly(9, 10, 11, 12);
        assertThat(PageSelection.parse("9-LAST").resolve(10, "a.pdf", "page")).containsExactly(9, 10);
        assertThat(PageSelection.parse("9-").resolve(10, "a.pdf", "page")).containsExactly(9, 10);
        assertThat(PageSelection.parse("7, 2, 3 – 4, 3").resolve(10, "a.pdf", "page")).containsExactly(2, 3, 4, 7);
    }

    @Test
    void startOrEndPastTheLastPageIsRejected() {
        assertThat(PageSelection.parse("5-6").resolve(6, "a.pdf", "page")).containsExactly(5, 6);
        assertThatThrownBy(() -> PageSelection.parse("5-99").resolve(6, "a.pdf", "page"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("a.pdf only has 6 pages");
        assertThatThrownBy(() -> PageSelection.parse("2, 9-11").resolve(6, "deck.pptx", "slide"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("deck.pptx only has 6 slides");
    }

    @Test
    void nonsenseIsRejected() {
        for (String bad : new String[]{"abc", "0", "5-3", "1-2-3", "-4", "x".repeat(200)}) {
            assertThatThrownBy(() -> PageSelection.parse(bad)).isInstanceOf(BadRequestException.class);
        }
    }

    @Test
    void oneRangePerFileIsRequiredWhenAnyAreSent() {
        assertThat(PageSelection.forFiles(null, 2)).hasSize(2).allMatch(PageSelection::all);
        assertThat(PageSelection.forFiles(new String[]{"", "3-4"}, 2).get(1).key()).isEqualTo("3-4");
        assertThatThrownBy(() -> PageSelection.forFiles(new String[]{"1"}, 2))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void keyIsTheSameForEquivalentSpellings() {
        assertThat(PageSelection.parse("9 - end").key()).isEqualTo(PageSelection.parse("9-last").key());
    }
}
