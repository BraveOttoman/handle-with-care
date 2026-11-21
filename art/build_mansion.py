"""Builds the detailed mansion, yard and truck from art/layout.json, bakes lightmaps
with Cycles, and writes public/models/mansion.glb plus lm_*.webp.

    python art/build_mansion.py            # full quality (several minutes on CPU)
    python art/build_mansion.py --quick    # fast, noisy preview bake

Lighting units match the game: a three.js point light of I candela is a Blender
point of 4*pi*I watts, a three.js directional light of intensity E is a Blender sun
of strength E, and the baked value is irradiance/pi, so the game uses
lightMapIntensity = pi * ENCODE_SCALE.
"""
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from common import (OUT, ROOT, apply_all_modifiers, assign_uv0, box, cylinder, export_glb, lathe, material,  # noqa: E402
                    reset_materials, reset_scene, rng, set_vertex_color, sphere, srgb_to_linear, to_b, tube)

QUICK = '--quick' in sys.argv
ENCODE_SCALE = 4.0  # lightmap stores value/4 so it has headroom near lamps
LM_SIZE = {'house': 2048, 'yard': 2048, 'truck': 1024} if not QUICK else {'house': 512, 'yard': 512, 'truck': 256}
FLICKER_SIZE = 1024 if not QUICK else 256
SAMPLES = 128 if not QUICK else 12

L = json.load(open(os.path.join(ROOT, 'art', 'layout.json')))
H, T, DOOR_H, BED_Y = L['H'], L['T'], L['DOOR_H'], L['BED_Y']

sc = reset_scene()
reset_materials()
sc.cycles.samples = SAMPLES
sc.cycles.max_bounces = 6
sc.cycles.diffuse_bounces = 4
sc.cycles.use_denoising = False
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- materials
ROOMS = L['roomColors']
M = {
    'floor': material('floor', '#8a5a3a', 0.55),
    'ceiling': material('ceiling', '#d9d0bd', 0.9),
    'grass': material('grass', '#34502e', 1.0),
    'path': material('path', '#6a665e', 0.9),
    'rug-red': material('rug-red', '#6e1e24', 1.0),
    'rug-blue': material('rug-blue', '#2c3d5c', 1.0),
    'rug-border': material('rug-border', '#b8913e', 1.0),
    'roof': material('roof', '#2a2230', 0.8),
    'siding': material('siding', '#3b2f2a', 0.85),
    'shelf': material('shelf', '#3d2617', 0.55),
    'brick': material('brick', '#6b3a2e', 0.95),
    'hedge': material('hedge', '#1f3a1f', 1.0),
    'truck-bed': material('truck-bed', '#a09080', 0.8),
    'truck-side': material('truck-side', '#f2efe6', 0.5),
    'truck-white': material('truck-white', '#f2efe6', 0.5),
    'truck-red': material('truck-red', '#d8392f', 0.35),
    'glass': material('glass', '#1d2a3a', 0.1, 0.5),
    'ramp': material('ramp', '#8a8f96', 0.4, 0.6),
    'column': material('column', '#e9dfc8', 0.7),
    'porch-roof': material('porch-roof', '#2a2230', 0.8),
    'trim': material('trim', '#e9dfc8', 0.6),
    'wainscot': material('wainscot', '#4a2c1c', 0.5),
    'beam': material('beam', '#2e1c12', 0.7),
    'frame': material('window-frame', '#2a1e18', 0.6),
    'moon-glass': material('window-moon', '#5a6f9e', 0.2, emit='#8fa8ff', strength=0.35),
    'warm-glass': material('window-warm', '#ffc77a', 0.2, emit='#ffb860', strength=1.1),
    'shutter': material('shutter', '#1f3328', 0.7),
    'books': material('books', '#ffffff', 0.7, vcol=True),
    'brass': material('brass', '#c9a24a', 0.35, 0.85),
    'firebox': material('firebox', '#141010', 1.0),
    'stone': material('stone', '#77736b', 0.9),
    'log': material('log', '#3a2414', 0.9),
    'ember': material('ember', '#ff6a1a', 0.6, emit='#ff5a10', strength=6),
    'marble': material('marble', '#e8e2d6', 0.35),
    'shade': material('lampshade', '#e8d6b0', 0.8),
    'candle': material('candle', '#f3ead8', 0.6),
    'flame': material('flame', '#ffd27a', 0.5, emit='#ffc860', strength=8),
    'tire': material('tire', '#151515', 0.9),
    'chrome': material('chrome', '#c8ccd0', 0.2, 1.0),
    'headlight': material('headlight', '#fff2cc', 0.2, emit='#fff2cc', strength=4),
    'taillight': material('taillight', '#ff2a1a', 0.3, emit='#ff2a1a', strength=2),
    'bark': material('bark', '#2a221c', 1.0),
}
for room, color in ROOMS.items():
    M['wall-' + room] = material('wall-' + room, color, 0.85)

GROUP_OF = {
    'grass': 'yard', 'path': 'yard', 'hedge': 'yard', 'roof': 'yard', 'siding': 'yard', 'column': 'yard', 'porch-roof': 'yard',
    'truck-bed': 'truck', 'truck-side': 'truck', 'truck-white': 'truck', 'truck-red': 'truck', 'glass': 'truck', 'ramp': 'truck',
}
UV_OF = {'floor': ('world', 2.4), 'wall': ('world', 2.0), 'grass': ('world', 3.0), 'path': ('world', 2.0),
         'truck-bed': ('world', 1.5), 'truck-side': ('unit', 1)}


def tagged(obj, group, uv='world', tile=1.0):
    obj['group'] = group
    obj['uv'] = uv
    obj['tile'] = tile
    return obj


def part(fn, name, *a, group='house', uv='world', tile=1.0, **kw):
    return tagged(fn(name, *a, **kw), group, uv, tile)


# ---------------------------------------------------------------- layout boxes
for i, b in enumerate(L['boxes']):
    key = b['mat']
    if key == 'hedge':
        continue  # replaced by bushes below
    if key == 'path':
        continue  # replaced by stepping stones
    if b.get('fireplace') or b.get('mantel') or b.get('sideboard') or b.get('desk') or b.get('deskLeg'):
        continue  # rebuilt in detail below
    if key == 'shelf':
        continue  # bookshelves rebuilt below
    mat_name = 'wall-' + b['wall']['room'] if key == 'wall' else key
    uvmode, tile = UV_OF.get(key, ('world', 1.0))
    cull = ()
    if key in ('floor', 'grass'):
        cull = ('bottom',)
    if key == 'ceiling':
        cull = ('top',)
    if key == 'wall' and b['s'][1] > 2:
        cull = ('top', 'bottom')
    bevel = {'truck-red': 0.12, 'column': 0.02, 'roof': 0.03, 'truck-white': 0.015, 'truck-side': 0.015}.get(key, 0)
    rot = (b.get('rotX', 0), 0, 0) if b.get('rotX') else None
    part(box, f'{key}-{i}', b['p'], b['s'], M[mat_name], rot=rot, bevel=bevel, cull=cull,
         group=GROUP_OF.get(key, 'house'), uv=uvmode, tile=tile)

# ---------------------------------------------------------------- trim: baseboards, wainscot, crown
PANELED = {'living', 'dining', 'foyer'}
for w in L['walls']:
    segs = []
    cur = w['from']
    for a, b in w['gaps']:
        if a > cur:
            segs.append((cur, a))
        cur = b
    if cur < w['to']:
        segs.append((cur, w['to']))
    for side, room in zip((-1, 1), w['rooms']):
        if room == 'outdoors':
            continue
        face = w['at'] + side * T / 2

        def run(a, b, y0, y1, depth, mat, name):
            mid, length = (a + b) / 2, b - a
            c = face + side * depth / 2
            if w['axis'] == 'x':
                part(box, name, [mid, (y0 + y1) / 2, c], [length, y1 - y0, depth], mat)
            else:
                part(box, name, [c, (y0 + y1) / 2, mid], [depth, y1 - y0, length], mat)

        for a, b in segs:
            run(a, b, 0, 0.14, 0.025, M['trim'], 'baseboard')
            if room in PANELED:
                run(a, b, 0.14, 0.92, 0.012, M['wainscot'], 'wainscot')
                run(a, b, 0.92, 0.97, 0.03, M['trim'], 'chair-rail')
        run(w['from'], w['to'], H - 0.1, H, 0.03, M['trim'], 'crown')
        run(w['from'], w['to'], H - 0.16, H - 0.1, 0.015, M['trim'], 'crown2')

# door casings and reveals
for d in L['doorways']:
    a, b, at = d['a'], d['b'], d['at']
    for side in (-1, 1):
        face = at + side * (T / 2 + 0.015)
        pieces = [((a - 0.05), DOOR_H / 2 + 0.05, 0.1, DOOR_H + 0.1), ((b + 0.05), DOOR_H / 2 + 0.05, 0.1, DOOR_H + 0.1),
                  ((a + b) / 2, DOOR_H + 0.06, b - a + 0.2, 0.12)]
        for (m, y, ln, hgt) in pieces:
            if d['axis'] == 'x':
                part(box, 'casing', [m, y, face], [ln, hgt, 0.03], M['trim'])
            else:
                part(box, 'casing', [face, y, m], [0.03, hgt, ln], M['trim'])
    # reveal boards inside the opening
    for m in (a + 0.01, b - 0.01):
        if d['axis'] == 'x':
            part(box, 'reveal', [m, DOOR_H / 2, at], [0.02, DOOR_H, T + 0.01], M['trim'])
        else:
            part(box, 'reveal', [at, DOOR_H / 2, m], [T + 0.01, DOOR_H, 0.02], M['trim'])
    if d['axis'] == 'x':
        part(box, 'reveal', [(a + b) / 2, DOOR_H - 0.01, at], [b - a, 0.02, T + 0.01], M['trim'])
    else:
        part(box, 'reveal', [at, DOOR_H - 0.01, (a + b) / 2], [T + 0.01, 0.02, b - a], M['trim'])

# ceiling beams
for z in (-10, -7.5, -5, -2.5, 2, 4.5, 7):
    part(box, 'beam', [0, H - 0.08, z], [23.8, 0.16, 0.18], M['beam'], bevel=0.01)


# ---------------------------------------------------------------- windows
def window(axis, at, pos, side, glass, group='house', sill=0.95, w=1.1, h=1.5, shutters=False):
    """Decorative window on the wall face at `at` (+side * T/2), centred at `pos` along the wall."""
    face = at + side * (T / 2 + 0.002)

    def put(name, along, y, ln, hgt, depth, mat, out=0.0, grp=group):
        c = face + side * (depth / 2 + out)
        if axis == 'x':
            part(box, name, [pos + along, y, c], [ln, hgt, depth], mat, group=grp)
        else:
            part(box, name, [c, y, pos + along], [depth, hgt, ln], mat, group=grp)

    yc = sill + h / 2
    put('glass', 0, yc, w, h, 0.01, M[glass], grp='live')
    for along, y, ln, hgt in [(0, sill + h, w + 0.14, 0.07), (0, sill, w + 0.14, 0.07), (-w / 2, yc, 0.07, h), (w / 2, yc, 0.07, h),
                              (0, yc, 0.04, h), (0, yc, w, 0.04)]:
        put('frame', along, y, ln, hgt, 0.05, M['frame'])
    put('sill', 0, sill - 0.05, w + 0.3, 0.05, 0.1, M['trim'])
    if shutters:
        for s in (-1, 1):
            put('shutter', s * (w / 2 + 0.3), yc, 0.45, h + 0.05, 0.03, M['shutter'])


for x in (-9.5, -3, 3, 9.5):
    window('x', -12, x, 1, 'moon-glass')
for z in (-9, -3):
    window('z', -12, z, 1, 'moon-glass')
for z in (-9, -3, 5):
    window('z', 12, z, -1, 'moon-glass')
for x in (-9, -3.5, 4, 8.5):
    window('x', 8, x, -1, 'moon-glass')
    window('x', 8, x, 1, 'warm-glass', group='yard', shutters=True)

# ---------------------------------------------------------------- study: bookshelves, desk
for (x, z) in L['shelves']:
    x0, x1 = x - 0.2, x + 0.2
    part(box, 'shelf-side', [x, 1.3, z - 0.78], [0.4, 2.6, 0.04], M['shelf'])
    part(box, 'shelf-side', [x, 1.3, z + 0.78], [0.4, 2.6, 0.04], M['shelf'])
    part(box, 'shelf-back', [x0 + 0.01, 1.3, z], [0.02, 2.6, 1.56], M['shelf'])
    part(box, 'shelf-top', [x, 2.62, z], [0.44, 0.05, 1.66], M['shelf'], bevel=0.01)
    part(box, 'shelf-kick', [x, 0.05, z], [0.4, 0.1, 1.56], M['shelf'])
    for k, y in enumerate((0.1, 0.72, 1.34, 1.96)):
        part(box, 'shelf-board', [x, y, z], [0.38, 0.03, 1.56], M['shelf'])
        cz = z - 0.74
        while cz < z + 0.72:
            bw = rng.uniform(0.03, 0.07)
            bh = rng.uniform(0.2, 0.3)
            if rng.random() < 0.08:  # a gap where someone took a book
                cz += bw * 2
                continue
            lean = rng.uniform(-0.15, 0.15) if rng.random() < 0.15 else 0
            book = part(box, 'book', [x - 0.02, y + 0.015 + bh / 2, cz + bw / 2], [rng.uniform(0.2, 0.26), bh, bw * 0.95],
                        M['books'], rot=(lean, 0, 0))
            hue = rng.random()
            col = __import__('colorsys').hls_to_rgb(hue, rng.uniform(0.18, 0.4), rng.uniform(0.3, 0.6))
            book['bookcolor'] = col
            cz += bw

# desk: top, drawers, turned legs
part(box, 'desk-top', [-8.5, 0.75, 1.2], [2.2, 0.08, 1.0], M['shelf'], bevel=0.015)
part(box, 'desk-apron', [-8.5, 0.63, 1.2], [1.9, 0.16, 0.85], M['shelf'])
for x in (-9.0, -8.0):
    part(box, 'drawer', [x, 0.63, 1.63], [0.7, 0.12, 0.02], M['shelf'])
    part(sphere, 'knob', [x, 0.63, 1.65], 0.02, M['brass'], subdiv=1)
leg = [(0.03, 0), (0.035, 0.05), (0.025, 0.12), (0.03, 0.4), (0.04, 0.5), (0.04, 0.55), (0.045, 0.71)]
for (x, z) in [(-9.5, 0.8), (-7.5, 0.8), (-9.5, 1.6), (-7.5, 1.6)]:
    part(lathe, 'desk-leg', leg, [x, 0, z], M['shelf'], segs=12)

# ---------------------------------------------------------------- foyer pedestal
ped = L['pedestal']
px, _, pz = ped['p']
part(lathe, 'pedestal', [(0.3, 0), (0.3, 0.06), (0.26, 0.09), (0.24, 0.12), (0.17, 0.18), (0.15, 0.3), (0.16, 0.55), (0.15, 0.8),
                         (0.17, 0.86), (0.24, 0.9), (0.27, 0.94), (0.27, 1.0)], [px, 0, pz], M['marble'], segs=28)

# ---------------------------------------------------------------- living: fireplace
part(box, 'fp-pier', [-6.95, 0.7, -11.6], [0.7, 1.4, 0.6], M['brick'], bevel=0.01)
part(box, 'fp-pier', [-5.05, 0.7, -11.6], [0.7, 1.4, 0.6], M['brick'], bevel=0.01)
part(box, 'fp-lintel', [-6, 1.15, -11.6], [1.2, 0.5, 0.6], M['brick'], bevel=0.01)
part(box, 'fp-back', [-6, 0.5, -11.82], [1.2, 1.0, 0.16], M['firebox'])
part(box, 'fp-floor', [-6, 0.05, -11.6], [1.2, 0.1, 0.5], M['firebox'])
part(box, 'hearth', [-6, 0.025, -11.05], [3.0, 0.05, 0.5], M['stone'], bevel=0.01)
part(box, 'mantel', [-6, 1.45, -11.55], [3.0, 0.1, 0.75], M['shelf'], bevel=0.02)
for x in (-7.2, -4.8):
    part(box, 'corbel', [x, 1.3, -11.25], [0.12, 0.2, 0.12], M['shelf'])
for k, (dx, a) in enumerate([(-0.15, 0.3), (0.12, -0.25), (0, 0)]):
    part(cylinder, 'log', [-6 + dx, 0.16 + (0.08 if k == 2 else 0), -11.6], 0.07, 0.8, M['log'], segs=10, rot=(0, a, math.pi / 2))
part(box, 'embers', [-6, 0.11, -11.6], [0.7, 0.02, 0.3], M['ember'], group='live')
part(box, 'chimney', [-6, H + 2.6, -10.6], [1.0, 3.2, 0.9], M['brick'], group='yard')

# ---------------------------------------------------------------- dining: sideboard
part(box, 'sideboard', [6, 0.42, -11.6], [2.9, 0.74, 0.48], M['shelf'], bevel=0.01)
part(box, 'sideboard-top', [6, 0.87, -11.58], [3.05, 0.06, 0.56], M['shelf'], bevel=0.015)
for x in (4.95, 6, 7.05):
    part(box, 'sb-door', [x, 0.45, -11.35], [0.9, 0.55, 0.02], M['wainscot'])
    part(sphere, 'knob', [x + 0.32, 0.45, -11.33], 0.02, M['brass'], subdiv=1)
for x in (4.65, 7.35):
    part(box, 'sb-foot', [x, 0.025, -11.6], [0.1, 0.05, 0.4], M['shelf'])

# ---------------------------------------------------------------- rugs
for b in L['boxes']:
    if b['mat'] in ('rug-red', 'rug-blue'):
        (x, y, z), (w, h, d) = b['p'], b['s']
        part(box, 'rug-border', [x, 0.004, z], [w, 0.006, d], M['rug-border'], cull=('bottom',))
        part(box, 'rug', [x, 0.008, z], [w - 0.3, 0.006, d - 0.3], M[b['mat']], cull=('bottom',))
        for k in range(int(w / 0.08)):
            fx = x - w / 2 + 0.04 + k * 0.08
            for s in (-1, 1):
                part(box, 'fringe', [fx, 0.004, z + s * (d / 2 + 0.04)], [0.02, 0.006, 0.08], M['candle'], cull=('bottom',))

# ---------------------------------------------------------------- yard: hedges, stepping stones, trees
for b in L['boxes']:
    if b['mat'] != 'hedge':
        continue
    (x, y, z), (w, h, d) = b['p'], b['s']
    long_x = w > d
    length = w if long_x else d
    n = max(2, int(length / 0.75))
    for k in range(n):
        t = -length / 2 + (k + 0.5) * length / n
        r = rng.uniform(0.75, 0.95)
        c = [x + t, 0.95 + rng.uniform(-0.1, 0.1), z] if long_x else [x, 0.95 + rng.uniform(-0.1, 0.1), z + t]
        bush = part(sphere, 'bush', c, r, M['hedge'], scale=(1.1 if long_x else 0.8, 1.15, 0.8 if long_x else 1.1), subdiv=2, group='yard')
        disp = bush.modifiers.new('lumps', 'DISPLACE')
        tex = bpy.data.textures.new('lumps', 'CLOUDS')
        tex.noise_scale = 0.35
        disp.texture = tex
        disp.strength = 0.25
for k in range(6):
    part(box, 'stone', [rng.uniform(-0.15, 0.15), 0.01, 8.6 + k * 0.6], [rng.uniform(0.75, 0.95), 0.03, 0.45], M['path'],
         bevel=0.02, cull=('bottom',), group='yard', uv='world', tile=2.0)


def tree(x, z, height):
    trunk = [(x, 0, z)]
    for i in range(1, 6):
        trunk.append((x + rng.uniform(-0.25, 0.25), height * i / 5, z + rng.uniform(-0.25, 0.25)))
    part(tube, 'trunk', trunk, lambda t: 0.28 * (1 - t) + 0.05, M['bark'], group='live')
    for i in range(7):
        base = trunk[rng.randint(2, 4)]
        a = rng.uniform(0, 2 * math.pi)
        ln = rng.uniform(1.2, 2.4)
        pts = [base]
        for j in range(1, 4):
            f = j / 3
            pts.append((base[0] + math.cos(a) * ln * f, base[1] + ln * f * 0.6 + rng.uniform(-0.1, 0.2), base[2] + math.sin(a) * ln * f))
        part(tube, 'branch', pts, lambda t: 0.08 * (1 - t) + 0.015, M['bark'], segs=6, group='live')


for (x, z, hh) in [(-17, 12, 6), (17.5, 15, 7), (-18, 23, 5.5), (18, 24, 6.5), (-8, 31, 7), (9, 32, 6)]:
    tree(x, z, hh)

# ---------------------------------------------------------------- truck details
for (x, y, z) in L['wheels']:
    part(lathe, 'tire', [(0.25, -0.17), (0.4, -0.17), (0.45, -0.12), (0.45, 0.12), (0.4, 0.17), (0.25, 0.17)], [x, y, z], M['tire'],
         segs=24, rot=(0, 0, math.pi / 2), group='truck', cap_top=True, cap_bottom=True)
    part(cylinder, 'hub', [x + (0.17 if x > 0 else -0.17), y, z], 0.24, 0.02, M['chrome'], segs=16, rot=(0, 0, math.pi / 2), group='truck')
for x in (-1.0, 1.0):
    part(cylinder, 'headlight', [x, 1.05, 23.62], 0.14, 0.04, M['headlight'], segs=16, rot=(math.pi / 2, 0, 0), group='live')
    part(box, 'taillight', [x * 1.4, BED_Y + 0.35, 14.98], [0.18, 0.12, 0.03], M['taillight'], group='live')
    part(box, 'mirror', [x * 1.62, 2.1, 23.1], [0.1, 0.3, 0.2], M['tire'], group='truck')
part(box, 'bumper', [0, 0.55, 23.68], [2.9, 0.2, 0.15], M['chrome'], bevel=0.03, group='truck')
part(box, 'bumper-rear', [0, BED_Y - 0.25, 14.92], [2.9, 0.15, 0.12], M['chrome'], bevel=0.02, group='truck')
part(box, 'grille', [0, 1.05, 23.62], [1.4, 0.35, 0.04], M['tire'], group='truck')
for s in (-1, 1):
    part(box, 'side-window', [s * 1.46, 2.0, 22.6], [0.03, 0.7, 1.3], M['glass'], group='truck')
for k in range(9):
    part(box, 'grip', [0, 0, 0], [2.3, 0.02, 0.04], M['chrome'], group='truck')
grips = [o for o in bpy.data.objects if o.name.startswith('grip')]
ramp_angle = math.atan2(BED_Y, 3)
for k, g in enumerate(grips):
    t = (k + 0.5) / len(grips)
    zz, yy = 12 + 3 * t, BED_Y * t + 0.01
    for v in g.data.vertices:
        v.co = v.co + to_b(0, yy, zz)


# ---------------------------------------------------------------- light fixtures (not baked; lit live in game)
def fixture(lamp):
    x, y, z = lamp['p']
    kind = lamp['fixture']
    if kind == 'pendant':
        part(cylinder, 'cord', [x, (y + 0.15 + H) / 2, z], 0.008, H - y - 0.15, M['tire'], segs=6, group='live')
        part(lathe, 'shade', [(0.24, -0.08), (0.2, 0.02), (0.1, 0.14), (0.04, 0.16)], [x, y, z], M['shade'], segs=24,
             cap_bottom=False, group='live')
    elif kind == 'chandelier':
        part(cylinder, 'stem', [x, (y + H) / 2, z], 0.015, H - y, M['brass'], segs=8, group='live')
        bpy.ops.mesh.primitive_torus_add(major_radius=0.38, minor_radius=0.02, location=to_b(x, y - 0.12, z))
        tagged(bpy.context.active_object, 'live').data.materials.append(M['brass'])
        bpy.context.active_object.name = 'chandelier-ring'
        for k in range(8):
            a = 2 * math.pi * k / 8
            cx, cz = x + math.cos(a) * 0.38, z + math.sin(a) * 0.38
            part(tube, 'arm', [(x, y - 0.02, z), ((x + cx) / 2, y - 0.2, (z + cz) / 2), (cx, y - 0.12, cz)], 0.01, M['brass'], segs=6,
                 group='live')
            part(cylinder, 'candle', [cx, y - 0.04, cz], 0.02, 0.14, M['candle'], segs=8, group='live')
            part(sphere, 'flame', [cx, y + 0.05, cz], 0.018, M['flame'], scale=(1, 1.6, 1), subdiv=1, group='live')
    elif kind == 'sconce':
        part(box, 'sconce-arm', [x, y + 0.1, z - 0.15], [0.05, 0.05, 0.3], M['tire'], group='live')
        part(box, 'lantern', [x, y, z], [0.18, 0.28, 0.18], M['warm-glass'], group='live')
        part(box, 'lantern-cap', [x, y + 0.16, z], [0.24, 0.05, 0.24], M['tire'], group='live')
    elif kind == 'truck':
        part(cylinder, 'truck-lamp', [x, BED_Y + 2.47, z], 0.18, 0.06, M['candle'], segs=16, group='live')


for lamp in L['lamps']:
    fixture(lamp)

# ---------------------------------------------------------------- lights for the bake
lights = []
for lamp in L['lamps']:
    ld = bpy.data.lights.new('lamp', 'POINT')
    ld.energy = 4 * math.pi * lamp['intensity']
    ld.color = srgb_to_linear(lamp['color'])
    ld.shadow_soft_size = 0.12
    lo = bpy.data.objects.new('lamp', ld)
    lo.location = to_b(*lamp['p'])
    sc.collection.objects.link(lo)
    lights.append((lo, lamp))

moon = L['moon']
sd = bpy.data.lights.new('moon', 'SUN')
sd.energy = moon['intensity']
sd.color = srgb_to_linear(moon['color'])
sd.angle = math.radians(1.5)
so = bpy.data.objects.new('moon', sd)
d = to_b(*[t - p for t, p in zip(moon['target'], moon['dir'])])
so.rotation_euler = (-d).to_track_quat('Z', 'Y').to_euler()
sc.collection.objects.link(so)

world = bpy.data.worlds.new('night')
sc.world = world
bg = world.node_tree.nodes.get('Background')
sky = srgb_to_linear(L['sky']['top'])
k = L['sky']['intensity'] / math.pi
bg.inputs['Color'].default_value = (sky[0] * k, sky[1] * k, sky[2] * k, 1)
bg.inputs['Strength'].default_value = 1.0

# fixtures and glass shouldn't block the bake's light
for o in bpy.data.objects:
    if o.type == 'MESH' and o.get('group') == 'live':
        o.visible_shadow = False

# ---------------------------------------------------------------- finalize meshes
t0 = time.time()
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
apply_all_modifiers(meshes)
for o in meshes:
    if o.get('bookcolor'):
        c = tuple(o['bookcolor'])
        set_vertex_color(o, lambda _p, _f, c=c: c)
    assign_uv0(o, o.get('uv', 'world'), o.get('tile', 1.0))

groups = {}
for o in meshes:
    groups.setdefault(o.get('group', 'house'), []).append(o)

joined = {}
for name, objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    ob['group'] = name
    joined[name] = ob
print('joined groups', {k: len(v.data.polygons) for k, v in joined.items()}, round(time.time() - t0, 1), 's')


def lightmap_uvs(ob):
    me = ob.data
    lm = me.uv_layers.new(name='Lightmap')
    me.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True,
                             scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    me.uv_layers['UVMap'].active_render = True


def bake_into(ob, size, name):
    img = bpy.data.images.new(name, size, size, float_buffer=True)
    for slot in ob.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.get('bake-target') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'bake-target'
        node.image = img
        nt.nodes.active = node
    ob.data.uv_layers.active = ob.data.uv_layers['Lightmap']
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    t = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=8, margin_type='EXTEND', use_clear=True)
    print(f'baked {name} {size}px in {time.time() - t:.0f}s')
    return img


def save_lightmap(img, path):
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]  # Blender rows are bottom-up
    if not QUICK:
        # light denoise: 3x3 box blur. Islands keep 8px of extended margin, so this doesn't bleed across them.
        pad = np.pad(px, ((1, 1), (1, 1), (0, 0)), mode='edge')
        px = sum(pad[dy:dy + h, dx:dx + w] for dy in range(3) for dx in range(3)) / 9
    x = np.clip(px / ENCODE_SCALE, 0, 1)
    srgb = np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)
    Image.fromarray((srgb * 255 + 0.5).astype(np.uint8), 'RGB').save(path, 'WEBP', quality=90, method=6)
    print('wrote', os.path.relpath(path, ROOT), f'{os.path.getsize(path) / 1024:.0f} KB')


for name in ('house', 'yard', 'truck'):
    ob = joined[name]
    lightmap_uvs(ob)
    ob['lightmap'] = f'lm_{name}.webp'
    save_lightmap(bake_into(ob, LM_SIZE[name], f'lm_{name}'), os.path.join(OUT, f'lm_{name}.webp'))

# flicker map: only the dining room's unwell lamp, so the game can make it stutter
for lo, lamp in lights:
    lo.hide_render = lamp['bake'] != 'flicker'
so.hide_render = True
bg.inputs['Strength'].default_value = 0
saved = {}
for m in bpy.data.materials:
    b = m.node_tree.nodes.get('Principled BSDF')
    if b and b.inputs['Emission Strength'].default_value > 0:
        saved[m.name] = b.inputs['Emission Strength'].default_value
        b.inputs['Emission Strength'].default_value = 0
sc.cycles.samples = max(8, SAMPLES // 2)
joined['house']['lightmapFlicker'] = 'lm_house_flicker.webp'
save_lightmap(bake_into(joined['house'], FLICKER_SIZE, 'lm_house_flicker'), os.path.join(OUT, 'lm_house_flicker.webp'))
for name, v in saved.items():
    bpy.data.materials[name].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = v

# strip bake nodes so the exporter doesn't try to embed them, then export
for m in bpy.data.materials:
    n = m.node_tree.nodes.get('bake-target')
    if n:
        m.node_tree.nodes.remove(n)
for ob in joined.values():
    ob.data.uv_layers.active = ob.data.uv_layers['UVMap']
export_glb(os.path.join(OUT, 'mansion.glb'), list(joined.values()))
print('wrote public/models/mansion.glb', f"{os.path.getsize(os.path.join(OUT, 'mansion.glb')) / 1024:.0f} KB")
