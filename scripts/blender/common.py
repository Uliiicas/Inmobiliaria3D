"""
Utilidades compartidas del pipeline de Blender (se ejecuta con el módulo `bpy`, sin interfaz).

Convención de ejes: la web usa Y arriba (three.js) y Blender Z arriba.
three (x, y, z)  →  Blender (x, -z, y)
"""
import json
import math
import os

import bpy  # noqa: I001  (bpy debe importarse antes que bmesh)
import bmesh
import mathutils
import numpy as np

WORK = os.environ.get('HOUSE_WORK', '/home/user/work')
GEO = os.path.join(WORK, 'geo')
TEX = os.path.join(WORK, 'tex')
MODELS = os.path.join(WORK, 'models')
OUT = os.path.join(WORK, 'out')
os.makedirs(OUT, exist_ok=True)


def t2b(x, y, z):
    return mathutils.Vector((x, -z, y))


# ───────────────────────────── materiales de la casa ─────────────────────────────
# clave de material → (textura Poly Haven, metros por repetición, tinte RGB, desaturar, rugosidad base)
# El tinte multiplica la textura; desaturar=1 convierte primero a escala de grises (telas teñidas).
MATS = {
    'concrete': ('concrete_wall_008', 2.4, (1.08, 1.06, 1.02), 0.3, 0.9),
    'concreteDark': ('concrete_wall_008', 2.4, (0.42, 0.40, 0.38), 0.4, 0.85),
    'plaster': ('plastered_wall_04', 3.0, (1.45, 1.41, 1.34), 1.0, 0.95),
    'microcement': ('white_plaster_02', 3.0, (1.12, 1.02, 0.88), 0.7, 0.8),
    'limestone': ('marble_01', 2.4, (1.12, 1.1, 1.06), 0.35, 0.75),
    'travertine': ('sandstone_blocks_08', 1.6, (1.08, 1.02, 0.94), 0.0, 0.8),
    'greystone': ('stone_wall_04', 2.0, (1.0, 0.98, 0.95), 0.2, 0.9),
    'marble': (None, 3.0, (0.93, 0.92, 0.9), 0.0, 0.2),
    'basalt': ('granite_tile_03', 1.6, (0.55, 0.55, 0.55), 0.5, 0.6),
    'bali': ('stone_tiles_02', 1.2, (0.78, 1.0, 0.95), 0.6, 0.7),
    'oak': ('oak_wood_planks', 2.2, (1.05, 1.0, 0.95), 0.0, 0.55),
    'walnut': ('walnut_veneer', 1.2, (0.72, 0.62, 0.55), 0.0, 0.5),
    'cumaru': ('wood_floor_deck', 2.0, (0.9, 0.84, 0.8), 0.4, 0.7),
    'smoked': ('smoked_walnut_veneer', 1.2, (0.42, 0.36, 0.32), 0.2, 0.45),
    'linen': ('rough_linen', 0.6, (1.12, 1.06, 0.96), 1.0, 0.95),
    'wool': ('poly_wool_herringbone', 0.5, (1.02, 0.96, 0.88), 1.0, 1.0),
    'leather': ('fabric_leather_02', 1.0, (1.0, 0.95, 0.9), 0.0, 0.55),
    'grass': ('leafy_grass', 4.0, (0.9, 0.95, 0.85), 0.0, 1.0),
    'rock': ('rock_face_03', 6.0, (0.85, 0.82, 0.78), 0.4, 0.95),
    'sand': ('sand_01', 4.0, (1.05, 1.0, 0.94), 0.0, 1.0),
}

# Albedo plano para los materiales sin textura (y color de las luminarias)
FLAT = {
    'metal': ((0.03, 0.028, 0.026), 0.4, 0.8),
    'bronze': ((0.26, 0.16, 0.08), 0.3, 1.0),
    'ceramic': ((0.86, 0.84, 0.8), 0.22, 0.0),
    'mirror': ((0.8, 0.82, 0.82), 0.02, 1.0),
    'glass': ((0.9, 0.95, 0.95), 0.03, 0.0),
    'glassFrosted': ((0.9, 0.9, 0.88), 0.6, 0.0),
    'glow': ((0.9, 0.85, 0.78), 0.7, 0.0),
    'cove': ((0.01, 0.01, 0.01), 1.0, 0.0),
    'fire': ((0.02, 0.01, 0.0), 1.0, 0.0),
    'foliage': ((0.05, 0.07, 0.035), 0.85, 0.0),
    'foliageLight': ((0.1, 0.12, 0.06), 0.85, 0.0),
    'trunk': ((0.1, 0.075, 0.05), 0.95, 0.0),
    'art1': ((0.6, 0.5, 0.4), 0.9, 0.0),
    'art2': ((0.55, 0.52, 0.48), 0.9, 0.0),
    'art3': ((0.62, 0.48, 0.36), 0.9, 0.0),
}

# Materiales que no reciben lightmap: transparentes, emisivos, terreno abierto y vegetación exterior
NO_LIGHTMAP = {'glass', 'glassFrosted', 'cove', 'glow', 'fire', 'mirror', 'grass', 'sand', 'rock', 'foliage', 'foliageLight', 'trunk'}
EMISSIVE = {'cove': ((1.0, 0.75, 0.48), 6.0), 'glow': ((1.0, 0.78, 0.55), 4.0), 'fire': ((1.0, 0.42, 0.1), 8.0)}


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def processed_texture_dir(key):
    return os.path.join(WORK, 'texproc', key)


def mean_albedo(key):
    """Albedo lineal medio de un material (para el rebote de luz en el horneado)."""
    if key in FLAT:
        return tuple(FLAT[key][0])
    path = os.path.join(processed_texture_dir(key), 'diff.jpg')
    if not os.path.exists(path):
        return (0.5, 0.5, 0.5)
    from PIL import Image
    im = np.asarray(Image.open(path).convert('RGB').resize((64, 64)), dtype=np.float64) / 255.0
    return tuple(srgb_to_lin(im).reshape(-1, 3).mean(0))


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_from_arrays(name, verts, tris, uvs=None, uv_name='uv0'):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], tris)
    if uvs is not None:
        layer = me.uv_layers.new(name=uv_name)
        layer.data.foreach_set('uv', np.asarray(uvs, dtype=np.float32).ravel())
    me.validate()
    return me


def weld(obj, dist=0.0006, smooth_angle=35):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.shade_smooth()
    obj.data.set_sharp_from_angle(angle=math.radians(smooth_angle))


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def set_active(obj):
    bpy.context.view_layer.objects.active = obj


def select_only(objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    if objs:
        set_active(objs[0])


def apply_modifiers(obj):
    select_only([obj])
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def load_json(path):
    with open(path) as f:
        return json.load(f)
