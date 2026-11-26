"""
Textiles con forma real, simulados con el motor de telas de Blender (sin interfaz):

  inflated()  almohadas y almohadones: una caja de tela inflada por presión interna; las
              esquinas quedan pellizcadas y las caras se abomban como un relleno real.
  drape()     sábanas, acolchados y mantas: una tela que cae por gravedad sobre colisionadores
              y forma pliegues naturales en los bordes.
  curtain()   cortinas de lino: ondas de pliegue fijas en el riel y caída libre al piso.

Todas las funciones devuelven un objeto con los modificadores ya aplicados, en coordenadas
locales del mueble (Z arriba, frente a -Y), listo para kit.group().
"""
import math
import random

import bpy  # noqa: I001
import bmesh
import mathutils


def _scene():
    sc = bpy.context.scene
    sc.frame_start = 1
    return sc


def _grid_box(name, sx, sy, sz, edge):
    """Caja con caras en grilla casi cuadrada de lado ~edge (buena para simular)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=mathutils.Matrix.Diagonal((sx, sy, sz, 1)))
    for axis, size in ((0, sx), (1, sy), (2, sz)):
        n = max(1, round(size / edge))
        for i in range(1, n):
            co = [0, 0, 0]
            co[axis] = -size / 2 + size * i / n
            no = [0, 0, 0]
            no[axis] = 1
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _grid_plane(name, sx, sy, edge):
    nx, ny = max(2, round(sx / edge)), max(2, round(sy / edge))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=nx, y_segments=ny, size=0.5, matrix=mathutils.Matrix.Diagonal((sx, sy, 1, 1)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _cloth(o, *, mass=0.3, tension=15, bending=0.5, shear=5, gravity=1.0, pressure=0.0, quality=10, self_collision=False, pin=None, time_scale=1.0):
    m = o.modifiers.new('cloth', 'CLOTH')
    s = m.settings
    s.quality = quality
    s.mass = mass
    s.tension_stiffness = s.compression_stiffness = tension
    s.shear_stiffness = shear
    s.bending_stiffness = bending
    s.air_damping = 1.0
    s.time_scale = time_scale
    s.effector_weights.gravity = gravity
    if pressure:
        s.use_pressure = True
        s.uniform_pressure_force = pressure
    if pin:
        s.vertex_group_mass = pin
        s.pin_stiffness = 1.0
    c = m.collision_settings
    c.distance_min = 0.006
    c.use_self_collision = self_collision
    if self_collision:
        c.self_distance_min = 0.004
    c.collision_quality = 5
    c.impulse_clamp = 1.0
    return m


def _run(o, frames):
    sc = _scene()
    m = o.modifiers['cloth']
    m.point_cache.frame_start = 1
    m.point_cache.frame_end = frames
    sc.frame_end = frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    old = o.data
    o.modifiers.clear()
    o.data = me
    bpy.data.meshes.remove(old)
    sc.frame_set(1)


def _finish(o, mat, subsurf=0, thickness=0.0, smooth=True, max_tris=3000):
    if thickness:
        s = o.modifiers.new('solid', 'SOLIDIFY')
        s.thickness = thickness
        s.offset = 1.0
        s.use_even_offset = True
    if subsurf:
        sub = o.modifiers.new('sub', 'SUBSURF')
        sub.levels = sub.render_levels = subsurf
    _bake_modifiers(o)
    # presupuesto de polígonos: la forma ya está; se simplifica donde la superficie es plana
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > max_tris:
        dec = o.modifiers.new('dec', 'DECIMATE')
        dec.ratio = max_tris / tris
        _bake_modifiers(o)
    # UV del atlas de luz propia: ángulo amplio para que la tela arrugada quede en pocas islas
    lightmap_unwrap(o, angle=80)
    me = o.data
    # marca: estas caras ya traen su UV de atlas (stages.uv no las vuelve a desplegar)
    me.attributes.new('lm_pre', 'INT', 'FACE').data.foreach_set('value', [1] * len(me.polygons))
    if smooth:
        me.shade_smooth()
    me.materials.clear()
    me.materials.append(mat)
    bpy.context.scene.collection.objects.unlink(o)
    return o


def _bake_modifiers(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    old = o.data
    o.modifiers.clear()
    o.data = me
    bpy.data.meshes.remove(old)


def lightmap_unwrap(o, angle=66):
    """Crea la capa 'lightmap' con Smart UV Project sólo para este objeto (que debe estar enlazado)."""
    me = o.data
    lay = me.uv_layers.get('lightmap') or me.uv_layers.new(name='lightmap')
    me.uv_layers.active = lay
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def collider(o, thickness=0.006):
    m = o.modifiers.new('coll', 'COLLISION')
    o.collision.thickness_outer = thickness
    o.collision.cloth_friction = 8
    o.collision.thickness_outer = max(thickness, 0.01)
    return m


def _wrinkle(o, amount, scale, seed):
    """Arrugas finas: desplazamiento de ruido a lo largo de la normal."""
    rnd = random.Random(seed)
    off = mathutils.Vector((rnd.random() * 50, rnd.random() * 50, rnd.random() * 50))
    me = o.data
    me.update()
    for v in me.vertices:
        n = mathutils.noise.noise((v.co + off) * scale)
        n2 = mathutils.noise.noise((v.co * 2.3 + off) * scale)
        v.co += v.normal * (n * amount + n2 * amount * 0.4)


# ─────────────────────────────── piezas ───────────────────────────────


def inflated(name, mat, sx, sy, sz, *, pressure=8, edge=0.03, frames=24, wrinkles=0.004, seed=0, fit=None, max_tris=1600):
    """Almohada / almohadón: caja de tela fina inflada (esquinas pellizcadas, caras abombadas).

    fit=(x, y, z) reescala el resultado a esas medidas finales (útil para almohadones de asiento).
    """
    o = _grid_box(name, sx, sy, sz, edge)
    _cloth(o, mass=0.15, tension=20, bending=0.08, shear=8, gravity=0.0, pressure=pressure)
    _run(o, frames)
    if fit:
        cs = [v.co for v in o.data.vertices]
        dims = [max(c[i] for c in cs) - min(c[i] for c in cs) for i in range(3)]
        o.data.transform(mathutils.Matrix.Diagonal((fit[0] / dims[0], fit[1] / dims[1], fit[2] / dims[2], 1)))
    if wrinkles:
        _wrinkle(o, wrinkles, 9.0, seed)
    return _finish(o, mat, max_tris=max_tris)


def drape(name, mat, sx, sy, z, colliders, *, edge=0.035, frames=45, mass=0.3, bending=0.6, thickness=0.02, offset=(0, 0), wrinkles=0.003, seed=0, pin_edge=None, max_tris=6000, bounds=None):
    """Tela que cae sobre `colliders` (objetos ya enlazados a la escena) desde la altura z.

    bounds=((x0,y0,z0),(x1,y1,z1)): si la simulación se vuelve inestable y algún vértice sale de
    esa caja, se repite con pasos más finos (la tela de Blender a veces "explota" en esquinas).
    """
    for attempt in range(4):
        o = _grid_plane(name, sx, sy, edge)
        o.location = (offset[0], offset[1], z)
        pin = None
        if pin_edge:
            vg = o.vertex_groups.new(name='pin')
            idx = [v.index for v in o.data.vertices if pin_edge(v.co)]
            vg.add(idx, 1.0, 'REPLACE')
            pin = 'pin'
        for c in colliders:
            collider(c)
        ts = 0.6 / (1 + attempt)
        _cloth(o, mass=mass, tension=15, bending=bending, shear=5, gravity=1.0, pin=pin, time_scale=ts, quality=10 + 4 * attempt)
        _run(o, int(frames / ts))
        for c in colliders:
            for m in list(c.modifiers):
                if m.type == 'COLLISION':
                    c.modifiers.remove(m)
        o.data.transform(mathutils.Matrix.Translation(o.location))
        o.location = (0, 0, 0)
        if not bounds:
            break
        lo, hi = bounds
        ok = all(lo[i] <= v.co[i] <= hi[i] for v in o.data.vertices for i in range(3))
        if ok:
            break
        print(f'drape {name}: inestable, reintento {attempt + 1}')
        bpy.data.objects.remove(o)
    if wrinkles:
        _wrinkle(o, wrinkles, 7.0, seed)
    return _finish(o, mat, thickness=thickness, max_tris=max_tris)


def curtain(name, mat, width, height, *, depth=0.09, pleat=0.16, edge=0.03, seed=0, max_tris=3000):
    """Cortina de pliegues: onda en el riel que se abre suavemente hacia el piso."""
    nx = max(4, round(width / edge))
    nz = max(4, round(height / (edge * 1.6)))
    rnd = random.Random(seed)
    phase = rnd.random() * math.tau
    verts, faces = [], []
    for j in range(nz + 1):
        t = j / nz  # 0 abajo, 1 arriba
        z = t * height
        amp = depth * (0.75 + 0.25 * t)
        for i in range(nx + 1):
            x = -width / 2 + width * i / nx
            w = math.sin(x / pleat * math.pi + phase + (1 - t) * 0.6 * math.sin(x * 3.1))
            y = amp * w + (1 - t) * 0.03 * math.sin(x * 7.7 + phase)
            verts.append((x, y, z))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    _wrinkle(o, 0.004, 5.0, seed)
    return _finish(o, mat, thickness=0.004, max_tris=max_tris)
