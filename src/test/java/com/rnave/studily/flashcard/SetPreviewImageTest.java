package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.SetPagePreview;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Font;
import java.awt.font.FontRenderContext;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class SetPreviewImageTest {

    private static SetPagePreview preview(String title, String code, String name, String color) {
        return new SetPagePreview(7L, title, null, "Ryan", "ryan", 12, code, name, color);
    }

    @Test
    void rendersOpenGraphSizedPng() throws IOException {
        byte[] png = SetPreviewImage.render(preview("Cell Biology", "BIOL 101", "Intro to Biology", "#10b981"));

        BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));
        assertThat(image.getWidth()).isEqualTo(1200);
        assertThat(image.getHeight()).isEqualTo(630);
    }

    @Test
    void rendersWithoutCourseAndWithOddInput() {
        assertThat(SetPreviewImage.render(preview("x".repeat(400), null, null, "not-a-color"))).isNotEmpty();
        assertThat(SetPreviewImage.render(preview("  ", "", "", null))).isNotEmpty();
        assertThat(SetPreviewImage.render(preview("Café 化学 🧪", "JAPN 110", "Japanese I", "#ef4444"))).isNotEmpty();
    }

    @Test
    void labelsCourseByCodeAndName() {
        assertThat(SetPreviewImage.courseLabel(preview("t", "BIOL 101", "Intro to Biology", null)))
                .isEqualTo("BIOL 101 · Intro to Biology");
        assertThat(SetPreviewImage.courseLabel(preview("t", "PSYC 100", "psyc 100", null))).isEqualTo("PSYC 100");
        assertThat(SetPreviewImage.courseLabel(preview("t", null, "Chemistry", null))).isEqualTo("Chemistry");
        assertThat(SetPreviewImage.courseLabel(preview("t", " ", null, null))).isNull();
    }

    @Test
    void versionChangesWithVisibleContent() {
        String base = SetPreviewImage.version(preview("Cells", "BIOL 101", "Bio", "#10b981"));

        assertThat(SetPreviewImage.version(preview("Cells", "BIOL 101", "Bio", "#10b981"))).isEqualTo(base);
        assertThat(SetPreviewImage.version(preview("Cells 2", "BIOL 101", "Bio", "#10b981"))).isNotEqualTo(base);
        assertThat(SetPreviewImage.version(preview("Cells", "BIOL 101", "Bio", "#3b82f6"))).isNotEqualTo(base);
    }

    @Test
    void wrapsLongWordsToWidth() {
        Font font = new Font(Font.SANS_SERIF, Font.BOLD, 40);
        FontRenderContext frc = new FontRenderContext(null, true, true);

        assertThat(SetPreviewImage.wrap("a".repeat(200), font, frc, 300))
                .hasSizeGreaterThan(1)
                .allSatisfy(line -> assertThat(font.getStringBounds(line, frc).getWidth()).isLessThanOrEqualTo(300.5));
    }
}
