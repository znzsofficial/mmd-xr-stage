"""Finely banded copal in a dark mineral matrix, containing pressed fern pinnae.
All marks use sphere directions; circles around a pole and across the UV seam stay continuous."""
from pathlib import Path
import numpy as np
from PIL import Image

w,h=1280,640
p=(np.arange(w)+.5)*2*np.pi/w; t=((np.arange(h)+.5)*np.pi/h)[:,None]
x=-np.sin(t)*np.cos(p); y=np.broadcast_to(np.cos(t),x.shape); z=np.sin(t)*np.sin(p)
def blend(a,b,v): return np.array(a)+(np.array(b)-np.array(a))*np.clip(v,0,1)[:,:,None]
f=2.9*y+1.32*x-.83*z+.28*np.sin(4*z-2*x)+.12*np.cos(6*y+x)
fine=np.sin(63*x+7*np.sin(8*z-4*y))*np.sin(44*y-55*z)
flow=np.sin(5*f); rind=np.clip(-3*(flow+.55)+.22*fine,0,1)
resin=blend([139,61,31],[255,195,87],.47+.37*np.cos(3.8*f)+.14*np.sin(17*z-4*y)+.055*fine)
cortex=blend([63,45,48],[114,79,65],.49+.23*np.sin(27*f)+.19*fine)
rgb=blend(resin,cortex,rind); lines=np.sin(62*f+.60*np.sin(11*x-9*z))
rgb+=(6*lines+12*np.maximum(0,lines)**13+4*fine)[:,:,None]*(1-rind*.76)[:,:,None]

# Rounded resin windows with asymmetric leaves and pinnate venation inside.
for i,(a,b,c,size,spin) in enumerate([(.69,.62,.38,.46,.46),(-.2,.88,-.51,.38,-.66),(.49,-.32,-.81,.62,.8),(-.37,-.57,.73,.58,-.32),(-.85,.28,-.36,.36,.25),(.28,.05,.96,.31,-1.1)]):
    n=np.array([a,b,c]);n/=np.linalg.norm(n);u=np.cross([0,1,0],n);u/=np.linalg.norm(u);v=np.cross(n,u)
    dot=lambda q:q[0]*x+q[1]*y+q[2]*z
    X=(np.cos(spin)*dot(u)+np.sin(spin)*dot(v))/size; Y=(-np.sin(spin)*dot(u)+np.cos(spin)*dot(v))/size
    d=np.hypot((X+.08*np.sin(3*Y))*1.39,Y*.91); front=dot(n)>.3
    window=np.clip((1.10-d)/.16,0,1)*front
    honey=blend([134,59,27],[250,184,77],.64+.19*X+.13*np.cos(2.7*Y+.5*i)+.06*fine)
    honey+=((8*np.sin(31*d+4*X)+21*np.exp(-((d-.96)/.055)**2))*(1-.38*X))[:,:,None]
    rgb=blend(rgb,honey,window*.94)
    def stem(q):return .07*np.sin(2.9*q+.2)+.055*q
    ink=np.clip(1-np.abs(X-stem(Y))/.021,0,1)*(np.abs(Y)<.85)
    for j in range(10):
        yy=-.60+j*.145
        for side in [-1,1]:
            y0=yy+(.035 if side==1 else 0);reach=.11+.34*max(0,1-((y0+.05)/.94)**2)
            s=(X-stem(y0))*side/reach;ss=np.clip(s,0,1)
            axis=y0+(.18+.085*(1-j/10))*ss+.037*np.sin(np.pi*ss)
            half=.046*np.sin(np.pi*ss)**.75*(1.16-.4*ss); mask=(s>0)&(s<1)
            leaflet=np.clip((half-np.abs(Y-axis))/.013,0,1)*mask
            vein=np.clip(1-np.abs(Y-axis)/.009,0,1);ink=np.maximum(ink,leaflet*(.84-.30*vein))
    rgb=blend(rgb,[99,54,35],ink*window)
Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(Path(__file__).with_name('amber-inclusions.webp'),quality=91,method=6)
