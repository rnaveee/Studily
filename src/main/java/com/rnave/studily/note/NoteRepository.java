package com.rnave.studily.note;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NoteRepository extends JpaRepository<Note, Long> {

    List<Note> findByCourseIdOrderByCreatedAtDesc(Long courseId);

    Optional<Note> findByIdAndCourseUserId(Long id, Long userId);
}
