package com.rnave.studily.rag;

import com.rnave.studily.filebank.BankFileKind;

public record RetrievedChunk(long chunkId, long fileId, String fileName, BankFileKind fileKind, boolean previewable,
                             Integer pageFrom, Integer pageTo, String heading, String content, Double relevance) {

    static RetrievedChunk of(ChunkStore.Hit hit, Double relevance) {
        return new RetrievedChunk(hit.chunkId(), hit.fileId(), hit.fileName(), hit.fileKind(), hit.previewable(),
                hit.pageFrom(), hit.pageTo(), hit.heading(), hit.content(), relevance);
    }

    public String location() {
        if (pageFrom == null) {
            return fileName;
        }
        if (pageTo == null || pageTo.equals(pageFrom)) {
            return fileName + ", p. " + pageFrom;
        }
        return fileName + ", pp. " + pageFrom + "-" + pageTo;
    }
}
