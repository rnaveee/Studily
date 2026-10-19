package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.DismissRequest;
import com.rnave.studily.admin.AdminDtos.EvidenceContent;
import com.rnave.studily.admin.AdminDtos.ModerationRequest;
import com.rnave.studily.admin.AdminDtos.ModerationResult;
import com.rnave.studily.admin.AdminDtos.Paged;
import com.rnave.studily.admin.AdminDtos.ReportCase;
import com.rnave.studily.admin.AdminDtos.ReportGroupRow;
import com.rnave.studily.moderation.ModerationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminModerationController {

    private final AdminReportService reportService;
    private final ModerationService moderationService;
    private final AdminAuditService auditService;

    public AdminModerationController(AdminReportService reportService, ModerationService moderationService,
                                     AdminAuditService auditService) {
        this.reportService = reportService;
        this.moderationService = moderationService;
        this.auditService = auditService;
    }

    @ModelAttribute
    void requireAdminContext(HttpServletRequest request) {
        AdminController.admin(request);
    }

    @GetMapping("/reports")
    public Paged<ReportGroupRow> reports(
            @RequestParam(defaultValue = "OPEN") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return reportService.groups(!"ALL".equalsIgnoreCase(status), page, Math.min(Math.max(size, 1), 100));
    }

    @GetMapping("/reports/users/{userId}")
    public ReportCase reportCase(@PathVariable Long userId) {
        return reportService.reportCase(userId);
    }

    @GetMapping("/reports/{id}/evidence")
    public ResponseEntity<byte[]> evidence(@PathVariable Long id) {
        EvidenceContent evidence = reportService.evidence(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(evidence.contentType()))
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header("X-Content-Type-Options", "nosniff")
                .body(evidence.data());
    }

    @PostMapping("/users/{id}/moderation")
    public ModerationResult moderate(@PathVariable Long id, @Valid @RequestBody ModerationRequest body,
                                     HttpServletRequest request) {
        String action = switch (body.type()) {
            case WARNING -> "USER_WARN";
            case SUSPENSION -> "USER_SUSPEND";
            case BAN -> "USER_BAN";
        };
        String detail = "type=" + body.type() + " days=" + body.days() + " reasons=" + body.reasons()
                + " removeAvatar=" + body.removeAvatar() + " clearBio=" + body.clearBio()
                + " messages=" + body.deleteMessageIds() + " reports=" + body.reportIds()
                + " note=" + body.note();
        auditService.record(AdminController.admin(request), request, action, "user:" + id, detail);
        return moderationService.apply(AdminController.admin(request), id, body);
    }

    @PostMapping("/users/{id}/moderation/lift")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lift(@PathVariable Long id, HttpServletRequest request) {
        auditService.record(AdminController.admin(request), request, "USER_LIFT", "user:" + id, null);
        moderationService.lift(AdminController.admin(request), id);
    }

    @PostMapping("/users/{id}/reports/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(@PathVariable Long id, @Valid @RequestBody(required = false) DismissRequest body,
                        HttpServletRequest request) {
        auditService.record(AdminController.admin(request), request, "REPORTS_DISMISS", "user:" + id,
                "reports=" + (body == null ? null : body.reportIds()));
        moderationService.dismiss(AdminController.admin(request), id, body == null ? null : body.reportIds());
    }
}
