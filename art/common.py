"""Shared Blender helpers for the Handle With Care art scripts.

All positions in these scripts are written in the game's coordinates
(three.js: X right, Y up, Z toward the viewer) and converted to Blender's
Z-up space here, so numbers can be copied straight from src/layout.js.
The glTF exporter converts back to Y-up on export.
"""
import math
import os
import random

import addon_utils
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable('cycles', default_set=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    return sc


def to_b(x, y, z):
    """three.js (Y-up) -> Blender (Z-up)."""
    return Vector((x, -z, y))


def srgb_to_linear(h):
    h = h.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


_materials = {}


def material(name, color='#ffffff', rough=0.8, metal=0.0, emit=None, strength=0.0, alpha=1.0, vcol=False):
    """Get or create a Principled material. Names matter: the game remaps some by name."""
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*srgb_to_linear(color), 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*srgb_to_linear(emit), 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
    if vcol:
        node = nt.nodes.new('ShaderNodeVertexColor')
        node.layer_name = 'Col'
        nt.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
    m['emit_strength'] = strength
    _materials[name] = m
    return m


def reset_materials():
    _materials.clear()


def finish_object(name, bm, mat, tags=None, collection=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(obj)
    if mat is not None:
        obj.data.materials.append(mat if isinstance(mat, bpy.types.Material) else material(mat))
    for k, v in (tags or {}).items():
        obj[k] = v
    return obj


def _xf(local, center, rot):
    """Rotate a three-space local vector by Euler(rot, 'XYZ') and offset by center, return Blender coords."""
    v = Vector(local)
    if rot:
        v = Euler(rot, 'XYZ').to_matrix() @ v
    return to_b(center[0] + v.x, center[1] + v.y, center[2] + v.z)


def box(name, p, s, mat, rot=None, bevel=0.0, cull=(), **tags):
    """Axis box in game coords. cull: any of 'top','bottom','left','right','front','back' faces to drop."""
    bm = bmesh.new()
    hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
    corners = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
               (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    vs = [bm.verts.new(_xf(c, p, rot)) for c in corners]
    faces = {
        'back': (0, 3, 2, 1), 'front': (4, 5, 6, 7), 'bottom': (0, 1, 5, 4),
        'top': (3, 7, 6, 2), 'left': (0, 4, 7, 3), 'right': (1, 2, 6, 5),
    }
    for key, idx in faces.items():
        if key not in cull:
            bm.faces.new([vs[i] for i in idx])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = finish_object(name, bm, mat, tags)
    if bevel > 0:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.harden_normals = False
    return obj


def lathe(name, profile, p, mat, segs=24, rot=None, cap_top=True, cap_bottom=True, smooth=True, **tags):
    """Revolve [(radius, y), ...] around the local Y axis."""
    bm = bmesh.new()
    rings = []
    for r, y in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new(_xf((math.cos(a) * r, y, math.sin(a) * r), p, rot)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            try:
                bm.faces.new((a[i], a[j], b[j], b[i]))
            except ValueError:
                pass
    if cap_bottom and profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and profile[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = smooth
    return finish_object(name, bm, mat, tags)


def cylinder(name, p, r, h, mat, segs=20, rot=None, **tags):
    return lathe(name, [(r, -h / 2), (r, h / 2)], p, mat, segs=segs, rot=rot, smooth=False, **tags)


def sphere(name, p, r, mat, scale=(1, 1, 1), subdiv=3, rot=None, **tags):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1)
    for v in bm.verts:
        local = (v.co.x * r * scale[0], v.co.z * r * scale[1], -v.co.y * r * scale[2])
        v.co = _xf(local, p, rot)
    for f in bm.faces:
        f.smooth = True
    return finish_object(name, bm, mat, tags)


def tube(name, points, r, mat, segs=10, **tags):
    """A round tube through game-space points (handles, spouts, cords, branches)."""
    bm = bmesh.new()
    pts = [Vector(to_b(*pt)) for pt in points]
    rings = []
    for i, c in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        a = d.cross(up).normalized()
        b = d.cross(a).normalized()
        rr = r(i / max(1, len(pts) - 1)) if callable(r) else r
        rings.append([bm.verts.new(c + (a * math.cos(t) + b * math.sin(t)) * rr)
                      for t in (2 * math.pi * k / segs for k in range(segs))])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(segs):
            j = (k + 1) % segs
            bm.faces.new((ra[k], ra[j], rb[j], rb[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    return finish_object(name, bm, mat, tags)


def apply_all_modifiers(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target='MESH')


def set_vertex_color(obj, color_fn):
    """color_fn(face_center_game_coords) -> (r, g, b) in sRGB 0..1."""
    me = obj.data
    attr = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for poly in me.polygons:
        c = poly.center
        rgb = color_fn((c.x, c.z, -c.y), poly)
        for li in poly.loop_indices:
            attr.data[li].color_srgb = (*rgb, 1)


def game_bounds(obj):
    xs, ys, zs = [], [], []
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        xs.append(w.x); ys.append(w.z); zs.append(-w.y)
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def assign_uv0(obj, mode='world', tile=1.0):
    """UVMap: 'world' = planar per face in meters/tile (for tiling textures),
    'unit' = each face side fills 0..1 (for labels like the truck side), 'keep' = leave."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    if mode == 'keep':
        return
    if mode == 'unit':
        (x0, x1), (y0, y1), (z0, z1) = game_bounds(obj)
        dx, dy, dz = max(x1 - x0, 1e-6), max(y1 - y0, 1e-6), max(z1 - z0, 1e-6)
    mw = obj.matrix_world
    nm = mw.to_3x3()
    for poly in me.polygons:
        n = nm @ poly.normal
        nx, ny, nz = n.x, n.z, -n.y  # to game space
        ax = max((abs(nx), 'x'), (abs(ny), 'y'), (abs(nz), 'z'))[1]
        for li in poly.loop_indices:
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            x, y, z = w.x, w.z, -w.y
            if mode == 'world':
                u, v = {'y': (x, -z), 'x': (z if nx < 0 else -z, y), 'z': (x if nz > 0 else -x, y)}[ax]
                uv.data[li].uv = (u / tile, v / tile)
            else:
                if ax == 'x':
                    u = (z - z0) / dz if nx < 0 else (z1 - z) / dz
                    v = (y - y0) / dy
                elif ax == 'z':
                    u = (x - x0) / dx if nz > 0 else (x1 - x) / dx
                    v = (y - y0) / dy
                else:
                    u, v = (x - x0) / dx, (z1 - z) / dz
                uv.data[li].uv = (u, v)


def export_glb(path, objects):
    for o in objects:
        ca = o.data.color_attributes
        for a in [a for a in ca if a.name != 'Col']:
            ca.remove(a)
        if 'Col' in ca:
            ca.active_color = ca['Col']
            ca.render_color_index = ca.active_color_index
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_image_format='NONE',
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


rng = random.Random(1234)
