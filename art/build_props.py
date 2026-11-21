"""Models every valuable (and the front door) in Blender and writes public/models/props.glb.

    python art/build_props.py

Each prop is one object named after its CATALOG key in src/props.js, origin at
its bottom centre, sized to sit inside the physics colliders defined there.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from common import (OUT, apply_all_modifiers, assign_uv0, box, cylinder, export_glb, lathe, material,  # noqa: E402
                    reset_materials, reset_scene, rng, set_vertex_color, sphere, tube)

reset_scene()
reset_materials()
os.makedirs(OUT, exist_ok=True)

M = {
    'porcelain': material('porcelain', '#ffffff', 0.25, vcol=True),
    'cardboard': material('cardboard', '#ffffff', 0.9),
    'tape': material('tape', '#e6dcc4', 0.4),
    'gold': material('gold', '#c9973a', 0.3, 0.9),
    'portrait': material('portrait', '#ffffff', 0.8),
    'walnut': material('walnut', '#4a2c1a', 0.45),
    'clockface': material('clockface', '#f1e6c8', 0.5),
    'brass': material('brass', '#d4a83a', 0.3, 0.85),
    'glass': material('glass-clear', '#cfe6ff', 0.05, alpha=0.25),
    'lacquer': material('lacquer', '#111111', 0.15),
    'ivory': material('ivory', '#f6f2e8', 0.3),
    'ebony': material('ebony', '#0b0b0b', 0.3),
    'felt': material('felt', '#6e1e24', 1.0),
    'ocean': material('globe', '#ffffff', 0.3, vcol=True),
    'chrome': material('chrome', '#b8c0c8', 0.2, 1.0),
    'lava-glass': material('lava-glass', '#ff3fa4', 0.1, emit='#ff2f8f', strength=1.2, alpha=0.75),
    'lava-blob': material('lava-blob', '#ffb03f', 0.4, emit='#ff7a1a', strength=3),
    'duck-gold': material('duck-gold', '#e8b931', 0.22, 1.0),
    'beak': material('beak', '#ff8a1f', 0.5),
    'eye': material('eye', '#111111', 0.2),
    'tv-case': material('tv-case', '#6b5a48', 0.5),
    'tv-panel': material('tv-panel', '#3a3d42', 0.6),
    'screen': material('screen', '#203040', 0.1, emit='#3a6a8a', strength=0.8),
    'velvet': material('velvet', '#7a1f2b', 0.9),
    'velvet-dark': material('velvet-dark', '#5e1720', 0.9),
    'button': material('button', '#3a0e14', 0.6),
    'teapot': material('teapot', '#e7f0ea', 0.25, vcol=True),
    'mahogany': material('mahogany', '#5a2a1a', 0.35),
    'bowl': material('bowl-glass', '#cfefff', 0.05, alpha=0.3),
    'water': material('water', '#3fa7ff', 0.1, alpha=0.45),
    'fish': material('fish', '#ff8a1f', 0.4, emit='#7a3000', strength=0.5),
    'gravel': material('gravel', '#c9b48a', 0.9),
    'door': material('door', '#5a2f1f', 0.45),
    'door-panel': material('door-panel', '#4a2617', 0.45),
}

props = {}


def prop(name, *objs):
    for o in objs:
        o['prop'] = name
    props.setdefault(name, []).extend(objs)


# ---------------------------------------------------------------- vase (collider: cyl r .17 h .63)
vase = lathe('vase', [(0.001, 0), (0.1, 0), (0.12, 0.02), (0.11, 0.05), (0.15, 0.12), (0.185, 0.22), (0.19, 0.3), (0.17, 0.4),
                      (0.11, 0.48), (0.075, 0.53), (0.075, 0.58), (0.1, 0.62), (0.095, 0.635), (0.07, 0.635), (0.065, 0.6)],
             [0, 0, 0], M['porcelain'], segs=40, cap_top=False)


def vase_color(p, f):
    y = p[1]
    if 0.25 < y < 0.33 or 0.6 < y or y < 0.04:
        return (0.18, 0.31, 0.64)
    if 0.12 < y < 0.24 and (math.sin(math.atan2(p[2], p[0]) * 6 + y * 30) > 0.55):
        return (0.25, 0.4, 0.75)  # little blue flourishes
    return (0.95, 0.96, 0.98)


set_vertex_color(vase, vase_color)
prop('vase', vase)

# ---------------------------------------------------------------- plates crate (box .6 .4 .45)
crate = box('crate', [0, 0.2, 0], [0.6, 0.4, 0.45], M['cardboard'], bevel=0.008)
crate['uv'] = 'unit'
tape = box('tape', [0, 0.401, 0], [0.62, 0.004, 0.08], M['tape'])
flap = box('flap', [0.0, 0.405, 0.12], [0.58, 0.004, 0.2], M['cardboard'], rot=(0.08, 0, 0))
flap['uv'] = 'unit'
prop('plates', crate, tape, flap)

# ---------------------------------------------------------------- portrait (box 1.0 1.3 .09)
frame_parts = []
for (x, y, w, h) in [(0, 1.25, 1.0, 0.1), (0, 0.05, 1.0, 0.1), (-0.45, 0.65, 0.1, 1.3), (0.45, 0.65, 0.1, 1.3)]:
    frame_parts.append(box('pframe', [x, y, 0], [w, h, 0.09], M['gold'], bevel=0.02))
for (x, y, w, h) in [(0, 1.18, 0.82, 0.03), (0, 0.12, 0.82, 0.03), (-0.395, 0.65, 0.03, 1.1), (0.395, 0.65, 0.03, 1.1)]:
    frame_parts.append(box('pframe-inner', [x, y, 0.03], [w, h, 0.03], M['gold'], bevel=0.008))
canvas = box('canvas', [0, 0.65, 0.0], [0.8, 1.1, 0.06], M['portrait'])
canvas['uv'] = 'unit'
prop('portrait', canvas, *frame_parts)

# ---------------------------------------------------------------- grandfather clock (box .6 2.1 .45)
c = []
c.append(box('clock-base', [0, 0.25, 0], [0.6, 0.5, 0.45], M['walnut'], bevel=0.02))
c.append(box('clock-trunk', [0, 1.05, 0], [0.48, 1.1, 0.36], M['walnut'], bevel=0.015))
c.append(box('clock-hood', [0, 1.8, 0], [0.58, 0.5, 0.43], M['walnut'], bevel=0.02))
c.append(box('clock-crown', [0, 2.07, 0], [0.6, 0.06, 0.45], M['walnut'], bevel=0.015))
c.append(lathe('clock-arch', [(0.2, 0), (0.18, 0.04), (0.001, 0.04)], [0, 2.1, 0], M['walnut'], segs=24, cap_top=False))
c.append(cylinder('clock-face', [0, 1.8, 0.215], 0.19, 0.01, M['clockface'], segs=32, rot=(math.pi / 2, 0, 0)))
c.append(cylinder('clock-bezel', [0, 1.8, 0.212], 0.205, 0.012, M['brass'], segs=32, rot=(math.pi / 2, 0, 0)))
for k in range(12):
    a = k * math.pi / 6
    c.append(box('tick', [math.sin(a) * 0.16, 1.8 + math.cos(a) * 0.16, 0.222], [0.012, 0.03, 0.004], M['ebony'], rot=(0, 0, -a)))
c.append(box('hand', [0.03, 1.84, 0.226], [0.012, 0.12, 0.004], M['ebony'], rot=(0, 0, -0.6)))
c.append(box('hand', [-0.04, 1.81, 0.227], [0.01, 0.09, 0.004], M['ebony'], rot=(0, 0, 1.9)))
c.append(box('clock-window', [0, 1.05, 0.182], [0.3, 0.85, 0.01], M['glass']))
c.append(cylinder('pendulum-rod', [0, 1.15, 0.12], 0.006, 0.6, M['brass'], segs=6))
c.append(cylinder('pendulum', [0, 0.82, 0.12], 0.07, 0.015, M['brass'], segs=24, rot=(math.pi / 2, 0, 0)))
for x in (-0.24, 0.24):
    c.append(sphere('finial', [x, 2.14, 0], 0.03, M['brass'], subdiv=2))
prop('clock', *c)

# ---------------------------------------------------------------- upright piano (box 1.5 1.25 .6 + keybed)
p = []
p.append(box('piano-body', [0, 0.72, -0.05], [1.42, 1.06, 0.5], M['lacquer'], bevel=0.02))
for x in (-0.73, 0.73):
    p.append(box('piano-cheek', [x, 0.62, 0.05], [0.04, 1.25, 0.7], M['lacquer'], bevel=0.015))
    p.append(box('piano-toe', [x, 0.04, 0.33], [0.06, 0.08, 0.15], M['lacquer'], bevel=0.01))
p.append(box('piano-top', [0, 1.26, -0.02], [1.5, 0.04, 0.6], M['lacquer'], bevel=0.015))
p.append(box('piano-bottom', [0, 0.18, -0.05], [1.42, 0.36, 0.5], M['lacquer'], bevel=0.015))
p.append(box('keybed', [0, 0.72, 0.38], [1.42, 0.06, 0.3], M['lacquer'], bevel=0.01))
n_white = 36
kw = 1.34 / n_white
for k in range(n_white):
    p.append(box('key', [-0.67 + kw * (k + 0.5), 0.77, 0.42], [kw * 0.92, 0.025, 0.2], M['ivory']))
    if k % 7 not in (2, 6) and k < n_white - 1:
        p.append(box('black-key', [-0.67 + kw * (k + 1), 0.795, 0.38], [kw * 0.55, 0.03, 0.12], M['ebony']))
p.append(box('fallboard', [0, 0.86, 0.26], [1.36, 0.12, 0.03], M['lacquer'], rot=(-0.2, 0, 0)))
p.append(box('music-desk', [0, 1.0, 0.22], [0.9, 0.22, 0.02], M['lacquer'], rot=(-0.25, 0, 0)))
for x in (-0.08, 0, 0.08):
    p.append(box('pedal', [x, 0.06, 0.24], [0.04, 0.015, 0.12], M['brass']))
p.append(box('felt', [0, 0.787, 0.31], [1.36, 0.01, 0.015], M['felt']))
prop('piano', *p)

# ---------------------------------------------------------------- crystal globe (ball r .22 at .32 + stand)
g = []
g.append(lathe('globe-stand', [(0.001, 0), (0.14, 0), (0.14, 0.02), (0.1, 0.04), (0.04, 0.07), (0.03, 0.1), (0.035, 0.11)],
               [0, 0, 0], M['brass'], segs=28))
globe = sphere('globe', [0, 0.32, 0], 0.2, M['ocean'], subdiv=4, rot=(0, 0, 0.41))


def land(pt, f):
    x, y, z = pt[0], pt[1] - 0.32, pt[2]
    n = math.sin(x * 22) * math.cos(z * 19) + math.sin(y * 25 + x * 9) * 0.8 + math.cos((x + z) * 13) * 0.5
    return (0.2, 0.55, 0.25) if n > 0.55 else (0.13, 0.35, 0.72)


set_vertex_color(globe, land)
g.append(globe)
bpy.ops.mesh.primitive_torus_add(major_radius=0.225, minor_radius=0.008, location=(0, 0, 0.32), rotation=(math.pi / 2, 0.41, 0))
ring = bpy.context.active_object
ring.data.materials.append(M['brass'])
g.append(ring)
prop('globe', *g)

# ---------------------------------------------------------------- lava lamp (cyl r .09 h .45)
lv = []
lv.append(lathe('lava-base', [(0.001, 0), (0.1, 0), (0.095, 0.03), (0.06, 0.12)], [0, 0, 0], M['chrome'], segs=24))
lv.append(lathe('lava-glass', [(0.06, 0.12), (0.075, 0.2), (0.07, 0.3), (0.04, 0.37)], [0, 0, 0], M['lava-glass'], segs=24,
                cap_bottom=False))
lv.append(lathe('lava-cap', [(0.04, 0.37), (0.035, 0.45), (0.001, 0.45)], [0, 0, 0], M['chrome'], segs=24, cap_bottom=False))
for (y, r) in [(0.16, 0.035), (0.24, 0.025), (0.3, 0.02)]:
    lv.append(sphere('blob', [rng.uniform(-0.015, 0.015), y, 0], r, M['lava-blob'], scale=(1, 1.3, 1), subdiv=2))
prop('lava', *lv)

# ---------------------------------------------------------------- golden duck (balls .28 @.3, .16 @ (0,.66,.16))
d = []
d.append(sphere('duck-body', [0, 0.29, -0.02], 0.28, M['duck-gold'], scale=(0.95, 0.85, 1.12), subdiv=4))
d.append(sphere('duck-tail', [0, 0.42, -0.3], 0.1, M['duck-gold'], scale=(0.7, 0.6, 1.2), subdiv=3, rot=(0.6, 0, 0)))
d.append(sphere('duck-head', [0, 0.66, 0.16], 0.16, M['duck-gold'], subdiv=4))
d.append(tube('duck-neck', [(0, 0.45, 0.08), (0, 0.55, 0.13), (0, 0.62, 0.15)], 0.1, M['duck-gold']))
d.append(sphere('beak', [0, 0.63, 0.33], 0.07, M['beak'], scale=(1.1, 0.45, 1.4), subdiv=3))
for x in (-0.09, 0.09):
    d.append(sphere('eye', [x, 0.7, 0.28], 0.022, M['eye'], subdiv=2))
    d.append(sphere('wing', [x * 2.6, 0.32, -0.05], 0.16, M['duck-gold'], scale=(0.35, 0.7, 1.2), subdiv=3, rot=(0.25, 0, 0)))
prop('duck', *d)

# ---------------------------------------------------------------- cursed CRT TV (box .6 .5 .5)
tv = []
tv.append(box('tv-case', [0, 0.25, -0.02], [0.6, 0.5, 0.46], M['tv-case'], bevel=0.04))
tv.append(box('tv-bezel', [0, 0.27, 0.215], [0.5, 0.4, 0.03], M['tv-panel'], bevel=0.02))
tv.append(sphere('tv-screen', [0, 0.27, 0.19], 0.36, M['screen'], scale=(0.6, 0.48, 0.15), subdiv=3))
tv.append(box('tv-knobs', [0.22, 0.27, 0.23], [0.08, 0.3, 0.02], M['tv-panel']))
for y in (0.34, 0.22):
    tv.append(cylinder('knob', [0.22, y, 0.25], 0.02, 0.02, M['chrome'], segs=12, rot=(math.pi / 2, 0, 0)))
for s in (-1, 1):
    tv.append(tube('antenna', [(0, 0.5, -0.05), (s * 0.12, 0.72, -0.05), (s * 0.22, 0.9, -0.05)], 0.006, M['chrome'], segs=6))
    tv.append(sphere('antenna-tip', [s * 0.22, 0.9, -0.05], 0.015, M['chrome'], subdiv=1))
prop('tv', *tv)

# ---------------------------------------------------------------- velvet armchair (seat .9x.45x.85, back, arms)
a = []
a.append(box('chair-seat', [0, 0.3, 0.03], [0.62, 0.16, 0.7], M['velvet'], bevel=0.05))
a.append(box('chair-base', [0, 0.16, 0], [0.9, 0.16, 0.85], M['velvet-dark'], bevel=0.03))
a.append(box('chair-back', [0, 0.75, -0.33], [0.84, 0.66, 0.2], M['velvet'], bevel=0.07))
for s in (-1, 1):
    a.append(box('chair-arm', [s * 0.375, 0.42, 0.0], [0.15, 0.3, 0.8], M['velvet-dark'], bevel=0.03))
    a.append(cylinder('chair-roll', [s * 0.375, 0.6, 0.0], 0.085, 0.82, M['velvet'], segs=16, rot=(math.pi / 2, 0, 0)))
for (x, y) in [(-0.2, 0.65), (0.2, 0.65), (0, 0.85), (-0.2, 0.95), (0.2, 0.95)]:
    a.append(sphere('tuft', [x, y, -0.225], 0.018, M['button'], subdiv=1))
for x in (-0.38, 0.38):
    for z in (-0.35, 0.35):
        a.append(lathe('chair-leg', [(0.02, 0), (0.03, 0.04), (0.035, 0.08)], [x, 0, z], M['mahogany'], segs=10))
prop('armchair', *a)

# ---------------------------------------------------------------- teapot (ball r .15)
tp = []
body = lathe('teapot-body', [(0.001, 0.0), (0.07, 0.0), (0.12, 0.04), (0.145, 0.11), (0.13, 0.19), (0.09, 0.235), (0.06, 0.245)],
             [0, 0, 0], M['teapot'], segs=32, cap_top=True)
set_vertex_color(body, lambda pt, f: (0.78, 0.34, 0.29) if 0.1 < pt[1] < 0.13 else (0.92, 0.95, 0.93))
tp.append(body)
tp.append(lathe('teapot-lid', [(0.065, 0.24), (0.06, 0.26), (0.03, 0.28), (0.001, 0.285)], [0, 0, 0], M['teapot'], segs=24,
                cap_bottom=False))
tp.append(sphere('lid-knob', [0, 0.3, 0], 0.022, M['teapot'], subdiv=2))
tp.append(tube('spout', [(0.12, 0.08, 0), (0.18, 0.12, 0), (0.21, 0.19, 0), (0.24, 0.23, 0)], lambda t: 0.035 - 0.018 * t, M['teapot']))
tp.append(tube('handle', [(-0.12, 0.19, 0), (-0.2, 0.2, 0), (-0.22, 0.13, 0), (-0.18, 0.07, 0), (-0.13, 0.06, 0)], 0.014, M['teapot']))
for o in tp[1:]:
    set_vertex_color(o, lambda pt, f: (0.92, 0.95, 0.93))
prop('teapot', *tp)

# ---------------------------------------------------------------- mahogany table (top 2x.08x1 at .76, legs)
tb = []
tb.append(box('table-top', [0, 0.76, 0], [2.0, 0.08, 1.0], M['mahogany'], bevel=0.02))
tb.append(box('table-apron', [0, 0.66, 0], [1.84, 0.12, 0.84], M['mahogany'], bevel=0.005))
leg = [(0.025, 0), (0.035, 0.04), (0.028, 0.1), (0.032, 0.3), (0.045, 0.4), (0.03, 0.5), (0.04, 0.6), (0.04, 0.72)]
for x in (-0.9, 0.9):
    for z in (-0.42, 0.42):
        tb.append(lathe('table-leg', leg, [x, 0, z], M['mahogany'], segs=14))
prop('table', *tb)

# ---------------------------------------------------------------- Gerald's fishbowl (ball r .2 at .2)
f = []
f.append(lathe('bowl', [(0.08, 0.0), (0.15, 0.03), (0.2, 0.14), (0.2, 0.24), (0.16, 0.34), (0.12, 0.38), (0.13, 0.39)], [0, 0, 0],
               M['bowl'], segs=36, cap_top=False))
f.append(lathe('water', [(0.075, 0.01), (0.145, 0.035), (0.19, 0.14), (0.19, 0.24), (0.165, 0.3), (0.001, 0.3)], [0, 0, 0],
               M['water'], segs=32, cap_top=False))
f.append(lathe('gravel', [(0.075, 0.012), (0.14, 0.04), (0.001, 0.06)], [0, 0, 0], M['gravel'], segs=24, cap_bottom=False))
f.append(sphere('fish', [0.03, 0.18, 0], 0.045, M['fish'], scale=(1.4, 0.8, 0.5), subdiv=2))
f.append(sphere('fish-tail', [-0.04, 0.18, 0], 0.03, M['fish'], scale=(0.6, 1.1, 0.2), subdiv=1))
prop('fishbowl', *f)

# ---------------------------------------------------------------- front door (1.9 x 2.34 x .08, centred)
dr = []
dr.append(box('door-slab', [0, 0, 0], [1.9, 2.34, 0.08], M['door'], bevel=0.008))
for s in (-1, 1):
    for (x, y, w, h) in [(-0.45, 0.45, 0.7, 1.0), (0.45, 0.45, 0.7, 1.0), (-0.45, -0.65, 0.7, 0.8), (0.45, -0.65, 0.7, 0.8)]:
        dr.append(box('door-panel', [x, y, s * 0.045], [w, h, 0.02], M['door-panel'], bevel=0.015))
    dr.append(sphere('door-knob', [0.78, -0.1, s * 0.07], 0.045, M['brass'], subdiv=2))
dr.append(box('door-knocker', [0, 0.55, 0.06], [0.14, 0.14, 0.02], M['brass'], bevel=0.01))
prop('door', *dr)

# ---------------------------------------------------------------- finalize: one object per prop
objs = [o for o in bpy.data.objects if o.type == 'MESH']
apply_all_modifiers(objs)
out = []
for name, parts in props.items():
    for o in parts:
        assign_uv0(o, o.get('uv', 'world'), 1.0)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    out.append(ob)
export_glb(os.path.join(OUT, 'props.glb'), out)
print('wrote public/models/props.glb', f"{os.path.getsize(os.path.join(OUT, 'props.glb')) / 1024:.0f} KB", [o.name for o in out])
