"""Bedding, fossil hash and the five scallop shelves. No runtime canvas/noise.
Run beside tideLayout.ts with Pillow and NumPy. The shore UV is the metric chart;
the second, tileable plate is the exposed cross-section of the same limestone.
"""
from pathlib import Path
import numpy as np
from PIL import Image

sin, cos, exp, pi = np.sin, np.cos, np.exp, np.pi


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def tint(c, paint, amount):
    t = np.clip(amount[..., None], 0, 1)
    return c*(1-t)+np.array(paint)*t


def save(name, c):
    Image.fromarray(np.clip(c, 0, 255).astype('uint8')).save(Path(__file__).with_name(name), quality=88, method=4)


def shore():
    rng = np.random.default_rng(704)
    x = np.linspace(-2.4, 8.32, 1536, dtype='float32')[None, :]
    z = np.linspace(-3.22, 3.22, 920, dtype='float32')[:, None]
    fold = sin(.96*x+1.2*z)+.4*cos(1.7*z-.51*x)+.19*sin(5.5*x+2.1*z)
    grit = rng.normal(0, 3, (len(z), x.size))
    field = 3.3*z-.73*x+.72*fold+.04*sin(21*z+9*x)
    c = np.array([111, 130, 126])+(13*cos(field)+7*sin(2*field+cos(x)))[..., None]
    c = tint(c, [178, 152, 128], .43*smooth(-.3, 1, fold))
    c = tint(c, [81, 92, 93], .56*exp(-(np.abs(sin(field))/.13)**2))
    c = tint(c, [194, 196, 165], .58*exp(-(sin(4*field+.7*sin(3*x))/.115)**2)*smooth(-.8, .65, sin(x+4*z)))
    # Pool floor is dark rock, criss-crossed by pale, discontinuous coquina.
    bay = (1-smooth(.35, 1.12, np.abs(z+1.17+.17*sin(.9*x+.52))))*smooth(.3, .95, x)*(1-smooth(3.36, 4.44, x))
    c = tint(c, [70, 103, 103], .65*bay)
    bank = z+1.17+.17*sin(.9*x+.52)
    for mark in [-.82,-.64,.55,.71]:
        strand = np.abs(bank-mark-.055*sin(3.2*x+mark)-.023*cos(7.4*x))
        c=tint(c,[195,194,161],.61*exp(-(strand/.035)**2)*smooth(.41,1.0,x)*(1-smooth(3.36,4.09,x))*(.59+.39*sin(2*x+mark)))
    # Upslope convex edges and fluted bivalve fans. Their open edges are drawn
    # on the real rounded noses, not on perfect rectangles painted across them.
    off = .16*cos(np.clip(z/.97,-1,1)*pi*.5)+.034*z+.028*cos(26*np.arctan2(z,.84))
    for i, nose in enumerate([1.40, 1.69, 1.98, 2.27, 2.56]):
        u = x-off-nose
        border = 1-smooth(.66, 1.02, np.abs(z+.04*sin(i*4)))
        k = smooth(-.24, -.19, u)*(1-smooth(.014, .095, u))*border
        angle = np.arctan2(z, .68+.06*x); radial = 26*angle
        rib = .5+.5*cos(radial)
        rings = cos(43*(u+.08*z*z)+.58*sin(7*z))
        shell = np.array([181, 127+i*3, 108+i*4])+(43*rib**2-11*sin(radial)+7*rings+4*cos(3*radial+2*i))[...,None]
        shell = tint(shell,[217,207,175],.36*smooth(.14,1.0,cos(radial+.7)*sin(4*z+.51*i)))
        c = tint(c, shell, k*(1-.62*bay))
        c = tint(c, [239, 218, 173], border*.83*exp(-((u+.025+.009*cos(49*angle))/.022)**2))
        c = tint(c, [98, 93, 99], border*.55*exp(-((u-.047)/.023)**2))
    # The high shore is a weathered surface; the dried fan inside is a broad
    # nacre plate, with an asymmetric growth nucleus and a fractured margin.
    rx, rz = x-5.5, z
    a, d = np.arctan2(rz,rx), np.hypot(rx,rz)
    edge = 1.32+.049*cos(5*a)+.026*sin(8*a+.8)
    # Broad flutes radiate from a broken, offset hinge and split into two
    # secondary folds. Four older growth lips cross them, not a field of rings.
    la = np.arctan2(rz+.07, rx+1.28); dist=np.hypot(rx+1.28,rz+.07)
    band = dist+.054*sin(7*la)+.042*cos(15*la-.7*dist)
    rays=22*la+.48*sin(5*la)+.21*sin(2.4*dist)
    ir=.5+.5*sin(2.3*dist-2*la+cos(2*la))
    nacre=np.array([155,166,164])+ir[...,None]*np.array([62,21,5]); face=.5+.5*cos(rays)
    nacre+=(26*face**2-16*sin(rays)+6*cos(2*rays)-5*sin(3*rays))[...,None]
    nacre=tint(nacre,[242,227,191],.43*exp(-(np.sin(.5*(rays-.30))/.26)**2)*smooth(.12,.62,dist))
    for j,mark in enumerate([.47,.97,1.62,2.2]):
        h=band-mark-.07*cos(3*la+j)
        nacre=tint(nacre,[115,105,107],.56*exp(-((h+.022)/.027)**2))
        nacre=tint(nacre,[245,221,183],.77*exp(-((h-.021)/.030)**2))
    c=tint(c,nacre,1-smooth(-.055,.018,d-edge))
    for j,mark in enumerate([-.028,.076,.167]):
        h=d-edge-mark
        c=tint(c,[83,79,81],.64*exp(-((h-.027)/.026)**2))
        c=tint(c,[235,206-j*7,166-j*6],.85*exp(-(h/.029)**2))
    # Inlaid timber at the wind landing. Every board is flush with support;
    # weathered end grain, nailheads and worn seams read even under the ring.
    dock = (1-smooth(1.05,1.14,np.abs(z-.0)))*(1-smooth(1.17,1.33,np.abs(x-.01)))
    seam = (x+.035*sin(3*z))*4
    plank = np.floor(seam); grain=cos(38*x+.75*cos(5*z+plank)+.41*sin(16*x+1.2*z))
    wood=np.array([134,119,103])+(8*sin(plank*2.3)+7*grain+4*cos(99*x+1.5*cos(4*z)))[...,None]
    wood=tint(wood,[69,75,72],.82*exp(-(np.sin(pi*seam)/.13)**2))
    pin=(np.mod(x+.064,.25)-.125)**2+(np.abs(z)-.89)**2
    wood=tint(wood,[72,81,78],.94*exp(-pin/.00026))
    c=tint(c,wood,dock*(1-bay)*smooth(-1.12,-.67,z+.55*(1-smooth(.4,1.2,x))))
    # Broken valves and tiny lime needles in the dark matrix, not noise
    # sprinkled over the dock or over the fan structure of the stage.
    for _ in range(350):
        cx,cz=rng.uniform(-2.35,8.22),rng.uniform(-3.2,3.2)
        if abs(cx)<1.3 and abs(cz)<1.05 or np.hypot(cx-5.5,cz)<1.25: continue
        r=rng.uniform(.012,.073); xx=np.where(abs(x[0]-cx)<r*1.3)[0]; zz=np.where(abs(z[:,0]-cz)<r*1.3)[0]
        if not len(xx) or not len(zz): continue
        u=(x[:,xx]-cx)/r; v=(z[zz]-cz)/r; a=rng.uniform(0,6.28)
        U=u*cos(a)+v*sin(a); V=(v*cos(a)-u*sin(a))/rng.uniform(.30,.78)
        dd=np.hypot(U,V); frac=sin(11*np.arctan2(V,U)+1.7*dd)
        mask=(1-smooth(.74,1.0,dd))*smooth(-.7,.2,U+.7*V)
        ix=np.ix_(zz,xx); c[ix]=tint(c[ix],np.array([205,183,156])+(13*frac)[...,None],mask*.72)
    save('tide-shore.webp',c+grit[...,None])
    # Shallow dry shell ribs rise from the physical cut plane. A normal print
    # keeps the light response of a fluted face without buckling actor support.
    relief=(.020*cos(rays)-.004*cos(2*rays))*(1-smooth(-.06,.02,d-edge))*smooth(.12,.61,dist)
    for mark in [.47,.97,1.62,2.2]: relief+=.013*exp(-((band-mark)/.041)**2)*(1-smooth(-.06,.02,d-edge))
    dy,dx=np.gradient(relief,6.44/(len(z)-1),10.72/(x.size-1)); den=np.sqrt(1+dx*dx+dy*dy)
    n=np.stack((-dx/den,dy/den,1/den),axis=-1)
    save('tide-valve-normals.webp',(n*.5+.5)*255)


def section():
    rng=np.random.default_rng(719)
    a,b=np.meshgrid(np.arange(512)*2*pi/512,np.arange(512)*2*pi/512)
    f=4*b+.58*sin(2*a+b)+.23*sin(3*a-b)+.19*cos(5*a+2*b)+.08*cos(11*a+3*b)
    q=cos(2*a+3*b+.8*sin(a-2*b)); lamina=exp(-(sin(f)/.19)**2)
    rock=np.array([211,216,212])+(9*sin(f)+7*q+5*cos(2*f-2*a))[...,None]
    rock=tint(rock,[147,168,163],.33*lamina)
    rock=tint(rock,[249,236,205],.66*exp(-(sin(2*f+.4*cos(4*a+b))/.14)**2)*(.56+.43*q))
    # Weathered flake edges pinching in and out of hairline bedding; narrow
    # paired cuts rather than dark holes that tiled into a regular polka dot.
    drift=.54*sin(a-b)+.24*cos(2*a+b)+.16*sin(4*a-3*b)
    for j in range(4):
        k=sin((j+1)*b+.45*sin(2*a)+.25*drift+j*.81)
        keep=smooth(.0,.66,sin(a*(j+1)-2*b+.91*j)+.4*drift)
        rock=tint(rock,[175,187,180],.41*exp(-((k+.07)/.050)**2)*keep)
        rock=tint(rock,[250,242,219],.53*exp(-(k/.042)**2)*keep)
    save('tide-section.webp',rock+rng.normal(0,4,a.shape)[...,None])


if __name__=='__main__':
    shore(); section()
