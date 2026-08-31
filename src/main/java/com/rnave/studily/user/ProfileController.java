package com.rnave.studily.user;

import com.rnave.studily.admin.AdminGuard;
import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.config.MatchKeys;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
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
    private final AdminGuard adminGuard;

    public ProfileController(UserRepository userRepository, CurrentUser currentUser, AdminGuard adminGuard) {
        this.userRepository = userRepository;
        this.currentUser = currentUser;
        this.adminGuard = adminGuard;
    }

    @GetMapping
    public UserDto me() {
        User user = currentUser.entity();
        return UserDto.from(user, adminGuard.isAdmin(user));
    }

    @PutMapping
    @Transactional
    public UserDto update(@Valid @RequestBody ProfileUpdateRequest req) {
        User user = currentUser.entity();
        user.setName(req.name());
        user.setSchool(req.school());
        user.setSchoolKey(MatchKeys.schoolKey(req.school()));
        user.setSchoolId(req.schoolId());
        user.setYear(req.year());
        user.setMajor(req.major());
        user.setBio(req.bio());
        return UserDto.from(userRepository.save(user), adminGuard.isAdmin(user));
    }

    public record ProfileUpdateRequest(
            @Size(max = 255) String name,
            @Size(max = 255) String school,
            @Size(max = 255) String schoolId,
            Integer year,
            @Size(max = 255) String major,
            @Size(max = 1000) String bio) {
    }
}
