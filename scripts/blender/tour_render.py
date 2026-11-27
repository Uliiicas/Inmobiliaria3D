"""
Render del recorrido completo en Cycles para la página /video/.

La cámara sigue exactamente la misma ruta que el recorrido 3D de la página principal:
lee las tomas de src/data/tour.ts y reproduce la curva Catmull-Rom centrípeta de three.js
(CatmullRomCurve3.getPoint), el FOV por toma y la apertura de la puerta.
El progreso es lineal en el número de cuadro, igual que el scroll de la web.

  HOUR=12 FRAMES=720 START=0 END=719 SAMPLES=96 python tour_render.py <carpeta de salida>

Variables:
  HOUR      hora del día (misma fórmula solar que src/lib/daylight.ts)
  FRAMES    cuadros de todo el recorrido · START / END  tramo a renderizar (inclusive)
  SAMPLES   muestras de Cycles (con denoiser OIDN) · RES  ancho (alto = 16:9)
  STEP      renderiza 1 de cada STEP cuadros (pruebas rápidas)

Lee $HOUSE_WORK/out/house.blend (build.py assemble). No modifica el .blend.
"""
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bpy  # noqa: E402,I001
import mathutils  # noqa: E402

from common import GEO, OUT, link, load_json, t2b  # noqa: E402
from build import sun_dir_for_hour  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
HOUR = float(os.environ.get('HOUR', '12'))
FRAMES = int(os.environ.get('FRAMES', '720'))
START = int(os.environ.get('START', '0'))
END = int(os.environ.get('END', str(FRAMES - 1)))
STEP = int(os.environ.get('STEP', '1'))
SAMPLES = int(os.environ.get('SAMPLES', '96'))
RES = int(os.environ.get('RES', '1280'))
DEST = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(OUT, f'tour-{HOUR:g}')
os.makedirs(DEST, exist_ok=True)


# ─────────────────────────── ruta de cámara (igual que TourRig.tsx) ───────────────────────────


def read_shots():
    src = open(os.path.join(ROOT, 'src/data/tour.ts'), encoding='utf8').read()
    consts = {'E1': 1.65, 'E2': 3.71 + 1.62}
    for k, v in re.findall(r'const (E\d) = ([\d.+ ]+)\n', src):
        consts[k] = eval(v)  # noqa: S307 (constantes numéricas del propio repo)
    shots = []
    for p, t, fov in re.findall(r'\{ p: \[([^\]]+)\], t: \[([^\]]+)\](?:, fov: ([\d.]+))? \}', src):
        val = lambda s: [float(consts.get(x.strip(), x.strip())) for x in s.split(',')]  # noqa: E731
        shots.append((val(p), val(t), float(fov or 55)))
    assert len(shots) > 10, 'no se pudieron leer las tomas de tour.ts'
    return shots


def catmull(points, t):
    """CatmullRomCurve3('centripetal').getPoint(t) de three.js, sin cerrar."""
    V = mathutils.Vector
    pts = [V(p) for p in points]
    n = len(pts)
    p = (n - 1) * t
    i = math.floor(p)
    w = p - i
    if w == 0 and i == n - 1:
        i, w = n - 2, 1.0
    p0 = pts[i - 1] if i > 0 else pts[0] - pts[1] + pts[0]
    p1, p2 = pts[i], pts[i + 1]
    p3 = pts[i + 2] if i + 2 < n else pts[n - 1] - pts[n - 2] + pts[n - 1]
    dt0 = ((p0 - p1).length_squared) ** 0.25
    dt1 = ((p1 - p2).length_squared) ** 0.25
    dt2 = ((p2 - p3).length_squared) ** 0.25
    if dt1 < 1e-4:
        dt1 = 1.0
    if dt0 < 1e-4:
        dt0 = dt1
    if dt2 < 1e-4:
        dt2 = dt1
    out = []
    for k in range(3):
        x0, x1, x2, x3 = p0[k], p1[k], p2[k], p3[k]
        t1 = ((x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1) * dt1
        t2 = ((x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2) * dt1
        c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2
        c3 = 2 * x1 - 2 * x2 + t1 + t2
        out.append(x1 + t1 * w + c2 * w * w + c3 * w * w * w)
    return out


def smoothstep(x, a, b):
    if x <= a:
        return 0.0
    if x >= b:
        return 1.0
    x = (x - a) / (b - a)
    return x * x * (3 - 2 * x)


SHOTS = read_shots()
NS = len(SHOTS)
# Tomas exteriores: la exposición se cierra afuera y se abre adentro, como el ojo (y como la web)
OUTSIDE = {0, 1, 2, 12, 13, 14, 15, 35, 36}


def pose(progress):
    pos = catmull([s[0] for s in SHOTS], progress)
    tgt = catmull([s[1] for s in SHOTS], progress)
    f = progress * (NS - 1)
    i = min(NS - 2, math.floor(f))
    fov = SHOTS[i][2] + (SHOTS[i + 1][2] - SHOTS[i][2]) * smoothstep(f - i, 0, 1)
    door = smoothstep(f, 2.5, 3.5) * (1 - smoothstep(f, 4.6, 5.6))
    a = 0.0 if i in OUTSIDE else 1.0
    b = 0.0 if (i + 1) in OUTSIDE else 1.0
    inside = a + (b - a) * smoothstep(f - i, 0.15, 0.85)
    return pos, tgt, fov, door, inside


# ─────────────────────────── luz según la hora ───────────────────────────


def hexrgb(h):
    h = h.lstrip('#')
    return tuple((int(h[k : k + 2], 16) / 255) ** 2.2 for k in (0, 2, 4))


# (hora, color del sol, energía del sol W/m², intensidad del cielo, luces artificiales 0..1, exposición afuera, extra adentro)
LIGHT = [
    (6.0, '#ff9e6b', 1.2, 0.35, 0.35, -0.3, 1.4),
    (7.3, '#ffc28e', 2.6, 0.7, 0.08, -1.6, 1.8),
    (10.0, '#fff1dc', 4.0, 1.0, 0.0, -2.4, 2.2),
    (13.0, '#fffaf1', 4.4, 1.0, 0.0, -2.6, 2.3),
    (15.5, '#fff0da', 4.0, 1.0, 0.0, -2.4, 2.1),
    (17.0, '#ffc890', 3.2, 0.9, 0.12, -1.9, 1.8),
    (18.4, '#ff9f5a', 2.4, 0.75, 0.45, -1.3, 1.2),
    (19.0, '#ff7f4d', 1.8, 0.6, 0.75, -1.0, 0.7),
    (19.6, '#ff6a5a', 0.8, 0.35, 0.92, -0.5, 0.3),
    (20.2, '#8ea0d8', 0.0, 0.12, 1.0, 0.2, -0.3),
    (21.0, '#9fb2e6', 0.0, 0.05, 1.0, 0.4, -0.5),
]


def light_for(h):
    i = 0
    while i < len(LIGHT) - 2 and h > LIGHT[i + 1][0]:
        i += 1
    a, b = LIGHT[i], LIGHT[i + 1]
    t = smoothstep(h, a[0], b[0])
    L = lambda x, y: x + (y - x) * t  # noqa: E731
    ca, cb = hexrgb(a[1]), hexrgb(b[1])
    return {
        'sun_color': tuple(L(ca[k], cb[k]) for k in range(3)),
        'sun': L(a[2], b[2]),
        'sky': L(a[3], b[3]),
        'art': L(a[4], b[4]),
        'exp_out': L(a[5], b[5]),
        'exp_in': L(a[6], b[6]),
    }


def setup_world(h, lt):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('tour_sky')
    sc.world = w
    nt = w.node_tree
    bg = nt.nodes['Background']
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'
    except TypeError:
        sky.sky_type = 'NISHITA'
    sd = sun_dir_for_hour(min(h, 19.72))
    sky.sun_elevation = max(math.asin(sd.z), math.radians(-3) if h > 19.7 else -1)
    sky.sun_rotation = math.atan2(sd.x, sd.y)
    if hasattr(sky, 'sun_disc'):
        sky.sun_disc = h < 19.6
    night = smoothstep(h, 19.6, 20.6)
    # de noche el cielo físico se apaga: se mezcla con un azul profundo (hora azul / noche)
    mix = nt.nodes.new('ShaderNodeMixRGB')
    mix.inputs['Fac'].default_value = night
    nt.links.new(sky.outputs['Color'], mix.inputs['Color1'])
    mix.inputs['Color2'].default_value = (*hexrgb('#1d2a52'), 1)
    nt.links.new(mix.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = lt['sky'] * (1 - night) + night * 0.35

    # sol (o luna fría y alta de noche)
    sun = bpy.data.objects.new('tour_sun', bpy.data.lights.new('tour_sun', 'SUN'))
    moon = mathutils.Vector(t2b(-0.35, 0.72, -0.6)).normalized()
    d = sd.lerp(moon, night).normalized()
    if d.z < 0.06:
        d.z = 0.06
        d.normalize()
    sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sun.data.color = lt['sun_color'] if night < 0.5 else hexrgb('#9fb2e6')
    sun.data.energy = lt['sun'] if night < 0.5 else 0.3
    sun.data.angle = math.radians(0.55)
    link(sun)


def setup_artificial(art):
    """Luminarias del recorrido (src/data/lighting.ts) y materiales emisivos de la casa."""
    from common import EMISSIVE

    for key, (col, strength) in EMISSIVE.items():
        m = bpy.data.materials.get(key)
        if not m:
            continue
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Emission Color'].default_value = (*col, 1)
        bsdf.inputs['Emission Strength'].default_value = strength * art
    if art < 0.02:
        return
    meta = load_json(os.path.join(GEO, 'geometry.json'))
    for i, (x, y, z, col, intensity, _rng) in enumerate(meta['lamps']):
        L = bpy.data.objects.new(f'tour_lamp{i}', bpy.data.lights.new(f'tour_lamp{i}', 'POINT'))
        L.data.energy = intensity * 45.0 * art
        L.data.shadow_soft_size = 0.25
        L.data.color = hexrgb(col)
        L.location = t2b(x, y, z)
        link(L)


# ─────────────────────────── agua y puerta (en la web son objetos aparte) ───────────────────────────


def water_material(name, color, transmissive, wave_scale, wave_strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.03
    bsdf.inputs['IOR'].default_value = 1.333
    if transmissive:
        bsdf.inputs['Transmission Weight'].default_value = 1.0
    coord = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = wave_scale
    noise.inputs['Detail'].default_value = 6
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = wave_strength
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def plane(name, size_x, size_y, loc, mat):
    me = bpy.data.meshes.new(name)
    hx, hy = size_x / 2, size_y / 2
    me.from_pydata([(-hx, -hy, 0), (hx, -hy, 0), (hx, hy, 0), (-hx, hy, 0)], [], [(0, 1, 2, 3)])
    o = bpy.data.objects.new(name, me)
    o.location = loc
    me.materials.append(mat)
    link(o)
    return o


def add_water():
    # océano: plano enorme a -9 m, oscuro y especular (refleja el cielo)
    ocean = water_material('tour_ocean', hexrgb('#0f2a33'), False, 0.35, 0.18)
    plane('tour_ocean', 6000, 6000, t2b(0, -9, 3000), ocean)
    # piscina infinita: agua transparente sobre el revestimiento de piedra
    pool = water_material('tour_pool', (0.85, 0.97, 0.95), True, 1.6, 0.06)
    plane('tour_pool', 22, 4.5, t2b(0, -0.09, 15.75), pool)


def add_door():
    oak = bpy.data.materials.get('oak')
    pivot = bpy.data.objects.new('tour_door_pivot', None)
    pivot.location = t2b(1.65, 0, -8.15)
    link(pivot)
    bpy.ops.mesh.primitive_cube_add(size=1)
    door = bpy.context.active_object
    door.name = 'tour_door'
    door.scale = (1.98, 0.1, 3.18)  # three (x, y, z) = (1,98 · 3,18 · 0,1) → Blender (x, -z, y)
    door.location = t2b(0.35, 1.6, 0)
    door.parent = pivot
    if oak:
        door.data.materials.append(oak)
    from build import box_uv

    bpy.context.view_layer.update()
    box_uv(door)
    return pivot


# ─────────────────────────── escena ───────────────────────────


def main():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'house.blend'))
    sc = bpy.context.scene
    lt = light_for(HOUR)
    setup_world(HOUR, lt)
    setup_artificial(lt['art'])
    add_water()
    door = add_door()

    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.015
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    try:
        sc.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
        sc.cycles.denoising_prefilter = 'ACCURATE'
    except (AttributeError, TypeError):
        pass
    sc.cycles.max_bounces = 8
    sc.cycles.diffuse_bounces = 4
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.sample_clamp_indirect = 8.0
    sc.cycles.use_light_tree = True
    sc.render.use_persistent_data = True  # el BVH y las texturas se reutilizan entre cuadros
    sc.render.resolution_x = RES
    sc.render.resolution_y = round(RES * 9 / 16)
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 94
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass

    cam = bpy.data.objects.new('tour_cam', bpy.data.cameras.new('tour_cam'))
    link(cam)
    sc.camera = cam
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.clip_start = 0.08
    cam.data.clip_end = 6000

    frames = [f for f in range(START, END + 1, STEP)]
    for f in frames:
        p = f / (FRAMES - 1)
        pos, tgt, fov, d, inside = pose(p)
        e, tg = t2b(*pos), t2b(*tgt)
        cam.location = e
        cam.rotation_euler = (tg - e).to_track_quat('-Z', 'Y').to_euler()
        cam.data.angle_y = math.radians(fov)
        # en video la puerta corre dentro del muro (en la web pivota): pivotando, la cámara pasa rozando su canto
        door.location = t2b(1.65 + 2.1 * d, 0, -8.15)
        sc.view_settings.exposure = lt['exp_out'] + lt['exp_in'] * inside
        for ob, path in ((cam, 'location'), (cam, 'rotation_euler'), (door, 'location')):
            ob.keyframe_insert(path, frame=f)
        cam.data.keyframe_insert('lens', frame=f)
        sc.view_settings.keyframe_insert('exposure', frame=f)
    # interpolación constante: cada cuadro usa exactamente su pose
    for ad in (cam.animation_data, door.animation_data, cam.data.animation_data, sc.animation_data):
        if ad and ad.action:
            for fc in getattr(ad.action, 'fcurves', []):
                for k in fc.keyframe_points:
                    k.interpolation = 'CONSTANT'

    sc.frame_start, sc.frame_end, sc.frame_step = START, END, STEP
    sc.render.filepath = os.path.join(DEST, 'f#####')
    sc.render.use_overwrite = False
    sc.render.use_placeholder = True  # varios procesos pueden repartirse el mismo rango
    print(f'Render {len(frames)} cuadros · hora {HOUR} · {SAMPLES} muestras · {RES}px → {DEST}', flush=True)
    bpy.ops.render.render(animation=True)


if __name__ == '__main__':
    main()
