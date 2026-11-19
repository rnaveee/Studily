package com.rnave.studily.user;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/hints")
public class HintsController {

    static final Set<String> KEYS = Set.of("flashcards", "weights", "exam", "bot");

    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public HintsController(UserRepository userRepository, CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public HintsDto get() {
        return new HintsDto(parse(currentUser.entity().getDismissedHints()));
    }

    @PostMapping("/dismiss")
    @Transactional
    public HintsDto dismiss(@Valid @RequestBody DismissRequest body) {
        if (!KEYS.contains(body.key())) {
            throw new BadRequestException("Unknown hint");
        }
        User me = currentUser.entity();
        List<String> keys = parse(me.getDismissedHints());
        if (!keys.contains(body.key())) {
            keys.add(body.key());
            me.setDismissedHints(String.join(",", keys));
            userRepository.save(me);
        }
        return new HintsDto(keys);
    }

    private static List<String> parse(String stored) {
        if (stored == null || stored.isBlank()) return new ArrayList<>();
        return new ArrayList<>(Arrays.asList(stored.split(",")));
    }

    public record HintsDto(List<String> dismissed) {
    }

    public record DismissRequest(@NotBlank @Size(max = 32) String key) {
    }
}
