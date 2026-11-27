"""Park-only art. Run with Python (Pillow, numpy, OpenCV) and project Node.

Original summer Zelkova sprays; habit, crenate teeth and parallel veins:
https://plants.ces.ncsu.edu/plants/zelkova-serrata/ (visual reference only).
Bark base: Poly Haven Bark Brown 02, CC0, https://polyhaven.com/a/bark_brown_02.
The shadow atlas is made from the actual cutout triangles at rest.
"""
import json
import subprocess
from hashlib import md5
from io import BytesIO
from math import cos, pi, sin
from pathlib import Path
from urllib.request import urlopen

import cv2
import numpy as np
from PIL import Image, ImageDraw


HERE = Path(__file__).resolve().parent
TILE = 512


def leaf_spray(seed):
    rng = np.random.default_rng(seed)
    img = Image.new('RGBA', (TILE*2, TILE*2))
    pen = ImageDraw.Draw(img)
    leaves = []

    def pix(points):
        return [(round(x*TILE*2), round((1-y)*TILE*2)) for x, y in points]

    def twig(points, w):
        pen.line(pix(points), fill=(95, 91, 53, 255), width=w, joint='curve')

    base = np.array([.5, .006])
    bend = rng.uniform(-.065, .065)

    def stem(t):
        return base + np.array([bend*sin(t*2.4)+.019*sin(t*5.2), .92*t])

    twig([stem(t) for t in np.linspace(0, 1, 18)], 6)
    for j in range(9):
        t = .035+j*.098
        side = -1 if j % 2 else 1
        p = stem(t)
        span = (.16+.13*sin(pi*t))*rng.uniform(.84, 1.03)
        d = np.array([side*span, (.09+.20*(1-t))*rng.uniform(.9, 1.14)])

        def node(u):
            return p+d*u+np.array([-.016*side, .029])*sin(u*pi)

        twig([node(u) for u in np.linspace(0, 1, 8)], 3)
        for n in range(7):
            u = .13+.132*n
            a = np.arctan2(d[1], d[0]) + (1 if n % 2 else -1)*rng.uniform(.63, 1.23)
            length = rng.uniform(.088, .144)*(1-.29*u)
            leaves.append((node(u), a, length))
        leaves.append((node(1), np.arctan2(d[1], d[0]), .095))
    leaves.append((stem(.94), pi*.52, .115))
    for p, angle, length in leaves:
        axis = np.array([cos(angle), sin(angle)])*length
        normal = np.array([-axis[1], axis[0]])
        half = rng.uniform(.19, .31)
        curl = rng.uniform(-.14, .14)
        asym = rng.uniform(.78, 1.22)

        def centre(t):
            return p + axis*t + normal*curl*sin(pi*t)

        def edge(t, sign, amp):
            width = half*sin(pi*t)**.79*(1.23-.48*t)*amp
            return centre(t) + normal*width*(asym if sign > 0 else 1)*sign

        tone = rng.uniform(-16, 20)
        base_rgb = np.array([109+tone, 145+tone*.76, 65+tone*.48])
        if rng.random() < .18:  # light through a thinner, younger blade
            base_rgb += [21, 12, -3]

        def pigment(delta):
            return tuple(np.uint8(np.clip(base_rgb+delta, 0, 255)))+(255,)

        for sign in [-1, 1]:
            outline = [p]
            for n in range(1, 10):
                outline.extend([edge((n-.40)/10, sign, .91), edge(n/10, sign, 1.10)])
            outline.append(centre(1))
            ridge = [centre(t) for t in np.linspace(1, 0, 14)]
            pen.polygon(pix(outline+ridge), fill=pigment(sign*9))
            for n in range(1, 9):
                t = n/10
                pen.line(pix([centre(t*.83), edge(t+.019, sign, .56), edge(t+.10, sign, .96)]),
                         fill=pigment(sign*9+8), width=1)
        pen.line(pix([centre(t) for t in np.linspace(.01, .96, 12)]), fill=pigment(25), width=1)
    img = img.resize((TILE, TILE), Image.Resampling.LANCZOS)
    # Fill transparent neighbours with pigment so mip filtering keeps the
    # silhouetted blades green against bright sky, without changing coverage.
    rgba = np.asarray(img).copy()
    rgb = rgba[:, :, :3]
    empty = rgba[:, :, 3] < 30
    rgb[empty] = cv2.dilate(rgb, np.ones((7, 7), np.uint8))[empty]
    rgb[(empty) & (rgb.max(axis=2) == 0)] = (100, 137, 60)
    return Image.fromarray(rgba)


def shadow_tile(tree, model, alpha):
    field = model['shadowPrint']
    origin = np.array([field['left'], field['top']])
    density = 1024 / np.array([field['width'], field['depth']])
    sun = np.array(model['sun'])

    def project(points):
        return ((points[:, [0, 2]]-points[:, 1:2]*sun[[0, 2]]/sun[1])-origin)*density

    mask = np.zeros((1024, 1024), np.uint8)
    for limb in tree['limbs']:
        for r1, r2 in zip(limb['rings'], limb['rings'][1:]):
            # Bound the projection of each tapered branch by two cross sections.
            contours = []
            for ring in (r1, r2):
                ctr = np.array([ring['p'][k] for k in ('x', 'y', 'z')])
                angles = np.arange(16)*pi/8
                points = np.column_stack((np.cos(angles), np.zeros(16), np.sin(angles)))
                contours.extend(project(ctr+points*ring['r']))
            cv2.fillConvexPoly(mask, cv2.convexHull(np.int32(contours)), 255)

    vertices = np.array(model['sprayPoints']).reshape(-1, 3)
    uv = np.array(model['sprayUV']).reshape(-1, 2)
    uv[:, 1] = 1-uv[:, 1]
    faces = np.array(model['sprayFaces']).reshape(-1, 3)
    for shoot in tree['shoots']:
        m = np.array(shoot['matrix']['elements']).reshape(4, 4).T
        dest = project(vertices @ m[:3, :3].T + m[:3, 3])
        for face in faces:
            points = dest[face].astype('float32')
            x, y, w, h = cv2.boundingRect(points)
            assert x >= 0 and x+w <= 1024 and y >= 0 and y+h <= 1024, 'Shadow outside its print'
            local = points - np.float32([x, y])
            transform = cv2.getAffineTransform(np.float32(uv[face]*TILE), local)
            coverage = cv2.warpAffine(alpha[shoot['tile']], transform, (w, h))
            clip = np.zeros_like(coverage)
            cv2.fillConvexPoly(clip, np.int32(np.round(local)), 255)
            dest_mask = mask[y:y+h, x:x+w]
            np.maximum(dest_mask, np.minimum(coverage, clip), out=dest_mask)

    soft = cv2.GaussianBlur(mask, (0, 0), sigmaX=2.1, sigmaY=1.5)
    # Skylight reaches even the dense centre. Root contact is softer than
    # the directional print, which runs much further north than it does west.
    y, x = np.indices(mask.shape)
    root = np.exp(-((x/density[0]+origin[0])/.44)**2-((y/density[1]+origin[1])/.47)**2)
    return Image.fromarray(np.uint8(np.maximum(.47*soft, 134*root))).resize((TILE, TILE), Image.Resampling.LANCZOS)


def bake():
    src = urlopen('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/bark_brown_02/bark_brown_02_diff_1k.jpg', timeout=25).read()
    assert md5(src).hexdigest() == '6669cca520594bdca19f94084984ab72'
    bark = np.asarray(Image.open(BytesIO(src)).resize((512, 512), Image.Resampling.LANCZOS), dtype=float)
    bark = .61*bark + .21*bark.mean(axis=2, keepdims=True) + [34, 36, 34]
    Image.fromarray(np.uint8(np.clip(bark, 0, 255))).save(HERE/'zelkova-bark.webp', quality=86)

    # Import the production habit, triangle winding, UVs and shore light.
    js = """import {growTree, habitCount, sprayPoints, sprayUV, sprayFaces, shadowPrint} from './treeHabit.ts';
    import {registerHooks} from 'node:module';
    registerHooks({resolve(id,ctx,next){return next(id.startsWith('.') && !id.endsWith('.ts') ? id+'.ts' : id,ctx);}});
    const {SHORE_SUN:sun}=await import('../shoreLayout.ts');
    console.log(JSON.stringify({sun,sprayPoints,sprayUV,sprayFaces,shadowPrint,
      trees:Array.from({length:habitCount},(_,i)=>growTree(i,sun))}));"""
    model = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', js], cwd=HERE))
    atlas = Image.new('RGBA', (TILE*2, TILE*2))
    foliage = [leaf_spray(231+i*71) for i in range(4)]
    alpha = [np.asarray(im.getchannel('A')) for im in foliage]
    shade = Image.new('RGBA', atlas.size, (49, 64, 79, 0))
    for i, tree in enumerate(model['trees']):
        corner = (i % 2*TILE, i//2*TILE)
        atlas.paste(foliage[i], corner)
        stamp = Image.new('RGBA', (TILE, TILE), (49, 64, 79, 255))
        stamp.putalpha(shadow_tile(tree, model, alpha))
        shade.paste(stamp, corner)
    atlas.save(HERE/'zelkova-sprays.webp', quality=91, method=6, exact=True)
    shade.save(HERE/'zelkova-shade.webp', quality=80, method=6, exact=True)


if __name__ == '__main__':
    bake()
