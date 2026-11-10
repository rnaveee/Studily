package com.rnave.studily.rag;

public record Chunk(int index, String heading, Integer pageFrom, Integer pageTo, String text) {

    public int tokenEstimate() {
        return Math.max(1, text.length() / 4);
    }
}
