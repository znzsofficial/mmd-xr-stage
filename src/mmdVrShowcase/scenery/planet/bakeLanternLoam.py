"""Moon UV print, sampled in 3D: humus pockets, branched hyphae and golden tips.
The layout adds the garden/path and canopy shadows as relief-aware vertex colours.
Run directly with NumPy and Pillow. No runtime procedural noise or shader.
"""
from pathlib import Path
import numpy as np
from PIL import Image


def bake():
    w,h=1536,768
    az=(np.arange(w,dtype=np.float32)+.5)*np.float32(2*np.pi/w)
    th=(np.arange(h,dtype=np.float32)[:,None]+.5)*np.float32(np.pi/h)
    x,y,z=-np.cos(az)*np.sin(th),np.cos(th),np.sin(az)*np.sin(th)
    sin,cos,exp=np.sin,np.cos,np.exp
    pockets=sin(8*x+5*z+1.3*cos(5*y))*cos(7*y-3*x+1.2*sin(5*z))
    fleck=sin(83*x+63*z+4*sin(37*y))*cos(92*y-34*z+4*cos(52*x))
    grit=sin(251*x+115*y+307*z)*cos(163*z+223*y+1.8*cos(231*x))
    coarse=.5+.5*pockets
    col=np.array([113,110,136])+coarse[...,None]*np.array([43,44,32])
    col+=np.minimum(0,pockets+.18)[...,None]*np.array([23,36,17])
    col+=(fleck*8+grit*9)[...,None]
    # A weathered network instead of a repeating tessellated cell lattice:
    # occasional long rhizomorphs cradle smaller, fading daughter filaments.
    f=10*x+7*z-3*y+1.05*sin(6*z-3*y)+.51*cos(11*y+3*x)+.12*sin(23*z+6*y)
    branch=sin(5*y+6*z+cos(3*x))*cos(3*z-5*x)
    ring=np.abs(sin(f)); visible=np.clip(.26+.79*branch,0,1)
    bank=exp(-(ring/.27)**2)*visible
    cord=exp(-(ring/.077)**2)*visible
    fine=np.abs(sin(2*f+2.2*sin(8*z+4*y)+.45*cos(16*x)))
    lateral=exp(-(fine/.065)**2)*exp(-ring*2.5)*(.65+.35*cos(9*y+8*x))*np.clip(branch+.48,0,1)
    col-=bank[...,None]*np.array([16,20,19]);col+=cord[...,None]*np.array([92,67,33])
    col+=lateral[...,None]*np.array([54,42,18])
    points=exp(-(fine/.14)**2)*np.maximum(0,cos(38*x-53*y+5*sin(9*z)))**14*visible
    col+=points[...,None]*np.array([82,67,38])
    Image.fromarray(np.clip(col,0,255).astype('uint8')).save(Path(__file__).with_name('lantern-loam.webp'),quality=87,method=6)


if __name__=='__main__':
    bake()
