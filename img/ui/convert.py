"""把生图 AI 导出的白底 JPG 转成透明底 PNG，并裁剪缩放到 UI 可用尺寸。"""
from PIL import Image, ImageDraw, ImageFilter
import os

SRC = os.path.dirname(os.path.abspath(__file__))

# 目标尺寸（最长边）。条形元素按宽度。
TARGET = {
    'ui-hp.png':          96,
    'ui-gold.png':        96,
    'ui-fate.png':        96,
    'ui-rank.png':        160,
    'ui-hp-frame.png':    512,
    'ui-hp-fill.png':     512,
    'ui-bar-ornament.png': 192,
}

MAGENTA = (255, 0, 255)

for src_name in sorted(os.listdir(SRC)):
    if not src_name.endswith('.jpg'):
        continue
    out_name = src_name.replace('.jpg', '.png')
    im = Image.open(os.path.join(SRC, src_name)).convert('RGB')
    w, h = im.size

    # 从四角+四边中点做泛洪填充，把与边缘近白连通的区域染成品红
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for seed in seeds:
        if sum(im.getpixel(seed)) / 3 > 235:
            ImageDraw.floodfill(im, seed, MAGENTA, thresh=45)

    rgba = im.convert('RGBA')
    px = rgba.load()
    # 品红 → 透明；再把残留的近白半透明边缘适当收缩
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if (r, g, b) == MAGENTA:
                px[x, y] = (r, g, b, 0)

    # 轻微收缩+羽化 alpha，去掉 JPG 白边
    alpha = rgba.getchannel('A')
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(alpha)

    # 裁剪到内容包围盒
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    # 缩放到目标尺寸
    tw = TARGET.get(out_name, 128)
    ratio = tw / rgba.width
    th = max(1, round(rgba.height * ratio))
    if tw < rgba.width:
        rgba = rgba.resize((tw, th), Image.LANCZOS)

    rgba.save(os.path.join(SRC, out_name))
    print(f'{src_name} -> {out_name}  {rgba.size}')
