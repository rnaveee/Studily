package com.rnave.studily.canvas;

import com.rnave.studily.academic.ItemType;

public record LmsRef(Kind kind, String courseKey, String courseCode, String courseName, String uid,
                     String groupKey, String title, ItemType typeHint, boolean closing) {

    public enum Kind {
        ITEM, SKIP
    }

    public static LmsRef skip(String courseKey) {
        return new LmsRef(Kind.SKIP, courseKey, null, null, null, null, null, null, false);
    }
}
