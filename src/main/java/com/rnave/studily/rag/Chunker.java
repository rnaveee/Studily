package com.rnave.studily.rag;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

@Component
public class Chunker {

    static final int MAX_CHARS = 1800;
    static final int OVERLAP_CHARS = 250;
    static final int MIN_CHARS = 350;

    private static final Pattern PARAGRAPH_BREAK = Pattern.compile("\\n\\s*\\n");
    private static final Pattern SENTENCE_END = Pattern.compile("(?<=[.!?])\\s+(?=[\\p{Lu}\\d(\\[\"'])");

    record Piece(String heading, Integer page, String text, boolean startsParagraph) {
    }

    public List<Chunk> chunk(List<Section> sections) {
        List<Piece> pieces = new ArrayList<>();
        for (Section section : sections) {
            pieces.addAll(split(section));
        }

        List<Chunk> chunks = new ArrayList<>();
        List<Piece> current = new ArrayList<>();
        for (Piece piece : pieces) {
            if (!current.isEmpty()) {
                boolean headingChanged = !Objects.equals(current.getLast().heading(), piece.heading());
                boolean full = length(current) + piece.text().length() + 2 > MAX_CHARS;
                if (full || (headingChanged && length(current) >= MIN_CHARS)) {
                    chunks.add(build(chunks.size(), current));
                    current = headingChanged ? new ArrayList<>() : overlap(current, piece);
                }
            }
            current.add(piece);
        }
        if (!current.isEmpty()) {
            chunks.add(build(chunks.size(), current));
        }
        return chunks;
    }

    static List<Piece> split(Section section) {
        List<Piece> pieces = new ArrayList<>();
        for (String paragraph : PARAGRAPH_BREAK.split(section.text())) {
            String trimmed = paragraph.strip();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (trimmed.length() <= MAX_CHARS) {
                pieces.add(new Piece(section.heading(), section.page(), trimmed, true));
                continue;
            }
            boolean first = true;
            for (String sentence : SENTENCE_END.split(trimmed)) {
                for (String part : hardWrap(sentence.strip())) {
                    pieces.add(new Piece(section.heading(), section.page(), part, first));
                    first = false;
                }
            }
        }
        return pieces;
    }

    static List<String> hardWrap(String text) {
        List<String> parts = new ArrayList<>();
        String rest = text;
        while (rest.length() > MAX_CHARS) {
            int cut = rest.lastIndexOf(' ', MAX_CHARS);
            if (cut < MAX_CHARS / 2) {
                cut = MAX_CHARS;
            }
            parts.add(rest.substring(0, cut).strip());
            rest = rest.substring(cut).strip();
        }
        if (!rest.isEmpty()) {
            parts.add(rest);
        }
        return parts;
    }

    private static List<Piece> overlap(List<Piece> previous, Piece next) {
        List<Piece> tail = new ArrayList<>();
        int size = 0;
        for (int i = previous.size() - 1; i >= 0; i--) {
            Piece piece = previous.get(i);
            if (size + piece.text().length() > OVERLAP_CHARS) {
                break;
            }
            tail.addFirst(piece);
            size += piece.text().length();
        }
        if (tail.size() == previous.size() || size + next.text().length() + 2 > MAX_CHARS) {
            return new ArrayList<>();
        }
        return tail;
    }

    private static Chunk build(int index, List<Piece> pieces) {
        StringBuilder text = new StringBuilder();
        Integer pageFrom = null;
        Integer pageTo = null;
        String previousHeading = pieces.getFirst().heading();
        for (Piece piece : pieces) {
            if (!text.isEmpty()) {
                boolean newHeading = piece.heading() != null && !piece.heading().equals(previousHeading);
                if (newHeading) {
                    text.append("\n\n").append(piece.heading()).append('\n');
                } else {
                    text.append(piece.startsParagraph() ? "\n\n" : " ");
                }
            }
            text.append(piece.text());
            previousHeading = piece.heading();
            if (piece.page() != null) {
                pageFrom = pageFrom == null ? piece.page() : Math.min(pageFrom, piece.page());
                pageTo = pageTo == null ? piece.page() : Math.max(pageTo, piece.page());
            }
        }
        return new Chunk(index, pieces.getFirst().heading(), pageFrom, pageTo, text.toString());
    }

    private static int length(List<Piece> pieces) {
        int total = 0;
        for (Piece piece : pieces) {
            total += piece.text().length() + 2;
        }
        return total;
    }
}
