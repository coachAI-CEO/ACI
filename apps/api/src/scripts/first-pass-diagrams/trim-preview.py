#!/usr/bin/env python3
"""Equalize left/right gutters around the green pitch in a qlmanage square PNG."""
import sys
from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert("RGB")
w, h = img.size
px = img.load()


def is_pitch(c):
    r, g, b = c
    return 10 < r < 70 and 55 < g < 130 and 20 < b < 90


minx, maxx = w, 0
for y in range(h):
    for x in range(w):
        if is_pitch(px[x, y]):
            minx = min(minx, x)
            maxx = max(maxx, x)
if maxx <= minx:
    sys.exit(0)
left, right = minx, w - 1 - maxx
delta = right - left
if delta > 8:
    img.crop((0, 0, w - delta, h)).save(path)
elif delta < -8:
    img.crop((-delta, 0, w, h)).save(path)
