"""Genera sprites PNG placeholder (uno por emoción) y el icono de la bandeja.
Uso: python3 generate_placeholders.py
Salida: src/assets/sprites/<emocion>.png y src/assets/tray-icon.png
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

OUT_SPRITES = "src/assets/sprites"
OUT_TRAY = "src/assets/tray-icon.png"
SIZE = 512
os.makedirs(OUT_SPRITES, exist_ok=True)

# Mismos acentos que src/components/SpeechBubble.css, para que el sprite
# y el globo de diálogo "hablen el mismo idioma" de color.
EMOTIONS = {
    "neutral": "#b9a97e",
    "feliz": "#d9a441",
    "triste": "#5c7ea3",
    "enfadada": "#b3453f",
    "avergonzada": "#c98a9c",
    "sorprendida": "#8b6fc9",
    "atenta": "#5fae82",
}

INK = (24, 20, 32, 255)  # color de rasgos faciales
PARCHMENT = (240, 230, 210, 255)


def hex_to_rgba(h, alpha=255):
    h = h.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return (r, g, b, alpha)


def try_font(size):
    for name in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(name):
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def face_base(draw, accent):
    cx, cy, r = SIZE // 2, 230, 170
    soft_fill = tuple(int(c * 0.28 + 15) for c in accent[:3]) + (255,)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=soft_fill, outline=accent, width=10)
    return cx, cy, r


def eyes_default(draw, cx, cy):
    for dx in (-70, 70):
        draw.ellipse([cx + dx - 18, cy - 20 - 18, cx + dx + 18, cy - 20 + 18], fill=INK)


def eyes_closed_arc(draw, cx, cy, upward=True):
    for dx in (-70, 70):
        bbox = [cx + dx - 30, cy - 20 - 22, cx + dx + 30, cy - 20 + 22]
        if upward:
            draw.arc(bbox, start=200, end=340, fill=INK, width=9)
        else:
            draw.arc(bbox, start=20, end=160, fill=INK, width=9)


def eyes_angled(draw, cx, cy, angry=True):
    for dx, flip in ((-70, 1), (70, -1)):
        x0, y0 = cx + dx - 24, cy - 20 + (14 if angry else -6) * (1 if flip > 0 else 1)
        x1, y1 = cx + dx + 24, cy - 20 - (14 if angry else -6)
        if flip < 0:
            x0, x1 = x1, x0
        draw.line([x0, y0, x1, y1], fill=INK, width=10)
        draw.ellipse([cx + dx - 10, cy - 20 - 10, cx + dx + 10, cy - 20 + 10], fill=INK)


def eyes_wide(draw, cx, cy):
    for dx in (-70, 70):
        draw.ellipse([cx + dx - 26, cy - 20 - 26, cx + dx + 26, cy - 20 + 26], fill=PARCHMENT, outline=INK, width=6)
        draw.ellipse([cx + dx - 10, cy - 20 - 10, cx + dx + 10, cy - 20 + 10], fill=INK)


def mouth_curve(draw, cx, cy, kind):
    y = cy + 95
    if kind == "smile":
        draw.arc([cx - 55, y - 35, cx + 55, y + 35], start=15, end=165, fill=INK, width=10)
    elif kind == "frown":
        draw.arc([cx - 55, y - 5, cx + 55, y + 65], start=200, end=340, fill=INK, width=10)
    elif kind == "flat":
        draw.line([cx - 45, y, cx + 45, y], fill=INK, width=10)
    elif kind == "o":
        draw.ellipse([cx - 26, y - 26, cx + 26, y + 26], fill=INK)
    elif kind == "wavy":
        pts = []
        for i in range(-45, 46, 5):
            pts.append((cx + i, y + 10 * math.sin(i / 12)))
        draw.line(pts, fill=INK, width=8, joint="curve")
    elif kind == "jagged":
        pts = [(cx - 50, y), (cx - 25, y + 18), (cx, y - 6), (cx + 25, y + 18), (cx + 50, y)]
        draw.line(pts, fill=INK, width=10, joint="curve")


def blush(draw, cx, cy):
    for dx in (-115, 115):
        draw.ellipse([cx + dx - 26, cy + 25 - 16, cx + dx + 26, cy + 25 + 16], fill=(230, 120, 140, 130))


def draw_sprite(emotion, accent_hex):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    accent = hex_to_rgba(accent_hex)
    cx, cy, _ = face_base(draw, accent)

    if emotion == "neutral":
        eyes_default(draw, cx, cy)
        mouth_curve(draw, cx, cy, "flat")
    elif emotion == "feliz":
        eyes_closed_arc(draw, cx, cy, upward=True)
        mouth_curve(draw, cx, cy, "smile")
    elif emotion == "triste":
        eyes_closed_arc(draw, cx, cy, upward=False)
        mouth_curve(draw, cx, cy, "frown")
    elif emotion == "enfadada":
        eyes_angled(draw, cx, cy, angry=True)
        mouth_curve(draw, cx, cy, "jagged")
    elif emotion == "avergonzada":
        eyes_closed_arc(draw, cx, cy, upward=True)
        mouth_curve(draw, cx, cy, "wavy")
        blush(draw, cx, cy)
    elif emotion == "sorprendida":
        eyes_wide(draw, cx, cy)
        mouth_curve(draw, cx, cy, "o")
    elif emotion == "atenta":
        eyes_default(draw, cx, cy)
        mouth_curve(draw, cx, cy, "flat")
        # una ceja levantada sutil para diferenciarla de "neutral"
        draw.arc([cx - 95, cy - 75, cx - 35, cy - 35], start=200, end=340, fill=accent, width=8)

    font = try_font(28)
    label = emotion.upper()
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((cx - tw / 2, SIZE - 60), label, font=font, fill=(255, 255, 255, 160))

    img.save(f"{OUT_SPRITES}/{emotion}.png")


def draw_tray_icon():
    size = 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    accent = hex_to_rgba(EMOTIONS["feliz"])
    r = 56
    cx = cy = size // 2
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=accent)
    for dx in (-20, 20):
        draw.ellipse([cx + dx - 8, cy - 10 - 8, cx + dx + 8, cy - 10 + 8], fill=INK)
    draw.arc([cx - 26, cy - 4, cx + 26, cy + 30], start=15, end=165, fill=INK, width=7)
    img.save(OUT_TRAY)


for name, color in EMOTIONS.items():
    draw_sprite(name, color)

draw_tray_icon()
print("Listo:", os.listdir(OUT_SPRITES), "+ tray-icon.png")
