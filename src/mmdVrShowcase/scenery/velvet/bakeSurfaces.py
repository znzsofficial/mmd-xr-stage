"""Original repeatable finish samples and the atelier's copperplate moon print. Pillow + NumPy."""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

out = Path(__file__).parent
rng = np.random.default_rng(41479)
n = 256
y, x = np.mgrid[:n, :n]
def normal(name, height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    vec = np.stack([-dx, dy, np.ones_like(dx)], axis=2)
    vec /= np.linalg.norm(vec, axis=2, keepdims=True)
    Image.fromarray(np.uint8(np.clip(128 + 127 * vec, 0, 255))).save(out / f'{name}.webp', lossless=True, method=6)

# Short tufts lean in the warp direction; satin's longer floats run diagonally.
nap = rng.normal(size=(n, n))
normal('velour-n', .5*nap + .32*np.roll(nap,1,0) + .18*np.roll(nap,2,0), .40)
tw = 2*math.pi / n
normal('satin-n', .56*np.sin(tw*(43*x+27*y)) + .18*np.cos(tw*(8*x-41*y)) + .05*nap, .54)
# Pebbled leather: irregular rounded cells with recessed valleys, tiling on both axes.
near = np.full((n,n), np.inf); second = near.copy()
for i in range(20):
    for j in range(20):
        a,b=(np.array([i,j])+rng.uniform(.08,.92,2))*n/20
        dx=np.abs(x-a);dy=np.abs(y-b);d=np.hypot(np.minimum(dx,n-dx),1.30*np.minimum(dy,n-dy))
        second=np.minimum(second,np.maximum(d,near));near=np.minimum(near,d)
normal('leather-n', np.tanh((second-near)*.46) + .055*nap, .93)

# A shallow arch, three night ridges, an engraved crescent and radiating etched
# lines. No photographs, reference characters, logos or external assets.
w,h=624,604
im=Image.new('RGB',(w,h),'#a77b71'); draw=ImageDraw.Draw(im)
for row in range(h):
    t=row/h; draw.line((0,row,w,row),fill=tuple(round(a*(1-t)+b*t) for a,b in zip((156,100,101),(216,175,139))))
cx,cy=316,246
for i in range(110):
    a=i*2*math.pi/110
    r0=rng.uniform(89,116); r1=rng.uniform(460,650)
    draw.line((cx+math.cos(a)*r0,cy+math.sin(a)*r0,cx+math.cos(a)*r1,cy+math.sin(a)*r1), fill=('#c4997e' if i%3 else '#d6b290'),width=1)
for r in [109,114,178,182,256,260]: draw.ellipse((cx-r,cy-r,cx+r,cy+r),outline='#d0a68c',width=1)
draw.ellipse((cx-85,cy-85,cx+85,cy+85),fill='#e6c399')
for i in range(1,84,4):draw.arc((cx-i,cy-i,cx+i,cy+i),30,294,fill='#c8a381',width=1)
for k,(base,fill) in enumerate([(425,'#a07077'),(489,'#7e565f'),(553,'#654a57')]):
    def ridge(px):return base+35*math.cos(px*.008+k*1.8)+17*math.sin(px*.015+k*.6)
    pts=[(i,ridge(i)) for i in range(-2,w+3,2)];draw.polygon(pts+[(w,h),(0,h)],fill=fill)
    for j in range(2,90,5):
        draw.line([(i,ridge(i)+j*(.7+.25*math.cos(i*.008))+2*math.sin(j*.12+i*.01)) for i in range(0,w,4)],fill=('#b68c83','#966d70','#826772')[k],width=1)
for i in range(95):
    px,py=rng.integers(14,w-14),rng.integers(15,345)
    draw.point((int(px),int(py)),fill='#e9cda7')
pix=np.array(im,dtype=float)+rng.normal(0,2,(h,w,1));Image.fromarray(np.uint8(np.clip(pix,0,255))).save(out/'moon-etch.webp',quality=87,method=6)
