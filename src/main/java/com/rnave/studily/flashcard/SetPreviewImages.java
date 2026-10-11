package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.SetPagePreview;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class SetPreviewImages {

    private static final int MAX_ENTRIES = 64;

    private final Map<String, byte[]> cache = Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
            return size() > MAX_ENTRIES;
        }
    });

    public byte[] png(SetPagePreview preview) {
        return cache.computeIfAbsent(SetPreviewImage.cacheKey(preview), key -> SetPreviewImage.render(preview));
    }
}
