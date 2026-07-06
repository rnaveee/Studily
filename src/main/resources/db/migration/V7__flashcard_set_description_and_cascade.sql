ALTER TABLE flashcard_sets ADD COLUMN description TEXT;

ALTER TABLE flashcard_sets DROP CONSTRAINT flashcard_sets_course_id_fkey;
ALTER TABLE flashcard_sets ADD CONSTRAINT flashcard_sets_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE flashcards DROP CONSTRAINT flashcards_set_id_fkey;
ALTER TABLE flashcards ADD CONSTRAINT flashcards_set_id_fkey
    FOREIGN KEY (set_id) REFERENCES flashcard_sets(id) ON DELETE CASCADE;
