"""Bake a periodic wind-wave slope field. Requires NumPy and Pillow."""
from pathlib import Path

import numpy as np
from PIL import Image


def bake(size=256):
    rng = np.random.default_rng(73281)
    k = np.fft.fftfreq(size, 1 / size)
    u, v = np.meshgrid(k, k)
    radius = np.maximum(0.001, np.hypot(u, v))
    wind = np.abs(v) / radius
    spectrum = np.fft.fft2(rng.normal(size=(size, size)))
    # Capillary waves ride a longer train. Bands have angular spread; single
    # parallel sines give long unbroken ridges instead of reflected facets.
    envelope = np.exp(-0.5 * (np.log(radius / 8) / 0.48) ** 2)
    envelope += 0.48 * np.exp(-0.5 * (np.log(radius / 23) / 0.37) ** 2)
    spectrum *= envelope * (0.20 + wind**3) / radius**2
    spectrum[0, 0] = 0
    # TextureLoader flips image rows, hence the sign of the v derivative.
    channels = [np.fft.ifft2(spectrum * derivative).real for derivative in (1j*u, -1j*v, 1)]
    packed = np.stack([np.clip(field / (3.2 * field.std()), -1, 1) for field in channels], axis=-1)
    return Image.fromarray(np.rint((packed + 1) * 127.5).astype('uint8'))


if __name__ == '__main__':
    target = Path(__file__).resolve().parents[1] / 'public/scenery/terminus/harbour-slopes.webp'
    bake().save(target, lossless=True, method=6)
