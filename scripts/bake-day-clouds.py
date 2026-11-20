"""Bake a seamless world-direction cloud mask (no sun) for the daytime sets."""
from pathlib import Path
import numpy as np
from PIL import Image

w,h=1536,768
lon=np.linspace(-np.pi,np.pi,w,dtype='f');lat=np.linspace(np.pi/2,-np.pi/2,h,dtype='f')[:,None]
x=np.cos(lat)*np.cos(lon); y=np.sin(lat)+np.zeros_like(x); z=np.cos(lat)*np.sin(lon)
rng=np.random.default_rng(5231);grid=rng.uniform(0,1,(64,64,64)).astype('f')
def noise(x,y,z):
    ix,iy,iz=[np.floor(q).astype('i') for q in (x,y,z)]
    a,b,c=[q-i for q,i in zip((x,y,z),(ix,iy,iz))];a,b,c=[t*t*(3-2*t) for t in (a,b,c)]
    v=np.zeros_like(x)
    for i in (0,1):
        for j in (0,1):
            for k in (0,1):v+=grid[(ix+i)%64,(iy+j)%64,(iz+k)%64]*(a if i else 1-a)*(b if j else 1-b)*(c if k else 1-c)
    return v
def smooth(lo,hi,v):
    t=np.clip((v-lo)/(hi-lo),0,1);return t*t*(3-2*t)
# Sample a 3D field on the unit sphere, not a flat plane divided by elevation.
# Directions agree at both ends of the panorama and converge at each pole.
base=noise(x*3+5,y*5+8,z*3+1);v=np.zeros_like(x)
for scale,weight in [(5,.50),(10,.26),(20,.14),(40,.07),(80,.03)]:
    v+=weight*noise(x*scale+.65*base+17,y*scale*1.6+30,z*scale+8)
mask=smooth(.45,.70,.72*v+.28*base)*smooth(-.015,.19,y)
out=np.round(255*mask).astype('uint8');out[:,-1]=out[:,0]
Image.fromarray(out).save(Path(__file__).resolve().parents[1]/'src/mmdVrShowcase/scenery/day-clouds.webp',lossless=True,method=6)
