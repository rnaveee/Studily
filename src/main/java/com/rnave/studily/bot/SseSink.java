package com.rnave.studily.bot;

import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;

final class SseSink {

    private final SseEmitter emitter;
    private volatile boolean closed;

    SseSink(SseEmitter emitter) {
        this.emitter = emitter;
        emitter.onCompletion(() -> closed = true);
        emitter.onTimeout(() -> closed = true);
        emitter.onError(error -> closed = true);
    }

    boolean closed() {
        return closed;
    }

    void send(String event, Object data) {
        if (closed) {
            return;
        }
        try {
            emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            closed = true;
        }
    }

    void complete() {
        if (!closed) {
            closed = true;
            emitter.complete();
        }
    }
}
