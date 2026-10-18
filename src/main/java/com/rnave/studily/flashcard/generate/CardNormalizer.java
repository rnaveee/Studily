package com.rnave.studily.flashcard.generate;

import com.rnave.studily.flashcard.generate.GenResult.GenCard;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

final class CardNormalizer {

    static final int MAX_FRONT = 500;
    static final int MAX_BACK = 2_000;
    static final int MAX_CARDS_PER_FILE = 60;
    private static final Pattern REF = Pattern.compile("(figure|page)-\\d{1,4}");

    record Card(String front, String back, String frontRef, String backRef, Integer sourcePage) {
    }

    private CardNormalizer() {
    }

    static List<Card> normalize(GenResult result, Set<String> shownRefs, int pageCount) {
        List<Card> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (result == null || result.cards() == null) {
            return out;
        }
        for (GenCard raw : result.cards()) {
            if (raw == null || out.size() >= MAX_CARDS_PER_FILE) {
                continue;
            }
            String front = tidy(raw.front(), MAX_FRONT);
            String back = tidy(raw.back(), MAX_BACK);
            String frontRef = ref(raw.frontImage(), shownRefs);
            String backRef = ref(raw.backImage(), shownRefs);
            if (frontRef != null && frontRef.startsWith("page-")) {
                if (backRef == null) {
                    backRef = frontRef;
                }
                frontRef = null;
            }
            boolean frontOk = !front.isEmpty() || frontRef != null;
            boolean backOk = !back.isEmpty() || backRef != null;
            if (!frontOk || !backOk || (front.isEmpty() && back.isEmpty())) {
                continue;
            }
            if (!seen.add(key(front) + "|" + (frontRef == null ? "" : frontRef))) {
                continue;
            }
            Integer page = raw.sourcePage() != null && raw.sourcePage() >= 1 && raw.sourcePage() <= pageCount
                    ? raw.sourcePage() : null;
            out.add(new Card(front, back, frontRef, backRef, page));
        }
        return out;
    }

    static String key(String text) {
        if (text == null) {
            return "";
        }
        return Normalizer.normalize(text, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\p{Punct}\\s]+", " ")
                .strip();
    }

    private static String ref(String value, Set<String> shownRefs) {
        if (value == null) {
            return null;
        }
        String ref = value.strip().toLowerCase(Locale.ROOT);
        return REF.matcher(ref).matches() && shownRefs.contains(ref) ? ref : null;
    }

    private static String tidy(String value, int max) {
        if (value == null) {
            return "";
        }
        String text = value.replace("\r\n", "\n").replace('\r', '\n')
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
        if (text.length() <= max) {
            return text;
        }
        return text.substring(0, max - 1).strip() + "…";
    }
}
