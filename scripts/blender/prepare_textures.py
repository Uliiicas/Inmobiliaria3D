"""
Prepara las texturas PBR de Poly Haven (CC0) para cada material de la casa:
tinte y desaturación según common.MATS, tamaño final para la web y mármol generado.

uso: python prepare_textures.py
Salida: $HOUSE_WORK/texproc/<material>/{diff,nor,rough}.jpg
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from common import MATS, TEX, processed_texture_dir  # noqa: E402

# Pisos y fachadas que ocupan media pantalla merecen 2048 px; el resto 1024
HERO = {'oak', 'limestone', 'concrete', 'cumaru'}


def fbm(n, octaves=6, seed=3):
    rng = np.random.default_rng(seed)
    acc = np.zeros((n, n))
    amp = 1.0
    for o in range(octaves):
        r = 4 * 2 ** o
        g = rng.standard_normal((r, r))
        # interpolación bicúbica periódica con PIL para que la textura repita sin costuras
        tile = np.tile(g, (3, 3))
        im = Image.fromarray(((tile - tile.min()) / (np.ptp(tile) + 1e-9) * 255).astype(np.uint8))
        im = im.resize((n * 3, n * 3), Image.BICUBIC)
        a = np.asarray(im, dtype=np.float64)[n : 2 * n, n : 2 * n] / 255.0 - 0.5
        acc += a * amp
        amp *= 0.5
    return acc


def marble(n=1024):
    x = np.linspace(0, 1, n, endpoint=False)
    X, Y = np.meshgrid(x, x)
    f = fbm(n, 7, 11)
    veins = np.abs(np.sin((X * 2 + Y * 1) * np.pi * 2 + f * 5.0))
    v = np.clip(1 - veins / 0.06, 0, 1) ** 1.5
    fine = np.abs(np.sin((X * 5 - Y * 3) * np.pi * 2 + fbm(n, 6, 5) * 8.0))
    v2 = np.clip(1 - fine / 0.03, 0, 1) * 0.4
    cloud = fbm(n, 5, 21)
    base = np.array([238, 236, 232]) / 255.0
    vein = np.array([150, 146, 140]) / 255.0
    t = np.clip(v * 0.75 + v2, 0, 1)[..., None]
    col = base * (1 - t) + vein * t + cloud[..., None] * 0.06
    rough = 0.18 + t[..., 0] * 0.08
    return col, rough


def save(path, arr, q=90):
    Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)).save(path, quality=q)


def main():
    for key, (src, _tile, tint, desat, _rough) in MATS.items():
        out = processed_texture_dir(key)
        os.makedirs(out, exist_ok=True)
        size = 2048 if key in HERO else 1024
        if src is None:
            col, rough = marble(size)
            save(os.path.join(out, 'diff.jpg'), col)
            save(os.path.join(out, 'rough.jpg'), np.stack([rough] * 3, -1))
            flat = np.zeros((64, 64, 3))
            flat[..., 0] = 0.5
            flat[..., 1] = 0.5
            flat[..., 2] = 1.0
            save(os.path.join(out, 'nor.jpg'), flat)
            continue
        d = os.path.join(TEX, src)
        diff = np.asarray(Image.open(os.path.join(d, 'diff.jpg')).convert('RGB').resize((size, size), Image.LANCZOS), dtype=np.float64) / 255.0
        if desat:
            g = diff @ np.array([0.299, 0.587, 0.114])
            diff = diff * (1 - desat) + g[..., None] * desat
        if key == 'plaster':
            # el yeso debe leerse como un blanco cálido apenas texturado
            diff = diff.mean((0, 1)) * 0.65 + diff * 0.35
        diff = diff * np.array(tint)
        save(os.path.join(out, 'diff.jpg'), diff)
        Image.open(os.path.join(d, 'nor.jpg')).convert('RGB').resize((size, size), Image.LANCZOS).save(os.path.join(out, 'nor.jpg'), quality=92)
        Image.open(os.path.join(d, 'rough.jpg')).convert('RGB').resize((size // 2, size // 2), Image.LANCZOS).save(os.path.join(out, 'rough.jpg'), quality=90)
        print(key, size)


if __name__ == '__main__':
    main()
