"""Original scalar fields, not sky colours or painted stars/planets. U wraps
around the sphere; each shell is sampled at its own finite ray intersection."""
from pathlib import Path
import numpy as np
from PIL import Image

out = Path(__file__).parent
rng = np.random.default_rng(31815)
table = rng.random((64, 64, 64), dtype=np.float32)

def field(x, y, z, f):
    a,b,c=[q*f+13.17 for q in (x,y,z)]
    i,j,k=[np.floor(q).astype(np.int32) for q in (a,b,c)]
    a,b,c=[q*q*(3-2*q) for q in (a-i,b-j,c-k)]
    def col(n,m):return table[(i+n)%64,(j+m)%64,k%64]*(1-c)+table[(i+n)%64,(j+m)%64,(k+1)%64]*c
    return ((1-a)*col(0,0)+a*col(1,0))*(1-b)+((1-a)*col(0,1)+a*col(1,1))*b-.5

w,h=2048,1024; result=np.zeros((h,w,3),np.uint8);phi=(np.arange(w)+.5)*np.pi*2/w
for row in range(0,h,32):
    th=(np.arange(row,row+32)[:,None]+.5)*np.pi/h
    x=-np.sin(th)*np.cos(phi);z=np.sin(th)*np.sin(phi);y=np.broadcast_to(np.cos(th),x.shape)
    warp=field(x,y,z,4.5); skin=field(x+.09*warp,y,z,14);grain=field(x,y,z,42); fine=field(x,y,z,119)
    # A bifurcated shell: a broken warm shock front wraps around a cold cavity.
    lat=y+.29*x+.065*z+.15*np.sin(3.1*x+2*z)+.07*np.sin(7*x-3*y)
    bend=lat+.29*warp+.085*skin+.033*grain+.009*fine
    pockets=.60+.40*np.sin(2.5*x-2.7*z+2*warp)**2
    shear=field(.65*x+.13*warp,2.9*y-.24*skin,1.08*z,33)+.33*field(x,3.3*y,z,74)
    broad=np.exp(-(bend/.235)**2)*pockets*np.clip(.51+.90*warp+.67*skin+.39*grain+.19*shear,0,1)
    ridges=(np.exp(-((bend-.105)/.017)**2)+.47*np.exp(-((bend-.145)/.010)**2)+.32*np.exp(-((bend+.105)/.021)**2))
    ribbons=np.exp(-((bend-.050*shear+.09*skin)/.133)**2)*np.exp(-12*abs(shear+.21*grain))
    front=(ridges+.43*ribbons)*np.clip(.42+.98*skin+.53*grain+.23*fine,0,1)*pockets
    veil=np.exp(-((bend+.015+.10*field(x+2,y,z,6))/.077)**2)*np.clip(.76+skin+.26*grain,0,1)
    result[row:row+32]=np.uint8(255*np.clip(np.stack((broad,front,veil),-1),0,1))
Image.fromarray(result).save(out/'tidal-cloud-fields.webp',lossless=True,method=6)

# Seamless gas currents in body-local longitude/latitude, sampled only on the
# gas giant's disc. A sheared oval vortex with curled filaments and a pale eye.
w,h=1024,512;phi=(np.arange(w)+.5)*2*np.pi/w-np.pi;t=(np.arange(h)+.5)[:,None]*np.pi/h; y=np.cos(t);x=np.sin(t)*np.sin(phi);z=np.sin(t)*np.cos(phi)
lon=np.broadcast_to(phi,x.shape).copy(); lat=np.broadcast_to(y,x.shape).copy()
# Advect the stripes into the anticyclones. Closed concentric rings painted
# over straight bands read as wood grain when the entire disc is 150 px wide.
for cx,cy,rx,ry,twist in [(-.28,.47,.48,.15,3.6),(.75,.14,.29,.09,-2.9),(-1.30,-.35,.39,.12,3.3),(2.2,.36,.36,.09,3.0)]:
    dx=np.arctan2(np.sin(lon-cx),np.cos(lon-cx))/rx;dy=(lat-cy)/ry;a=twist*np.exp(-1.3*(dx**2+dy**2));ca=np.cos(a);sa=np.sin(a)
    lon+=(dx*ca-dy*sa-dx)*rx;lat+=(dx*sa+dy*ca-dy)*ry
u=field(x,y,z,4);v=field(np.sin(lon)+.12*u,lat*2.4,np.cos(lon),13);s=field(x+.06*v,lat*3,z,51)
band=lat+.042*u+.022*v+.006*s+.015*np.sin(5*lon+8*lat)
k=np.clip(.52+.24*np.sin(22*band+.8*np.sin(5*band))+.13*np.cos(65*band+3*u)+.06*np.sin(172*band+6*v)+.12*v,0,1)
mix=lambda a,b,p:np.array(a)+(np.array(b)-np.array(a))*p[...,None]
col=mix([120,67,64],[251,223,178],k)
ex=(phi+.28)/.48;ey=(y-.47)/.15;r=np.sqrt(ex*ex+ey*ey);vortex=np.exp(-1.8*r**3)
col=col*(1-.68*vortex[...,None])+mix([155,63,45],[253,183,123],k)*(.68*vortex[...,None]);col+=np.exp(-8*r**2)[...,None]*[13,14,13]
col+=(10*v+6*s)[...,None];Image.fromarray(np.uint8(np.clip(col,0,255))).save(out/'storm-belts.webp',quality=94,method=6)
