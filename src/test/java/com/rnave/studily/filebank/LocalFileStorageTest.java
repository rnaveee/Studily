package com.rnave.studily.filebank;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFileStorageTest {

    @TempDir
    Path tempDir;

    @Test
    void putGetAndDeleteRoundTripUnderTheRoot() {
        LocalFileStorage storage = new LocalFileStorage(tempDir.resolve("store"));
        byte[] data = "hello".getBytes(StandardCharsets.UTF_8);

        storage.put("bank/7/abc-123", data, "text/plain");

        assertThat(storage.configured()).isTrue();
        assertThat(storage.get("bank/7/abc-123")).isEqualTo(data);
        storage.delete("bank/7/abc-123");
        assertThat(Files.exists(tempDir.resolve("store/bank/7/abc-123"))).isFalse();
    }

    @Test
    void rejectsKeysThatEscapeTheRoot() throws Exception {
        Path root = tempDir.resolve("store");
        LocalFileStorage storage = new LocalFileStorage(root);

        for (String key : new String[] {"../escape.txt", "bank/../../escape.txt", "bank/../../../escape.txt"}) {
            assertThatThrownBy(() -> storage.put(key, new byte[] {1}, "text/plain"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThat(Files.exists(tempDir.resolve("escape.txt"))).isFalse();
    }

    @Test
    void rejectsAbsoluteAndMalformedKeys() {
        LocalFileStorage storage = new LocalFileStorage(tempDir.resolve("store"));

        for (String key : new String[] {"/etc/passwd", "bank//x", "bank/./x", "bank/", "bank\\x", "bank/a b", ""}) {
            assertThatThrownBy(() -> storage.get(key)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> storage.get(null)).isInstanceOf(IllegalArgumentException.class);
    }
}
