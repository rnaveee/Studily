import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SVG_DIR = HERE / "svg"
PNG_DIR = HERE / "export" / "png"
WEBP_DIR = HERE / "export" / "webp"
CHROME = Path.home() / ".cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell"

OUT = "#1d1a33"
SW = 10

MATERIALS = {
    "wood": dict(light="#C99A66", base="#A26F40", dark="#7A4F2A", deep="#573619", hi="#E2C29A", motif="wood"),
    "bronze": dict(light="#FFB877", base="#E8873A", dark="#B85E1C", deep="#7E3A0C", hi="#FFE3C4", motif="metal"),
    "silver": dict(light="#F4F7FB", base="#CBD3DE", dark="#98A3B4", deep="#677285", hi="#FFFFFF", motif="metal"),
    "gold": dict(light="#FFE57F", base="#F7C531", dark="#D49A10", deep="#9C6A04", hi="#FFF7C9", motif="metal"),
    "diamond": dict(light="#E6FBFF", base="#A3E8FF", dark="#5EC6EC", deep="#2B8FC2", hi="#FFFFFF", motif="gem"),
    "ruby": dict(light="#FF8FA5", base="#E22B4C", dark="#AA1130", deep="#6E0A1F", hi="#FFC6D1", motif="gem"),
    "obsidian": dict(light="#3E3856", base="#221E31", dark="#15121F", deep="#08070D", hi="#8C82B8", motif="obsidian"),
}

TIER_LABEL = {
    "wood": "Wood", "bronze": "Bronze", "silver": "Silver", "gold": "Gold",
    "diamond": "Diamond", "ruby": "Ruby", "obsidian": "Rainbow obsidian",
}

BADGES = [
    ("level_1", "wood", "arrow", "LV 1"),
    ("level_5", "bronze", "arrow", "LV 5"),
    ("level_10", "silver", "arrow", "LV 10"),
    ("level_20", "gold", "arrow", "LV 20"),
    ("level_30", "diamond", "arrow", "LV 30"),
    ("level_50", "ruby", "arrow", "LV 50"),
    ("level_75", "ruby", "arrow", "LV 75"),
    ("level_100", "obsidian", "arrow", "LV 100"),
    ("first_session", "wood", "brain", "FIRST"),
    ("hours_10", "silver", "brain", "10 HRS"),
    ("streak_7", "gold", "brain", "7 DAY"),
    ("hours_100", "diamond", "brain", "100 HRS"),
    ("streak_30", "ruby", "brain", "30 DAY"),
    ("runs_10", "bronze", "cards", "10 RUNS"),
    ("runs_100", "gold", "cards", "100 RUNS"),
    ("friends_5", "bronze", "people", "5 FRIENDS"),
    ("friends_10", "silver", "people", "10 FRIENDS"),
    ("friends_20", "gold", "people", "POPULAR"),
    ("friends_50", "diamond", "people", "FAMOUS"),
    ("schoolmates_10", "silver", "people", "SCHOOL"),
    ("member_1m", "bronze", "bicep", "1 MONTH"),
    ("member_6m", "gold", "bicep", "6 MONTHS"),
    ("member_1y", "diamond", "bicep", "1 YEAR"),
    ("og", "obsidian", "double_bicep", "OG"),
    ("cosmetic_spark", "silver", "spark", "SPARK"),
    ("cosmetic_comet", "gold", "comet", "COMET"),
    ("cosmetic_crown", "ruby", "crown", "CROWN"),
]

FACE = "M56 300 L256 150 L456 300 L256 450 Z"
RAINBOW = ["#FF5A6E", "#FF9F43", "#FFE066", "#4CD964", "#4CB8F0", "#8E7CFF", "#E05CFF"]


def defs(m):
    stops = "".join(
        f'<stop offset="{i / (len(RAINBOW) - 1):.3f}" stop-color="{c}"/>' for i, c in enumerate(RAINBOW)
    )
    return f"""<defs>
<clipPath id="face"><path d="{FACE}"/></clipPath>
<linearGradient id="faceL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{m['light']}"/><stop offset="1" stop-color="{m['base']}"/></linearGradient>
<linearGradient id="faceR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{m['base']}"/><stop offset="1" stop-color="{m['dark']}"/></linearGradient>
<linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="0">{stops}</linearGradient>
<linearGradient id="rainbowV" x1="0" y1="0" x2="1" y2="1">{stops}</linearGradient>
</defs>"""


def leaves(m):
    shapes = [
        ("M150 300 C78 246 50 140 60 38 C120 128 160 214 198 276 Z", m["dark"]),
        ("M188 292 C128 238 110 158 128 52 C164 138 192 208 228 264 Z", m["base"]),
        ("M226 284 C180 234 176 166 198 82 C216 158 238 212 262 252 Z", m["light"]),
    ]
    out = []
    for d, fill in shapes:
        out.append(f'<path d="{d}" fill="{fill}" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>')
    if m["motif"] == "obsidian":
        out.append('<path d="M84 76 C96 150 128 214 168 262" fill="none" stroke="url(#rainbowV)" stroke-width="6" stroke-linecap="round" opacity="0.8"/>')
        out.append('<path d="M150 92 C160 160 186 210 214 248" fill="none" stroke="url(#rainbowV)" stroke-width="5" stroke-linecap="round" opacity="0.7"/>')
    return "".join(out)


def bowl(m):
    return (
        f'<path d="M168 318 L168 402 C168 466 210 494 256 494 C302 494 344 466 344 402 L344 318 Z" '
        f'fill="{m["dark"]}" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<path d="M190 430 C200 462 224 476 252 478" fill="none" stroke="{m["base"]}" stroke-width="8" stroke-linecap="round" opacity="0.8"/>'
    )


def motif(m):
    kind = m["motif"]
    if kind == "wood":
        return (
            f'<g clip-path="url(#face)" fill="none" stroke="{m["deep"]}" stroke-linecap="round" opacity="0.35">'
            '<path d="M70 280 C140 262 190 300 260 276 C330 252 380 290 450 270" stroke-width="7"/>'
            '<path d="M80 330 C150 312 210 350 280 326 C350 302 400 336 446 322" stroke-width="6"/>'
            '<path d="M150 220 C200 206 240 236 300 214" stroke-width="5"/>'
            '<path d="M170 390 C220 376 270 404 330 384" stroke-width="5"/>'
            '<ellipse cx="352" cy="262" rx="20" ry="11" stroke-width="5"/>'
            "</g>"
        )
    if kind == "metal":
        return (
            f'<g clip-path="url(#face)">'
            f'<path d="M96 300 L196 225 L236 255 L136 330 Z" fill="{m["hi"]}" opacity="0.55"/>'
            f'<path d="M150 340 L250 265 L266 277 L166 352 Z" fill="{m["hi"]}" opacity="0.4"/>'
            "</g>"
        )
    if kind == "gem":
        return (
            f'<g clip-path="url(#face)">'
            f'<path d="M136 300 L256 210 L376 300 L256 390 Z" fill="{m["light"]}" opacity="0.55"/>'
            f'<path d="M256 150 L256 210 M456 300 L376 300 M256 450 L256 390 M56 300 L136 300 '
            f'M156 225 L196 255 M356 225 L316 255 M356 375 L316 345 M156 375 L196 345" '
            f'stroke="{m["hi"]}" stroke-width="5" opacity="0.7" fill="none" stroke-linecap="round"/>'
            f'<path d="M136 300 L256 210 L256 300 Z" fill="{m["hi"]}" opacity="0.35"/>'
            "</g>"
            + sparkle(118, 262, 16, "#FFFFFF") + sparkle(392, 336, 11, "#FFFFFF")
        )
    return (
        '<g clip-path="url(#face)">'
        '<path d="M60 330 L250 188 L300 188 L110 330 Z" fill="url(#rainbow)" opacity="0.7"/>'
        '<path d="M170 410 L360 268 L392 268 L202 410 Z" fill="url(#rainbow)" opacity="0.55"/>'
        '<path d="M300 200 L336 226 L256 286 L220 260 Z" fill="url(#rainbow)" opacity="0.4"/>'
        "</g>"
        + sparkle(124, 270, 14, "#FFFFFF") + sparkle(388, 330, 10, "#E8E2FF") + sparkle(330, 214, 8, "#FFFFFF")
    )


def sparkle(x, y, r, color):
    k = r * 0.28
    return (
        f'<path d="M{x} {y - r} C{x + k} {y - k} {x + k} {y - k} {x + r} {y} C{x + k} {y + k} {x + k} {y + k} {x} {y + r} '
        f'C{x - k} {y + k} {x - k} {y + k} {x - r} {y} C{x - k} {y - k} {x - k} {y - k} {x} {y - r} Z" fill="{color}"/>'
    )


def frame(m):
    return (
        leaves(m)
        + bowl(m)
        + f'<path d="M56 300 L256 450 L456 300 L456 318 L256 468 L56 318 Z" fill="{m["deep"]}" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        + '<path d="M56 300 L256 150 L256 450 Z" fill="url(#faceL)"/>'
        + '<path d="M256 150 L456 300 L256 450 Z" fill="url(#faceR)"/>'
        + motif(m)
        + f'<path d="{FACE}" fill="none" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
    )


def icon_arrow():
    shape = "M256 84 L366 206 L304 206 L304 392 L208 392 L208 206 L146 206 Z"
    return (
        f'<path d="{shape}" fill="#3BD47F"/>'
        '<path d="M256 84 L366 206 L304 206 L304 392 L256 392 Z" fill="#22A85E"/>'
        '<path d="M230 218 L230 372" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" opacity="0.5"/>'
        '<path d="M250 112 L184 188" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="0.5"/>'
        f'<path d="{shape}" fill="none" stroke="{OUT}" stroke-width="{SW + 2}" stroke-linejoin="round"/>'
    )


BRAIN = [(206, 206, 50), (256, 186, 54), (306, 206, 50), (184, 258, 50), (328, 258, 50),
         (222, 300, 52), (290, 300, 52), (256, 252, 62)]


def icon_brain():
    outline = "".join(f'<circle cx="{x}" cy="{y}" r="{r + 11}" fill="{OUT}"/>' for x, y, r in BRAIN)
    shade = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#E25A8E"/>' for x, y, r in BRAIN)
    fill = "".join(f'<circle cx="{x - 4}" cy="{y - 5}" r="{r - 6}" fill="#FF8FBA"/>' for x, y, r in BRAIN)
    folds = (
        '<g fill="none" stroke="#C93E74" stroke-width="8" stroke-linecap="round">'
        '<path d="M256 150 C244 184 268 214 256 246 C244 280 266 310 256 344"/>'
        '<path d="M196 214 C212 198 234 206 232 226"/>'
        '<path d="M316 214 C300 198 278 206 280 226"/>'
        '<path d="M176 268 C192 252 214 260 212 280"/>'
        '<path d="M336 268 C320 252 298 260 300 280"/>'
        '<path d="M214 318 C224 306 240 310 240 324"/>'
        '<path d="M298 318 C288 306 272 310 272 324"/>'
        "</g>"
        '<ellipse cx="214" cy="178" rx="20" ry="12" fill="#FFFFFF" opacity="0.55" transform="rotate(-25 214 178)"/>'
    )
    return outline + shade + fill + folds


def icon_cards():
    back = (
        '<g transform="rotate(-14 222 252)">'
        f'<rect x="158" y="160" width="128" height="176" rx="18" fill="#FFE18A" stroke="{OUT}" stroke-width="{SW}"/>'
        '<rect x="158" y="160" width="128" height="40" rx="18" fill="#FFC93C"/>'
        f'<rect x="158" y="160" width="128" height="176" rx="18" fill="none" stroke="{OUT}" stroke-width="{SW}"/>'
        "</g>"
    )
    front = (
        '<g transform="rotate(9 292 246)">'
        f'<rect x="226" y="148" width="132" height="180" rx="18" fill="#FFFFFF"/>'
        '<rect x="332" y="148" width="26" height="180" rx="13" fill="#E4E2F4"/>'
        '<rect x="226" y="148" width="132" height="42" rx="18" fill="#7C6CFF"/>'
        '<rect x="226" y="172" width="132" height="18" fill="#7C6CFF"/>'
        '<g stroke="#7C6CFF" stroke-width="10" stroke-linecap="round">'
        '<path d="M250 222 L330 222"/><path d="M250 252 L316 252"/><path d="M250 282 L324 282"/>'
        "</g>"
        f'<rect x="226" y="148" width="132" height="180" rx="18" fill="none" stroke="{OUT}" stroke-width="{SW}"/>'
        "</g>"
    )
    return back + front


def person(hx, hy, hr, body, shade, fill, dark):
    return (
        f'<path d="{body}" fill="{fill}" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<path d="{shade}" fill="{dark}"/>'
        f'<path d="{body}" fill="none" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<circle cx="{hx}" cy="{hy}" r="{hr}" fill="{fill}" stroke="{OUT}" stroke-width="{SW}"/>'
        f'<path d="M{hx + hr * 0.15} {hy - hr + 4} A{hr - 4} {hr - 4} 0 0 1 {hx + hr - 4} {hy + hr * 0.2} '
        f'L{hx + hr * 0.45} {hy + hr * 0.1} Z" fill="{dark}" opacity="0.6"/>'
        f'<circle cx="{hx}" cy="{hy}" r="{hr}" fill="none" stroke="{OUT}" stroke-width="{SW}"/>'
        f'<ellipse cx="{hx - hr * 0.35}" cy="{hy - hr * 0.4}" rx="{hr * 0.28}" ry="{hr * 0.16}" fill="#FFFFFF" opacity="0.55" transform="rotate(-30 {hx - hr * 0.35} {hy - hr * 0.4})"/>'
    )


def icon_people():
    back = person(
        206, 182, 42,
        "M134 336 C134 268 168 240 206 240 C244 240 278 268 278 336 Z",
        "M206 240 C244 240 278 268 278 336 L244 336 C244 292 230 256 206 240 Z",
        "#3BC9DB", "#1E9EB0",
    )
    front = person(
        298, 206, 48,
        "M214 360 C214 286 254 260 298 260 C342 260 382 286 382 360 Z",
        "M298 260 C342 260 382 286 382 360 L342 360 C342 310 326 276 298 260 Z",
        "#FF9F43", "#E57A12",
    )
    return back + front


ARM = ("M16 128 C34 100 76 86 108 100 C118 104 124 110 128 116 L120 66 C112 46 118 24 138 22 "
       "C158 20 170 36 164 56 L184 148 C188 172 170 188 148 188 L16 184 Z")


def arm_shape():
    return (
        f'<path d="{ARM}" fill="#FFC83D"/>'
        '<path d="M16 162 L150 164 C170 164 182 156 184 148 C188 172 170 188 148 188 L16 184 Z" fill="#E9A10C"/>'
        '<path d="M160 62 L178 138" stroke="#E9A10C" stroke-width="7" stroke-linecap="round"/>'
        '<path d="M128 36 C136 31 148 31 155 36" fill="none" stroke="#E9A10C" stroke-width="6" stroke-linecap="round"/>'
        '<path d="M125 51 C133 46 146 46 153 51" fill="none" stroke="#E9A10C" stroke-width="6" stroke-linecap="round"/>'
        '<path d="M94 112 C106 118 114 128 116 140" fill="none" stroke="#E9A10C" stroke-width="6" stroke-linecap="round"/>'
        '<ellipse cx="64" cy="114" rx="20" ry="9" fill="#FFFFFF" opacity="0.55" transform="rotate(-14 64 114)"/>'
        f'<path d="{ARM}" fill="none" stroke="{OUT}" stroke-width="9" stroke-linejoin="round"/>'
    )


def icon_bicep():
    return f'<g transform="translate(258 250) scale(1.3) translate(-102 -100)">{arm_shape()}</g>'


def icon_double_bicep():
    right = f'<g transform="translate(340 250) scale(0.98) translate(-102 -100)">{arm_shape()}</g>'
    left = f'<g transform="translate(172 250) scale(-0.98 0.98) translate(-102 -100)">{arm_shape()}</g>'
    return left + right + sparkle(256, 128, 24, "#FFE066") + sparkle(256, 128, 11, "#FFFFFF")


def icon_spark():
    star = ("M256 104 C272 208 290 226 392 244 C290 262 272 280 256 384 C240 280 222 262 120 244 "
            "C222 226 240 208 256 104 Z")
    return (
        f'<path d="{star}" fill="#FFE066"/>'
        '<path d="M256 104 C272 208 290 226 392 244 C290 262 272 280 256 384 Z" fill="#F5B700"/>'
        f'<path d="{star}" fill="none" stroke="{OUT}" stroke-width="{SW + 2}" stroke-linejoin="round"/>'
        + sparkle(352, 150, 22, "#FFFFFF") + sparkle(168, 340, 16, "#FFF3B0")
    )


def icon_comet():
    tail = (
        '<path d="M276 250 C220 300 170 330 104 356 C176 344 232 322 298 276 Z" fill="#B5E9FF" stroke="#1d1a33" stroke-width="9" stroke-linejoin="round"/>'
        '<path d="M262 222 C214 252 170 270 118 284 C178 284 230 270 284 244 Z" fill="#7FD6FF" stroke="#1d1a33" stroke-width="9" stroke-linejoin="round"/>'
        '<path d="M296 280 C262 322 230 350 184 380 C244 364 280 338 318 296 Z" fill="#7FD6FF" stroke="#1d1a33" stroke-width="9" stroke-linejoin="round"/>'
    )
    head = (
        f'<circle cx="314" cy="222" r="66" fill="#4CB8F0" stroke="{OUT}" stroke-width="{SW + 2}"/>'
        '<path d="M314 156 A66 66 0 0 1 380 222 A66 66 0 0 1 340 282 A60 60 0 0 0 314 156 Z" fill="#2E93C4"/>'
        f'<circle cx="314" cy="222" r="66" fill="none" stroke="{OUT}" stroke-width="{SW + 2}"/>'
        '<ellipse cx="292" cy="196" rx="20" ry="12" fill="#FFFFFF" opacity="0.6" transform="rotate(-30 292 196)"/>'
    )
    return tail + head + sparkle(166, 160, 16, "#FFFFFF")


def icon_crown():
    crown = "M146 332 L164 176 L216 248 L256 140 L296 248 L348 176 L366 332 Z"
    return (
        f'<path d="{crown}" fill="#FFD24A"/>'
        '<path d="M256 140 L296 248 L348 176 L366 332 L256 332 Z" fill="#F2B705"/>'
        f'<path d="{crown}" fill="none" stroke="{OUT}" stroke-width="{SW + 2}" stroke-linejoin="round"/>'
        f'<rect x="142" y="300" width="228" height="52" rx="12" fill="#F2B705" stroke="{OUT}" stroke-width="{SW}"/>'
        f'<circle cx="198" cy="326" r="13" fill="#4CB8F0" stroke="{OUT}" stroke-width="6"/>'
        f'<circle cx="256" cy="326" r="15" fill="#3BD47F" stroke="{OUT}" stroke-width="6"/>'
        f'<circle cx="314" cy="326" r="13" fill="#8E7CFF" stroke="{OUT}" stroke-width="6"/>'
        f'<circle cx="164" cy="170" r="15" fill="#FFE066" stroke="{OUT}" stroke-width="7"/>'
        f'<circle cx="256" cy="132" r="17" fill="#FFE066" stroke="{OUT}" stroke-width="7"/>'
        f'<circle cx="348" cy="170" r="15" fill="#FFE066" stroke="{OUT}" stroke-width="7"/>'
        '<path d="M190 300 L204 230" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" opacity="0.5"/>'
    )


ICONS = {
    "arrow": icon_arrow, "brain": icon_brain, "cards": icon_cards, "people": icon_people,
    "bicep": icon_bicep, "double_bicep": icon_double_bicep, "spark": icon_spark,
    "comet": icon_comet, "crown": icon_crown,
}


def banner(label, special):
    top = "M58 374 Q256 338 454 374"
    band = f"{top} L454 436 Q256 400 58 436 Z"
    left_tail = "M92 386 L22 398 L48 426 L24 456 L100 446 Z"
    right_tail = "M420 386 L490 398 L464 426 L488 456 L412 446 Z"
    left_fold = "M58 374 L92 386 L100 446 L58 436 Z"
    right_fold = "M454 374 L420 386 L412 446 L454 436 Z"
    size = min(56, 300 / (len(label) * 0.74))
    edge = "url(#rainbow)" if special else "#4A4386"
    return (
        f'<path d="{left_tail}" fill="#1A1736" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<path d="{right_tail}" fill="#1A1736" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<path d="{left_fold}" fill="#0F0D22" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<path d="{right_fold}" fill="#0F0D22" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<path d="{band}" fill="#2A2552"/>'
        f'<path d="M66 386 Q256 352 446 386" fill="none" stroke="{edge}" stroke-width="7" stroke-linecap="round" opacity="0.9"/>'
        f'<path d="{band}" fill="none" stroke="{OUT}" stroke-width="{SW}" stroke-linejoin="round"/>'
        '<path id="tp" d="M76 404 Q256 370 436 404" fill="none"/>'
        f'<text font-family="Montserrat" font-weight="900" font-size="{size:.1f}" fill="#FFFFFF" '
        f'stroke="#120F26" stroke-width="6" paint-order="stroke" letter-spacing="1">'
        f'<textPath href="#tp" startOffset="50%" text-anchor="middle" dominant-baseline="central">{label}</textPath></text>'
    )


def badge_svg(tier, icon, label):
    m = MATERIALS[tier]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
        + defs(m) + frame(m) + ICONS[icon]() + banner(label, tier == "obsidian") + "</svg>"
    )


def render(svg_path, png_path):
    subprocess.run(
        [str(CHROME), "--headless", "--hide-scrollbars", "--disable-gpu", "--no-sandbox",
         "--default-background-color=00000000", "--window-size=512,512",
         f"--screenshot={png_path}", svg_path.as_uri()],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def main(codes):
    for d in (SVG_DIR, PNG_DIR, WEBP_DIR):
        d.mkdir(parents=True, exist_ok=True)
    for code, tier, icon, label in BADGES:
        if codes and code not in codes:
            continue
        svg_path = SVG_DIR / f"{code}.svg"
        png_path = PNG_DIR / f"{code}.png"
        svg_path.write_text(badge_svg(tier, icon, label))
        render(svg_path, png_path)
        img = Image.open(png_path).convert("RGBA")
        img.resize((256, 256), Image.LANCZOS).save(WEBP_DIR / f"{code}.webp", "WEBP", quality=92, method=6)
        print(code, tier, icon, label)


if __name__ == "__main__":
    main(set(sys.argv[1:]))
