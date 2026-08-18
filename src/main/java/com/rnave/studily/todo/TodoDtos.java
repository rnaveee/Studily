package com.rnave.studily.todo;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class TodoDtos {

    public record TodoChecklistItemDto(
            Long id,
            @NotBlank @Size(max = 255) String text,
            boolean done) {

        public static TodoChecklistItemDto from(TodoChecklistItem item) {
            return new TodoChecklistItemDto(item.getId(), item.getText(), item.isDone());
        }
    }

    public record TodoDto(
            Long id,
            String title,
            String notes,
            TodoPriority priority,
            Instant dueAt,
            boolean completed,
            Instant completedAt,
            Long categoryId,
            String categoryName,
            String categoryColor,
            List<TodoChecklistItemDto> checklist,
            Instant createdAt) {

        public static TodoDto from(Todo todo) {
            TodoCategory category = todo.getCategory();
            return new TodoDto(
                    todo.getId(),
                    todo.getTitle(),
                    todo.getNotes(),
                    todo.getPriority(),
                    todo.getDueAt(),
                    todo.getCompletedAt() != null,
                    todo.getCompletedAt(),
                    category == null ? null : category.getId(),
                    category == null ? null : category.getName(),
                    category == null ? null : category.getColor(),
                    todo.getChecklist().stream().map(TodoChecklistItemDto::from).toList(),
                    todo.getCreatedAt());
        }
    }

    public record TodoRequest(
            @NotBlank @Size(max = 255) String title,
            @Size(max = 5000) String notes,
            @NotNull TodoPriority priority,
            Instant dueAt,
            Long categoryId,
            @Valid @Size(max = 100) List<TodoChecklistItemDto> checklist) {
    }

    public record CompleteRequest(boolean completed) {
    }
}
