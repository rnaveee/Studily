package com.rnave.studily.progress;

import com.rnave.studily.progress.ProgressDtos.ChestDto;
import com.rnave.studily.progress.ProgressDtos.ChestOpenResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chests")
public class ChestController {

    private final ChestService chestService;

    public ChestController(ChestService chestService) {
        this.chestService = chestService;
    }

    @GetMapping
    public List<ChestDto> unopened() {
        return chestService.unopened();
    }

    @PostMapping("/{id}/open")
    public ChestOpenResult open(@PathVariable Long id) {
        return chestService.open(id);
    }
}
