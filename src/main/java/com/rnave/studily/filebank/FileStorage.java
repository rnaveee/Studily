package com.rnave.studily.filebank;

public interface FileStorage {

    boolean configured();

    void put(String key, byte[] data, String contentType);

    byte[] get(String key);

    void delete(String key);
}
