"""Bake the court's seamless starlit horizon. Offline art tool (Pillow/NumPy)."""
from pathlib import Path
from math import tau
import numpy as np
from PIL import Image, ImageDraw

w, h = 2048, 800
rng = np.random.default_rng(73024)
u, v = np.meshgrid(np.arange(w)/w, np.arange(h)/h)
x = tau*u
def bell(value, width): return np.exp(-(value/width)**2)
def noise(step):
    grid = rng.integers(0, 256, (max(3,h//step),w//step), dtype=np.uint8)
    # Pad one repeat either side before smooth resampling, then crop the centre.
    tile = Image.fromarray(np.tile(grid,(1,3))).resize((w*3,h),Image.Resampling.BICUBIC)
    return np.asarray(tile.crop((w,0,2*w,h))).astype(float)/255

cloud = .48*noise(90)+.32*noise(40)+.15*noise(16)+.05*noise(5)
high = (34+13*np.sin(x-.6))*bell(v-.48,.17)
sky = np.zeros((h,w,3))+[12,19,44]+high[:,:,None]*[1.45,1.0,1.35]
band = v-.34-.087*np.sin(x*2+.9)-.032*np.sin(x*5)
dust = bell(band,.058)*np.maximum(0,cloud-.20)*.98
sky += dust[:,:,None]*[55,49,84]
for j in range(3):
    line = .425-.06*np.sin(x*2+.38*j)-.032*np.sin(x*5+.16*j)-.017*np.sin(x*9)+j*.009
    d = v-line
    curtain = np.minimum(1,np.maximum(0,1.1+np.sin(x*3)))*(.2+.8*cloud)*(.75+.25*np.sin(41*x+np.sin(x*8)*2))
    ribbon = curtain*bell(d,np.where(d>0,.006+.002*j,.037))*0.66
    sky += ribbon[:,:,None]*([14,68,53] if j<2 else [46,32,62])
sky += ((cloud-.4)*bell(v-.50,.065))[:,:,None]*[47,39,48]
# A tiny grain reduces visible colour bands in the dusk gradient.
sky += rng.normal(0,.68,(h,w,1))
im = Image.fromarray(np.uint8(np.clip(sky,0,255))); g = ImageDraw.Draw(im)
for _ in range(3400):
    xx, yy = rng.integers(0,w),rng.integers(50,407)
    lum = rng.uniform(.15,1)**2*(1-max(0,(yy-330)/95))
    old = np.asarray(im.getpixel((xx,yy))); c=tuple((old+([204,216,220]-old)*lum).astype(int))
    g.point((xx,yy),fill=c)
    if lum>.84 and rng.random()<.15:
        g.line((xx-1,yy,xx+1,yy), fill=c);g.line((xx,yy-1,xx,yy+1),fill=c)
# Broken layers of distant ridges are entirely in the sky: no distant alpha cards.
for j,(base,col) in enumerate([(.514,(76,76,103)),(.533,(60,69,93)),(.563,(46,57,81)),(.60,(35,44,66))]):
    points=[]
    for px in range(0,w+1,3):
        a=tau*px/w
        ridge=sum(np.sin(a*n+j*n+.46*n)/(n**.76) for n in (3,7,12,23,49,87))
        points.append((px,int(h*(base+ridge*.033))))
    g.polygon([(0,h),*points,(w,h)],fill=col)
im.save(Path(__file__).resolve().parents[1]/'src/mmdVrShowcase/scenery/astral-dusk.webp',quality=90,method=6)
