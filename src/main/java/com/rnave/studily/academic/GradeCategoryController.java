package com.rnave.studily.academic;

import com.rnave.studily.academic.GradeCategoryDtos.GradeCategoryDto;
import com.rnave.studily.academic.GradeCategoryDtos.GradeCategoryRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class GradeCategoryController {

    private final GradeCategoryService categoryService;

    public GradeCategoryController(GradeCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping("/api/courses/{courseId}/weights")
    public List<GradeCategoryDto> listForCourse(@PathVariable Long courseId) {
        return categoryService.listForCourse(courseId);
    }

    @PostMapping("/api/courses/{courseId}/weights")
    @ResponseStatus(HttpStatus.CREATED)
    public GradeCategoryDto create(@PathVariable Long courseId,
                                   @Valid @RequestBody GradeCategoryRequest req) {
        return categoryService.create(courseId, req);
    }

    @PutMapping("/api/weights/{id}")
    public GradeCategoryDto update(@PathVariable Long id,
                                   @Valid @RequestBody GradeCategoryRequest req) {
        return categoryService.update(id, req);
    }

    @DeleteMapping("/api/weights/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        categoryService.delete(id);
    }
}
