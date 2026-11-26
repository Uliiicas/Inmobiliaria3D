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
    up = M[mat]
    parts = []
    h0 = 0.12  # zócalo retirado: el sofá "flota"
    parts.append(rigid_box('base', M['walnut'], 0, 0, h0 / 2, w - 0.12, d - 0.12, h0, 0.006))
    parts.append(soft_box('seat', up, 0, 0.02, h0 + 0.13, w, d, 0.26, 0.05, 3))
    parts.append(soft_box('back', up, 0, d / 2 - 0.11, h0 + 0.4, w, 0.22, 0.56, 0.07, 3))
    for s in (-1, 1):
        parts.append(soft_box('arm', up, s * (w / 2 - 0.1), 0.02, h0 + 0.3, 0.2, d, 0.36, 0.06, 3))
    n = max(2, round((w - 0.4) / 0.9))
    cw = (w - 0.4) / n
    for i in range(n):
        x = -w / 2 + 0.2 + cw * (i + 0.5)
        parts.append(soft_box('cush', up, x, -0.06, h0 + 0.33, cw - 0.015, d - 0.3, 0.16, 0.06, 4, puff=0.025))
        parts.append(pillow('bk', up, x, d / 2 - 0.28, h0 + 0.6, cw * 0.82, 0.12, 0.36, -0.25))
    # cojines decorativos en lino crudo y lana
    parts.append(pillow('p1', M['linen' if mat != 'linen' else 'wool'], -w / 2 + 0.42, d / 2 - 0.38, h0 + 0.58, 0.42, 0.11, 0.38, -0.3))
    parts.append(pillow('p2', M['leather' if mat == 'linen' else 'linen'], w / 2 - 0.42, d / 2 - 0.38, h0 + 0.58, 0.42, 0.11, 0.38, -0.3))
    return group(parts, name, loc, rot)


def bed(M, name, loc, rot, w, l):
    parts = []
    parts.append(rigid_box('plat', M['walnut'], 0, 0, 0.2, w + 0.3, l + 0.2, 0.16, 0.008))
    parts.append(soft_box('mattress', M['linen'], 0, 0, 0.42, w, l, 0.28, 0.07, 3))
    # edredón que cae por los lados y se dobla al pie
    parts.append(soft_box('duvet', M['linen'], 0, -l * 0.12, 0.5, w + 0.06, l * 0.76, 0.16, 0.06, 4, puff=0.02))
    parts.append(soft_box('throw', M['wool'], 0, -l * 0.33, 0.585, w + 0.1, l * 0.28, 0.05, 0.025, 3, puff=0.01))
    # cabecero tapizado
    parts.append(soft_box('head', M['wool'], 0, l / 2 + 0.05, 0.75, w + 0.3, 0.1, 0.9, 0.04, 3))
    for s in (-1, 1):
        parts.append(pillow('pl', M['linen'], s * w * 0.24, l / 2 - 0.3, 0.68, w * 0.4, 0.16, 0.36, -0.35))
    parts.append(pillow('pc', M['wool'], 0, l / 2 - 0.5, 0.66, 0.5, 0.12, 0.3, -0.2))
    # mesas de luz suspendidas con lámpara
    for s in (-1, 1):
        x = s * (w / 2 + 0.45)
        parts.append(rigid_box('nt', M['walnut'], x, l / 2 - 0.25, 0.48, 0.55, 0.42, 0.08, 0.006))
        parts.append(cylinder('ls', M['bronze'], x, l / 2 - 0.25, 0.75, 0.012, 0.012, 0.45, 8))
        parts.append(cylinder('lb', M['bronze'], x, l / 2 - 0.25, 0.53, 0.07, 0.07, 0.02, 20))
    return group(parts, name, loc, rot)


def dining_chair(M, name, loc, rot):
    parts = []
    parts.append(soft_box('seat', M['linen'], 0, 0, 0.45, 0.48, 0.48, 0.08, 0.03, 3, puff=0.01))
    parts.append(soft_box('back', M['linen'], 0, 0.22, 0.74, 0.46, 0.06, 0.48, 0.025, 3))
    for lx, ly in ((-0.2, -0.2), (0.2, -0.2), (-0.2, 0.2), (0.2, 0.2)):
        c = cylinder('leg', M['oak'], lx, ly, 0.205, 0.016, 0.012, 0.41, 10)
        c.rotation_euler = (math.copysign(0.05, ly), -math.copysign(0.05, lx), 0)
        parts.append(c)
    parts.append(rigid_box('rail', M['oak'], 0, 0.21, 0.42, 0.42, 0.025, 0.04, 0.004))
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
