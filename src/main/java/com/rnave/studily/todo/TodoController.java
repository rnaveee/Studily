package com.rnave.studily.todo;

import com.rnave.studily.todo.TodoDtos.CompleteRequest;
import com.rnave.studily.todo.TodoDtos.TodoDto;
import com.rnave.studily.todo.TodoDtos.TodoRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    @GetMapping
    public List<TodoDto> list() {
        return todoService.list();
    }

    @GetMapping("/{id}")
    public TodoDto get(@PathVariable Long id) {
        return todoService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TodoDto create(@Valid @RequestBody TodoRequest req) {
        return todoService.create(req);
    }

    @PutMapping("/{id}")
    public TodoDto update(@PathVariable Long id, @Valid @RequestBody TodoRequest req) {
        return todoService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        todoService.delete(id);
    }

    @PostMapping("/{id}/complete")
    public TodoDto complete(@PathVariable Long id, @Valid @RequestBody CompleteRequest req) {
        return todoService.setCompleted(id, req.completed());
    }
}
