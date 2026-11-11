package com.rnave.studily.progress;

import com.rnave.studily.progress.ProgressDtos.BotOutfitDto;
import com.rnave.studily.progress.ProgressDtos.BotOutfitPurchaseResult;
import com.rnave.studily.progress.ProgressDtos.EquipBotOutfitRequest;
import com.rnave.studily.user.BotOutfitRef;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class BotOutfitController {

    private final BotOutfitService botOutfitService;

    public BotOutfitController(BotOutfitService botOutfitService) {
        this.botOutfitService = botOutfitService;
    }

    @GetMapping("/api/bot-outfits")
    public List<BotOutfitDto> mine() {
        return botOutfitService.mine();
    }

    @PostMapping("/api/bot-outfits/{code}/purchase")
    public BotOutfitPurchaseResult purchase(@PathVariable String code) {
        return botOutfitService.purchase(code);
    }

    @PutMapping("/api/me/bot-outfit")
    public BotOutfitRef equip(@RequestBody EquipBotOutfitRequest req) {
        return botOutfitService.equip(req.top(), req.bottom());
    }
}
