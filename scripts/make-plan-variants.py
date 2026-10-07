#!/usr/bin/env python3
"""Smaller copies of every floor plan, for phones, thumbnails and normal viewing.

For each plan in src/data/floorPlans.json this writes, next to the original:
  <name>.1200.webp   1200 px wide (all plans wider than that)
  <name>.2400.webp   2400 px wide (plans wider than 2400 px)
Same aspect ratio as the original, so calibration and positions don't change
(the board draws the image at the plan's own width and height). The original
stays as it is and is still used when someone zooms in.

The app picks a copy by the size it's drawn at (lib/floorPlans.js planSrc).
Run after adding or replacing a plan image:  python3 scripts/make-plan-variants.py
Needs Pillow with WebP support (pip install Pillow).
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTHS = (1200, 2400)
QUALITY = 85


def variant_path(path, width):
    base, ext = os.path.splitext(path)
    return f'{base}.{width}{ext}'


def main():
    manifest = json.load(open(os.path.join(ROOT, 'src/data/floorPlans.json')))
    made = before = after = 0
    for floors in manifest['plans'].values():
        for plan in floors.values():
            src = os.path.join(ROOT, 'public', plan['file'])
            if not os.path.exists(src):
                continue
            with Image.open(src) as im:
                im = im.convert('RGB')
                for w in WIDTHS:
                    if im.width <= w:
                        continue
                    out = variant_path(src, w)
                    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
                        continue
                    h = round(im.height * w / im.width)
                    im.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=QUALITY, method=6)
                    made += 1
                    before += os.path.getsize(src)
                    after += os.path.getsize(out)
                    print(f'{os.path.relpath(out, ROOT)}  {w}x{h}  {os.path.getsize(out) // 1024} KB')
    print(f'{made} copies written', file=sys.stderr)


if __name__ == '__main__':
    main()
