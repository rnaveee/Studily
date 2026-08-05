package com.rnave.studily.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class MatchKeysTest {

    @Test
    void schoolKeyNormalizesSuffixesAndCase() {
        assertEquals("simonfraser", MatchKeys.schoolKey("Simon Fraser University"));
        assertEquals("simonfraser", MatchKeys.schoolKey("simon fraser"));
        assertEquals("simonfraser", MatchKeys.schoolKey("  Simon-Fraser  University "));
        assertEquals("britishcolumbia", MatchKeys.schoolKey("University of British Columbia"));
        assertEquals("britishcolumbia", MatchKeys.schoolKey("british columbia"));
        assertEquals("douglas", MatchKeys.schoolKey("Douglas College"));
    }

    @Test
    void schoolKeyHandlesDegenerateInput() {
        assertNull(MatchKeys.schoolKey(null));
        assertNull(MatchKeys.schoolKey(""));
        assertNull(MatchKeys.schoolKey("University"));
        assertNull(MatchKeys.schoolKey("  the of  "));
    }

    @Test
    void codeKeyStripsSeparatorsAndUppercases() {
        assertEquals("CMPT225", MatchKeys.codeKey("CMPT 225"));
        assertEquals("CMPT225", MatchKeys.codeKey("cmpt225"));
        assertEquals("CMPT225", MatchKeys.codeKey("cmpt-225"));
        assertEquals("MATH151", MatchKeys.codeKey(" math 151 "));
        assertNull(MatchKeys.codeKey(null));
        assertNull(MatchKeys.codeKey("  -  "));
    }
}
