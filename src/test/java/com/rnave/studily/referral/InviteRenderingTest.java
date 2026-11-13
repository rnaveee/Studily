package com.rnave.studily.referral;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;

import static org.assertj.core.api.Assertions.assertThat;

class InviteRenderingTest {

    private static final String SHELL = """
            <html><head><title>Studily: Your whole semester on one screen</title>
            <meta name="description" content="old" />
            <meta property="og:title" content="old" />
            <meta property="og:description" content="old" />
            <meta property="og:url" content="old" />
            <meta property="og:image" content="old" />
            <meta property="og:image:alt" content="old" />
            <meta name="twitter:title" content="old" />
            <meta name="twitter:description" content="old" />
            <meta name="twitter:image" content="old" />
            </head><body></body></html>
            """;

    @Test
    void previewIsA1200By630Png() throws Exception {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(InvitePreviewImage.png("Ada Lovelace")));

        assertThat(image.getWidth()).isEqualTo(1200);
        assertThat(image.getHeight()).isEqualTo(630);
    }

    @Test
    void previewSurvivesVeryLongAndNonLatinNames() throws Exception {
        String longName = "Bartholomew ".repeat(30) + "学生";

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(InvitePreviewImage.render(longName)));

        assertThat(image.getWidth()).isEqualTo(1200);
    }

    @Test
    void versionChangesWithTheName() {
        assertThat(InvitePreviewImage.version("Ada")).isNotEqualTo(InvitePreviewImage.version("Grace"));
    }

    @Test
    void pageMetaRewritesTitleAndSocialTagsAndEscapesTheName() {
        String html = InvitePageMeta.render(SHELL, "Ada <b>\"Lovelace\"", "https://studily.ca/invite/ABCD2345",
                "https://studily.ca/api/public/invites/ABCD2345/preview.png?v=1");

        assertThat(html).contains("<title>Ada &lt;b&gt;&quot;Lovelace&quot; invited you to Studily</title>");
        assertThat(html).contains("<meta property=\"og:url\" content=\"https://studily.ca/invite/ABCD2345\" />");
        assertThat(html).contains("content=\"https://studily.ca/api/public/invites/ABCD2345/preview.png?v=1\"");
        assertThat(html).doesNotContain("content=\"old\"");
        assertThat(html).doesNotContain("<b>");
    }
}
