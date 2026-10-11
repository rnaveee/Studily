package com.rnave.studily.flashcard;

import com.rnave.studily.flashcard.FlashcardDtos.SetPagePreview;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RadialGradientPaint;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.font.FontRenderContext;
import java.awt.font.TextAttribute;
import java.awt.font.TextLayout;
import java.awt.geom.AffineTransform;
import java.awt.geom.Ellipse2D;
import java.awt.geom.Path2D;
import java.awt.geom.Point2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.text.AttributedString;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SetPreviewImage {

    public static final int WIDTH = 1200;
    public static final int HEIGHT = 630;
    private static final int DESIGN = 1;

    private static final int CARD_X = 96;
    private static final int CARD_Y = 64;
    private static final int CARD_W = WIDTH - CARD_X * 2;
    private static final int CARD_H = 400;
    private static final int CARD_RADIUS = 40;
    private static final int PAD = 60;

    private static final Color INK = new Color(0x13, 0x14, 0x2e);
    private static final Color MUTED = new Color(0x6b, 0x6f, 0x8a);
    private static final Color ACCENT = new Color(0x63, 0x66, 0xf1);
    private static final Color LAVENDER = new Color(0xa5, 0xb4, 0xfc);

    private static final Font HEAVY = load("og/Inter-ExtraBold.ttf");
    private static final Font SEMI = load("og/Inter-SemiBold.ttf");

    private static final Pattern PATH_TOKEN = Pattern.compile("[MCLZ]|-?\\d*\\.?\\d+");
    private static final String[][] LOGO = {
            {"M72 116 C46 100 36 64 38 30 C58 60 72 92 86 110 Z", "#4f46e5"},
            {"M80 118 C60 102 52 74 60 34 C72 64 82 92 94 112 Z", "#7c83f3"},
            {"M88 120 C74 104 72 78 82 42 C88 70 96 94 102 114 Z", "#a5b4fc"},
            {"M74 132 C74 150 86 158 100 158 C114 158 126 150 126 132 L126 118 L100 130 L74 118 Z", "#4f46e5"},
            {"M100 90 L164 120 L100 150 L36 120 Z", "#818cf8"},
            {"M100 90 L164 120 L100 150 Z", "#6f77f0"},
    };
    private static final String LOGO_RIM = "M100 96 L152 120 L100 144 L48 120 Z";

    static {
        ImageIO.setUseCache(false);
    }

    private SetPreviewImage() {}

    public static String version(SetPagePreview p) {
        return Integer.toHexString(Objects.hash(DESIGN, cacheKey(p)));
    }

    static String cacheKey(SetPagePreview p) {
        return String.join("\u0000", String.valueOf(p.title()), String.valueOf(p.cardCount()),
                String.valueOf(p.courseCode()), String.valueOf(p.courseName()), String.valueOf(p.courseColor()));
    }

    public static byte[] render(SetPagePreview p) {
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);

            paintBackground(g);
            paintDeck(g);

            int left = CARD_X + PAD;
            int width = CARD_W - PAD * 2;
            int chipBottom = paintChip(g, p, left, CARD_Y + PAD, width);
            int countTop = paintCount(g, p.cardCount(), left, CARD_Y + CARD_H - PAD);
            paintTitle(g, p.title(), left, chipBottom + 24, width, countTop - 24);
            paintBrand(g);
        } finally {
            g.dispose();
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            ImageIO.write(img, "png", out);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toByteArray();
    }

    private static void paintBackground(Graphics2D g) {
        g.setPaint(new RadialGradientPaint(new Point2D.Float(WIDTH / 2f, HEIGHT * 0.42f), WIDTH * 0.62f,
                new float[]{0f, 1f}, new Color[]{new Color(0x1f, 0x1e, 0x46), new Color(0x0d, 0x0d, 0x1c)}));
        g.fillRect(0, 0, WIDTH, HEIGHT);
    }

    private static void paintDeck(Graphics2D g) {
        g.setColor(new Color(0x37, 0x30, 0xa3));
        g.fill(card(CARD_X + 56, CARD_Y + 40, CARD_W - 112));
        g.setColor(new Color(0x63, 0x66, 0xf1));
        g.fill(card(CARD_X + 28, CARD_Y + 20, CARD_W - 56));
        for (int i = 1; i <= 6; i++) {
            g.setColor(new Color(0, 0, 0, 10));
            g.fill(card(CARD_X - i, CARD_Y + i * 2, CARD_W + i * 2));
        }
        g.setColor(Color.WHITE);
        g.fill(card(CARD_X, CARD_Y, CARD_W));
    }

    private static Shape card(int x, int y, int w) {
        return new RoundRectangle2D.Float(x, y, w, CARD_H, CARD_RADIUS * 2, CARD_RADIUS * 2);
    }

    private static int paintChip(Graphics2D g, SetPagePreview p, int x, int y, int maxWidth) {
        String course = courseLabel(p);
        Color base = course == null ? ACCENT : parseColor(p.courseColor());
        String label = course == null ? "Flashcard set" : course;
        int height = 54;
        int padX = 24;
        int dot = 16;
        int gap = 14;
        Font font = styled(SEMI, 26f, 0);
        FontRenderContext frc = g.getFontRenderContext();
        String text = ellipsize(label, font, frc, maxWidth - padX * 2 - dot - gap);
        TextLayout chip = layout(text, font, frc);
        int width = padX * 2 + dot + gap + (int) Math.ceil(chip.getAdvance());

        g.setColor(mix(base, Color.WHITE, 0.13));
        g.fill(new RoundRectangle2D.Float(x, y, width, height, height, height));
        g.setColor(base);
        g.fill(new Ellipse2D.Float(x + padX, y + (height - dot) / 2f, dot, dot));
        g.setColor(mix(base, INK, 0.5));
        chip.draw(g, x + padX + dot + gap, y + height / 2f + capHeight(font, frc) / 2f);
        return y + height;
    }

    private static int paintCount(Graphics2D g, int count, int x, int bottom) {
        Font font = styled(SEMI, 26f, 0);
        FontRenderContext frc = g.getFontRenderContext();
        float cap = capHeight(font, frc);
        String text = count == 1 ? "1 card" : count + " cards";
        int icon = 26;
        float iconY = bottom - cap / 2f - icon / 2f;
        g.setStroke(new BasicStroke(2.6f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g.setColor(mix(MUTED, Color.WHITE, 0.45));
        g.draw(new RoundRectangle2D.Float(x + 6, iconY, icon - 6, icon - 8, 7, 7));
        g.setColor(Color.WHITE);
        g.fill(new RoundRectangle2D.Float(x, iconY + 6, icon - 6, icon - 8, 7, 7));
        g.setColor(MUTED);
        g.draw(new RoundRectangle2D.Float(x, iconY + 6, icon - 6, icon - 8, 7, 7));
        layout(text, font, frc).draw(g, x + icon + 12, bottom);
        return Math.round(bottom - cap);
    }

    private static void paintTitle(Graphics2D g, String title, int x, int top, int width, int bottom) {
        String text = title == null || title.isBlank() ? "Untitled set" : title.strip().replaceAll("\\s+", " ");
        FontRenderContext frc = g.getFontRenderContext();
        Font font = null;
        List<String> lines = null;
        float lineHeight = 0;
        for (float size = 78f; size >= 46f; size -= 2f) {
            font = styled(HEAVY, size, -0.025f);
            lineHeight = size * 1.12f;
            lines = wrap(text, font, frc, width);
            if (lines.size() <= 3 && lines.size() * lineHeight <= bottom - top) break;
        }
        int maxLines = Math.max(1, Math.min(3, (int) ((bottom - top) / lineHeight)));
        if (lines.size() > maxLines) {
            List<String> kept = new ArrayList<>(lines.subList(0, maxLines));
            String rest = String.join(" ", lines.subList(maxLines - 1, lines.size()));
            kept.set(maxLines - 1, ellipsize(rest + "…", font, frc, width));
            lines = kept;
        }

        float cap = capHeight(font, frc);
        float blockHeight = (lines.size() - 1) * lineHeight + cap;
        float baseline = top + ((bottom - top) - blockHeight) / 2f + cap;
        g.setColor(INK);
        for (String line : lines) {
            layout(line, font, frc).draw(g, x, baseline);
            baseline += lineHeight;
        }
    }

    private static void paintBrand(Graphics2D g) {
        double scale = 0.5;
        float centerY = (CARD_Y + CARD_H + 40 + HEIGHT) / 2f;
        AffineTransform saved = g.getTransform();
        g.translate(CARD_X - 36 * scale, centerY - 94 * scale);
        g.scale(scale, scale);
        for (String[] part : LOGO) {
            g.setColor(Color.decode(part[1]));
            g.fill(path(part[0]));
        }
        g.setStroke(new BasicStroke(2.5f));
        g.setColor(new Color(0xa5, 0xb4, 0xfc, 140));
        g.draw(path(LOGO_RIM));
        g.setTransform(saved);

        FontRenderContext frc = g.getFontRenderContext();
        Font word = styled(HEAVY, 40f, -0.02f);
        float baseline = centerY + capHeight(word, frc) / 2f;
        g.setColor(Color.WHITE);
        new TextLayout("Studily", word, frc).draw(g, (float) (CARD_X + 128 * scale + 16), baseline);

        Font site = styled(SEMI, 26f, 0);
        TextLayout siteLayout = new TextLayout("studily.ca", site, frc);
        g.setColor(LAVENDER);
        siteLayout.draw(g, CARD_X + CARD_W - siteLayout.getAdvance(), baseline);
    }

    static String courseLabel(SetPagePreview p) {
        String code = p.courseCode() == null ? "" : p.courseCode().strip();
        String name = p.courseName() == null ? "" : p.courseName().strip();
        if (code.isEmpty()) return name.isEmpty() ? null : name;
        if (name.isEmpty() || name.equalsIgnoreCase(code)) return code;
        return code + " · " + name;
    }

    static List<String> wrap(String text, Font font, FontRenderContext frc, float width) {
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split(" ")) {
            String candidate = line.isEmpty() ? word : line + " " + word;
            if (advance(candidate, font, frc) <= width) {
                line.setLength(0);
                line.append(candidate);
                continue;
            }
            if (!line.isEmpty()) {
                lines.add(line.toString());
                line.setLength(0);
            }
            String rest = word;
            while (advance(rest, font, frc) > width) {
                int cut = rest.offsetByCodePoints(0, 1);
                while (cut < rest.length() && advance(rest.substring(0, rest.offsetByCodePoints(cut, 1)), font, frc) <= width) {
                    cut = rest.offsetByCodePoints(cut, 1);
                }
                lines.add(rest.substring(0, cut));
                rest = rest.substring(cut);
            }
            line.append(rest);
        }
        if (!line.isEmpty()) lines.add(line.toString());
        return lines;
    }

    private static String ellipsize(String text, Font font, FontRenderContext frc, float width) {
        if (advance(text, font, frc) <= width) return text;
        String base = text.endsWith("…") ? text.substring(0, text.length() - 1) : text;
        int end = base.length();
        while (end > 0) {
            end = base.offsetByCodePoints(end, -1);
            String candidate = base.substring(0, end).stripTrailing() + "…";
            if (advance(candidate, font, frc) <= width) return candidate;
        }
        return "…";
    }

    private static float advance(String text, Font font, FontRenderContext frc) {
        return text.isEmpty() ? 0 : layout(text, font, frc).getAdvance();
    }

    private static TextLayout layout(String text, Font font, FontRenderContext frc) {
        AttributedString attributed = new AttributedString(text);
        attributed.addAttribute(TextAttribute.FONT, font);
        if (font.canDisplayUpTo(text) != -1) {
            Font fallback = new Font(Map.of(
                    TextAttribute.FAMILY, Font.SANS_SERIF,
                    TextAttribute.WEIGHT, TextAttribute.WEIGHT_BOLD,
                    TextAttribute.SIZE, font.getSize2D()));
            for (int i = 0; i < text.length(); ) {
                int cp = text.codePointAt(i);
                int next = i + Character.charCount(cp);
                if (!font.canDisplay(cp)) attributed.addAttribute(TextAttribute.FONT, fallback, i, next);
                i = next;
            }
        }
        return new TextLayout(attributed.getIterator(), frc);
    }

    private static float capHeight(Font font, FontRenderContext frc) {
        return (float) font.createGlyphVector(frc, "H").getVisualBounds().getHeight();
    }

    private static Font styled(Font font, float size, float tracking) {
        return font.deriveFont(Map.of(
                TextAttribute.SIZE, size,
                TextAttribute.TRACKING, tracking,
                TextAttribute.KERNING, TextAttribute.KERNING_ON,
                TextAttribute.LIGATURES, TextAttribute.LIGATURES_ON));
    }

    private static Color parseColor(String hex) {
        if (hex == null || !hex.strip().matches("#?[0-9a-fA-F]{6}")) return ACCENT;
        String digits = hex.strip().replace("#", "");
        return new Color(Integer.parseInt(digits, 16));
    }

    private static Color mix(Color color, Color toward, double amount) {
        return new Color(
                (int) Math.round(color.getRed() * amount + toward.getRed() * (1 - amount)),
                (int) Math.round(color.getGreen() * amount + toward.getGreen() * (1 - amount)),
                (int) Math.round(color.getBlue() * amount + toward.getBlue() * (1 - amount)));
    }

    private static Path2D path(String d) {
        Matcher m = PATH_TOKEN.matcher(d);
        List<String> tokens = new ArrayList<>();
        while (m.find()) tokens.add(m.group());
        Path2D.Float path = new Path2D.Float();
        int i = 0;
        while (i < tokens.size()) {
            String cmd = tokens.get(i++);
            switch (cmd) {
                case "M" -> path.moveTo(num(tokens, i), num(tokens, i + 1));
                case "L" -> path.lineTo(num(tokens, i), num(tokens, i + 1));
                case "C" -> path.curveTo(num(tokens, i), num(tokens, i + 1), num(tokens, i + 2),
                        num(tokens, i + 3), num(tokens, i + 4), num(tokens, i + 5));
                default -> path.closePath();
            }
            i += switch (cmd) {
                case "M", "L" -> 2;
                case "C" -> 6;
                default -> 0;
            };
        }
        return path;
    }

    private static float num(List<String> tokens, int i) {
        return Float.parseFloat(tokens.get(i));
    }

    private static Font load(String resource) {
        try (InputStream in = SetPreviewImage.class.getClassLoader().getResourceAsStream(resource)) {
            if (in != null) return Font.createFont(Font.TRUETYPE_FONT, in);
        } catch (Exception ignored) {
        }
        return new Font(Font.SANS_SERIF, Font.BOLD, 1);
    }
}
