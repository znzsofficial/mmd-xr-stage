"""Gate-only linear XY normal + perceptual roughness. Pillow, NumPy; no albedo input."""
from pathlib import Path
import numpy as np
from PIL import Image

N, PAD = 240, 8
y, x = (np.mgrid[:N, :N] + .5) / N  # y increases DOWN in the file
tau = np.pi * 2
rng = np.random.default_rng(1893)
plate = Image.new('RGB', (512, 512), (128, 128, 232))


def field(nx, ny):
    a = rng.normal(0, 1, (ny, nx))
    u, v = x * nx, y * ny
    i, j = u.astype(int), v.astype(int)
    u, v = u % 1, v % 1
    u, v = u*u*(3-2*u), v*v*(3-2*v)
    return sum(a[(j+b) % ny, (i+c) % nx] * (v if b else 1-v) *
               (u if c else 1-u) for b in range(2) for c in range(2))


def pack(col, row, height, metres, roughness):
    # Physical surface heights in metres; gentle enough to keep the visible hemisphere.
    dy, dx = np.gradient(height, metres[1]/N, metres[0]/N)
    norm = np.sqrt(1 + dx*dx + dy*dy)
    rgb = np.dstack([.5-.5*dx/norm, .5+.5*dy/norm, roughness])
    # Steps under one degree in tangent space; compressible without introducing
    # lossy WebP chroma cross-talk between roughness and the two slope axes.
    data = (2*np.rint(127.5*np.clip(rgb, 0, 1))).clip(0,255).astype('uint8')
    plate.paste(Image.fromarray(np.pad(data, ((PAD,PAD),(PAD,PAD),(0,0)), mode='edge')), (col*256,row*256))


# A broad lime float dragged across fine sand. No high-contrast white flecks.
float_marks, sand = field(4, 15), field(82, 91)
pack(0, 0, .0022*float_marks + .00050*sand + .0011*field(16,9),
     (1.62,1.4), .935+.026*np.tanh(float_marks))

# Eight fired pan-and-cover courses across one repeat. Rolled crowns and lips
# have a somewhat tighter lobe than the open clay trough, not painted white edges.
phase = (x*8+.5) % 1-.5
crown = np.exp(-.5*(phase/.141)**2)
lip = ((y*6+.18*(1-crown)) % 1)
height = .031*crown + .0045*np.cos(phase*tau) + .004*(lip-.5) - .003*np.exp(-((lip-.986)/.045)**2)
pack(1, 0, height+.0006*field(21,19), (1.22,.57), .78-.26*crown+.031*np.tanh(field(12,10)))

# Raised stiles and two fielded door panels: the rectangle is joinery, not a
# Sobel filter of the ink, rubbed edges or colour of the printed door.
u, v = x*1.56, y*2.665
def raised(bounds, bevel):
    l,t,r,b=bounds
    d=np.minimum.reduce([u-l,r-u,v-t,b-v]); a=np.clip(d/bevel,0,1)
    return a*a*(3-2*a)

height=.0022*field(6,2)+.00044*field(49,5)
for a,b in [(51/488,166/488),(187/488,435/488)]:
    for inset,h in [(0,.012),(.023,-.016),(.054,.010)]:
        height += h*raised((55/488*1.56+inset,a*2.665+inset,(1-55/488)*1.56-inset,b*2.665-inset),.019)
height += .010*raised((.030,.046,1.530,2.619),.019)-.010*raised((.100,.189,1.460,2.476),.024)
# A very slight crown on the planed planks. The long soft reflection travels
# across this surface instead of locking to the grain as the viewer moves.
height += .005*np.cos(tau*x*2+.18*np.sin(tau*y))
pack(0, 1, height,(1.56,2.665), .345+.038*np.tanh(field(10,3))+.018*np.cos(tau*x*2))

target = Path(__file__).with_name('architecture-gate-finish.webp')
plate.save(target, 'WEBP', lossless=True, method=6)
print(f'{target.name}: 512 x 512, {target.stat().st_size} bytes')
