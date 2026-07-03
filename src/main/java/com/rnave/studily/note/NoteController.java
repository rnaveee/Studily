package com.rnave.studily.note;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.course.Course;
import com.rnave.studily.course.CourseService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;

@RestController
public class NoteController {

    private final NoteRepository noteRepository;
    private final CourseService courseService;
    private final CurrentUser currentUser;

    public NoteController(NoteRepository noteRepository, CourseService courseService, CurrentUser currentUser) {
        this.noteRepository = noteRepository;
        this.courseService = courseService;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/courses/{courseId}/notes")
    @Transactional(readOnly = true)
    public List<NoteDto> list(@PathVariable Long courseId) {
        courseService.requireOwned(courseId);
        return noteRepository.findByCourseIdOrderByCreatedAtDesc(courseId)
                .stream().map(NoteDto::from).toList();
    }

    @PostMapping("/api/courses/{courseId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public NoteDto create(@PathVariable Long courseId, @Valid @RequestBody NoteRequest req) {
        Course course = courseService.requireOwned(courseId);
        Note note = new Note();
        note.setCourse(course);
        note.setBody(req.body().trim());
        return NoteDto.from(noteRepository.save(note));
    }

    @DeleteMapping("/api/notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        Note note = noteRepository.findByIdAndCourseUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Note not found"));
        noteRepository.delete(note);
    }

    public record NoteDto(Long id, Long courseId, String body, Instant createdAt) {
        static NoteDto from(Note n) {
            return new NoteDto(n.getId(), n.getCourse().getId(), n.getBody(), n.getCreatedAt());
        }
    }

    public record NoteRequest(@NotBlank @Size(max = 10000) String body) {
    }
}
