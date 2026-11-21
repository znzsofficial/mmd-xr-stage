"""Original equal-angle albedo sheets, sampled in 3D so neither pole nor seam splits the strata."""
from pathlib import Path
import numpy as np
from PIL import Image
out=Path(__file__).parent;rng=np.random.default_rng(2703);field=rng.random((64,64,64)).astype('f')
w,h=1536,768;phi=(np.arange(w)+.5)*2*np.pi/w;theta=((np.arange(h)+.5)*np.pi/h)[:,None]
x=-np.sin(theta)*np.cos(phi);y=np.broadcast_to(np.cos(theta),x.shape);z=np.sin(theta)*np.sin(phi)
def noise(f):
    a,b,c=(v*f+9.37 for v in (x,y,z));i,j,k=(np.floor(v).astype(int) for v in (a,b,c));u,v,t=a-i,b-j,c-k;u,v,t=(q*q*(3-2*q) for q in (u,v,t));result=0
    for dx in (0,1):
        for dy in (0,1):
            for dz in (0,1):result+=field[(i+dx)%64,(j+dy)%64,(k+dz)%64]*(u if dx else 1-u)*(v if dy else 1-v)*(t if dz else 1-t)
    return result-.5
n=noise(4);f=noise(17);g=noise(86);grain=noise(210);mix=lambda a,b,q:np.array(a)+(np.array(b)-np.array(a))*np.clip(q,0,1)[:,:,None]
ember=mix([114,67,61],[217,164,108],.61+n+f*.48);dust=np.zeros_like(x)
for i in range(30):
    yy=1-(i+.5)/15;ss=np.sqrt(1-yy**2);a=i*2.39996+.38;xx,zz=ss*np.sin(a),ss*np.cos(a);width=.007+.036*((i*13%29)/29)**2
    d=(1-xx*x-yy*y-zz*z)/width;theta=np.arctan2(y-yy,z*xx-x*zz);r=np.maximum(d,.001)**.5
    dust+=23*np.exp(-((d-1)/.27)**2)-23*np.exp(-d*1.70)+15*np.exp(-((r-1.28)/.45)**2)*(np.sin(19*theta+i+f*2)**8)
ember+=(dust+f*14+g*19+grain*9)[:,:,None];Image.fromarray(np.uint8(np.clip(ember,0,255))).save(out/'ember-basins.webp',quality=91,method=6)
s=np.sin(4.2*x-3.6*y+1.28*np.sin(4*z));r=np.cos(5*z+2.8*y+1.2*np.sin(5*x));k=s+.09*f+.014*g
ice=mix([65,120,149],[204,226,216],.57+.86*n+.40*f);ice+=(np.exp(-8*abs(k+.14))*27-np.exp(-24*abs(k))*71+np.exp(-18*abs(r+.12*f))*18+g*19+grain*8)[:,:,None]
Image.fromarray(np.uint8(np.clip(ice,0,255))).save(out/'frost-rifts.webp',quality=91,method=6)
