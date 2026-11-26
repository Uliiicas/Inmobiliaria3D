"""
Pipeline de Blender para la residencia (Blender 5.x como módulo de Python: `pip install bpy`).

  python build.py assemble   arma la escena: arquitectura, mobiliario nuevo, modelos Poly Haven
  python build.py uv         genera el segundo canal UV (lightmap) con densidad uniforme
  python build.py bake       hornea cielo, rebote del sol y luminarias en un atlas
  python build.py export     exporta house.glb + lightmap para la web
  python build.py preview    renders de control en Cycles

Cada etapa lee y guarda $HOUSE_WORK/out/house.blend.
Entradas: geometry.json/.bin (export-geometry.ts), texturas procesadas (prepare_textures.py) y
modelos de Poly Haven descargados con phfetch.py.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402,I001
import mathutils  # noqa: E402
import numpy as np  # noqa: E402

import kit  # noqa: E402
from common import (  # noqa: E402
    EMISSIVE, FLAT, GEO, MATS, MODELS, NO_LIGHTMAP, OUT, apply_modifiers, clear_scene, link, load_json,
    mesh_from_arrays, processed_texture_dir, select_only, set_active, t2b, weld,
)

BLEND = os.path.join(OUT, 'house.blend')


# ─────────────────────────────── materiales ───────────────────────────────


def make_materials():
    M = {}
    for key in list(MATS) + list(FLAT):
        mat = bpy.data.materials.new(key)
        nt = mat.node_tree
        bsdf = nt.nodes['Principled BSDF']
        if key in MATS:
            _src, tile, _tint, _d, rough = MATS[key]
            d = processed_texture_dir(key)
            uvn = nt.nodes.new('ShaderNodeUVMap')
            uvn.uv_map = 'uv0'
            mp = nt.nodes.new('ShaderNodeMapping')
            mp.inputs['Scale'].default_value = (1 / tile, 1 / tile, 1)
            nt.links.new(uvn.outputs['UV'], mp.inputs['Vector'])

            def img(name, non_color=False):
                t = nt.nodes.new('ShaderNodeTexImage')
                t.image = bpy.data.images.load(os.path.join(d, name), check_existing=True)
                if non_color:
                    t.image.colorspace_settings.name = 'Non-Color'
                nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
                return t

            nt.links.new(img('diff.jpg').outputs['Color'], bsdf.inputs['Base Color'])
            r = img('rough.jpg', True)
            rm = nt.nodes.new('ShaderNodeMath')
            rm.operation = 'MULTIPLY'
            rm.inputs[1].default_value = rough / 0.75
            nt.links.new(r.outputs['Color'], rm.inputs[0])
            nt.links.new(rm.outputs[0], bsdf.inputs['Roughness'])
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nm.inputs['Strength'].default_value = 0.8
            nt.links.new(img('nor.jpg', True).outputs['Color'], nm.inputs['Color'])
            nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        else:
            col, rough, metal = FLAT[key]
            bsdf.inputs['Base Color'].default_value = (*col, 1)
            bsdf.inputs['Roughness'].default_value = rough
            bsdf.inputs['Metallic'].default_value = metal
            if key in ('glass', 'glassFrosted'):
                bsdf.inputs['Transmission Weight'].default_value = 1.0
                bsdf.inputs['IOR'].default_value = 1.45
            if key in EMISSIVE:
                ec, es = EMISSIVE[key]
                bsdf.inputs['Emission Color'].default_value = (*ec, 1)
                bsdf.inputs['Emission Strength'].default_value = 0.0  # se enciende sólo en el horneado nocturno
        M[key] = mat
    return M


# ─────────────────────────────── geometría ───────────────────────────────


def load_procedural():
    meta = load_json(os.path.join(GEO, 'geometry.json'))
    raw = np.fromfile(os.path.join(GEO, 'geometry.bin'), dtype=np.float32).reshape(-1, 8)
    return meta, raw


def object_from_chunk(name, raw, entries, M):
    """Malla Blender (Z arriba) a partir de uno o varios tramos del volcado procedural."""
    verts, uvs = [], []
    mats = []
    for e in entries:
        a = raw[e['offset'] // 32 : e['offset'] // 32 + e['count']]
        verts.append(np.stack([a[:, 0], -a[:, 2], a[:, 1]], -1))
        uvs.append(a[:, 6:8])
        mats.append((e['mat'], e['count']))
    V = np.concatenate(verts)
    U = np.concatenate(uvs)
    tris = np.arange(len(V)).reshape(-1, 3)
    me = mesh_from_arrays(name, V.tolist(), tris.tolist(), U)
    slot = {}
    face_mat = []
    for m, count in mats:
        if m not in slot:
            slot[m] = len(me.materials)
            me.materials.append(M[m])
        face_mat += [slot[m]] * (count // 3)
    me.polygons.foreach_set('material_index', face_mat)
    o = bpy.data.objects.new(name, me)
    link(o)
    weld(o)
    return o


def box_uv(obj, scale=1.0):
    """Proyección cúbica en metros reales (misma convención que las cajas de la web)."""
    me = obj.data
    if 'uv0' not in me.uv_layers:
        me.uv_layers.new(name='uv0')
    uv = me.uv_layers['uv0']
    mw = obj.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    for poly in me.polygons:
        n = nm @ poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = p.y, p.z
            elif ax == 1:
                u, v = p.x, p.z
            else:
                u, v = p.x, p.y
            uv.data[li].uv = (u * scale, v * scale)


# ─────────────────────────────── modelos Poly Haven ───────────────────────────────

_ph_cache = {}


def ph_model(mid, max_tris=9000):
    """Importa un modelo de Poly Haven una vez (unido, aplicado y, si hace falta, decimado)."""
    if mid in _ph_cache:
        return _ph_cache[mid]
    path = [f for f in os.listdir(os.path.join(MODELS, mid)) if f.endswith('.gltf')][0]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, mid, path))
    new = [o for o in bpy.data.objects if o not in before]
    new_names = [o.name for o in new]
    meshes = [o for o in new if o.type == 'MESH']
    select_only(meshes)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    for nm in new_names:
        x = bpy.data.objects.get(nm)
        if x is not None and x != o:
            bpy.data.objects.remove(x)
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > max_tris:
        d = o.modifiers.new('dec', 'DECIMATE')
        d.ratio = max_tris / tris
        apply_modifiers(o)
    # el pie del modelo en el origen
    zs = [v.co.z for v in o.data.vertices]
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    off = mathutils.Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    o.data.transform(mathutils.Matrix.Translation(-off))
    if o.data.uv_layers:
        o.data.uv_layers[0].name = 'uv0'
    o.name = f'PH_{mid}_src'
    bpy.context.scene.collection.objects.unlink(o)
    _ph_cache[mid] = o
    return o


def place_ph(mid, loc, rot, scale=1.0, name=None, max_tris=9000):
    src = ph_model(mid, max_tris)
    o = src.copy()
    o.data = src.data.copy()
    o.name = name or f'ph_{mid}'
    o.location = loc
    o.rotation_euler = (0, 0, rot)
    o.scale = (scale, scale, scale)
    link(o)
    select_only([o])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o['ph'] = mid
    return o


# ─────────────────────────────── ensamblado ───────────────────────────────


def assemble():
    clear_scene()
    M = make_materials()
    meta, raw = load_procedural()
    places = {p['id']: p for p in meta['placements']}
    by_tag = {}
    for e in meta['meshes']:
        by_tag.setdefault(e['tag'], []).append(e)

    KEEP = {'pendantLine', 'hedge'}  # piezas procedurales que se conservan (con bevel)
    kept = []
    arch_entries = by_tag.pop('arch')
    kept.append(object_from_chunk('arch', raw, arch_entries, M))

    furniture = []
    trees = []
    ph = []
    plant_i = 0
    for tag, entries in by_tag.items():
        p = places[tag]
        kind = p['kind']
        a = p['args']
        x, y, z = p['p']
        loc = t2b(x, y, z)
        rot = p['rot']
        if kind in KEEP:
            o = object_from_chunk(tag, raw, entries, M)
            kept.append(o)
        elif kind == 'sofa':
            furniture.append(kit.sofa(M, tag, loc, rot, a['w'], a['d'], a['mat']))
        elif kind == 'armchair':
            if a['mat'] == 'leather':
                ph.append(place_ph('modern_arm_chair_01', loc, rot, 0.95))
            else:
                ph.append(place_ph('mid_century_lounge_chair', loc, rot, 0.82))
        elif kind == 'bed':
            furniture.append(kit.bed(M, tag, loc, rot, a['w'], a['l']))
        elif kind == 'table':
            if a['top'] == 'travertine' and abs(x - 3) < 0.1 and abs(z - 3.9) < 0.1:
                ph.append(place_ph('coffee_table_round_01', loc, rot, 1.0))
                ph.append(place_ph('lambis_shell', t2b(3.25, 0.49, 3.75), 0.6, 1.4))
                ph.append(place_ph('ceramic_vase_03', t2b(2.75, 0.49, 4.05), 0, 0.9))
            elif a['top'] == 'walnut' and a['h'] < 0.5 and y > 1:
                ph.append(place_ph('modern_coffee_table_01', loc, rot + math.pi / 2, 1.0))
            else:
                furniture.append(kit.table(M, tag, loc, rot, a['w'], a['d'], a['h'], a['top']))
        elif kind == 'chair':
            furniture.append(kit.dining_chair(M, tag, loc, rot))
        elif kind == 'rug':
            furniture.append(kit.rug(M, tag, loc, rot, a['w'], a['d']))
        elif kind == 'plant':
            s = a['scale']
            if plant_i % 2 == 0:
                ph.append(place_ph('potted_plant_01', loc, plant_i * 1.3, s * 1.05, max_tris=18000))
            else:
                ph.append(place_ph('potted_plant_02', loc, plant_i * 1.3, s * 1.45, max_tris=14000))
            plant_i += 1
        elif kind == 'floorLamp':
            furniture.append(kit.floor_lamp(M, tag, loc))
        elif kind == 'sculpture':
            ph.append(place_ph('marble_bust_01', loc, -0.4, 1.35))
        elif kind == 'stool':
            furniture.append(kit.stool(M, tag, loc))
        elif kind == 'lounger':
            furniture.append(kit.lounger(M, tag, loc, a['base']))
        elif kind == 'planter':
            o = object_from_chunk(tag, raw, [e for e in entries if e['mat'] != 'foliage'], M)
            kept.append(o)
            w, d, h = a['w'], a['d'], a['h']
            n = max(1, round(w / 0.45))
            for i in range(n):
                px = x - w / 2 + w / n * (i + 0.5)
                ph.append(place_ph('shrub_04', t2b(px, y + h, z), i * 2.1, 2.2, max_tris=3000))
        elif kind == 'tree':
            trees += [t.name for t in kit.tree(tag, loc, a['scale'], seed=int(x * 7 + z * 13))]
        else:
            kept.append(object_from_chunk(tag, raw, entries, M))

    # decoración adicional
    ph.append(place_ph('ceramic_vase_01', t2b(10.3, 0.75, 5.0), 0, 0.9))
    ph.append(place_ph('potted_plant_04', t2b(11.9, 0.945, -2.5), 0.4, 1.3))
    ph.append(place_ph('ceramic_vase_03', t2b(-7.7, 0.5, 6.4), 0, 0.8))

    for o in furniture:
        box_uv(o)

    # una malla por material para la arquitectura + mobiliario propio (pocas llamadas de dibujo)
    solid = kept + furniture
    select_only(solid)
    bpy.ops.object.join()
    allm = bpy.context.view_layer.objects.active
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH' and not o.get('ph') and o.name not in trees and o.data.materials and o.data.polygons:
            mat = o.data.materials[o.data.polygons[0].material_index]
            o.data.materials.clear()
            o.data.materials.append(mat)
            o.data.polygons.foreach_set('material_index', [0] * len(o.data.polygons))
            o.name = mat.name
            o['mat'] = mat.name
    _ = allm
    # árboles: un objeto para madera y otro para hojas
    for part in ('_wood', '_leaves'):
        objs = [bpy.data.objects[t] for t in trees if t.endswith(part) and t in bpy.data.objects]
        print('trees', part, len(objs), 'de', len(trees))
        select_only(objs)
        bpy.ops.object.join()
        bpy.context.view_layer.objects.active.name = 'trees' + part
        bpy.context.view_layer.objects.active['mat'] = 'tree' + part
    for i, o in enumerate(ph):
        o.name = f"{o['ph']}_{i}"
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    report()


def report():
    tot = 0
    for o in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        if o.type != 'MESH':
            continue
        t = sum(len(p.vertices) - 2 for p in o.data.polygons)
        tot += t
        print(f'  {o.name:34s} {t:8d} tris  mats={[m.name for m in o.data.materials][:4]}')
    print('TOTAL tris', tot)


# ─────────────────────────────── renders de control ───────────────────────────────


def sky_world(strength=1.0, sun_dir=None):
    w = bpy.data.worlds.new('sky')
    bpy.context.scene.world = w
    nt = w.node_tree
    bg = nt.nodes['Background']
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'
    except TypeError:
        sky.sky_type = 'NISHITA'
    if sun_dir is not None:
        sky.sun_elevation = math.asin(sun_dir.z)
        sky.sun_rotation = math.atan2(sun_dir.x, sun_dir.y)
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    return w


def sun_dir_for_hour(h):
    """Misma fórmula que src/lib/daylight.ts → dirección en ejes de Blender."""
    sunrise, sunset = 6.15, 19.75
    t = (h - sunrise) / (sunset - sunrise)
    el = math.radians(68) * math.sin(math.pi * t)
    az = math.radians(-30 + (122 + 30) * t)
    x, y, z = math.cos(az) * math.cos(el), math.sin(el), math.sin(az) * math.cos(el)
    return t2b(x, y, z).normalized()


def preview(views=None, samples=64, res=(960, 540), tag='preview'):
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    sd = sun_dir_for_hour(16.5)
    sky_world(0.6, sd)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.5
    sun.data.angle = math.radians(0.6)
    sun.rotation_euler = (-sd).to_track_quat('-Z', 'Y').to_euler()
    link(sun)
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.exposure = -0.3
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    link(cam)
    sc.camera = cam
    views = views or {
        'exterior_sur': ((22, 3.5, 34), (2, 3, 8), 32),
        'living': ((8.6, 1.7, 0.6), (1.5, 1.6, 5.5), 22),
        'acceso': ((14, 4, -36), (2, 3, -8), 35),
    }
    for name, (eye, target, lens) in views.items():
        e = t2b(*eye)
        tg = t2b(*target)
        cam.location = e
        cam.rotation_euler = (tg - e).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        sc.render.filepath = os.path.join(OUT, f'{tag}_{name}.png')
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    stage = sys.argv[1]
    if stage == 'assemble':
        assemble()
    elif stage == 'preview':
        preview()
    else:
        import stages

        getattr(stages, stage)()
