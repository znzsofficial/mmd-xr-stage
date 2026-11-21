"""Seamless physical detail plate. One small tile for the whole system, sampled
at metre scales. R: broken sand grains; G: edges of crystal flakes; B: seams."""
from pathlib import Path
import numpy as np
from PIL import Image

n=768; y,x=np.mgrid[:n,:n]/n; rng=np.random.default_rng(5314)
def noise(k,x=x,y=y):
    grid=rng.random((k,k)); xx=x*k; yy=y*k; i=np.floor(xx).astype(int);j=np.floor(yy).astype(int)
    u=xx-i;v=yy-j;u=u*u*(3-2*u);v=v*v*(3-2*v)
    return ((1-u)*grid[j%k,i%k]+u*grid[j%k,(i+1)%k])*(1-v)+((1-u)*grid[(j+1)%k,i%k]+u*grid[(j+1)%k,(i+1)%k])*v
def flakes(k):
    xx=x*k;yy=y*k;i=np.floor(xx).astype(int);j=np.floor(yy).astype(int);a=xx-i;b=yy-j
    sites=rng.uniform(.07,.93,(k,k,2));shades=rng.random((k,k));one=np.full_like(x,9);two=one.copy();grain=x.copy()
    for dy in (-1,0,1):
        for dx in (-1,0,1):
            sx,sy=sites[(j+dy)%k,(i+dx)%k].transpose(2,0,1);d=(dx+sx-a)**2+(dy+sy-b)**2;hit=d<one
            grain=np.where(hit,shades[(j+dy)%k,(i+dx)%k],grain);two=np.minimum(two,np.maximum(one,d));one=np.minimum(one,d)
    gap=np.sqrt(two)-np.sqrt(one);return grain,np.exp(-(gap/.090)**2)
stone,edge=flakes(25);fine,rim=flakes(65);cloud=noise(5);salt=noise(143);warp=noise(8)
seam=np.exp(-np.square(np.sin(2*np.pi*(5*x+3*y+.30*warp+.15*noise(21)))/.13))
plate=np.stack((.34*stone+.37*fine+.29*salt-.19*rim,.24+.53*stone+.23*cloud-.45*edge,.70*seam+.30*edge),axis=-1)
Image.fromarray(np.uint8(255*np.clip(plate,0,1))).save(Path(__file__).with_name('mineral-grain.webp'),quality=93,method=6)
