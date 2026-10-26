package com.rnave.studily.config;

public class DeadLinkException extends BadRequestException {
    public DeadLinkException(String message) {
        super(message);
    }
}
