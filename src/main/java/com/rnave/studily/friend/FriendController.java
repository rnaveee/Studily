package com.rnave.studily.friend;

import com.rnave.studily.config.PageResponse;
import com.rnave.studily.friend.FriendDtos.FriendRequestDto;
import com.rnave.studily.friend.FriendDtos.RelationshipDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @GetMapping
    public List<FriendRequestDto> friends() {
        return friendService.friends();
    }

    @GetMapping("/incoming")
    public List<FriendRequestDto> incoming() {
        return friendService.incoming();
    }

    @GetMapping("/pending")
    public List<FriendRequestDto> pending() {
        return friendService.pendingSent();
    }

    @GetMapping("/schoolmates")
    public PageResponse<RelationshipDto> schoolmates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        return friendService.schoolmates(page, size);
    }

    @GetMapping("/users/{id}")
    public RelationshipDto publicUser(@PathVariable Long id) {
        return friendService.publicUser(id);
    }

    @GetMapping("/search")
    public PageResponse<RelationshipDto> search(
            @RequestParam String username,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return friendService.searchByUsername(username, page, size);
    }

    @PostMapping("/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public FriendRequestDto send(@Valid @RequestBody SendRequest req) {
        return friendService.sendRequest(req.userId());
    }

    @PostMapping("/requests/{id}/accept")
    public FriendRequestDto accept(@PathVariable Long id) {
        return friendService.accept(id);
    }

    @DeleteMapping("/requests/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable Long id) {
        friendService.remove(id);
    }

    public record SendRequest(@NotNull Long userId) {
    }
}
