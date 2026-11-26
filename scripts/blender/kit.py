"""
Mobiliario modelado en Blender para reemplazar las cajas procedurales: tapizados con
bordes redondeados (bevel + subdivisión), camas con ropa de cama, sillas de comedor y
árboles con hojas en tarjetas recortadas. Todas las medidas están en metros, en
coordenadas locales de Blender (Z arriba, el frente del mueble mira a -Y).
"""
import math
import os
import random

import bpy  # noqa: I001
import bmesh
import mathutils

from common import MODELS, link


def _box(bm, cx, cy, cz, sx, sy, sz):
    m = mathutils.Matrix.Translation((cx, cy, cz)) @ mathutils.Matrix.Diagonal((sx, sy, sz, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def soft_box(name, mat, cx, cy, cz, sx, sy, sz, radius=0.04, segments=3, puff=0.0):
    """Caja tapizada: bevel redondeado y, opcionalmente, una leve curvatura de relleno."""
    bm = bmesh.new()
    _box(bm, 0, 0, 0, sx, sy, sz)
    r = min(radius, sx / 2.05, sy / 2.05, sz / 2.05)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=r, segments=segments, profile=0.5, affect='EDGES', clamp_overlap=True)
    if puff > 0:
        # infla el centro de las caras grandes (almohadones)
        for v in bm.verts:
            nx = abs(v.co.x) / (sx / 2)
            ny = abs(v.co.y) / (sy / 2)
            k = (1 - nx * nx) * (1 - ny * ny)
            if v.co.z > 0:
                v.co.z += puff * max(k, 0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    o.location = (cx, cy, cz)
    return o


def rigid_box(name, mat, cx, cy, cz, sx, sy, sz, radius=0.004):
    o = soft_box(name, mat, cx, cy, cz, sx, sy, sz, radius, segments=1)
    o.data.set_sharp_from_angle(angle=math.radians(40))
    return o


def cylinder(name, mat, cx, cy, cz, r1, r2, h, seg=24):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(40))
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    o.location = (cx, cy, cz)
    return o


def pillow(name, mat, cx, cy, cz, sx, sy, sz, tilt=0.0):
    """Almohadón: cubo subdividido (Catmull-Clark) que toma forma de almohada mullida."""
    bm = bmesh.new()
    _box(bm, 0, 0, 0, 1, 1, 1)
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=2, use_grid_fill=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    o.scale = (sx * 1.25, sy * 1.25, sz * 1.6)
    o.location = (cx, cy, cz)
    o.rotation_euler = (tilt, 0, 0)
    me.shade_smooth()
    me.materials.append(mat)
    return o


def group(parts, name, loc, rot):
    """Une las partes de un mueble en un solo objeto y lo coloca en la escena."""
    coll = bpy.context.scene.collection
    for p in parts:
        coll.objects.link(p)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
        bpy.context.view_layer.objects.active = p
        for m in list(p.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.location = mathutils.Vector(o.location) + mathutils.Vector(loc)
    o.rotation_euler = (0, 0, rot)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


# ─────────────────────────────── piezas ───────────────────────────────


def sofa(M, name, loc, rot, w, d, mat):
    """Sofá tapizado: estructura con bordes suaves y almohadones de tela inflados (seams, abombado)."""
    import soft

    up = M[mat]
    parts = []
    h0 = 0.1  # zócalo retirado: el sofá "flota"
    seed = int(abs(loc[0] * 11 + loc[1] * 5))
    parts.append(rigid_box('base', M['walnut'], 0, 0, h0 / 2, w - 0.12, d - 0.12, h0, 0.006))
    parts.append(soft_box('deck', up, 0, 0.0, h0 + 0.1, w, d, 0.2, 0.05, 4))
    parts.append(soft_box('back', up, 0, d / 2 - 0.1, h0 + 0.36, w, 0.2, 0.52, 0.08, 4, puff=0.0))
    for s_ in (-1, 1):
        parts.append(soft_box('arm', up, s_ * (w / 2 - 0.1), 0.0, h0 + 0.27, 0.2, d, 0.34, 0.08, 4))
    n = max(2, round((w - 0.4) / 0.85))
    cw = (w - 0.4) / n
    seat = soft.inflated('seat', up, cw, d - 0.3, 0.15, pressure=2.5, seed=seed, fit=(cw - 0.01, d - 0.24, 0.17), wrinkles=0.003)
    back = soft.inflated('backc', up, cw, 0.5, 0.12, pressure=3.5, seed=seed + 1, fit=(cw - 0.01, 0.52, 0.2), wrinkles=0.004)
    acc1 = soft.inflated('acc1', M['linen' if mat != 'linen' else 'wool'], 0.5, 0.5, 0.06, pressure=8, seed=seed + 2)
    acc2 = soft.inflated('acc2', M['leather' if mat == 'linen' else 'linen'], 0.46, 0.46, 0.06, pressure=8, seed=seed + 3)

    def place(src, x, y, z, rx=0.0, rz=0.0):
        o = src.copy()
        o.data = src.data.copy()
        o.rotation_euler = (rx, 0, rz)
        o.location = (x, y, z)
        return o

    for i in range(n):
        x = -w / 2 + 0.2 + cw * (i + 0.5)
        parts.append(place(seat, x, -0.08, h0 + 0.27))
        # respaldo: almohadón apoyado e inclinado hacia atrás
        parts.append(place(back, x, d / 2 - 0.3, h0 + 0.6, math.radians(90 - 14)))
    parts.append(place(acc1, -w / 2 + 0.45, d / 2 - 0.42, h0 + 0.6, math.radians(-72), 0.25))
    parts.append(place(acc2, w / 2 - 0.45, d / 2 - 0.42, h0 + 0.58, math.radians(-70), -0.2))
    for p in (seat, back, acc1, acc2):
        bpy.data.meshes.remove(p.data)
    return group(parts, name, loc, rot)


def bed(M, name, loc, rot, w, l):
    """Cama con ropa de cama simulada: acolchado que cae por los lados, manta al pie y almohadas infladas."""
    import soft

    parts = []
    plat = rigid_box('plat', M['walnut'], 0, 0, 0.2, w + 0.3, l + 0.2, 0.16, 0.008)
    mattress = soft_box('mattress', M['linen'], 0, 0, 0.415, w, l, 0.27, 0.06, 4)
    parts += [plat, mattress]
    coll = bpy.context.scene.collection
    coll.objects.link(plat)
    coll.objects.link(mattress)
    seed = int(abs(loc[0] * 13 + loc[1] * 7))
    floor = rigid_box('floor', M['oak'], 0, 0, -0.01, w + 3, l + 3, 0.02, 0.001)
    coll.objects.link(floor)
    # acolchado: cubre 3/4 de la cama y cae por los lados y el pie
    duvet = soft.drape('duvet', M['linen'], w + 0.62, l * 0.8 + 0.12, 0.66, [mattress, plat, floor], offset=(0, -l * 0.1 - 0.06),
                       edge=0.03, mass=0.4, bending=1.2, thickness=0.05, wrinkles=0.007, seed=seed, max_tris=9000,
                       bounds=((-w / 2 - 0.5, -l / 2 - 0.5, -0.03), (w / 2 + 0.5, l / 2 + 0.3, 0.9)))
    # manta de lana doblada al pie
    coll.objects.link(duvet)
    throw = soft.drape('throw', M['wool'], w + 0.34, 0.5, 0.78, [duvet, mattress, plat, floor], offset=(0, -l / 2 + 0.36),
                       edge=0.03, mass=0.25, bending=0.8, thickness=0.012, wrinkles=0.005, seed=seed + 1,
                       bounds=((-w / 2 - 0.5, -l / 2 - 0.5, -0.03), (w / 2 + 0.5, 0, 0.95)))
    coll.objects.unlink(duvet)
    coll.objects.unlink(floor)
    bpy.data.objects.remove(floor)
    coll.objects.unlink(plat)
    coll.objects.unlink(mattress)
    parts += [duvet, throw]
    # cabecero tapizado en canales verticales
    n = max(6, round((w + 0.3) / 0.24))
    cw = (w + 0.3) / n
    for i in range(n):
        x = -(w + 0.3) / 2 + cw * (i + 0.5)
        parts.append(soft_box('head', M['wool'], x, l / 2 + 0.06, 0.78, cw - 0.004, 0.11, 0.96, 0.05, 4, puff=0.0))
    # almohadas: dos grandes contra el cabecero, dos de dormir delante y una decorativa
    big = soft.inflated('pb', M['wool'], 0.62, 0.62, 0.07, pressure=9, seed=seed + 2)
    sleep = soft.inflated('ps', M['linen'], 0.72, 0.48, 0.07, pressure=7, seed=seed + 3)
    acc = soft.inflated('pa', M['leather'], 0.48, 0.3, 0.06, pressure=8, seed=seed + 4)

    def place(src, x, y, z, tilt, yaw=0.0):
        o = src.copy()
        o.data = src.data.copy()
        o.rotation_euler = (tilt, 0, yaw)
        o.location = (x, y, z)
        return o

    for s in (-1, 1):
        parts.append(place(big, s * w * 0.25, l / 2 - 0.14, 0.86, math.radians(-75), s * 0.05))
        parts.append(place(sleep, s * w * 0.24, l / 2 - 0.36, 0.72, math.radians(-58), -s * 0.04))
    parts.append(place(acc, 0.02, l / 2 - 0.55, 0.68, math.radians(-50), 0.06))
    # mesas de luz suspendidas con lámpara
    for s in (-1, 1):
        x = s * (w / 2 + 0.45)
        parts.append(rigid_box('nt', M['walnut'], x, l / 2 - 0.25, 0.48, 0.55, 0.42, 0.08, 0.006))
        parts.append(cylinder('ls', M['bronze'], x, l / 2 - 0.25, 0.75, 0.012, 0.012, 0.45, 8))
        parts.append(cylinder('lb', M['bronze'], x, l / 2 - 0.25, 0.53, 0.07, 0.07, 0.02, 20))
        parts.append(cylinder('sh', M['glow'], x, l / 2 - 0.25, 1.02, 0.13, 0.11, 0.2, 32))
    return group(parts, name, loc, rot)


def _bend(o, k):
    """Curva la pieza alrededor del asiento: y += k·x² (respaldo envolvente)."""
    for v in o.data.vertices:
        v.co.y += k * v.co.x * v.co.x


def dining_chair(M, name, loc, rot):
    """Silla tapizada: asiento mullido, respaldo curvo envolvente y patas de roble cónicas abiertas."""
    import soft

    parts = []
    parts.append(soft_box('shell', M['linen'], 0, 0, 0.43, 0.48, 0.47, 0.06, 0.025, 3))
    seat = soft.inflated('cush', M['linen'], 0.46, 0.44, 0.08, pressure=2.5, seed=int(abs(loc[0] * 9 + loc[1] * 3)), fit=(0.46, 0.45, 0.07), wrinkles=0.002)
    seat.location = (0, -0.01, 0.49)
    parts.append(seat)
    back = soft_box('back', M['linen'], 0, 0, 0, 0.48, 0.055, 0.44, 0.025, 4)
    # el respaldo se curva hacia adelante en los lados
    for v in back.data.vertices:
        v.co.y -= 0.55 * v.co.x * v.co.x
    back.location = (0, 0.215, 0.76)
    back.rotation_euler = (math.radians(-8), 0, 0)
    parts.append(back)
    for lx, ly in ((-0.2, -0.19), (0.2, -0.19), (-0.2, 0.19), (0.2, 0.19)):
        c = cylinder('leg', M['oak'], lx, ly, 0.2, 0.017, 0.011, 0.42, 12)
        c.rotation_euler = (math.copysign(0.07, ly), -math.copysign(0.07, lx), 0)
        parts.append(c)
    return group(parts, name, loc, rot)


def books(M, name, x0, x1, base, depth, seed, max_h=0.3):
    """Hilera de libros sueltos: alturas, espesores y colores variados, alguno inclinado o apilado."""
    rnd = random.Random(seed)
    mats = ['leather', 'linen', 'wool', 'walnut', 'smoked', 'art1', 'art2', 'art3', 'linen', 'art3']
    parts = []
    x = x0
    while x < x1 - 0.03:
        r = rnd.random()
        if r < 0.06:  # hueco con objeto
            x += rnd.uniform(0.12, 0.25)
            continue
        if r < 0.14:  # pila acostada
            hz = 0.0
            for _ in range(rnd.randint(2, 4)):
                t = rnd.uniform(0.025, 0.05)
                w = rnd.uniform(0.17, 0.24)
                parts.append(rigid_box('b', M[rnd.choice(mats)], x + w / 2, rnd.uniform(-0.01, 0.01), base + hz + t / 2, w, depth * rnd.uniform(0.75, 0.95), t, 0.004))
                hz += t
            x += 0.26
            continue
        t = rnd.uniform(0.02, 0.055)
        h = rnd.uniform(0.62, 1.0) * max_h
        d = depth * rnd.uniform(0.7, 0.95)
        b = rigid_box('b', M[rnd.choice(mats)], 0, 0, 0, t, d, h, 0.003)
        lean = rnd.random() < 0.08
        b.rotation_euler = (0, math.radians(rnd.uniform(8, 16)) if lean else 0, 0)
        b.location = (x + t / 2 + (h * 0.15 if lean else 0), (depth - d) / 2, base + h / 2)
        parts.append(b)
        x += t + rnd.uniform(0.0, 0.004)
    return parts


def vessel_basin(M, name, loc, rot, faucet_from_wall=0.32):
    """Bacha de apoyo en cerámica con grifería de pared en bronce."""
    parts = []
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.17, radius2=0.21, depth=0.13)
    # vaciado: inserta y baja la tapa superior
    top = [f for f in bm.faces if f.normal.z > 0.9][0]
    r = bmesh.ops.inset_region(bm, faces=[top], thickness=0.012, depth=0)
    bmesh.ops.translate(bm, vec=(0, 0, -0.1), verts=list({v for f in [top] for v in f.verts}))
    _ = r
    me = bpy.data.meshes.new('basin')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('basin', me)
    o.location = (0, 0, 0.065)
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    me.shade_smooth()
    me.materials.append(M['ceramic'])
    parts.append(o)
    # grifo de pared: caño horizontal y florón
    spout = cylinder('spout', M['bronze'], 0, 0, 0, 0.012, 0.012, faucet_from_wall - 0.05, 16)
    spout.rotation_euler = (math.radians(90), 0, 0)
    spout.location = (0, faucet_from_wall / 2 + 0.02, 0.32)
    parts.append(spout)
    rose = cylinder('rose', M['bronze'], 0, faucet_from_wall, 0.32, 0.035, 0.035, 0.012, 24)
    rose.rotation_euler = (math.radians(90), 0, 0)
    parts.append(rose)
    for dx in (-0.09, 0.09):
        k = cylinder('knob', M['bronze'], dx, faucet_from_wall - 0.03, 0.32, 0.018, 0.018, 0.05, 16)
        k.rotation_euler = (math.radians(90), 0, 0)
        parts.append(k)
    return group(parts, name, loc, rot)


def toilet(M, name, loc, rot):
    """Inodoro suspendido con mochila embutida y placa de descarga."""
    parts = []
    bowl = soft_box('bowl', M['ceramic'], 0, -0.05, 0.31, 0.37, 0.55, 0.3, 0.13, 4)
    for v in bowl.data.vertices:  # se afina hacia adelante
        k = (0.3 - v.co.y) / 0.6
        v.co.x *= 0.78 + 0.22 * min(max(k, 0), 1)
    parts.append(bowl)
    parts.append(soft_box('seat', M['ceramic'], 0, -0.06, 0.47, 0.37, 0.5, 0.025, 0.012, 3))
    parts.append(soft_box('tank', M['ceramic'], 0, 0.26, 0.6, 0.42, 0.14, 1.0, 0.03, 3))
    parts.append(rigid_box('plate', M['bronze'], 0, 0.185, 0.95, 0.22, 0.012, 0.14, 0.003))
    return group(parts, name, loc, rot)


def towel(M, name, loc, rot, w=0.5, drop=0.55, mat='linen'):
    """Toallero de bronce con una toalla simulada colgando."""
    import soft

    parts = []
    bar = cylinder('bar', M['bronze'], 0, 0, 0, 0.011, 0.011, w + 0.2, 16)
    bar.rotation_euler = (0, math.radians(90), 0)
    bar.location = (0, 0, 0)
    coll = bpy.context.scene.collection
    coll.objects.link(bar)
    bpy.context.view_layer.update()
    t = soft.drape('towel', M[mat], w, drop * 2 + 0.05, 0.03, [bar], edge=0.025, mass=0.4, bending=2.0, thickness=0.008, frames=50, wrinkles=0.004, seed=int(abs(loc[0] * 5)))
    coll.objects.unlink(bar)
    parts += [bar, t]
    for dx in (-(w / 2 + 0.1), w / 2 + 0.1):
        parts.append(cylinder('post', M['bronze'], dx, 0.03, 0, 0.012, 0.012, 0.06, 12))
        parts[-1].rotation_euler = (math.radians(90), 0, 0)
    return group(parts, name, loc, rot)


def sink_faucet(M, name, loc, rot):
    """Bacha bajo mesada (borde de acero) con grifería cuello de cisne en bronce."""
    parts = [rigid_box('rim', M['metal'], 0, 0, 0.002, 0.78, 0.44, 0.004, 0.002),
             rigid_box('well', M['concreteDark'], 0, 0, 0.0045, 0.74, 0.40, 0.002, 0.001)]
    parts.append(cylinder('fb', M['bronze'], 0, 0.3, 0.02, 0.028, 0.028, 0.04, 20))
    parts.append(cylinder('fc', M['bronze'], 0, 0.3, 0.2, 0.016, 0.016, 0.36, 16))
    # cuello de cisne: arco de tubo
    curve = bpy.data.curves.new('neck', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.014
    curve.bevel_resolution = 3
    sp = curve.splines.new('POLY')
    pts = []
    for i in range(13):
        a = math.pi * i / 12
        pts.append((0, 0.3 - 0.12 + 0.12 * math.cos(a), 0.38 + 0.12 * math.sin(a)))
    pts.append((0, 0.3 - 0.24, 0.3))
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (*c, 1)
    co = bpy.data.objects.new('neck', curve)
    bpy.context.scene.collection.objects.link(co)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(co.evaluated_get(dg))
    bpy.context.scene.collection.objects.unlink(co)
    neck = bpy.data.objects.new('neckm', me)
    me.materials.append(M['bronze'])
    me.shade_smooth()
    parts.append(neck)
    lever = cylinder('lv', M['bronze'], 0.04, 0.3, 0.12, 0.008, 0.008, 0.09, 10)
    lever.rotation_euler = (0, math.radians(70), 0)
    parts.append(lever)
    return group(parts, name, loc, rot)


def cooktop(M, name, loc, rot):
    parts = [rigid_box('glass', M['basalt'], 0, 0, 0.003, 0.9, 0.5, 0.006, 0.002)]
    for dx, dy, r in ((-0.22, 0.1, 0.1), (0.22, 0.1, 0.08), (-0.22, -0.12, 0.08), (0.22, -0.12, 0.1)):
        # zonas de cocción: aro gris fino sobre el vidrio negro
        parts.append(cylinder('ring', M['metal'], dx, dy, 0.0065, r, r, 0.001, 40))
        parts.append(cylinder('zone', M['basalt'], dx, dy, 0.0072, r - 0.005, r - 0.005, 0.001, 40))
    return group(parts, name, loc, rot)


def table(M, name, loc, rot, w, d, h, top):
    parts = [rigid_box('top', M[top], 0, 0, h - 0.025, w, d, 0.05, 0.006)]
    leg = M['marble'] if top == 'marble' else M['metal']
    for s in (-1, 1):
        parts.append(rigid_box('leg', leg, s * (w / 2 - 0.35), 0, (h - 0.05) / 2, 0.06, d * 0.7, h - 0.05, 0.004))
    return group(parts, name, loc, rot)


def rug(M, name, loc, rot, w, d):
    return group([soft_box('rug', M['wool'], 0, 0, 0.012, w, d, 0.024, 0.01, 2)], name, loc, rot)


def floor_lamp(M, name, loc):
    parts = [
        cylinder('base', M['metal'], 0, 0, 0.012, 0.16, 0.16, 0.024, 32),
        cylinder('pole', M['metal'], 0, 0, 0.8, 0.01, 0.01, 1.56, 8),
        cylinder('shade', M['glow'], 0, 0, 1.62, 0.16, 0.22, 0.26, 40),
    ]
    return group(parts, name, loc, 0)


def lounger(M, name, loc, base):
    parts = [soft_box('pad', M['linen'], 0, 0, 0.2, 0.75, 1.9, 0.14 if base else 0.3, 0.05, 3, puff=0.015)]
    if base:
        parts.append(rigid_box('frame', M['cumaru'], 0, 0, 0.07, 0.8, 2.0, 0.12, 0.006))
        parts.append(pillow('hp', M['linen'], 0, 0.75, 0.34, 0.5, 0.18, 0.16, -0.4))
    return group(parts, name, loc, 0)


def stool(M, name, loc):
    parts = [
        soft_box('seat', M['leather'], 0, 0, 0.72, 0.4, 0.4, 0.06, 0.03, 3, puff=0.008),
        cylinder('col', M['metal'], 0, 0, 0.36, 0.022, 0.022, 0.7, 12),
        cylinder('foot', M['metal'], 0, 0, 0.01, 0.2, 0.2, 0.02, 32),
        cylinder('ring', M['metal'], 0, 0, 0.28, 0.17, 0.17, 0.015, 32),
    ]
    return group(parts, name, loc, 0)


# ─────────────────────────────── árboles ───────────────────────────────


def leaf_material():
    """Hojas en tarjetas con recorte alfa a partir del atlas de hojas del jacarandá de Poly Haven."""
    if 'leafcard' in bpy.data.materials:
        return bpy.data.materials['leafcard']
    from PIL import Image
    import numpy as np

    src = os.path.join(MODELS, 'jacaranda_tree', 'textures', 'jacaranda_tree_leaves_diff_1k.jpg')
    dst = os.path.join(MODELS, 'leafcard.png')
    if not os.path.exists(dst):
        im = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32) / 255.0
        lum = im.max(-1)
        a = np.clip((lum - 0.07) / 0.08, 0, 1)
        # oliva: verde grisáceo plateado
        g = im @ np.array([0.3, 0.59, 0.11])
        col = np.stack([g * 0.78, g * 0.9, g * 0.68], -1) * 1.15
        rgba = np.concatenate([np.clip(col, 0, 1), a[..., None]], -1)
        Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').save(dst)
    mat = bpy.data.materials.new('leafcard')
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(dst)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.7
    mat.surface_render_method = 'DITHERED'
    return mat


def bark_material():
    if 'bark' in bpy.data.materials:
        return bpy.data.materials['bark']
    mat = bpy.data.materials.new('bark')
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(MODELS, 'jacaranda_tree', 'textures', 'jacaranda_tree_trunk_diff_1k.jpg'))
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.95
    return mat


def tree(name, loc, scale, seed):
    """Olivo escultórico: tronco torcido que se abre en ramas y copa de tarjetas de hojas."""
    rnd = random.Random(seed)
    bark = bark_material()
    leaf = leaf_material()
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('uv0')
    cards = []

    def branch(p, d, length, radius, depth):
        segs = 6
        ring = 7
        prev = None
        pts = []
        for i in range(segs + 1):
            t = i / segs
            q = p + d * length * t
            q += mathutils.Vector((math.sin(t * 3 + seed) * 0.08, math.cos(t * 2.3 + seed) * 0.08, 0)) * length * 0.3
            pts.append(q)
        for i, q in enumerate(pts):
            r = radius * (1 - 0.55 * i / segs)
            axis = d.normalized()
            side = axis.orthogonal().normalized()
            up = axis.cross(side).normalized()
            vs = []
            for k in range(ring):
                a = k / ring * math.tau
                vs.append(bm.verts.new(q + (side * math.cos(a) + up * math.sin(a)) * r))
            if prev:
                for k in range(ring):
                    f = bm.faces.new((prev[k], prev[(k + 1) % ring], vs[(k + 1) % ring], vs[k]))
                    for li, loop in enumerate(f.loops):
                        loop[uv].uv = ((k + (li in (1, 2))) / ring, (i - (li < 2)) * length / segs)
            prev = vs
        end = pts[-1]
        if depth >= 2:
            # racimos de hojas al final de las ramas finas
            for _ in range(34):
                c = end + mathutils.Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.5, 0.6))) * 1.1 * scale
                cards.append(c)
            return
        n = 3 if depth == 0 else 2
        for j in range(n):
            nd = (d.normalized() + mathutils.Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.1, 0.6)))).normalized()
            branch(pts[-1 - j], nd, length * rnd.uniform(0.55, 0.75), radius * 0.6, depth + 1)

    branch(mathutils.Vector((0, 0, 0)), mathutils.Vector((rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), 1)), 2.2 * scale, 0.14 * scale, 0)
    me = bpy.data.meshes.new(name + '_wood')
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(bark)
    wood = bpy.data.objects.new(name + '_wood', me)

    # tarjetas de hojas: dos planos cruzados por racimo
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('uv0')
    for c in cards:
        s = rnd.uniform(0.6, 0.95) * scale
        rot = mathutils.Euler((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, math.tau))).to_matrix()
        for plane in range(2):
            pr = rot @ mathutils.Matrix.Rotation(plane * math.pi / 2, 3, 'Z')
            corners = [(-0.5, 0, -0.5), (0.5, 0, -0.5), (0.5, 0, 0.5), (-0.5, 0, 0.5)]
            vs = [bm.verts.new(c + pr @ (mathutils.Vector(k) * s)) for k in corners]
            f = bm.faces.new(vs)
            for loop, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                loop[uv].uv = (u, v)
    me = bpy.data.meshes.new(name + '_leaves')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(leaf)
    leaves = bpy.data.objects.new(name + '_leaves', me)
    for o in (wood, leaves):
        o.location = loc
        link(o)
    return [wood, leaves]
