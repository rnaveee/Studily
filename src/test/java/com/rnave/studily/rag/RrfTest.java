package com.rnave.studily.rag;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

class RrfTest {

    @Test
    void itemsFoundByBothMethodsRiseToTheTop() {
        List<String> semantic = List.of("a", "b", "c", "d");
        List<String> keyword = List.of("d", "e", "a");

        List<String> fused = Rrf.fuse(List.of(semantic, keyword), Function.identity(), 10);

        assertThat(fused.subList(0, 2)).containsExactly("a", "d");
        assertThat(fused).containsExactlyInAnyOrder("a", "b", "c", "d", "e");
    }

    @Test
    void fusionRespectsTheLimit() {
        List<Integer> one = List.of(1, 2, 3, 4, 5);
        List<Integer> two = List.of(6, 7, 8);

        assertThat(Rrf.fuse(List.of(one, two), Function.identity(), 3)).hasSize(3);
    }

    @Test
    void anEmptyListContributesNothing() {
        assertThat(Rrf.fuse(List.of(List.of("x", "y"), List.<String>of()), Function.identity(), 5))
                .containsExactly("x", "y");
    }
}
