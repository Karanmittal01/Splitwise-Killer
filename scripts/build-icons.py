"""
Rebuild the app icons from the source artwork.

The artwork ships as a rounded square sitting on a white card with a drop
shadow, all baked into the PNG. Android and iOS draw their own rounded mask and
shadow, so shipping that as-is puts a white plate around the icon on the home
screen — which is exactly what it looked like.

The fix is to crop past the artwork's own rounded corners. A corner of radius r
stops being a corner once you crop r*(1 - 1/sqrt(2)) from every side: past that
the new corners land inside the artwork, so no arc and no rim stroke survive and
the gradient reaches all four edges.
"""

import math
import pathlib
from PIL import Image

SOURCE = "public/icon-source.png"   # the original, kept for future re-runs
SQUARE = (63, 63, 449, 449)         # the coloured square inside the white card
RADIUS = 76                         # its corner radius, measured from the pixels
CROP = 30                           # > 76 * (1 - 1/sqrt(2)) = 22.3, with margin

# A launcher mask can crop to the inscribed circle, so the maskable variant
# keeps the artwork inside the central 78% and extends the gradient outwards.
SAFE = 0.78

src = Image.open(SOURCE).convert("RGB")
assert CROP > RADIUS * (1 - 1 / math.sqrt(2)), "crop must clear the corner arc"

l, t, r, b = SQUARE
art = src.crop((l + CROP, t + CROP, r - CROP, b - CROP))
master = art.resize((1024, 1024), Image.LANCZOS)

# Maskable: the artwork at SAFE scale, with its outer ring clamped outward to
# fill the margin. The ring is smooth gradient, so the join is invisible.
side = round(1024 * SAFE)
pad = (1024 - side) // 2
inner = master.resize((side, side), Image.LANCZOS)
maskable = Image.new("RGB", (1024, 1024))
ip = inner.load()
mp = maskable.load()
for y in range(1024):
    sy = min(side - 1, max(0, y - pad))
    for x in range(1024):
        sx = min(side - 1, max(0, x - pad))
        mp[x, y] = ip[sx, sy]
maskable.paste(inner, (pad, pad))

OUT = [
    (master, "public/icon-512.png", 512),
    (master, "public/icon-192.png", 192),
    (master, "src/app/icon.png", 256),
    (master, "src/app/apple-icon.png", 180),
    (maskable, "public/icon-maskable-512.png", 512),
    (maskable, "public/icon-maskable-192.png", 192),
]
for img, path, size in OUT:
    scaled = img.resize((size, size), Image.LANCZOS)
    # Palette + dither: an icon is a handful of flat colours over one gradient,
    # so 256 dithered colours are indistinguishable from full RGB at a quarter
    # of the bytes. These ship on every page load.
    scaled = scaled.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    scaled.save(path, optimize=True)
    print(f"wrote {path} {size}x{size} ({pathlib.Path(path).stat().st_size // 1024} KB)")
