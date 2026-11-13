package com.rnave.studily.referral;

import com.rnave.studily.config.SpaPages;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Controller
public class InvitePageController {

    private final ReferralService referralService;
    private final SpaPages spaPages;
    private final String baseUrl;

    public InvitePageController(ReferralService referralService, SpaPages spaPages,
                                @Value("${app.base-url}") String baseUrl) {
        this.referralService = referralService;
        this.spaPages = spaPages;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    @GetMapping(value = "/invite/{code}", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public ResponseEntity<String> page(@PathVariable String code) {
        String html = spaPages.shell().orElse(null);
        if (html == null) {
            return ResponseEntity.notFound().build();
        }
        String normalized = code.trim().toUpperCase(Locale.ROOT);
        String body = referralService.invite(normalized)
                .map(invite -> InvitePageMeta.render(html, invite.inviterName(), baseUrl + "/invite/" + normalized,
                        baseUrl + "/api/public/invites/" + normalized + "/preview.png?v="
                                + InvitePreviewImage.version(invite.inviterName())))
                .orElse(html);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .body(body);
    }
}
