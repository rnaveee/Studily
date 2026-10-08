package com.rnave.studily.progress;

import com.rnave.studily.progress.ProgressDtos.EquipFlairRequest;
import com.rnave.studily.progress.ProgressDtos.EquippedFlairResult;
import com.rnave.studily.progress.ProgressDtos.FlairDto;
import com.rnave.studily.progress.ProgressDtos.FlairPurchaseResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class FlairController {

    private final FlairService flairService;

    public FlairController(FlairService flairService) {
        this.flairService = flairService;
    }

    @GetMapping("/api/flairs")
    public List<FlairDto> mine() {
        return flairService.mine();
    }

    @PostMapping("/api/flairs/{code}/purchase")
    public FlairPurchaseResult purchase(@PathVariable String code) {
        return flairService.purchase(code);
    }

    @PutMapping("/api/me/flair")
    public EquippedFlairResult equip(@RequestBody EquipFlairRequest req) {
        return flairService.equip(req.code());
    }
}
