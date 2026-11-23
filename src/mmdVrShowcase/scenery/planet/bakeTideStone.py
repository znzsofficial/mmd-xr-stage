"""07 | Sea-cut chalk, at metric scale. Run with Python, NumPy and Pillow.

The shore is a unique chart. Sparse beach-worn shell fragments are centimetres
long; there is no enlarged valve under the performer. Bedding orientation and
live wetness are supplied by the rock mesh/material, not painted shadows.
"""
from pathlib import Path
import numpy as np
from PIL import Image


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def tint(base, ink, alpha):
    t = np.clip(alpha[..., None], 0, 1)
    return base*(1-t)+np.asarray(ink)*t


def save(name, image, size=None):
    out = Image.fromarray(np.clip(image, 0, 255).astype('uint8'))
    if size:
        out = out.resize(size, Image.Resampling.LANCZOS)
    out.save(Path(__file__).with_name(name), quality=87, method=6)


def chalk_grain(rng, shape, size):
    """Band-limited, seamless field; sizes and amplitudes are independent."""
    h, w = shape
    f = np.fft.rfft2(rng.normal(size=shape))
    ky, kx = np.fft.fftfreq(h)[:, None], np.fft.rfftfreq(w)[None, :]
    layer = np.fft.irfft2(f*np.exp(-(kx*kx+ky*ky)*(size**2)), s=shape, axes=(0, 1))
    return layer/max(.000001, layer.std())


def shore():
    rng = np.random.default_rng(709)
    size = (896, 896)
    x = np.linspace(-2.4, 7.35, size[1])[None, :]
    z = np.linspace(-5.05, 5.05, size[0])[:, None]
    broad = chalk_grain(rng, size, 170)
    worn = chalk_grain(rng, size, 47)
    grit = chalk_grain(rng, size, 6)
    quiet = smooth(3.7, 4.8, x)*(1-smooth(.85, 1.70, abs(z)))
    c = np.array([235, 214, 182])+(4*broad+2*worn)[..., None]
    # Pale calcareous sand thinning out over blue-grey clay in the long pool.
    axis = z+1.18+.16*np.sin(.85*x+.52)
    pool = (1-smooth(.38, 1.07, abs(axis)))*smooth(.35, 1.08, x)*(1-smooth(3.45, 4.55, x))
    c = tint(c, [153, 180, 193], .68*pool)
    c = tint(c, [246, 228, 202], .79*quiet)
    # Outer sweep of the high bank is warm iron-bearing stone. The low
    # route crosses cooler, shell-rich chalk, not the same sand at all levels.
    bank = smooth(.52, 1.20, z+.11*np.sin(x))*(1-smooth(2.19, 2.83, z))
    c = tint(c, [219, 191, 162], .70*bank*smooth(.65, 1.65, x)*(1-smooth(5.62, 6.76, x)))
    steps = (1-smooth(.55, 1.03, abs(z)))*smooth(1.05, 1.50, x)*(1-smooth(3.09, 3.86, x))
    c = tint(c, [221, 216, 204], .68*steps)
    # A few lenticular exposures, with no repeated contour around a step.
    lamina = .85*z-.12*x+.15*broad+.33*np.sin(.60*x)
    for strike, start, end in [(1.37, -.4, 2.7), (-2.14, .38, 4.1), (1.4, 4.1, 7.25)]:
        d = abs(lamina-strike)
        lens = smooth(start, start+.70, x)*(1-smooth(end-.70, end, x))
        c = tint(c, [223, 191, 158], .49*(1-smooth(.02, .25, d))*lens)
    # Real coquina: handfuls of off-centre, overlapping half-valves washed
    # up in the lee of individual banks. Their highlights come from normals.
    relief = .00020*grit+.00055*worn
    for cx, cz, spread_x, spread_z, n in [(-.3, 1.49, .51, .17, 25),
            (1.9, -.41, .41, .18, 38), (3.25, .70, .59, .15, 47),
            (4.0, -1.69, .42, .23, 23), (6.4, 1.72, .54, .17, 39)]:
        for _ in range(n):
            px, pz = rng.normal(cx, spread_x), rng.normal(cz, spread_z)
            rad, rot = rng.uniform(.020, .059), rng.uniform(0, 6.28)
            ix = np.where(abs(x[0]-px) < rad*1.3)[0]
            iz = np.where(abs(z[:, 0]-pz) < rad*1.3)[0]
            if not len(ix) or not len(iz): continue
            u, v = (x[:, ix]-px)/rad, (z[iz]-pz)/rad
            s, t = u*np.cos(rot)+v*np.sin(rot), (v*np.cos(rot)-u*np.sin(rot))/.66
            d, a = np.hypot(s, t), np.arctan2(t, s+.34)
            intact = (1-smooth(.74, 1, d))*smooth(-.71, -.30, s+.24*t)
            ridge = .5+.5*np.cos(9*a)
            region = np.ix_(iz, ix)
            c[region] = tint(c[region], np.array([245, 231, 205])+(5*ridge)[..., None], intact*.83)
            relief[region] += intact*(.002*(1-np.minimum(1, d))+.0014*ridge)
    save('tide-shore.webp', c+(1.25*grit+rng.normal(0, .8, size))[..., None])
    dz, dx = np.gradient(relief, 10.10/(size[0]-1), 9.75/(size[1]-1))
    inv = 1/np.sqrt(1+dx*dx+dz*dz)
    save('tide-valve-normals.webp', (np.stack((-dx*inv, dz*inv, inv), axis=-1)*.5+.5)*255, (448, 448))


def section():
    rng = np.random.default_rng(743)
    shape = (384, 384)
    flake = chalk_grain(rng, shape, 23)
    pore = chalk_grain(rng, shape, 5)
    powder = chalk_grain(rng, shape, 73)
    # The regional material is the vertex paint. This achromatic microprint
    # stays very pale so it cannot impose a second colour or repeat broad veins.
    c = np.array([246, 244, 241])+(1.6*powder+1.9*flake+.9*pore)[..., None]
    c = tint(c, [193, 191, 189], .30*smooth(1.05, 2.1, pore)*smooth(.31, 1.3, flake))
    save('tide-section.webp', c+rng.normal(0, 1.4, shape)[..., None])


if __name__ == '__main__':
    shore()
    section()
