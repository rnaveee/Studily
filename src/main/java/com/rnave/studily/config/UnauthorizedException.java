package com.rnave.studily.config;

public class UnauthorizedException extends RuntimeException {

    public static final String SESSION_EXPIRED = "SESSION_EXPIRED";

    private final String code;

    public UnauthorizedException(String message) {
        this(message, null);
    }

    public UnauthorizedException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
