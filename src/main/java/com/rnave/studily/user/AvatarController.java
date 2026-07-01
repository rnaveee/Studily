package com.rnave.studily.user;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

@RestController
public class AvatarController {

    private final AvatarService avatarService;

    public AvatarController(AvatarService avatarService) {
        this.avatarService = avatarService;
    }

    @PostMapping("/api/me/avatar")
    public UserDto upload(@RequestParam("file") MultipartFile file) {
        return avatarService.upload(file);
    }

    @DeleteMapping("/api/me/avatar")
    public UserDto delete() {
        return avatarService.delete();
    }

    @GetMapping("/api/users/{id}/avatar")
    public ResponseEntity<byte[]> serve(@PathVariable Long id) {
        User user = avatarService.requireForServing(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(user.getAvatarContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .body(user.getAvatarImage());
    }
}
