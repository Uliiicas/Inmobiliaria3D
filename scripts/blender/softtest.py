"""Prueba aislada de una pieza: python softtest.py bed|sofa  → $HOUSE_WORK/out/test_<pieza>.png"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402,I001
import mathutils  # noqa: E402

import build  # noqa: E402
import kit  # noqa: E402
from common import OUT, clear_scene, link  # noqa: E402

what = sys.argv[1]
clear_scene()
M = build.make_materials()
import time  # noqa: E402

t0 = time.time()
if what == 'bed':
    o = kit.bed(M, 'bed', (0, 0, 0), 0, 2.0, 2.2)
    eye, tgt = (2.6, -3.0, 1.7), (0, 0.2, 0.55)
elif what == 'sofa':
    o = kit.sofa(M, 'sofa', (0, 0, 0), 0, 3.0, 1.05, 'linen')
    eye, tgt = (2.2, -3.2, 1.4), (0, 0, 0.45)
print('construido en', round(time.time() - t0, 1), 's', len(o.data.polygons), 'caras')
floor = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
floor.data.from_pydata([(-8, -8, 0), (8, -8, 0), (8, 8, 0), (-8, 8, 0)], [], [(0, 1, 2, 3)])
floor.data.materials.append(M['oak'])
link(floor)
uv = floor.data.uv_layers.new(name='uv0')
for i, lp in enumerate(floor.data.loops):
    v = floor.data.vertices[lp.vertex_index].co
    uv.data[i].uv = (v.x, v.y)
build.box_uv(o)
sc = bpy.context.scene
sd = mathutils.Vector((-0.5, -0.6, 0.62)).normalized()
build.sky_world(0.5, sd)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.0
sun.data.angle = math.radians(2)
sun.rotation_euler = (-sd).to_track_quat('-Z', 'Y').to_euler()
link(sun)
sc.render.engine = 'CYCLES'
sc.cycles.samples = 48
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 900, 560
sc.view_settings.view_transform = 'AgX'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
link(cam)
sc.camera = cam
e, t = mathutils.Vector(eye), mathutils.Vector(tgt)
cam.location = e
cam.rotation_euler = (t - e).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 32
sc.render.filepath = os.path.join(OUT, f'test_{what}.png')
bpy.ops.render.render(write_still=True)
