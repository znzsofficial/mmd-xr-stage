"""Original mineral prints for the twin moons (NumPy + Pillow, no source photos).

One mip-filtered lookup per surface: RG tangent slopes, B stone tone, A film
or oxidised seam coverage. Keep alpha >= 1/2 through browser image decoding.
The art is cut on the sphere, not a planar pattern squeezed onto the poles.
"""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).parent
W, H = 3072, 1536  # supersample actual cleavage geometry for a 1536x768 field
tau = 2*np.pi
theta = (np.arange(H, dtype='f')[:, None]+.5)*np.pi/H
phi = (np.arange(W, dtype='f')+.5)*tau/W
x = -np.sin(theta)*np.cos(phi)
y = np.broadcast_to(np.cos(theta), x.shape)
z = np.sin(theta)*np.sin(phi)


def cells(n, seed):
    """Nearest spherical tangent frame and distance to the next plate."""
    rng = np.random.default_rng(seed)
    i = np.arange(n)
    sy = 1-(i+.5)*2/n
    angle = 2.399963*i+.24
    ss = np.sqrt(1-sy*sy)
    sites = np.column_stack((ss*np.cos(angle), sy, ss*np.sin(angle)))
    sites += rng.uniform(-.58, .58, sites.shape)/np.sqrt(n)
    sites /= np.linalg.norm(sites, axis=1, keepdims=True)
    # Only neighbouring latitudes can win; process in strips to bound memory.
    ids = np.empty(x.shape, 'i'); gap = np.empty_like(x)
    for j in range(0, H, 8):
        sl = slice(j,j+8); pole = y[sl,0]
        best = np.full_like(x[sl], -2); second = best.copy(); owner = ids[sl]
        for k in np.flatnonzero((sites[:,1] > pole.min()-5/np.sqrt(n)) &
                                (sites[:,1] < pole.max()+5/np.sqrt(n))):
            a,b,c = sites[k]; d = x[sl]*a+y[sl]*b+z[sl]*c
            win = d > best
            second = np.maximum(second,np.minimum(d,best))
            owner[win] = k; best = np.maximum(best,d)
        gap[sl] = (best-second)*n
    east = np.stack((sites[:,2], sy*0, -sites[:,0]), axis=1)
    east /= np.linalg.norm(east,axis=1,keepdims=True)
    north = np.cross(sites,east); yaw = rng.uniform(0,tau,n)[:,None]
    a,b = east*np.cos(yaw)+north*np.sin(yaw), north*np.cos(yaw)-east*np.sin(yaw)
    def project(axis):
        return ((x*axis[ids,0]+y*axis[ids,1]+z*axis[ids,2])*np.sqrt(n)).astype('f')
    return project(a),project(b),gap,rng.random(n).astype('f')[ids]


def smooth(a,b,v):
    t = np.clip((v-a)/(b-a),0,1)
    return t*t*(3-2*t)


def write(name,radius,depth,tone,accent):
    arc_x = radius*tau/W*np.sin(theta)
    # Tangent perturbation is -gradient(height); the north/texture V axis
    # points against the bitmap row direction.
    nx = -(np.roll(depth,-1,axis=1)-np.roll(depth,1,axis=1))/(2*arc_x)
    ny = np.gradient(depth,axis=0)/(radius*np.pi/H)
    def channel(v):
        im = Image.fromarray(np.uint8(np.clip(v,0,1)*255+.5))
        return im.resize((W//2,H//2),Image.Resampling.LANCZOS)
    texture = Image.merge('RGBA',tuple(map(channel,(.5+.5*nx,.5+.5*ny,tone,.5+.49*accent))))
    texture.save(OUT/name,quality=94,alpha_quality=91,method=6)


def salt():
    u,v,edge,seed = cells(840,174)
    # A halite hopper has square terraces turning back into its centre.
    # Only some cells host exposed hoppers; the others retain cloudy brine.
    q = np.maximum(np.abs(u)*(.80+.55*seed),np.abs(v)*1.08)*(.63+.94*seed)
    crystal = (1-smooth(.92,1.18,q))*smooth(.10,.54,edge)*smooth(.16,.40,seed)
    steps = (np.cos(q*18.6-seed*1.3)*.5+.5)**4
    lip = np.exp(-((q-.89)/.083)**2)
    grout = np.exp(-(edge/.25)**2)
    strata = np.sin(12*x-7*y+2.6*np.cos(3*z))+np.sin(16*z+5*y)
    milk = .54+.09*strata+.15*seed-.22*grout
    tone = milk+crystal*(.24*steps+.12*lip-.35*(1-np.minimum(q,1)))
    depth = .011*seed+.011*strata+.018*grout+crystal*(.021*q+.008*steps+.013*lip+.017*(.57*u-v))
    write('salt-hoppers.webp',4.8,depth,tone,crystal*(.32*steps+.95*lip))


def glaze():
    u,v,edge,seed = cells(245,754)
    # Conchoidal break: a percussive bulb at one end of each spall and
    # eccentric, nested arrest lines opening across its curved fracture face.
    wave = np.sqrt((.72*u+.46+1.7*seed)**2+(.89*v+.24*u*u-.21)**2)
    ripple = wave*(10+11*seed)+.83*np.sin(v*2+.9*seed)+.46*np.sin(3.6*wave)
    scars = (.5+.5*np.cos(ripple))**5*smooth(.12,.50,edge)*(.18+.82*smooth(.24,.76,seed))
    bulb = np.exp(-((wave-.63)/.24)**2)
    cut = np.exp(-(edge/.17)**2)
    run = 7*z-3.4*x+2.8*np.sin(3*y+1.6*x)+1.2*np.cos(3.2*x-2*z)
    flow = .5+.5*np.sin(run); slag = .5+.5*np.sin(2*run-1.1+1.45*np.cos(5*y+x))
    # Only a few flow contacts carry a line of iron oxide; the host remains black glass.
    seam = np.exp(-((slag-.48)/.062)**2)*(.34+.66*flow)
    rank = .16+.30*seed+.18*flow+.13*bulb+.18*scars-.16*cut+.05*np.sin(4*run+np.cos(3*z))
    depth = .018*seed+.019*bulb+.014*scars-.016*cut+.016*np.cos(wave*2.4)+.016*(u*.36+v*(seed-.5))
    write('glaze-fractures.webp',4.6,depth,rank,seam+.22*cut*flow)


if __name__ == '__main__':
    salt(); glaze()
