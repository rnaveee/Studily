package com.rnave.studily.academic;

import com.rnave.studily.academic.AcademicItemDtos.AcademicItemDto;
import com.rnave.studily.academic.AcademicItemDtos.AcademicItemRequest;
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
public class AcademicItemController {

    private final AcademicItemService itemService;

    public AcademicItemController(AcademicItemService itemService) {
        this.itemService = itemService;
    }

    @GetMapping("/api/courses/{courseId}/items")
    public List<AcademicItemDto> listForCourse(@PathVariable Long courseId) {
        return itemService.listForCourse(courseId);
    }

    @PostMapping("/api/courses/{courseId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public AcademicItemDto create(@PathVariable Long courseId, @Valid @RequestBody AcademicItemRequest req) {
        return itemService.create(courseId, req);
    }

    @PutMapping("/api/items/{id}")
    public AcademicItemDto update(@PathVariable Long id, @Valid @RequestBody AcademicItemRequest req) {
        return itemService.update(id, req);
    }

    @DeleteMapping("/api/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        itemService.delete(id);
    }
}
