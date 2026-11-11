package com.rnave.studily.rag;

import java.util.List;

public record ExtractedDocument(List<Section> sections, Integer pageCount, int unreadablePages) {

    public boolean mostlyUnreadable() {
        return pageCount != null && pageCount > 0 && unreadablePages * 2 > pageCount;
    }
}
