"""Etapas de lightmap, horneado y exportación (las llama build.py)."""
import json
import math
import os

import bpy  # noqa: I001
import numpy as np

from common import EMISSIVE, GEO, NO_LIGHTMAP, OUT, link, load_json, mean_albedo, select_only, t2b

BLEND = os.path.join(OUT, 'house.blend')
LM_SIZE = int(os.environ.get('LM_SIZE', '4096'))
SAMPLES = int(os.environ.get('LM_SAMPLES', '128'))


def is_lightmapped(o):
    if o.type != 'MESH':
        return False
    key = o.get('mat', '')
    if key in NO_LIGHTMAP or o.name.startswith(('trees_', 'shrub_')):
        return False
    return True


def lm_objects():
    return [o for o in bpy.context.scene.objects if is_lightmapped(o)]


# ─────────────────────────────── UV de lightmap ───────────────────────────────


def uv():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    objs = lm_objects()
    area = 0.0
    for o in objs:
        me = o.data
        if 'lightmap' not in me.uv_layers:
            me.uv_layers.new(name='lightmap')
        me.uv_layers.active = me.uv_layers['lightmap']
        # el canal 0 sigue siendo el de render (texturas)
        me.uv_layers['uv0' if 'uv0' in me.uv_layers else 0].active_render = True
        area += sum(p.area for p in me.polygons)
    print(f'{len(objs)} objetos con lightmap, {area:.0f} m² de superficie')
    tree = scene_bvh()
    select_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    shrink_hidden_faces(objs, tree)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, scale=True, margin_method='ADD', margin=5.0 / LM_SIZE, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    # texel efectivo
    used = 0.0
    for o in objs:
        uvd = o.data.uv_layers['lightmap'].data
        for p in o.data.polygons:
            pts = [uvd[i].uv for i in p.loop_indices]
            a = 0.0
            for i in range(1, len(pts) - 1):
                a += abs((pts[i].x - pts[0].x) * (pts[i + 1].y - pts[0].y) - (pts[i + 1].x - pts[0].x) * (pts[i].y - pts[0].y)) / 2
            used += a
    texel = math.sqrt(area / (used * LM_SIZE * LM_SIZE)) if used else 0
    print(f'ocupación del atlas {used * 100:.0f}% · texel ≈ {texel * 100:.1f} cm a {LM_SIZE}px')
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


def scene_bvh():
    """Árbol de colisión con toda la escena opaca (transformaciones ya aplicadas)."""
    from mathutils.bvhtree import BVHTree

    verts, polys = [], []
    for o in bpy.context.scene.objects:
        if o.type != 'MESH' or o.get('mat') in ('glass', 'glassFrosted') or o.name.startswith(('trees_', 'shrub_')):
            continue
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in o.data.vertices]
        polys += [[base + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys, epsilon=0.0)


def shrink_hidden_faces(objs, tree):
    """
    Caras que nadie ve (tapadas por otra pieza pegada, dentro de muros o bajo losas): se reducen a
    casi nada en el atlas para que la resolución vaya a las superficies visibles.
    """
    import bmesh

    total = hidden_n = 0
    for o in objs:
        bm = bmesh.from_edit_mesh(o.data)
        bm.verts.ensure_lookup_table()
        layer = bm.loops.layers.uv['lightmap']
        for f in bm.faces:
            total += 1
            c = f.calc_center_median()
            n = f.normal
            hidden = (n.z < -0.9 and c.z < 0.05) or c.z < -0.65
            if not hidden and f.calc_area() > 0.0004:
                # ¿hay algo pegado delante de la cara en el centro y cerca de las esquinas?
                pts = [c] + [c + (v.co - c) * 0.8 for v in f.verts]
                hits = 0
                for q in pts:
                    loc, _nn, _i, dist = tree.ray_cast(q + n * 0.003, n, 0.03)
                    if loc is not None:
                        hits += 1
                hidden = hits == len(pts)
            if hidden:
                hidden_n += 1
                cu = f.loops[0][layer].uv.copy()
                for lp in f.loops[1:]:
                    cu += lp[layer].uv
                cu /= len(f.loops)
                for lp in f.loops:
                    lp[layer].uv = cu + (lp[layer].uv - cu) * 0.02
        bmesh.update_edit_mesh(o.data)
    print(f'caras ocultas reducidas en el atlas: {hidden_n} de {total}')


# ─────────────────────────────── horneado ───────────────────────────────


def _bake_materials(objs, img):
    """Material de horneado: difuso con el albedo medio (rebote correcto) y la imagen destino."""
    cache = {}
    originals = {}
    for o in objs:
        originals[o.name] = [m for m in o.data.materials]
        for i, m in enumerate(o.data.materials):
            if m is None:
                continue
            if m.name not in cache:
                key = o.get('mat') if o.get('mat') else None
                col = mean_albedo(key) if key else _ph_albedo(m)
                bm = bpy.data.materials.new('bake_' + m.name)
                nt = bm.node_tree
                bsdf = nt.nodes['Principled BSDF']
                bsdf.inputs['Base Color'].default_value = (*[min(c, 0.85) for c in col], 1)
                bsdf.inputs['Roughness'].default_value = 1.0
                t = nt.nodes.new('ShaderNodeTexImage')
                t.image = img
                nt.nodes.active = t
                cache[m.name] = bm
            o.data.materials[i] = cache[m.name]
    return originals


def _ph_albedo(m):
    """Albedo medio de un material importado de Poly Haven (a partir de su textura base)."""
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and any(link.to_socket.name == 'Base Color' for link in n.outputs['Color'].links):
            px = np.array(n.image.pixels[:]).reshape(-1, 4)[::97, :3]
            lin = np.where(px <= 0.04045, px / 12.92, ((px + 0.055) / 1.055) ** 2.4) if not n.image.is_float else px
            return tuple(lin.mean(0))
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        return tuple(bsdf.inputs['Base Color'].default_value[:3])
    return (0.5, 0.5, 0.5)


def _world(color, strength):
    w = bpy.data.worlds.new('bake_world')
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*color, 1)
    bg.inputs['Strength'].default_value = strength
    bpy.context.scene.world = w


def _emission(on):
    for key, (col, strength) in EMISSIVE.items():
        m = bpy.data.materials.get(key)
        if not m:
            continue
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Emission Color'].default_value = (*col, 1)
        bsdf.inputs['Emission Strength'].default_value = strength if on else 0.0


def bake():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 4
    sc.cycles.use_denoising = False
    bk = sc.render.bake
    bk.use_pass_color = False
    bk.margin = 6
    bk.margin_type = 'EXTEND'
    bk.target = 'IMAGE_TEXTURES'

    # el vidrio deja pasar toda la luz en el horneado (Cycles no calcula cáusticas del sol)
    for o in sc.objects:
        if o.type == 'MESH' and o.get('mat') in ('glass', 'glassFrosted'):
            o.visible_shadow = False
            o.visible_diffuse = False
            o.visible_glossy = False
            o.visible_transmission = False

    objs = lm_objects()
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers['lightmap']
    img = bpy.data.images.new('LM', LM_SIZE, LM_SIZE, float_buffer=True, alpha=False)
    _bake_materials(objs, img)
    select_only(objs)

    meta = load_json(os.path.join(GEO, 'geometry.json'))
    results = {}

    def run(name, direct, indirect):
        bk.use_pass_direct = direct
        bk.use_pass_indirect = indirect
        img.generated_color = (0, 0, 0, 1)
        print(f'horneando {name} ({LM_SIZE}px, {SAMPLES} muestras)…', flush=True)
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'} if direct and indirect else ({'DIRECT'} if direct else {'INDIRECT'}), use_clear=True, margin=6)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(LM_SIZE, LM_SIZE, 4)[..., :3]
        results[name] = px.copy()
        np.save(os.path.join(OUT, f'lm_{name}.npy'), px.astype(np.float16))

    # 1) cielo: bóveda uniforme blanca, sin sol ni luminarias → oclusión del cielo + rebotes
    _world((1, 1, 1), 1.0)
    _emission(False)
    run('sky', True, True)

    # 2) rebote del sol de la tarde (la luz directa del sol se calcula en tiempo real)
    _world((0, 0, 0), 0.0)
    from build import sun_dir_for_hour

    sd = sun_dir_for_hour(15.5)
    sun = bpy.data.objects.new('bake_sun', bpy.data.lights.new('bake_sun', 'SUN'))
    sun.data.energy = 1.0
    sun.data.angle = math.radians(1.0)
    sun.rotation_euler = (-sd).to_track_quat('-Z', 'Y').to_euler()
    link(sun)
    run('sun', False, True)
    bpy.data.objects.remove(sun)

    # 3) luminarias interiores y exteriores encendidas (noche)
    _emission(True)
    lamps = []
    for i, (x, y, z, col, intensity, _rng) in enumerate(meta['lamps']):
        if i == 2:  # la piscina se ilumina con su propio material emisivo en la web
            continue
        L = bpy.data.objects.new(f'bake_lamp{i}', bpy.data.lights.new(f'bake_lamp{i}', 'POINT'))
        L.data.energy = intensity * 45.0
        L.data.shadow_soft_size = 0.25
        h = col.lstrip('#')
        L.data.color = tuple(int(h[k : k + 2], 16) / 255 for k in (0, 2, 4))
        L.location = t2b(x, y, z)
        link(L)
        lamps.append(L)
    run('lamps', True, True)
    for L in lamps:
        bpy.data.objects.remove(L)
    _emission(False)
    encode(results)


def encode(results=None):
    """Empaqueta los tres horneados (luminancia) en un RGB de 8 bits con codificación raíz cuadrada."""
    from PIL import Image

    if results is None:
        results = {n: np.load(os.path.join(OUT, f'lm_{n}.npy')).astype(np.float32) for n in ('sky', 'sun', 'lamps')}
    lum = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    chans = []
    scales = {}
    for name in ('sky', 'sun', 'lamps'):
        L = results[name] @ lum
        L = denoise(L)
        s = float(np.percentile(L[L > 1e-5], 99.7)) if (L > 1e-5).any() else 1.0
        scales[name] = s
        chans.append(np.sqrt(np.clip(L / s, 0, 1)))
    rgb = np.stack(chans, -1)[::-1]  # Blender guarda las imágenes de abajo hacia arriba
    Image.fromarray((rgb * 255 + 0.5).astype(np.uint8), 'RGB').save(os.path.join(OUT, 'lightmap.png'))
    with open(os.path.join(OUT, 'lightmap.json'), 'w') as f:
        json.dump({'size': int(rgb.shape[0]), 'encoding': 'sqrt', 'scale': scales, 'channels': ['sky', 'sun', 'lamps']}, f, indent=1)
    print('lightmap.png', scales)


def denoise(L):
    """Open Image Denoise con su filtro específico para lightmaps (pip install pyoidn)."""
    try:
        import pyoidn
    except ImportError:
        print('aviso: pyoidn no está instalado, el atlas queda sin limpiar')
        return L
    rgb = np.ascontiguousarray(np.repeat(L[..., None], 3, -1).astype(np.float32))
    out = pyoidn.denoise(rgb, filter_type='RTLightmap', quality='high')
    return np.maximum(np.asarray(out, dtype=np.float32).mean(-1), 0)


# ─────────────────────────────── exportación ───────────────────────────────


def export():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
            continue
        me = o.data
        o['lightmap'] = 1 if is_lightmapped(o) else 0
        # orden de canales para glTF: TEXCOORD_0 = texturas, TEXCOORD_1 = lightmap
        names = [u.name for u in me.uv_layers]
        if 'lightmap' in names and names.index('lightmap') != 1:
            print('aviso: orden de UV inesperado en', o.name, names)
        me.uv_layers['uv0' if 'uv0' in names else 0].active_render = True
    # los materiales de la casa viajan sólo por nombre: la web los recrea con sus texturas en mosaico
    from common import FLAT, MATS

    for m in bpy.data.materials:
        if m.name in MATS or m.name in FLAT:
            nt = m.node_tree
            for n in list(nt.nodes):
                if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'):
                    nt.nodes.remove(n)
    path = os.path.join(OUT, 'house_raw.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_apply=True,
        export_image_format='AUTO',
        export_yup=True,
    )
    print('exportado', path, os.path.getsize(path) / 1e6, 'MB')
