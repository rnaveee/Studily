package com.rnave.studily.todo;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.todo.TodoDtos.TodoChecklistItemDto;
import com.rnave.studily.todo.TodoDtos.TodoDto;
import com.rnave.studily.todo.TodoDtos.TodoRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TodoService {

    private static final Comparator<Todo> ORDER = Comparator
            .comparing((Todo t) -> t.getCompletedAt() != null)
            .thenComparing(Todo::getPriority)
            .thenComparing(Todo::getDueAt, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Todo::getCreatedAt);

    private final TodoRepository todoRepository;
    private final TodoCategoryRepository categoryRepository;
    private final CurrentUser currentUser;

    public TodoService(TodoRepository todoRepository, TodoCategoryRepository categoryRepository,
                       CurrentUser currentUser) {
        this.todoRepository = todoRepository;
        this.categoryRepository = categoryRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<TodoDto> list() {
        return todoRepository.findByUserId(currentUser.id())
                .stream().sorted(ORDER).map(TodoDto::from).toList();
    }

    @Transactional(readOnly = true)
    public TodoDto get(Long id) {
        return TodoDto.from(requireOwned(id));
    }

    @Transactional(readOnly = true)
    public Todo requireOwned(Long id) {
        return todoRepository.findByIdAndUserId(id, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    @Transactional
    public TodoDto create(TodoRequest req) {
        Todo todo = new Todo();
        todo.setUser(currentUser.entity());
        apply(todo, req);
        return TodoDto.from(todoRepository.save(todo));
    }

    @Transactional
    public TodoDto update(Long id, TodoRequest req) {
        Todo todo = requireOwned(id);
        apply(todo, req);
        return TodoDto.from(todoRepository.save(todo));
    }

    @Transactional
    public void delete(Long id) {
        todoRepository.delete(requireOwned(id));
    }

    @Transactional
    public TodoDto setCompleted(Long id, boolean completed) {
        Todo todo = requireOwned(id);
        todo.setCompletedAt(completed ? Instant.now() : null);
        return TodoDto.from(todoRepository.save(todo));
    }

    private void apply(Todo todo, TodoRequest req) {
        todo.setTitle(req.title().trim());
        todo.setNotes(trimToNull(req.notes()));
        todo.setPriority(req.priority());
        todo.setDueAt(req.dueAt());
        todo.setCategory(resolveCategory(req.categoryId()));

        Map<Long, TodoChecklistItem> existing = new HashMap<>();
        for (TodoChecklistItem item : todo.getChecklist()) {
            if (item.getId() != null) existing.put(item.getId(), item);
        }

        todo.getChecklist().clear();
        if (req.checklist() != null) {
            int position = 0;
            for (TodoChecklistItemDto dto : req.checklist()) {
                TodoChecklistItem item = dto.id() != null ? existing.get(dto.id()) : null;
                if (item == null) {
                    item = new TodoChecklistItem();
                    item.setTodo(todo);
                }
                item.setText(dto.text().trim());
                item.setDone(dto.done());
                item.setPosition(position++);
                todo.getChecklist().add(item);
            }
        }
    }

    private TodoCategory resolveCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categoryRepository.findByIdAndUserId(categoryId, currentUser.id())
                .orElseThrow(() -> new NotFoundException("Category not found"));
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
