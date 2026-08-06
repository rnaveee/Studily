package com.rnave.studily.calendar;

import com.rnave.studily.config.ConflictException;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/calendar/categories")
public class EventCategoryController {

    private final EventCategoryRepository categoryRepository;
    private final CurrentUser currentUser;

    public EventCategoryController(EventCategoryRepository categoryRepository, CurrentUser currentUser) {
        this.categoryRepository = categoryRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<EventCategoryDto> list() {
        return categoryRepository.findByUserIdOrderByNameAsc(currentUser.id())
                .stream().map(EventCategoryDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public EventCategoryDto create(@Valid @RequestBody EventCategoryRequest req) {
        String name = req.name().trim();
        if (categoryRepository.existsByUserIdAndNameIgnoreCase(currentUser.id(), name)) {
            throw new ConflictException("You already have a category called \"" + name + "\"");
        }
        EventCategory category = new EventCategory();
        category.setUser(currentUser.entity());
        category.setName(name);
        category.setColor(req.color().trim());
        return EventCategoryDto.from(categoryRepository.save(category));
    }

    @PutMapping("/{id}")
    @Transactional
    public EventCategoryDto update(@PathVariable Long id, @Valid @RequestBody EventCategoryRequest req) {
        EventCategory category = requireOwned(id);
        String name = req.name().trim();
        if (categoryRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(currentUser.id(), name, id)) {
            throw new ConflictException("You already have a category called \"" + name + "\"");
        }
        category.setName(name);
        category.setColor(req.color().trim());
        return EventCategoryDto.from(categoryRepository.save(category));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable Long id) {
        categoryRepository.delete(requireOwned(id));
    }

    private EventCategory requireOwned(Long id) {
        return categoryRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Category not found"));
    }

    public record EventCategoryDto(Long id, String name, String color) {
        public static EventCategoryDto from(EventCategory c) {
            return new EventCategoryDto(c.getId(), c.getName(), c.getColor());
        }
    }

    public record EventCategoryRequest(
            @NotBlank @Size(max = 60) String name,
            @NotBlank @Size(max = 32) String color) {
    }
}
