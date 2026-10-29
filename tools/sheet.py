#!/usr/bin/env python3
"""Contact sheet: python3 tools/sheet.py out.png a.png b.png c.png d.png  (2x2, half size)"""
import sys
from PIL import Image
out, fs = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = ims[0].size; w2, h2 = w // 2, h // 2
cols = 2; rows = (len(ims) + 1) // 2
sheet = Image.new('RGB', (w2 * cols, h2 * rows), 'white')
for i, im in enumerate(ims): sheet.paste(im.resize((w2, h2)), ((i % 2) * w2, (i // 2) * h2))
sheet.save(out)
