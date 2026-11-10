package com.rnave.studily.rag;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

final class Rrf {

    static final int K = 60;

    private Rrf() {
    }

    static <T, I> List<T> fuse(List<List<T>> rankings, Function<T, I> identity, int limit) {
        Map<I, Double> scores = new HashMap<>();
        Map<I, T> items = new LinkedHashMap<>();
        for (List<T> ranking : rankings) {
            for (int rank = 0; rank < ranking.size(); rank++) {
                T item = ranking.get(rank);
                I id = identity.apply(item);
                scores.merge(id, 1.0 / (K + rank + 1), Double::sum);
                items.putIfAbsent(id, item);
            }
        }
        return items.keySet().stream()
                .sorted((a, b) -> Double.compare(scores.get(b), scores.get(a)))
                .limit(limit)
                .map(items::get)
                .toList();
    }
}
