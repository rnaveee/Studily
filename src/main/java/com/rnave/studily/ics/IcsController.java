package com.rnave.studily.ics;

import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.ics.IcsDtos.ImportRequest;
import com.rnave.studily.ics.IcsDtos.ImportResult;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/calendar")
public class IcsController {

    private final IcsService icsService;

    public IcsController(IcsService icsService) {
        this.icsService = icsService;
    }

    @PostMapping("/import")
    public ImportResult importCalendar(@Valid @RequestBody ImportRequest req) {
        return icsService.importCalendar(req.source(), req.timeZone());
    }

    @PostMapping(value = "/import-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportResult importFile(@RequestParam("file") MultipartFile file,
                                   @RequestParam(value = "timeZone", required = false) String timeZone) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("That file is empty");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Could not read that file");
        }
        return icsService.importFile(bytes, file.getOriginalFilename(), timeZone);
    }

    @GetMapping(value = "/export.ics", produces = "text/calendar")
    public ResponseEntity<String> export() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/calendar; charset=utf-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"studily.ics\"")
                .body(icsService.export());
    }
}
