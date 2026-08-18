package com.rnave.studily.todo;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.NotFoundException;
import com.rnave.studily.todo.TodoDtos.TodoChecklistItemDto;
import com.rnave.studily.todo.TodoDtos.TodoDto;
import com.rnave.studily.todo.TodoDtos.TodoRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TodoServiceTest {

    private TodoRepository todoRepository;
    private TodoCategoryRepository categoryRepository;
    private CurrentUser currentUser;
    private TodoService service;

    @BeforeEach
    void setUp() {
        todoRepository = mock(TodoRepository.class);
        categoryRepository = mock(TodoCategoryRepository.class);
        currentUser = mock(CurrentUser.class);
        service = new TodoService(todoRepository, categoryRepository, currentUser);
        when(currentUser.id()).thenReturn(1L);
        when(todoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private Todo ownedTodoWithItem(long todoId, long itemId) {
        Todo todo = new Todo();
        todo.setId(todoId);
        todo.setTitle("Calc homework");
        TodoChecklistItem item = new TodoChecklistItem();
        item.setId(itemId);
        item.setTodo(todo);
        item.setText("Do part 1");
        item.setDone(true);
        todo.getChecklist().add(item);
        when(todoRepository.findByIdAndUserId(todoId, 1L)).thenReturn(Optional.of(todo));
        return todo;
    }

    private static TodoRequest request(List<TodoChecklistItemDto> checklist) {
        return new TodoRequest("Calc homework", null, TodoPriority.MEDIUM, null, null, checklist);
    }

    @Test
    void updateKeepsExistingChecklistItemRows() {
        Todo todo = ownedTodoWithItem(10L, 100L);
        TodoChecklistItem original = todo.getChecklist().get(0);

        service.update(10L, request(List.of(new TodoChecklistItemDto(100L, "Do part 1 again", true))));

        assertThat(todo.getChecklist()).hasSize(1);
        assertThat(todo.getChecklist().get(0)).isSameAs(original);
        assertThat(todo.getChecklist().get(0).getText()).isEqualTo("Do part 1 again");
        assertThat(todo.getChecklist().get(0).isDone()).isTrue();
    }

    @Test
    void updateIgnoresForeignChecklistItemIds() {
        Todo todo = ownedTodoWithItem(10L, 100L);

        service.update(10L, request(List.of(new TodoChecklistItemDto(31337L, "Submit assignment", false))));

        assertThat(todo.getChecklist()).hasSize(1);
        assertThat(todo.getChecklist().get(0).getId()).isNull();
        assertThat(todo.getChecklist().get(0).getText()).isEqualTo("Submit assignment");
    }

    @Test
    void updateDropsRemovedChecklistItemsAndRenumbersPositions() {
        Todo todo = ownedTodoWithItem(10L, 100L);

        service.update(10L, request(List.of(
                new TodoChecklistItemDto(null, "Part 2", false),
                new TodoChecklistItemDto(null, "Submit assignment", false))));

        assertThat(todo.getChecklist()).extracting(TodoChecklistItem::getText)
                .containsExactly("Part 2", "Submit assignment");
        assertThat(todo.getChecklist()).extracting(TodoChecklistItem::getPosition)
                .containsExactly(0, 1);
    }

    @Test
    void requireOwnedRejectsAnotherUsersTodo() {
        when(todoRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requireOwned(99L))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createRejectsCategoryOwnedByAnotherUser() {
        when(currentUser.entity()).thenReturn(null);
        when(categoryRepository.findByIdAndUserId(7L, 1L)).thenReturn(Optional.empty());

        TodoRequest req = new TodoRequest("Task", null, TodoPriority.LOW, null, 7L, null);

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void listSortsByCompletionThenPriorityThenDueDate() {
        Instant now = Instant.now();
        Todo done = todo(1L, TodoPriority.HIGH, now, null);
        done.setCompletedAt(now);
        Todo highSoon = todo(2L, TodoPriority.HIGH, now, now.plus(1, ChronoUnit.DAYS));
        Todo highLater = todo(3L, TodoPriority.HIGH, now, now.plus(5, ChronoUnit.DAYS));
        Todo highUndated = todo(4L, TodoPriority.HIGH, now, null);
        Todo low = todo(5L, TodoPriority.LOW, now, now.plus(1, ChronoUnit.DAYS));

        when(todoRepository.findByUserId(1L)).thenReturn(List.of(low, highUndated, done, highLater, highSoon));

        assertThat(service.list()).extracting(TodoDto::id).containsExactly(2L, 3L, 4L, 5L, 1L);
    }

    @Test
    void completeAndUncompleteSetAndClearCompletedAt() {
        ownedTodoWithItem(10L, 100L);

        assertThat(service.setCompleted(10L, true).completed()).isTrue();
        assertThat(service.setCompleted(10L, false).completedAt()).isNull();
    }

    private static Todo todo(long id, TodoPriority priority, Instant createdAt, Instant dueAt) {
        Todo t = new Todo();
        t.setId(id);
        t.setTitle("t" + id);
        t.setPriority(priority);
        t.setCreatedAt(createdAt);
        t.setDueAt(dueAt);
        return t;
    }
}
