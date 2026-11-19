"""Prepare DUQAIO sticker assets.

1. Remove stray fragments of neighbouring stickers that touch the image border.
2. Register each anime image onto its realistic twin (scale + translation search on
   edge maps) so the glitch swaps without the bowl jumping.
3. Place both on one shared canvas and export WebP:
      <id>_real.webp, <id>_anime.webp  (aligned, same size)
      <id>_menu.webp                   (realistic with a baked soft shadow, for the orbit)
      <id>_shadow.webp                 (shadow only, drawn under the glitching hero)
   plus assets/manifest.json with sizes and the registration result.

Usage: py -3.11 prep_assets.py <incoming_dir> <out_dir>
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

DISHES = {
    "01_spicy_ramen": "spicy-ramen",
    "02_shrimp_noodles": "shrimp-noodles",
    "03_black_garlic_ramen": "black-garlic-ramen",
    "04_sesame_dan_dan": "sesame-dan-dan",
    "05_mushroom_udon": "mushroom-udon",
}


def components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    comps = []
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        q = deque([(y0, x0)])
        lab[y0, x0] = n
        px = []
        while q:
            y, x = q.popleft()
            px.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    q.append((yy, xx))
        ys = np.array([p[0] for p in px]); xs = np.array([p[1] for p in px])
        comps.append(dict(id=n, area=len(px), x0=xs.min(), x1=xs.max(), y0=ys.min(), y1=ys.max()))
    return lab, comps


def clean(im):
    """Drop fragments of neighbouring stickers. They often touch the white border of the
    main sticker through a thin neck, so components are found on an eroded mask."""
    a = np.array(im)
    alpha = a[..., 3]
    h, w = alpha.shape
    solid = Image.fromarray(((alpha > 8) * 255).astype(np.uint8))
    eroded = np.array(solid.filter(ImageFilter.MinFilter(11))) > 0
    lab, comps = components(eroded)
    total = sum(c["area"] for c in comps) or 1
    keep = np.zeros_like(eroded)
    removed = []
    for c in comps:
        cw = c["x1"] - c["x0"] + 1
        edge = c["x0"] <= 6 or c["x1"] >= w - 7 or c["y0"] <= 6 or c["y1"] >= h - 7
        sliver = edge and cw < 0.14 * w
        if c["area"] < 0.01 * total or sliver:
            removed.append(c["area"])
            continue
        keep |= lab == c["id"]
    grown = np.array(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))) > 0
    a[..., 3] = np.where(grown, alpha, 0)
    return Image.fromarray(a), removed


def edges(im):
    a = np.asarray(im, np.float32) / 255.0
    lum = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]) * a[..., 3]
    gy, gx = np.gradient(lum)
    g = np.hypot(gx, gy)
    g = np.sqrt(g)  # compress so texture and outlines both count
    return g - g.mean()


def best_shift(ref, mov):
    """Translation of mov that best matches ref (FFT cross-correlation, padded)."""
    H = ref.shape[0] + mov.shape[0]
    W = ref.shape[1] + mov.shape[1]
    F = np.fft.rfft2(ref, (H, W))
    G = np.fft.rfft2(mov, (H, W))
    cc = np.fft.irfft2(F * np.conj(G), (H, W))
    i = np.unravel_index(np.argmax(cc), cc.shape)
    dy, dx = i
    if dy > H // 2:
        dy -= H
    if dx > W // 2:
        dx -= W
    norm = np.sqrt((ref ** 2).sum() * (mov ** 2).sum()) + 1e-9
    return cc[i] / norm, dx, dy


def register(real, anime):
    ref = edges(real)
    best = None
    for s in np.arange(0.80, 1.26, 0.01):
        w = round(anime.width * s); h = round(anime.height * s)
        mov = edges(anime.resize((w, h), Image.LANCZOS))
        score, dx, dy = best_shift(ref, mov)
        if best is None or score > best[0]:
            best = (score, s, dx, dy)
    # refine
    score0, s0, _, _ = best
    for s in np.arange(s0 - 0.01, s0 + 0.0101, 0.0025):
        w = round(anime.width * s); h = round(anime.height * s)
        mov = edges(anime.resize((w, h), Image.LANCZOS))
        score, dx, dy = best_shift(ref, mov)
        if score > best[0]:
            best = (score, s, dx, dy)
    return best


def shadow_of(img, pad):
    a = img.getchannel("A")
    sh = Image.new("L", img.size, 0)
    sh.paste(a, (0, 0))
    big = Image.new("L", (img.width + 2 * pad, img.height + 2 * pad), 0)
    big.paste(sh, (pad + 6, pad + 16))  # light from upper left
    big = big.filter(ImageFilter.GaussianBlur(14))
    big = big.point(lambda v: int(v * 0.42))
    out = Image.new("RGBA", big.size, (40, 22, 12, 0))
    out.putalpha(big)
    return out


manifest = {}
for stem, did in DISHES.items():
    real, r_removed = clean(Image.open(os.path.join(SRC, f"{stem}_realistic.png")).convert("RGBA"))
    anime, a_removed = clean(Image.open(os.path.join(SRC, f"{stem}_anime.png")).convert("RGBA"))
    score, s, dx, dy = register(real, anime)
    anime_s = anime.resize((round(anime.width * s), round(anime.height * s)), Image.LANCZOS)

    # shared canvas: union of both placements, plus padding for shadow / glitch slices
    x0 = min(0, dx); y0 = min(0, dy)
    x1 = max(real.width, dx + anime_s.width); y1 = max(real.height, dy + anime_s.height)
    pad = 28
    W = x1 - x0 + 2 * pad; Hh = y1 - y0 + 2 * pad
    rc = Image.new("RGBA", (W, Hh)); rc.paste(real, (pad - x0, pad - y0))
    ac = Image.new("RGBA", (W, Hh)); ac.paste(anime_s, (pad - x0 + dx, pad - y0 + dy))

    # trim to the union of opaque content + pad
    bb = Image.fromarray(np.maximum(np.array(rc)[..., 3], np.array(ac)[..., 3])).getbbox()
    bx0, by0, bx1, by1 = bb
    crop = (max(0, bx0 - pad), max(0, by0 - pad), min(W, bx1 + pad), min(Hh, by1 + pad))
    rc = rc.crop(crop); ac = ac.crop(crop)

    sh = shadow_of(rc, 0)
    menu = Image.new("RGBA", rc.size); menu.alpha_composite(sh); menu.alpha_composite(rc)

    rc.save(os.path.join(OUT, f"{did}_real.webp"), quality=90, method=6)
    ac.save(os.path.join(OUT, f"{did}_anime.webp"), quality=90, method=6)
    menu.save(os.path.join(OUT, f"{did}_menu.webp"), quality=88, method=6)
    sh.save(os.path.join(OUT, f"{did}_shadow.webp"), quality=80, method=6)
    manifest[did] = dict(w=rc.width, h=rc.height, scale=round(float(s), 4), dx=int(dx), dy=int(dy),
                         score=round(float(score), 3), removed_real=r_removed, removed_anime=a_removed)
    print(did, manifest[did])

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)
