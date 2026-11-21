"""Original signboards and resist-printed calico. Run with Pillow and a CJK font.
Set JIANGNAN_FONT on systems without Windows' Kai face. No font is embedded.
"""
import math
import os
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

rng = random.Random(1907)
font_path = os.environ.get('JIANGNAN_FONT', 'C:/Windows/Fonts/simkai.ttf')
atlas = Image.new('RGB', (1024, 512))


def paper(w, h, rgb, wood=False):
    image = Image.new('RGB', (w, h))
    pix = image.load()
    for y in range(h):
        for x in range(w):
            fibre = (math.sin(y * .32 + math.cos(x * .013) + .5 * math.sin(x * .021 + y * .02)) * 4
                     if wood else 1.1 * math.sin(x * 2.1) + 1.3 * math.sin(y * 1.48))
            n = round(rng.gauss(0, 2.1) + fibre)
            pix[x, y] = tuple(max(0, min(255, c + n)) for c in rgb)
    return image


cloth = paper(512, 512, (38, 76, 96))
d = ImageDraw.Draw(cloth)
ink = '#dfd8b9'
# A pair of circling fish in each open medallion; small wave eyes between.
for row in range(-1, 5):
    for col in range(-1, 5):
        x, y = 128 * col + (row % 2) * 64, 128 * row
        for rad in [51, 47]:
            d.ellipse([x-rad,y-rad,x+rad,y+rad], outline=ink, width=2)
        for sign in [1,-1]:
            def shape(points): return [(x+sign*a,y+sign*b) for a,b in points]
            d.polygon(shape([(-29,-13),(-21,-24),(-8,-27),(8,-24),(17,-16),(19,-11),
                             (13,-9),(1,-15),(-12,-15),(-20,-10),(-25,-5)]), fill=ink)
            d.polygon(shape([(17,-15),(28,-23),(26,-12),(31,-7),(18,-9)]), fill=ink)
            d.line(shape([(-20,-20),(-15,-23),(-12,-21)]), fill='#34566a', width=2)
            d.point(shape([(-21,-16)]),fill='#1f455b')
            for i in range(3):
                d.line(shape([(-10+i*8,-24),(-7+i*8,-20),(-10+i*8,-17)]),fill='#577680',width=2)
        for i in range(3):
            d.arc([x+57-i*3,y+52-i*3,x+69+i*3,y+65+i*3],185,350,fill=ink,width=2)
for _ in range(10500):
    x, y = rng.randrange(512), rng.randrange(512)
    if cloth.getpixel((x,y))[0]>140:d.line((x,y,x+rng.randrange(1,4),y),fill='#68848b')
atlas.paste(cloth,(0,0))

for j, (text, dark) in enumerate([('枕 河 街', True), ('听 雨 茶 栈', True), ('蓝 印 花 布', False), ('秦 淮 歌 楼', True)]):
    board = paper(512,128, (64,48,40) if dark else (202,197,165), dark)
    d = ImageDraw.Draw(board)
    gold = '#debf85' if dark else '#39596b'
    for inset, width in [(8,3),(14,1)]: d.rectangle((inset,inset,511-inset,127-inset),outline=gold,width=width)
    for x in (24,488):
        for y in (24,104): d.polygon([(x-4,y),(x,y-4),(x+4,y),(x,y+4)],fill=gold)
    font = ImageFont.truetype(font_path,68 if len(text)>5 else 74)
    d.text((256,64),text,anchor='mm',font=font,fill=gold,stroke_width=0)
    atlas.paste(board,(512,j*128))
atlas.save(Path(__file__).with_name('river-prints.webp'),quality=88,method=6)
