"""Rotary-cut birch, 0.96 × 0.48 m. R = diffuse value, GB = pore slopes.

python src/mmdVrShowcase/scenery/ClassroomBirch.py  (NumPy, Pillow)
No scan or source photograph. The sliced ring figure is pigment; only the
tiny independently placed wood vessels produce relief below the lacquer.
"""
from pathlib import Path
import numpy as np
from PIL import Image

rng = np.random.default_rng(1942)
h, w = 256, 512
y, x = np.mgrid[:h, :w]; u, v = x/w, y/h; tau=2*np.pi

def noise(x_scale, y_scale):
    # Frequency-filtered white noise with wrap continuity on both axes.
    kx = np.fft.rfftfreq(w)[None,:] * x_scale
    ky = np.fft.fftfreq(h)[:,None] * y_scale
    n = np.fft.irfft2(np.fft.rfft2(rng.normal(size=(h,w))) * np.exp(-18*(kx*kx+ky*ky)), s=(h,w))
    return (n-n.mean())/n.std()

bend=.013*noise(85,38)+.014*np.sin(tau*(u+.21*np.sin(tau*v)))
# The arch of a ring opens and closes with the changing knife radius. Sparse
# latewood feathers sit between longer bands; neither gets a painted highlight.
phase=6*(v+bend)+.34*np.sin(tau*u)+.22*noise(116,48)
feather=np.exp(-((np.sin(np.pi*phase)/.32)**2))
face=.92+.045*noise(80,12)+.024*noise(39,2.7)-.125*feather*(.62+.38*np.cos(tau*u))
depth=np.zeros((h,w))
for i in range(2700):
    cx,cy=rng.uniform(0,w),rng.uniform(0,h); rx,ry=rng.uniform(.9,3.4),rng.uniform(.38,.85)
    dx=np.arange(-7,8)+int(cx)-cx; dy=np.arange(-3,4)+int(cy)-cy
    pore=np.exp(-(dx[None,:]/rx)**2-((dy[:,None]-.07*dx[None,:])/ry)**2)
    iy=(np.arange(-3,4)+int(cy))%h; ix=(np.arange(-7,8)+int(cx))%w
    depth[np.ix_(iy,ix)]-=rng.uniform(.22,.74)*pore
face+=.035*depth
gu=(np.roll(depth,-1,axis=1)-np.roll(depth,1,axis=1))*.62
gv=(np.roll(depth,-1,axis=0)-np.roll(depth,1,axis=0))*.62
# Quantise the tiny slope domain before lossless compression, so chroma
# subsampling cannot bleed dark growth rings into the normal channels.
gu=np.round(gu*24)/24; gv=np.round(gv*24)/24
image=np.uint8(np.round(255*np.clip(np.stack((face,.5-gu,.5+gv),axis=2),0,1)))
Image.fromarray(image).save(Path(__file__).with_name('class-birch-stock.webp'),lossless=True,method=6)
