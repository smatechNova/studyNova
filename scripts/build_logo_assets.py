from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "apps" / "mobile" / "assets"
SOURCE = ASSETS / "brand" / "logo-nova-transparent-v2.png"

NAVY = (16, 42, 67, 255)
OFF_WHITE = (248, 250, 252, 255)


def trimmed_logo() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("The logo source has no visible pixels.")
    return image.crop(bounds)


def fit_logo(logo: Image.Image, canvas_size: int, coverage: float) -> Image.Image:
    target = round(canvas_size * coverage)
    scale = min(target / logo.width, target / logo.height)
    size = (max(1, round(logo.width * scale)), max(1, round(logo.height * scale)))
    return logo.resize(size, Image.Resampling.LANCZOS)


def centered(canvas: Image.Image, mark: Image.Image, y_offset: int = 0) -> Image.Image:
    x = (canvas.width - mark.width) // 2
    y = (canvas.height - mark.height) // 2 + y_offset
    canvas.alpha_composite(mark, (x, y))
    return canvas


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, "PNG", optimize=True)


def build() -> None:
    logo = trimmed_logo()

    master = centered(Image.new("RGBA", (1024, 1024)), fit_logo(logo, 1024, 0.76))
    save_png(master, ASSETS / "brand" / "logo-master.png")

    icon = centered(Image.new("RGBA", (1024, 1024), NAVY), fit_logo(logo, 1024, 0.68))
    save_png(icon, ASSETS / "icon.png")
    save_png(icon, ASSETS / "brand" / "app-icon-source.png")

    adaptive = centered(Image.new("RGBA", (1024, 1024)), fit_logo(logo, 1024, 0.54))
    save_png(adaptive, ASSETS / "adaptive-icon.png")

    splash = Image.new("RGBA", (1024, 1024))
    tile_bounds = (178, 178, 846, 846)
    ImageDraw.Draw(splash).rounded_rectangle(tile_bounds, radius=164, fill=OFF_WHITE)
    centered(splash, fit_logo(logo, 1024, 0.50))
    save_png(splash, ASSETS / "splash-icon.png")
    save_png(splash, ASSETS / "brand" / "splash-brand.png")

    notification_mark = fit_logo(logo, 192, 0.70)
    alpha = notification_mark.getchannel("A")
    white_mark = Image.new("RGBA", notification_mark.size, (255, 255, 255, 0))
    white_mark.putalpha(alpha)
    notification = centered(Image.new("RGBA", (192, 192)), white_mark)
    save_png(notification, ASSETS / "notification-icon.png")


if __name__ == "__main__":
    build()
