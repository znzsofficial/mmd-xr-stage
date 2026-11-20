"""Original scale print: 2.04 x 1.28 m of fired-clay paving with sandstone margins."""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw, ImageFilter

r = Random(6694)
W, H = 816, 512
im = Image.new('RGB', (W, H), (132, 122, 101))
d = ImageDraw.Draw(im)

def slab(x, y, w, h, base):
    k = r.randint(-9, 9)
    col = tuple(c+k for c in base)
    d.rounded_rectangle((x+1, y+1, x+w-2, y+h-2), 2, fill=col)
    d.line((x+3,y+2,x+w-4,y+2),fill=tuple(c+6 for c in col))
    for _ in range(w*h//28):
        xx=x+r.randrange(3,max(4,w-3)); yy=y+r.randrange(3,max(4,h-3)); k=r.choice([-17,-11,-7,8,13,21]);
        d.point((xx,yy),tuple(c+k for c in col))

for j in range(16):
    y = j*32
    for i in range(9):
        x=max(56,56+(i-.5*(j%2))*88); end=min(W-56,56+(i+1-.5*(j%2))*88)
        if end>x: slab(int(x),y,int(end-x),32,r.choice([(178,126,96),(181,133,103),(168,117,91),(175,124,96)]))
for x in [0,W-56]:
    for j in range(4): slab(x,j*128,56,128,(196,181,148))
im.filter(ImageFilter.GaussianBlur(.32)).save(Path(__file__).with_name('garden-clinker.webp'),quality=86,method=6)
