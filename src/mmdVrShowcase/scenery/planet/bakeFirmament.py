"""Original equirectangular sky in display sRGB. No catalogue or external imagery.
Three SphereGeometry longitude: -X, +Z, +X, -Z. Noise is sampled on the unit
sphere, so the dust continues through the seam and around the poles."""
from pathlib import Path
import numpy as np
from PIL import Image

W,H=3072,1536
rng=np.random.default_rng(3199)
noise=rng.random((64,64,64),dtype=np.float32)
def field(x,y,z,f):
    x=x*f+13.39;y=y*f+17.77;z=z*f+9.13
    i=np.floor(x).astype(np.int32);j=np.floor(y).astype(np.int32);k=np.floor(z).astype(np.int32)
    a,b,c=x-i,y-j,z-k
    a=a*a*(3-2*a);b=b*b*(3-2*b);c=c*c*(3-2*c)
    def p(dx,dy):return noise[(i+dx)%64,(j+dy)%64,k%64]*(1-c)+noise[(i+dx)%64,(j+dy)%64,(k+1)%64]*c
    return (p(0,0)*(1-a)+p(1,0)*a)*(1-b)+(p(0,1)*(1-a)+p(1,1)*a)*b
def unit(a):return np.asarray(a)/np.linalg.norm(a)
phi=(np.arange(W)+.5)*2*np.pi/W
im=np.zeros((H,W,3),np.float32)
# A tilted galactic plane with clumped core light and a broken double dust lane.
for start in range(0,H,48):
    th=(np.arange(start,start+48)[:,None]+.5)*np.pi/H
    x=-np.sin(th)*np.cos(phi);y=np.broadcast_to(np.cos(th),x.shape);z=np.sin(th)*np.sin(phi)
    lat=.36*x+.89*y+.277*z
    lump=field(x,y,z,4)*.49+field(x,y,z,14)*.27+field(x,y,z,41)*.16+field(x,y,z,110)*.08
    bend=field(x,y,z,5)-.5; ridge=lat+bend*.16+.028*np.sin(8*x+6*z)
    glow=np.exp(-(lat/.19)**2)*(0.26+.74*((1-z)/2)**3)
    dust=.72*np.exp(-((ridge+.032)/.036)**2)+.29*np.exp(-((ridge-.073)/.022)**2)
    gas=np.maximum(0,lump-.19)**1.65*glow*(1-np.minimum(.87,dust))
    temper=field(x,y,z,3);col=np.stack([134+40*temper,114+50*temper,126+60*(1-temper)],axis=-1)
    sky=np.array([4.7,7.9,17.0])+gas[:,:,None]*col+glow[:,:,None]*np.array([3,5,10]);im[start:start+48]=sky
# A continuous magnitude distribution; most stars occupy < a texel and fuse
# into star clouds at low mip levels. Uniform solid angle, plus the galactic disk.
for _ in range(85000):
    u=rng.random();cy=rng.uniform(-1,1);sy=np.sqrt(1-cy*cy);a=2*np.pi*u
    lat=-.36*np.cos(a)*sy+.89*cy+.277*np.sin(a)*sy
    if rng.random()>.19+.81*np.exp(-(lat/.16)**2):continue
    px=int(W*u);py=min(H-1,int(H*np.arccos(cy)/np.pi));power=min(1,.034*(1-rng.random())**(-.95));glow=12+235*power
    tint=np.array([[.80,.88,1],[1,.95,.86],[1,.83,.66],[.88,.94,1]])[rng.integers(4)]
    im[py,px]+=tint*glow
    if power>.28 and 2<=py<H-2:
        for dy in range(-2,3):
            for dx in range(-2,3):
                d=dx*dx+dy*dy
                if d:im[py+dy,(px+dx)%W]+=tint*glow*.32*np.exp(-d/(.65+power))

# Paint distant disks in angular coordinates. Ring particles in front of the
# equator occlude the disk; the far side and its gaps are hidden by the limb.
def planet(direction,radius,style,ring=False):
    d=unit(direction);right=unit(np.cross(d,[0,1,0]));up=np.cross(right,d);v=np.arccos(d[1])/np.pi
    half=radius*(2.7 if ring else 1.25)
    def paint(az,t,row):
        xy=np.stack([-np.cos(az)*np.sin(t),np.full(len(az),np.cos(t)),np.sin(az)*np.sin(t)],axis=-1)
        l=xy@d;s=(xy@right)/(radius*l);b=(xy@up)/(radius*l);r2=s*s+b*b;disk=r2<=1
        if disk.any():
            X=s[disk];Y=b[disk];Z=np.sqrt(1-r2[disk]);L=np.clip(-.62*X+.50*Y+.44*Z,0,1)
            N=field(X,Y,Z,7)-.5;M=field(X,Y,Z,22)-.5
            if style=='amber':
                h=Y+.25*X+.055*N+.017*np.sin(9*X+3*Y);stripe=.52+.31*np.sin(15*h)+.12*np.sin(38*h+.55*np.sin(7*X))+.05*np.sin(82*h)
                color=np.array([174,100,81])+(np.array([246,209,155])-np.array([174,100,81]))*stripe[:,None]
            else:
                pal={'ice':([65,102,169],[138,229,219]),'red':([131,49,75],[244,132,100]),'lilac':([104,76,140],[221,197,236])}[style]
                land=np.clip(.49+N*1.6+M*.8+.16*np.sin(13*Y+7*X),0,1);color=np.array(pal[0])+(np.array(pal[1])-np.array(pal[0]))*land[:,None]
            rim=np.maximum(0,1-Z)**4*(.24+.76*L);row[disk]=color*(.12+.88*L[:,None]**.62)+rim[:,None]*[48,66,76]
        if ring:
            xx=s*.971+b*.24;yy=-s*.24+b*.971;r=np.sqrt(xx**2+(yy/.275)**2)
            mask=(r>1.27)&(r<2.04)&(~disk|(yy<0));r=r[mask]
            strength=.57+.24*np.sin(r*27)**2+.07*np.cos(r*67);strength*=np.where((r>1.72)&(r<1.78),.13,1);strength*=np.clip((r-1.27)*20,0,1)*np.clip((2.04-r)*22,0,1)
            row[mask]=row[mask]*(1-strength[:,None])+np.array([208,174,140])*strength[:,None]
        return row
    for j in range(max(0,int(H*(v-half/np.pi))-3),min(H,int(H*(v+half/np.pi))+4)):
        t=(j+.5)*np.pi/H;ix=np.where((-np.cos(phi)*d[0]+np.sin(phi)*d[2])*np.sin(t)+d[1]*np.cos(t)>np.cos(half+.004))[0]
        if len(ix):im[j,ix]=sum(paint(phi[ix]+dx*2*np.pi/W,t+dy*np.pi/H,im[j,ix].copy()) for dx,dy in [(-.25,-.25),(.25,-.25),(-.25,.25),(.25,.25)])*.25
planet([-.39,.21,-.91],.122,'amber',True);planet([.47,.16,-.86],.048,'ice');planet([.56,.21,-.81],.011,'lilac');planet([.84,-.48,.23],.085,'red');planet([-.25,-.73,.68],.062,'lilac')
Image.fromarray(np.uint8(np.clip(im,0,255))).save(Path(__file__).with_name('winter-arm.webp'),quality=94,method=6)
