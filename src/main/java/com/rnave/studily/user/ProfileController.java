package com.rnave.studily.user;

import com.rnave.studily.config.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class ProfileController {

    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public ProfileController(UserRepository userRepository, CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public UserDto me() {
        return UserDto.from(currentUser.entity());
    }

    @PutMapping
    @Transactional
    public UserDto update(@Valid @RequestBody ProfileUpdateRequest req) {
        User user = currentUser.entity();
        user.setName(req.name());
        user.setSchool(req.school());
        user.setSchoolId(req.schoolId());
        user.setYear(req.year());
        user.setMajor(req.major());
        user.setBio(req.bio());
        return UserDto.from(userRepository.save(user));
    }

    public record ProfileUpdateRequest(
            String name,
            String school,
            String schoolId,
            Integer year,
            String major,
            String bio) {
    }
}
