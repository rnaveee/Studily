package com.rnave.studily.admin;

import com.rnave.studily.admin.AdminDtos.AdminStatus;
import com.rnave.studily.admin.AdminDtos.AuditRow;
import com.rnave.studily.admin.AdminDtos.BroadcastRequest;
import com.rnave.studily.admin.AdminDtos.BroadcastResult;
import com.rnave.studily.admin.AdminDtos.ColumnInfo;
import com.rnave.studily.admin.AdminDtos.GrowthPoint;
import com.rnave.studily.admin.AdminDtos.Health;
import com.rnave.studily.admin.AdminDtos.Overview;
import com.rnave.studily.admin.AdminDtos.Paged;
import com.rnave.studily.admin.AdminDtos.QueryRequest;
import com.rnave.studily.admin.AdminDtos.QueryResult;
import com.rnave.studily.admin.AdminDtos.ResetLink;
import com.rnave.studily.admin.AdminDtos.TableInfo;
import com.rnave.studily.admin.AdminDtos.TableRows;
import com.rnave.studily.admin.AdminDtos.TotpSetup;
import com.rnave.studily.admin.AdminDtos.UnlockRequest;
import com.rnave.studily.admin.AdminDtos.UnlockResponse;
import com.rnave.studily.admin.AdminDtos.UserDetail;
import com.rnave.studily.admin.AdminDtos.UserRow;
import com.rnave.studily.config.BadRequestException;
import com.rnave.studily.config.GlobalRateLimitFilter;
import com.rnave.studily.config.SlidingWindowRateLimiter;
import com.rnave.studily.config.TooManyRequestsException;
import com.rnave.studily.config.UnauthorizedException;
import com.rnave.studily.user.User;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final long UNLOCK_WINDOW_MS = 15 * 60_000;

    private final AdminSessionService sessionService;
    private final AdminAnalyticsService analyticsService;
    private final AdminDbService dbService;
    private final AdminUserService userService;
    private final AdminOpsService opsService;
    private final AdminAuditService auditService;
    private final PasswordEncoder passwordEncoder;

    private final SlidingWindowRateLimiter unlockLimiter = new SlidingWindowRateLimiter(5, UNLOCK_WINDOW_MS);

    public AdminController(AdminSessionService sessionService, AdminAnalyticsService analyticsService,
                           AdminDbService dbService, AdminUserService userService,
                           AdminOpsService opsService, AdminAuditService auditService,
                           PasswordEncoder passwordEncoder) {
        this.sessionService = sessionService;
        this.analyticsService = analyticsService;
        this.dbService = dbService;
        this.userService = userService;
        this.opsService = opsService;
        this.auditService = auditService;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/status")
    public AdminStatus status(HttpServletRequest request) {
        User admin = admin(request);
        var session = session(request);
        return new AdminStatus(
                session != null,
                sessionService.totpEnabled(),
                session == null ? null : session.expiresAt(),
                sessionService.sessionMs(),
                admin.getUsername());
    }

    @PostMapping("/session")
    public UnlockResponse unlock(@RequestBody UnlockRequest body, HttpServletRequest request) {
        User admin = admin(request);
        String key = GlobalRateLimitFilter.clientIp(request);
        if (!unlockLimiter.tryConsume(key)) {
            auditService.record(admin, request, "ADMIN_UNLOCK_THROTTLED", null, null);
            throw new TooManyRequestsException("Too many unlock attempts. Try again in 15 minutes.");
        }
        if (body.password() == null || !passwordEncoder.matches(body.password(), admin.getPasswordHash())) {
            auditService.record(admin, request, "ADMIN_UNLOCK_FAILED", "bad password", null);
            throw new UnauthorizedException("Incorrect password");
        }
        if (sessionService.totpEnabled() && !sessionService.verifyTotp(body.code())) {
            auditService.record(admin, request, "ADMIN_UNLOCK_FAILED", "bad 2FA code", null);
            throw new UnauthorizedException("Incorrect authenticator code");
        }
        var issued = sessionService.issue(admin);
        auditService.record(admin, request, "ADMIN_UNLOCK", null, null);
        return new UnlockResponse(issued.token(), issued.expiresAt());
    }

    @DeleteMapping("/session")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void lock(HttpServletRequest request) {
        sessionService.revokeAll();
        auditService.record(admin(request), request, "ADMIN_LOCK", null, null);
    }

    @PostMapping("/totp/setup")
    public TotpSetup totpSetup(HttpServletRequest request) {
        User admin = admin(request);
        String secret = Totp.randomSecret();
        auditService.record(admin, request, "ADMIN_TOTP_SETUP", null, "generated a new secret");
        return new TotpSetup(secret, Totp.provisioningUri(secret, admin.getUsername(), "Studily Admin"));
    }

    @GetMapping("/overview")
    public Overview overview() {
        return analyticsService.overview();
    }

    @GetMapping("/growth")
    public List<GrowthPoint> growth(@RequestParam(defaultValue = "30") int days) {
        return analyticsService.growth(days);
    }

    @GetMapping("/health")
    public Health health() {
        return opsService.health();
    }

    @GetMapping("/users")
    public Paged<UserRow> users(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "recent") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return userService.search(q, sort, page, size);
    }

    @GetMapping("/users/{id}")
    public UserDetail user(@PathVariable Long id) {
        return userService.detail(id);
    }

    @PostMapping("/users/{id}/verify-email")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@PathVariable Long id, @RequestParam(defaultValue = "true") boolean verified,
                            HttpServletRequest request) {
        userService.setEmailVerified(id, verified);
        auditService.record(admin(request), request, "USER_SET_VERIFIED", "user:" + id,
                "verified=" + verified);
    }

    @PostMapping("/users/{id}/reset-link")
    public ResetLink resetLink(@PathVariable Long id, HttpServletRequest request) {
        auditService.record(admin(request), request, "USER_RESET_LINK", "user:" + id, null);
        return userService.resetLink(id);
    }

    @PostMapping("/users/{id}/verify-link")
    public ResetLink verifyLink(@PathVariable Long id, HttpServletRequest request) {
        auditService.record(admin(request), request, "USER_VERIFY_LINK", "user:" + id, null);
        return userService.verifyLink(id);
    }

    @PostMapping("/users/{id}/revoke-sessions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeSessions(@PathVariable Long id, HttpServletRequest request) {
        userService.revokeSessions(id);
        auditService.record(admin(request), request, "USER_REVOKE_SESSIONS", "user:" + id, null);
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable Long id, HttpServletRequest request) {
        auditService.record(admin(request), request, "USER_DELETE", "user:" + id, null);
        userService.delete(id);
    }

    @GetMapping("/db/tables")
    public List<TableInfo> tables() {
        return dbService.tables();
    }

    @GetMapping("/db/tables/{table}")
    public TableRows tableRows(
            @PathVariable String table,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String orderBy,
            @RequestParam(defaultValue = "desc") String dir,
            @RequestParam(required = false) String q) {
        return dbService.browse(table, page, size, orderBy, dir, q);
    }

    @GetMapping("/db/tables/{table}/columns")
    public List<ColumnInfo> tableColumns(@PathVariable String table) {
        return dbService.columns(table);
    }

    @PutMapping("/db/tables/{table}/rows/{id}")
    public Map<String, Object> updateRow(
            @PathVariable String table,
            @PathVariable String id,
            @RequestBody Map<String, Object> changes,
            HttpServletRequest request) {
        int affected = dbService.updateRow(table, id, changes);
        auditService.record(admin(request), request, "DB_ROW_UPDATE", table + "#" + id, changes.toString());
        return Map.of("rowsAffected", affected);
    }

    @DeleteMapping("/db/tables/{table}/rows/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRow(@PathVariable String table, @PathVariable String id, HttpServletRequest request) {
        dbService.deleteRow(table, id);
        auditService.record(admin(request), request, "DB_ROW_DELETE", table + "#" + id, null);
    }

    @GetMapping("/db/tables/{table}/export")
    public ResponseEntity<byte[]> exportTable(@PathVariable String table, HttpServletRequest request) {
        String csv = dbService.csv(table);
        auditService.record(admin(request), request, "DB_EXPORT", table, null);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + table + ".csv\"")
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/db/query")
    public QueryResult query(@RequestBody QueryRequest body, HttpServletRequest request) {
        boolean read = dbService.isRead(body.sql());
        if (!read) {
            auditService.record(admin(request), request, "DB_QUERY_WRITE", null, body.sql());
        }
        QueryResult result = dbService.query(body.sql(), body.write());
        if (read) {
            auditService.record(admin(request), request, "DB_QUERY_READ", null, body.sql());
        }
        return result;
    }

    @PostMapping("/broadcast")
    public BroadcastResult broadcast(@RequestBody BroadcastRequest body, HttpServletRequest request) {
        BroadcastResult result = opsService.broadcast(body);
        auditService.record(admin(request), request, "BROADCAST", body.title(),
                result.recipients() + " recipients: " + body.body());
        return result;
    }

    @GetMapping("/audit")
    public Paged<AuditRow> audit(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return opsService.audit(page, size);
    }

    private static User admin(HttpServletRequest request) {
        Object user = request.getAttribute(AdminAuthFilter.USER_ATTRIBUTE);
        if (user instanceof User resolved) {
            return resolved;
        }
        throw new BadRequestException("Admin context missing");
    }

    private static AdminSessionService.Parsed session(HttpServletRequest request) {
        Object session = request.getAttribute(AdminAuthFilter.SESSION_ATTRIBUTE);
        return session instanceof AdminSessionService.Parsed parsed ? parsed : null;
    }

    @Scheduled(fixedRate = 10 * UNLOCK_WINDOW_MS)
    void evictStale() {
        unlockLimiter.evictStale();
    }
}
