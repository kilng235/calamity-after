"""二次处理：ui-hp-fill 裁成横条，ui-bar-ornament 去白斑并切成左右两半，
其余图标做一次全局近白残留清理。"""
from PIL import Image, ImageFilter
import os

SRC = os.path.dirname(os.path.abspath(__file__))


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def remove_near_white(im, thresh=205):
    """全局移除近白（三通道都高）像素——保留金色等彩色高光。"""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and min(r, g, b) > thresh:
                px[x, y] = (r, g, b, 0)
    a = im.getchannel('A').filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(a)
    return im


def shrink_edge(im, k=1):
    a = im.getchannel('A')
    for _ in range(k):
        a = a.filter(ImageFilter.MinFilter(3))
    im.putalpha(a)
    return im


# ── ui-hp-fill：定位暗色余烬光带，裁成横条 ──
im = Image.open(os.path.join(SRC, 'ui-hp-fill.jpg')).convert('RGB')
w, h = im.size
g = im.convert('L')
rows = []
px = g.load()
for y in range(h):
    s = sum(px[x, y] for x in range(0, w, 16))
    rows.append(s / (w // 16))
band_rows = [y for y, v in enumerate(rows) if v < 190]
top, bot = max(0, band_rows[0] - 6), min(h, band_rows[-1] + 6)
band = im.crop((0, top, w, bot)).convert('RGBA')
band = remove_near_white(band, 215)
bbox = band.getbbox()
if bbox:
    band = band.crop(bbox)
band = band.resize((512, max(8, round(band.height * 512 / band.width))), Image.LANCZOS)
band.save(os.path.join(SRC, 'ui-hp-fill.png'))
print('ui-hp-fill ->', band.size)

# ── ui-bar-ornament：去白 + 找中缝切成左右两个角饰 ──
orn = load('ui-bar-ornament.png')
orn = remove_near_white(orn)
bbox = orn.getbbox()
orn = orn.crop(bbox)
w, h = orn.size
a = orn.getchannel('A')
apx = a.load()
cols = [sum(apx[x, y] for y in range(0, h, 4)) for x in range(w)]
# 在中间 1/3 区域找最宽的空列段作为切缝
mid_lo, mid_hi = w // 3, 2 * w // 3
best_gap, gap_start = (0, 0), -1
for x in range(mid_lo, mid_hi):
    if cols[x] == 0:
        if gap_start < 0:
            gap_start = x
    else:
        if gap_start >= 0 and x - gap_start > best_gap[1] - best_gap[0]:
            best_gap = (gap_start, x)
        gap_start = -1
cut = (best_gap[0] + best_gap[1]) // 2 if best_gap[1] > best_gap[0] else w // 2
left = orn.crop((0, 0, cut, h))
right = orn.crop((cut, 0, w, h))
left.save(os.path.join(SRC, 'ui-ornament-left.png'))
right.save(os.path.join(SRC, 'ui-ornament-right.png'))
print('ornament split at', cut, '->', left.size, right.size)

# ── 其余图标：清理封闭区白斑 ──
for name in ['ui-hp.png', 'ui-gold.png', 'ui-fate.png', 'ui-rank.png']:
    im = load(name)
    im = remove_near_white(im, 225)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(os.path.join(SRC, name))
    print(name, 'cleaned', im.size)

# 原始 JPG 移入 source 子目录
os.makedirs(os.path.join(SRC, 'source'), exist_ok=True)
for f in os.listdir(SRC):
    if f.endswith('.jpg'):
        os.rename(os.path.join(SRC, f), os.path.join(SRC, 'source', f))
print('jpg moved to source/')
