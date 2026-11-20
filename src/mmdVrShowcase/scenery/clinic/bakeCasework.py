"""Oak shelves, sealed sage sides and recessed back. Requires Pillow and NumPy."""
from pathlib import Path
import numpy as np
from PIL import Image

N = 248
y, x = np.mgrid[:N, :N] / N
rng = np.random.default_rng(7431)


def field(cols, rows):
    a = rng.normal(0, 1, (rows, cols)).astype('float32')
    return np.asarray(Image.fromarray(a).resize((N, N), Image.Resampling.BICUBIC))


out = {k: Image.new('RGB' if k != 'rough' else 'L', (512, 512)) for k in ('color', 'normal', 'rough')}


def chip(slot, rgb, height, rough):
    # Texture v increases upward, bitmap rows downward. No height from paint colour.
    dy, dx = np.gradient(height)
    n = np.stack((-dx, dy, np.ones_like(dy)), axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    for k, a in [('color', rgb), ('normal', 127.5 + 127.5*n), ('rough', 255*rough)]:
        a = np.uint8(np.clip(a, 0, 255))
        padded = np.pad(a, [(4, 4), (4, 4)]+([(0, 0)] if a.ndim == 3 else []), mode='edge')
        out[k].paste(Image.fromarray(padded), ((slot % 2)*256, (slot // 2)*256))


for s in (0, 1):
    warp = .55*np.sin(x*3.8+s) + .29*field(3, 6)
    phase = (11 if s == 0 else 1.75)*y + warp*(1 if s == 0 else .25)
    grain = np.power(.5+.5*np.sin(2*np.pi*phase), 5)
    pores = np.maximum(0, field(65, 140 if s == 0 else 22)-.28)
    value = 3.6*field(7, 30 if s == 0 else 8) - 18*grain - 6*pores
    base = np.array([185, 155, 116]) if s == 0 else np.array([172, 138, 102])
    chip(s, base + value[...,None]*[.98,.84,.70], -.48*grain-.16*pores, .51+.15*grain+.025*pores)

for s in (2, 3):
    orange_peel = field(76, 96)
    pigment = np.array([194, 202, 191]) + (2.0*field(8, 11)+1.8*orange_peel)[...,None]
    if s == 3:
        # Low-frequency contact shade at the back of each bay.
        world_y = 1.47-y*1.36
        occ = np.maximum.reduce([np.exp(-np.abs(world_y-level)/.062) for level in (.21,.63,1.02,1.46)])
        pigment *= (1-.19*occ-.10*np.exp(-np.minimum(x,1-x)/.045))[...,None]
    chip(s, pigment, .19*orange_peel, .69+.038*orange_peel+.019*field(9, 13))

for k, im in out.items():
    path = Path(__file__).with_name(f'casework-{k}.webp')
    im.save(path, quality=90, lossless=k!='color', method=6)
