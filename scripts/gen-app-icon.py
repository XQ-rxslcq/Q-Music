"""Generate Q-Music app icon: Comfortaa Bold Q on blue-cyan background."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_PATH = ROOT / "assets" / "fonts" / "Comfortaa-Variable.ttf"
# 偏蓝青（相对样例 #2bbbad 更偏蓝）
BG = (42, 159, 212, 255)  # #2a9fd4
WHITE = (255, 255, 255, 255)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT_PATH), size)
    try:
        font.set_variation_by_name("Bold")
    except Exception:
        try:
            font.set_variation_by_axes([700])
        except Exception:
            pass
    return font


def rounded_mask(size: int, radius: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def render(size: int) -> Image.Image:
    # 透明画布 + 圆角青底（约 20% 圆角）
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    radius = size * 0.2
    plate = Image.new("RGBA", (size, size), BG)
    plate.putalpha(rounded_mask(size, radius))
    img.alpha_composite(plate)
    draw = ImageDraw.Draw(img)
    font = load_font(int(size * 0.62))
    bbox = draw.textbbox((0, 0), "Q", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), "Q", font=font, fill=WHITE)
    return img


def main() -> None:
    assets = ROOT / "assets"
    build = ROOT / "build"
    build.mkdir(exist_ok=True)

    master = render(1024)
    master.save(assets / "icon.png")
    master.resize((512, 512), Image.Resampling.LANCZOS).save(assets / "icon-512.png")
    master.resize((256, 256), Image.Resampling.LANCZOS).save(build / "icon.png")

    sizes = [16, 24, 32, 48, 64, 128, 256]
    layers = [render(max(s * 2, 64)).resize((s, s), Image.Resampling.LANCZOS) for s in sizes]
    ico_path = build / "icon.ico"
    layers[-1].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=layers[:-1],
    )
    shutil.copy2(ico_path, assets / "icon.ico")
    print("OK", assets / "icon.png", ico_path)


if __name__ == "__main__":
    main()
