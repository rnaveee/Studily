package com.rnave.studily.rag;

public class IngestFailure extends RuntimeException {

    private final boolean permanent;

    public IngestFailure(String message, boolean permanent) {
        super(message);
        this.permanent = permanent;
    }

    public boolean permanent() {
        return permanent;
    }
}
