"""Bake the fountain's six small reflection faces with Pillow/NumPy, on CPU.

Use the actual harbour sky, shop footprints and grown zelkova branches. No
scene capture, prefilter or second scene render is needed on an XR frame.
"""
from pathlib import Path
import json
import math
import subprocess

import numpy as np
from PIL import Image, ImageDraw

here = Path(__file__).resolve().parent
assets = here.parents[4] / 'public/scenery/terminus'
layout = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import {fountainCourt, parkTrees, parkShops} from '../parkLayout.ts';
import {growTree} from './treeHabit.ts';
const trees = parkTrees.map(t => {
  const h = growTree(t.variant, [3,3,-7]);
  return {...t, limbs:h.limbs.map(b=>b.rings.map(r=>[...r.p.toArray(),r.r])),
    leaves:h.shoots.map(s=>[...s.matrix.elements.slice(12,15),s.exposure])};
});
console.log(JSON.stringify({fountainCourt, trees, parkShops}));'''], cwd=here))

eye = np.array([layout['fountainCourt']['x'], .365, layout['fountainCourt']['z']])
size = 192
sky = np.asarray(Image.open(assets / 'harbour-clear-reflection.webp').convert('RGB'))
h, w = sky.shape[:2]
coord = (np.arange(size) + .5) / size * 2 - 1
u, v = np.meshgrid(coord, coord)
faces = [
    ('px', [-1,0,0], [0,0,-1], [0,-1,0]), ('nx', [1,0,0], [0,0,1], [0,-1,0]),
    ('py', [0,1,0], [-1,0,0], [0,0,1]), ('ny', [0,-1,0], [-1,0,0], [0,0,-1]),
    ('pz', [0,0,1], [-1,0,0], [0,-1,0]), ('nz', [0,0,-1], [1,0,0], [0,-1,0]),
]
for name, forward, right, down in faces:
    rays = np.array(forward) + np.outer(u.ravel(),right).reshape(size,size,3) + np.outer(v.ravel(),down).reshape(size,size,3)
    rays /= np.linalg.norm(rays, axis=2, keepdims=True)
    x, y, z = rays.transpose(2,0,1)
    sx = ((.5 + np.arctan2(z,x)/(2*math.pi)) * w).astype(int) % w
    sy = np.clip((1 - np.arcsin(np.clip(y,0,1))*2/math.pi) * h, 0, h-1).astype(int)
    pixels = sky[sy,sx].copy()
    pixels[y < .036] = [179,173,151]  # honed inner coping as seen from water level
    pixels[y < 0] = [92,119,111]
    image = Image.fromarray(pixels)
    draw = ImageDraw.Draw(image)

    def project(p):
        d = p - eye
        depth = np.dot(d, forward)
        if depth < .1:
            return None
        return ((1 + np.dot(d,right)/depth) * size/2, (1 + np.dot(d,down)/depth) * size/2)

    for s in layout['parkShops']:
        across = np.array([math.cos(s['yaw']),0,-math.sin(s['yaw'])])
        def facade(x0, y0, x1, y1, color):
            points = [project(np.array([s['x'],b,s['z']]) + a*across) for a,b in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]]
            if all(p is not None for p in points):
                draw.polygon(points, fill=color)
        half = s['w']/2
        facade(-half,0,half,s['h'],s['color'])
        facade(-half,2.1,half,2.75,s['trim'])
        for a in np.arange(-half+.2,half-.8,1.5):
            facade(a,.4,a+1.22,2,'#50635d')
            for floor in np.arange(3.2,s['h']-1.2,2.25):
                facade(a,floor,a+.95,floor+1.1,'#747e76')

    for tree in sorted(layout['trees'], key=lambda t: -(t['x']-eye[0])**2-(t['z']-eye[2])**2):
        base = np.array([tree['x'],0,tree['z']]); scale = tree['scale']
        for branch in tree['limbs']:
            prev = None
            for *p,r in branch:
                world = base + np.array(p)*scale
                pt = project(world)
                if pt and prev:
                    draw.line([prev,pt],fill='#6d6753',width=max(1,round(size*r*scale/np.linalg.norm(world-eye))))
                prev = pt
        for *p,light in tree['leaves']:
            world = base + np.array(p)*scale
            pt = project(world)
            if pt:
                a,b = pt; radius = size*.22*scale/np.linalg.norm(world-eye)
                tint = tuple(int(k*light+l) for k,l in [(75,38),(81,54),(51,35)])
                draw.ellipse((a-radius,b-radius*.6,a+radius,b+radius*.6),fill=tint)
    image.resize((96,96),Image.Resampling.LANCZOS).save(assets / f'fountain-{name}.webp',quality=89,method=6)
