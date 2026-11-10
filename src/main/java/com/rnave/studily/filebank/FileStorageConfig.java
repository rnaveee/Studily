package com.rnave.studily.filebank;

import com.rnave.studily.config.ServiceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.nio.file.Path;

@Configuration
public class FileStorageConfig {

    private static final Logger log = LoggerFactory.getLogger(FileStorageConfig.class);

    @Bean
    FileStorage fileStorage(@Value("${app.storage.endpoint}") String endpoint,
                            @Value("${app.storage.bucket}") String bucket,
                            @Value("${app.storage.access-key}") String accessKey,
                            @Value("${app.storage.secret-key}") String secretKey,
                            @Value("${app.storage.local-dir}") String localDir) {
        if (StringUtils.hasText(endpoint)) {
            return new S3FileStorage(endpoint, bucket, accessKey, secretKey);
        }
        if (StringUtils.hasText(localDir)) {
            return new LocalFileStorage(Path.of(localDir.strip()));
        }
        log.warn("STORAGE_ENDPOINT and STORAGE_LOCAL_DIR are not set, the file bank is disabled");
        return new Disabled();
    }

    private static final class Disabled implements FileStorage {

        private static final String NOT_SET_UP = "File storage isn't set up on this server yet.";

        @Override
        public boolean configured() {
            return false;
        }

        @Override
        public void put(String key, byte[] data, String contentType) {
            throw new ServiceUnavailableException(NOT_SET_UP);
        }

        @Override
        public byte[] get(String key) {
            throw new ServiceUnavailableException(NOT_SET_UP);
        }

        @Override
        public void delete(String key) {
            throw new ServiceUnavailableException(NOT_SET_UP);
        }
    }
}
