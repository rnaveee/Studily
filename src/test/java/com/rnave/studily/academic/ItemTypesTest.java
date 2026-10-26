package com.rnave.studily.academic;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ItemTypesTest {

    @ParameterizedTest
    @ValueSource(strings = {"Exam", "Exams", "Midterm", "Midterms", "Final", "Finals", "Final Exam", "Tests", "Unit test 2"})
    void fromName_readsSingularAndPluralExamNamesAsExams(String name) {
        assertThat(ItemTypes.fromName(name)).isEqualTo(ItemType.EXAM);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Assignments", "Labs", "Quizzes", "Examples", "Testing log", "Finality essay", ""})
    void fromName_leavesOtherNamesAsAssignments(String name) {
        assertThat(ItemTypes.fromName(name)).isEqualTo(ItemType.ASSIGNMENT);
    }
}
