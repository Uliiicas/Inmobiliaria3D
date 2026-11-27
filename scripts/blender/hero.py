"""Vistas fijas de alta calidad en Cycles para animarlas con IA (Kling, Hailuo, Higgsfield…).

uso:
  python hero.py                       # todas las vistas de VIEWS
  HERO_VIEWS=living,piscina python hero.py
  HERO_RES=640x360 HERO_SAMPLES=16 python hero.py   # prueba rápida de encuadre

Necesita la escena armada (`python build.py assemble`). Cada vista define su hora del día y si las
luminarias van encendidas, así la luz coincide con la que después anima la IA. Las salidas quedan en
$HOUSE_WORK/out/hero_<vista>.png.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402,I001

from build import BLEND, sky_world, sun_dir_for_hour  # noqa: E402
from common import EMISSIVE, GEO, OUT, link, load_json, t2b  # noqa: E402

# nombre → (ojo, objetivo, lente mm, hora, luminarias encendidas, exposición[, desplazamiento vertical])
# El desplazamiento es el shift de lente: baja el encuadre sin inclinar las verticales.
# Coordenadas en ejes de la web (x, altura, z; +z mira al mar), igual que src/data/rooms.ts.
VIEWS = {
    # fachada al mar desde la playa, sol bajo de la tarde
    'fachada': ((24, 7.5, 40), (0, 2.0, 9), 32, 19.3, True, -0.5),
    # living de doble altura desde el lado del comedor: muro cortina, hogar y lámpara circular
    'living': ((7.3, 1.5, -1.2), (0.5, 2.4, 7), 18, 18.9, True, -0.4),
    # piscina infinita al atardecer, a ras del agua
    'piscina': ((-10.5, 0.8, 16.4), (6, 1.4, 12), 22, 19.3, True, -0.5),
    # comedor frente al mar
    'comedor': ((13.6, 1.5, 2.4), (8.5, 0.8, 7.2), 20, 17.2, True, -0.6),
}


def water(name, size, loc, color, transmission):
    """Agua que la web dibuja con shaders propios y no está en la escena horneada."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = 0.03
    b.inputs['IOR'].default_value = 1.33
    b.inputs['Transmission Weight'].default_value = transmission
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 2.5, 1.0)
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.6 if transmission else 0.35
    nz.inputs['Detail'].default_value = 6
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.12
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    bpy.ops.mesh.primitive_plane_add(size=1, location=t2b(*loc))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    o.data.materials.append(m)
    return o


def _emission(on):
    for key, (col, strength) in EMISSIVE.items():
        m = bpy.data.materials.get(key)
        if not m:
            continue
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Emission Color'].default_value = (*col, 1)
        bsdf.inputs['Emission Strength'].default_value = strength if on else 0.0


def fix_flipped_normals():
    """Algunas caras de la arquitectura traen normales personalizadas invertidas: el horneado no lo nota,
    pero en un render directo esas caras salen negras. Se reemplazan por la normal de la cara."""
    fixed = 0
    for o in bpy.data.objects:
        me = o.data if o.type == 'MESH' else None
        if not me or not me.has_custom_normals:
            continue
        cn = [c.vector.copy() for c in me.corner_normals]
        bad = 0
        for poly in me.polygons:
            for li in poly.loop_indices:
                if cn[li].dot(poly.normal) < 0:
                    cn[li] = poly.normal.copy()
                    bad += 1
        if bad:
            me.normals_split_custom_set(cn)
            fixed += bad
    print(f'normales corregidas: {fixed}')


def separate_coplanar():
    """La arquitectura procedural tiene muros que se superponen en el mismo plano (dos tramos que comparten
    cara). En el horneado no importa, pero en un render directo cada rayo que sale de una cara choca contra
    su gemela y la superficie queda negra. Se separa cada pieza suelta una fracción de milímetro."""
    import bmesh

    moved = 0
    for o in bpy.data.objects:
        if o.type != 'MESH' or len(o.data.polygons) < 2:
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.verts.ensure_lookup_table()
        seen = set()
        k = 0
        for v0 in bm.verts:
            if v0.index in seen:
                continue
            stack, island = [v0], []
            seen.add(v0.index)
            while stack:
                v = stack.pop()
                island.append(v)
                for e in v.link_edges:
                    w = e.other_vert(v)
                    if w.index not in seen:
                        seen.add(w.index)
                        stack.append(w)
            off = ((k % 7) - 3) * 0.0007
            if off:
                for v in island:
                    v.co.x += off
                    v.co.y += off * 0.8
                    v.co.z += off * 0.6
            k += 1
        moved += k
        bm.to_mesh(o.data)
        bm.free()
    print(f'piezas separadas: {moved}')


def lamps(meta, gain):
    out = []
    for i, (x, y, z, col, intensity, _rng) in enumerate(meta['lamps']):
        L = bpy.data.objects.new(f'hero_lamp{i}', bpy.data.lights.new(f'hero_lamp{i}', 'POINT'))
        L.data.energy = intensity * gain
        L.data.shadow_soft_size = 0.25
        h = col.lstrip('#')
        L.data.color = tuple(int(h[k : k + 2], 16) / 255 for k in (0, 2, 4))
        L.location = t2b(x, y, z)
        link(L)
        out.append(L)
    return out


def main():
    res = os.environ.get('HERO_RES', '1920x1080').split('x')
    samples = int(os.environ.get('HERO_SAMPLES', '128'))
    names = [n for n in os.environ.get('HERO_VIEWS', ','.join(VIEWS)).split(',') if n]
    tag = os.environ.get('HERO_TAG', 'hero')
    lamp_gain = float(os.environ.get('HERO_LAMP_GAIN', '45'))

    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.render.resolution_x, sc.render.resolution_y = int(res[0]), int(res[1])
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    meta = load_json(os.path.join(GEO, 'geometry.json'))
    fix_flipped_normals()
    separate_coplanar()
    # pileta (World.tsx → Pool) y mar (Ocean); en Blender el plano mira +Z, igual que el piso
    water('hero_pool', (22, 4.5), (0, -0.09, 15.75), (0.55, 0.85, 0.8), 1.0)
    water('hero_sea', (6000, 6000), (0, -9, 3000), (0.01, 0.05, 0.08), 0.0)

    cam = bpy.data.objects.new('hero_cam', bpy.data.cameras.new('hero_cam'))
    link(cam)
    sc.camera = cam
    sun = bpy.data.objects.new('hero_sun', bpy.data.lights.new('hero_sun', 'SUN'))
    sun.data.angle = math.radians(0.8)
    link(sun)

    for name in names:
        eye, target, lens, hour, lit, exposure, *rest = VIEWS[name]
        sd = sun_dir_for_hour(hour)
        sky_world(0.6, sd)
        sun.data.energy = 3.5 * max(0.0, min(1.0, sd.z * 6))
        warm = max(0.0, min(1.0, 1.0 - sd.z / 0.35))  # sol bajo → luz dorada
        sun.data.color = (1.0, 1.0 - 0.32 * warm, 1.0 - 0.62 * warm)
        sun.rotation_euler = (-sd).to_track_quat('-Z', 'Y').to_euler()
        _emission(lit)
        added = lamps(meta, lamp_gain) if lit else []
        sc.view_settings.exposure = exposure + float(os.environ.get('HERO_EXPOSURE', '0'))

        e, tg = t2b(*eye), t2b(*target)
        cam.location = e
        cam.rotation_euler = (tg - e).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        cam.data.shift_y = rest[0] if rest else 0.0
        sc.render.filepath = os.path.join(OUT, f'{tag}_{name}.png')
        bpy.ops.render.render(write_still=True)
        for L in added:
            bpy.data.objects.remove(L)


if __name__ == '__main__':
    main()
