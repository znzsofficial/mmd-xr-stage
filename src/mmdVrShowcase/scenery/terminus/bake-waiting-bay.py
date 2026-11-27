"""Finish atlas for the terminus joinery (Pillow + NumPy; no runtime downloads).

Long grain and roughness: Oak Wood Planks, Dimitrios Savva, Poly Haven, CC0.
https://polyhaven.com/a/oak_wood_planks · https://polyhaven.com/license
All cut ends, wear masks, painted iron and anchor finishes are original.
"""
from hashlib import md5
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from PIL import Image


def source(channel, digest):
    base = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/oak_wood_planks/'
    data = urlopen(base + f'oak_wood_planks_{channel}_2k.jpg', timeout=30).read()
    assert md5(data).hexdigest() == digest
    return Image.open(BytesIO(data))


def field(w, h, nx, ny, rng):
    controls = Image.fromarray(rng.uniform(-1, 1, (ny, nx)).astype('float32'))
    return np.asarray(controls.resize((w, h), Image.Resampling.BICUBIC))


def rgb(a):
    return Image.fromarray(np.uint8(np.clip(a, 0, 255)))


def bake():
    width, height = 1024, 64
    y, x = (np.indices((height, width)) + .5) / np.array([height, width])[:, None, None]
    rng = np.random.default_rng(73689)
    color = Image.new('RGB', (1024, 1024), 'white')
    response = Image.new('RGB', color.size, (255, 176, 0))

    def strip(i, pigment, rough, metal=0):
        color.paste(rgb(pigment), (0, height*i))
        packed = np.empty((height, width, 3)); packed[:] = [255, 0, 0]
        packed[:, :, 1] = rough*255; packed[:, :, 2] = metal*255
        response.paste(rgb(packed), (0, height*i))

    oak = source('diff', '740160778f1c4b78bac74d96fe3c06ea')
    rough = source('rough', 'd7533fb12d5c296917ff6fb169bb282b').convert('L')
    # Cut within eight different boards, excluding flooring seams and joints.
    cuts = [(12, 114), (190, 297), (492, 609), (684, 778), (985, 1104),
            (1320, 1400), (1488, 1543), (1750, 1868)]
    for i, (top, bottom) in enumerate(cuts):
        crop = (6, top, 2042, bottom)
        timber = np.asarray(oak.crop(crop).resize((width, height), Image.Resampling.LANCZOS)).astype(float)
        grain_rough = np.asarray(rough.crop(crop).resize((width, height)), dtype=float) / 255
        # Oiled hand-rests and seat fronts: high spots polished; wet ends and
        # the long exposed arrises have lost oil and picked up a silver tone.
        fibre = field(width, height, 31, 36, rng)
        arris = np.exp(-np.minimum(y, 1-y)*15) * np.clip(.68+fibre, 0, 1)
        end = np.exp(-np.minimum(x, 1-x)*29)
        patina = .28*arris + .33*end
        timber = timber*(1-patina[:, :, None]) + np.array([176, 163, 139])*patina[:, :, None]
        contact = np.exp(-((x-.51)/.32)**4) * np.exp(-((y-.50)/.39)**4)
        strip(i, timber, np.clip(.35+.32*grain_rough+.25*patina-.065*contact, .32, .82))

    # Individual cross-cuts: rings traverse the end from an offset pith. Dry
    # checks follow the radial direction instead of wrapping round the board.
    end_color = np.zeros((64, 1024, 3)); end_rough = np.zeros((64, 1024))
    v, u = np.mgrid[0:64, 0:128]
    for i in range(8):
        dx, dy = u-(-38+29*i), v+rng.uniform(22, 103)
        rad = np.hypot(dx*.88, dy) + 1.1*field(128, 64, 4, 4, rng)
        phase = rad/7.3 + .12*np.sin(rad/11)
        latewood = np.exp(-((phase-np.round(phase))/.13)**2)
        check = np.exp(-((dx-.43*dy-19)/.79)**2)*np.clip((v-13)/31, 0, 1)
        relief = -19*latewood - 39*check + 3.2*rng.standard_normal(rad.shape)
        end_color[:, i*128:(i+1)*128] = np.array([148, 112, 80])+relief[:, :, None]
        end_rough[:, i*128:(i+1)*128] = .72+.075*latewood
    strip(8, end_color, end_rough)

    # Rolled enamel. Wear is preferentially at the foot and on the two lips;
    # most of a face remains continuous paint, not an overall rust pattern.
    for i in (9, 10):
        flake = field(width, height, 97, 21, rng)
        bloom = field(width, height, 31, 12, rng)
        rim = np.exp(-np.minimum(y, 1-y)*27)
        foot = np.exp(-x*13) if i == 9 else np.exp(-np.minimum(x, 1-x)*19)
        chip = np.clip((flake + .85*rim + .72*foot - 1.13)*4, 0, 1)
        stain = .24*foot*np.clip(bloom+.65, 0, 1)
        coat = np.array([56, 86, 81]) + (4.3*bloom+2*flake)[:, :, None]
        oxide = np.array([129, 90, 66])+bloom[:, :, None]*12
        wear = np.maximum(chip, stain)[:, :, None]
        strip(i, coat*(1-wear)+oxide*wear, .49+.08*bloom+.31*chip, .04+.20*chip)

    stone = field(width, height, 260, 38, rng)*7 + field(width, height, 20, 5, rng)*8
    strip(11, np.array([151, 146, 132]) + stone[:, :, None], .89)
    # Solid swatches are tinted by the individual ferrules, washers and studs.
    white = np.full((height, width, 3), 255)
    strip(12, white, .39, .66); strip(13, white, .64, .22)

    # The ticket-office matchboarding is painted. Only raised grain, worn
    # tongues and a few exposed wood fibres at the damp sill read through.
    for i, top in enumerate((684, 1320)):
        timber = np.asarray(oak.crop((4, top, 2044, top+80)).resize((width, height)), dtype=float)
        grain = timber[:, :, 0]-np.mean(timber[:, :, 0])
        weather = field(width, height, 23, 39, rng)
        lips = np.exp(-np.minimum(y, 1-y)*30)
        chip = np.clip((.6*lips+.5*np.exp(-x*18)+weather-.98)*2, 0, 1)
        coat = np.array([142, 159, 146])+(grain*.22+3.5*weather)[:, :, None]
        strip(14+i, coat*(1-chip[:, :, None])+timber*chip[:, :, None], .66+.11*chip+.04*weather)

    here = Path(__file__).resolve().parent
    color.save(here / 'waiting-bay.webp', quality=90, method=6)
    response.resize((512, 512), Image.Resampling.BOX).save(here / 'waiting-bay-rm.webp', lossless=True, method=6)


if __name__ == '__main__':
    bake()
