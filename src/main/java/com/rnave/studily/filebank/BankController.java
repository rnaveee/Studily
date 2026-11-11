package com.rnave.studily.filebank;

import com.rnave.studily.config.CurrentUser;
import com.rnave.studily.filebank.BankDtos.BankStatusDto;
import com.rnave.studily.filebank.BankDtos.KindRequest;
import com.rnave.studily.rag.Scope;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/bank")
public class BankController {

    private final BankService bank;
    private final CurrentUser currentUser;

    public BankController(BankService bank, CurrentUser currentUser) {
        this.bank = bank;
        this.currentUser = currentUser;
    }

    @GetMapping("/status")
    public BankStatusDto status() {
        return bank.status();
    }

    @GetMapping("/courses/{courseId}/files")
    public List<BankFileDto> courseFiles(@PathVariable Long courseId) {
        return bank.courseFiles(courseId);
    }

    @PostMapping(value = "/courses/{courseId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<BankFileDto> upload(@PathVariable Long courseId,
                                    @RequestParam(value = "files", required = false) List<MultipartFile> files,
                                    @RequestParam(value = "kind", required = false) BankFileKind kind) {
        Scope scope = Scope.course(currentUser.id(), courseId);
        return bank.upload(scope, files, kind).stream().map(BankFileDto::from).toList();
    }

    @PatchMapping("/files/{id}")
    public BankFileDto setKind(@PathVariable Long id, @Valid @RequestBody KindRequest req) {
        return bank.setKind(id, req.kind());
    }

    @PostMapping("/files/{id}/retry")
    public BankFileDto retry(@PathVariable Long id) {
        return bank.retry(id);
    }

    @DeleteMapping("/files/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        bank.delete(id);
    }

    @GetMapping("/files/{id}/pages/{page}/preview")
    public ResponseEntity<byte[]> preview(@PathVariable Long id, @PathVariable int page) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=86400")
                .body(bank.previewPng(id, page));
    }
}
