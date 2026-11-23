# Meteor Runner - Blender asset generator
# Run: blender -b --factory-startup -noaudio --python assets/scripts/make_assets.py
#
# Coordinate convention (Blender): forward = -Y, up = +Z, width = X.
# The glTF exporter maps Blender -Y -> glTF -Z, so in Three.js the models
# face -Z with Y up, origin at ground center, exactly as docs/GAME_DESIGN.md
# section 5 requires.
import bpy
import bmesh
import math
import os
import random
from mathutils import Vector

ROOT = os.path.expanduser("~/workspace/meteor-runner")
GLB_DIR = os.path.join(ROOT, "public", "models")
BLEND_DIR = os.path.join(ROOT, "assets", "source")
PREVIEW = os.path.join(ROOT, "assets", "preview.png")
for d in (GLB_DIR, BLEND_DIR):
    os.makedirs(d, exist_ok=True)

# ---------------------------------------------------------------- materials
def srgb(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hex_lin(h):
    h = h.lstrip('#')
    return tuple(srgb(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))

def mat(name, color, roughness=0.6, metallic=0.0, emission=None, e_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_lin(color), 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*hex_lin(emission), 1.0)
        bsdf.inputs["Emission Strength"].default_value = e_strength
    return m

CREAM   = mat("Cream",   "#f5ead9", roughness=0.35)
CREAM_D = mat("CreamDk", "#d9cbb2", roughness=0.5)
TEAL_G  = mat("TealGlass", "#0e5f66", roughness=0.12, metallic=0.1,
              emission="#2ec4b6", e_strength=0.55)
TEAL_E  = mat("TealGlow", "#2ec4b6", roughness=0.4,
              emission="#2ec4b6", e_strength=2.6)
TEAL_DK = mat("TealDark", "#14524e", roughness=0.5, metallic=0.2)
ORANGE_E = mat("OrangeGlow", "#ff8c42", roughness=0.4,
               emission="#ff8c42", e_strength=2.8)
ORANGE_S = mat("OrangeSolid", "#e56f26", roughness=0.45)
INDIGO  = mat("Indigo",  "#232a52", roughness=0.7, metallic=0.25)
DECK_M  = mat("Deck",    "#1b2145", roughness=0.85, metallic=0.15)
DARK    = mat("DarkMetal", "#2b2f3d", roughness=0.45, metallic=0.6)
ROCK    = mat("Rock",    "#4a4460", roughness=0.95)
ROCK2   = mat("Rock2",   "#3a3654", roughness=0.95)
YELLOW_E = mat("ShardGlow", "#ffd94d", roughness=0.35,
               emission="#ffd94d", e_strength=2.6)
RED_M   = mat("MagnetRed", "#d93a30", roughness=0.35)
WHITE_M = mat("MagnetTip", "#e8e8ec", roughness=0.3, metallic=0.4)
PLANET  = mat("Planet",  "#2c3a6e", roughness=0.9)
PLANET2 = mat("PlanetBand", "#2ec4b6", roughness=0.85)
RING_M  = mat("Ring",    "#8d99c4", roughness=0.6, metallic=0.3)

# ---------------------------------------------------------------- helpers
def clean_scene():
    # delete objects only - materials created above must survive
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.curves):
        pass  # orphan datablocks are harmless here

def finish_obj(obj, material=None, smooth=False):
    if material is not None and obj.type == 'MESH':
        obj.data.materials.append(material)
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = smooth
    return obj

def box(name, size, loc, material, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = o.modifiers.new("bev", 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish_obj(o, material)

def sphere(name, radius, loc, material, scale=(1, 1, 1), seg=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc,
                                         segments=seg, ring_count=rings)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish_obj(o, material, smooth=True)

def cyl(name, radius, depth, loc, material, rot=(0, 0, 0), vertices=24, r2=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth,
                                        location=loc, rotation=rot,
                                        vertices=vertices)
    o = bpy.context.active_object
    o.name = name
    if r2 is not None:  # taper: scale top ring
        pass
    return finish_obj(o, material, smooth=True)

def cone(name, r1, r2, depth, loc, material, vertices=6, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth,
                                    location=loc, vertices=vertices,
                                    rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return finish_obj(o, material)

def torus(name, major, minor, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=40, minor_segments=12,
                                     location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    return finish_obj(o, material, smooth=True)

def rock(name, radius, loc, material, seed, squash=1.0):
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius,
                                          location=loc)
    o = bpy.context.active_object
    o.name = name
    me = o.data
    for v in me.vertices:
        n = v.co.normalized()
        f = 1.0 + rng.uniform(-0.28, 0.28)
        v.co = n * radius * f
    o.scale = (1.0, 1.0, squash)
    bpy.ops.object.transform_apply(scale=True)
    # location was reset by transform_apply? no - scale only. restore loc:
    o.location = loc
    return finish_obj(o, material, smooth=False)

def crystal_spike(name, r, h, loc, material=TEAL_E, tilt=(0, 0, 0)):
    # stretched octahedron = sharp crystal
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0, radius=1.0,
                                          location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (r, r, h / 2.0)
    o.rotation_euler = tilt
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = tilt
    return finish_obj(o, material, smooth=False)

def shift(objs, dx, dy, dz):
    for o in objs:
        o.location.x += dx
        o.location.y += dy
        o.location.z += dz

# ---------------------------------------------------------------- builders
def build_drone():
    objs = []
    # main hull: streamlined, nose toward -Y
    objs.append(sphere("Hull", 0.5, (0, 0.05, 0.40), CREAM,
                       scale=(1.05, 1.5, 0.66)))
    # glass canopy = visor band across the front (protrudes past the hull)
    objs.append(sphere("Visor", 0.36, (0, -0.55, 0.42), TEAL_G,
                       scale=(0.95, 1.0, 0.66)))
    # thin emissive eye-strip on the canopy
    objs.append(box("EyeStrip", (0.40, 0.04, 0.07), (0, -0.885, 0.50),
                    TEAL_E, bevel=0.015))
    # top spine fin + rear fin
    objs.append(box("FinTop", (0.05, 0.55, 0.20), (0, 0.42, 0.66), TEAL_DK,
                    bevel=0.02, rot=(math.radians(-18), 0, 0)))
    objs.append(box("FinL", (0.34, 0.30, 0.04), (-0.28, 0.62, 0.52), TEAL_DK,
                    bevel=0.015))
    objs.append(box("FinR", (0.34, 0.30, 0.04), (0.28, 0.62, 0.52), TEAL_DK,
                    bevel=0.015))
    # side pods with orange thrusters at the rear (+Y)
    for s in (-1, 1):
        objs.append(cyl("Pod", 0.17, 0.85, (0.55 * s, 0.10, 0.34), CREAM_D,
                        rot=(math.radians(90), 0, 0)))
        objs.append(cyl("Thruster", 0.115, 0.06, (0.55 * s, 0.545, 0.34),
                        ORANGE_E, rot=(math.radians(90), 0, 0)))
        objs.append(cyl("PodRing", 0.175, 0.08, (0.55 * s, -0.22, 0.34),
                        DARK, rot=(math.radians(90), 0, 0)))
    # belly light strip
    objs.append(box("BellyGlow", (0.30, 0.70, 0.04), (0, 0.0, 0.085), TEAL_E,
                    bevel=0.015))
    return objs

def build_asteroid_a():
    objs = [rock("RockA", 0.8, (0, 0, 0.72), ROCK, seed=11, squash=0.9)]
    objs.append(crystal_spike("CrysA1", 0.13, 0.55, (0.42, -0.25, 1.25),
                              tilt=(math.radians(18), math.radians(-12), 0)))
    objs.append(crystal_spike("CrysA2", 0.09, 0.38, (-0.45, 0.28, 1.05),
                              tilt=(math.radians(-14), math.radians(10), 0)))
    return objs

def build_asteroid_b():
    objs = []
    objs.append(rock("RockB1", 0.95, (-0.45, 0.1, 0.80), ROCK, seed=23,
                     squash=0.9))
    objs.append(rock("RockB2", 0.62, (0.62, -0.25, 0.55), ROCK2, seed=37,
                     squash=0.95))
    objs.append(rock("RockB3", 0.48, (0.35, 0.55, 0.42), ROCK, seed=51,
                     squash=1.0))
    objs.append(crystal_spike("CrysB1", 0.15, 0.7, (-0.5, 0.05, 1.62),
                              tilt=(math.radians(10), math.radians(-8), 0)))
    objs.append(crystal_spike("CrysB2", 0.10, 0.45, (0.72, -0.3, 1.0),
                              tilt=(math.radians(-16), math.radians(14), 0)))
    return objs

def build_crystal():
    objs = []
    objs.append(box("Base", (1.8, 1.1, 0.16), (0, 0, 0.08), ROCK2, bevel=0.05))
    spikes = [  # (x, y, r, h, tilt_x, tilt_y)
        (-0.62, 0.1, 0.20, 0.70, 0.10, -0.14),
        (-0.22, -0.18, 0.24, 0.62, -0.12, -0.05),
        (0.18, 0.16, 0.27, 0.68, 0.06, 0.10),
        (0.58, -0.12, 0.19, 0.52, -0.08, 0.16),
        (0.0, 0.30, 0.15, 0.40, 0.16, 0.0),
        (-0.42, -0.32, 0.13, 0.34, -0.18, -0.10),
        (0.42, 0.34, 0.12, 0.30, 0.14, 0.08),
    ]
    for i, (x, y, r, h, tx, ty) in enumerate(spikes):
        objs.append(crystal_spike(f"Spike{i}", r, h, (x, y, 0.14 + h / 2),
                                  tilt=(tx, ty, 0)))
    return objs

def build_barrier():
    objs = []
    for s in (-1, 1):
        objs.append(box("Post", (0.20, 0.24, 1.6), (0.90 * s, 0, 0.80),
                        INDIGO, bevel=0.03))
        objs.append(box("PostGlow", (0.22, 0.26, 0.12), (0.90 * s, 0, 1.30),
                        ORANGE_E, bevel=0.02))
        objs.append(box("PostFoot", (0.34, 0.40, 0.12), (0.90 * s, 0, 0.06),
                        DARK, bevel=0.03))
    # overhead beam: bottom edge exactly z = 1.05, top 1.60
    objs.append(box("BeamFrame", (2.0, 0.30, 0.55), (0, 0, 1.325), DARK,
                    bevel=0.04))
    objs.append(box("BeamGlow", (1.86, 0.32, 0.38), (0, 0, 1.325), ORANGE_E,
                    bevel=0.05))
    return objs

def build_shard():
    objs = []
    objs.append(crystal_spike("Shard", 0.16, 0.45, (0, 0, 0.50),
                              material=YELLOW_E))
    o = bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0, radius=0.13,
                                              location=(0, 0, 0.50))
    inner = bpy.context.active_object
    inner.name = "ShardCore"
    inner.rotation_euler = (0, 0, math.radians(45))
    objs.append(finish_obj(inner, YELLOW_E, smooth=False))
    return objs

def build_shield():
    objs = []
    # ring standing upright, facing the player (plane = XZ, normal = Y)
    objs.append(torus("ShieldRing", 0.30, 0.075, (0, 0, 0.50), TEAL_E,
                      rot=(math.radians(90), 0, 0)))
    objs.append(sphere("ShieldCore", 0.155, (0, 0, 0.50), TEAL_G, seg=24,
                       rings=12))
    return objs

def build_magnet():
    objs = []
    bpy.ops.mesh.primitive_torus_add(major_radius=0.24, minor_radius=0.105,
                                     major_segments=36, minor_segments=12,
                                     location=(0, 0, 0.52))
    o = bpy.context.active_object
    o.name = "MagnetU"
    # stand the ring upright (plane XZ), then keep the top half:
    # U opening downward, legs ending at local z = 0
    o.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(rotation=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    verts = [v for v in bm.verts if v.co.z < -0.001]
    bmesh.ops.delete(bm, geom=verts, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    objs.append(finish_obj(o, RED_M, smooth=True))
    for s in (-1, 1):
        objs.append(box("MagnetTip", (0.19, 0.19, 0.17), (0.24 * s, 0, 0.435),
                        WHITE_M, bevel=0.02))
    return objs

def build_gate():
    objs = []
    for s in (-1, 1):
        objs.append(box("Pillar", (0.55, 0.55, 4.5), (3.75 * s, 0, 2.25),
                        INDIGO, bevel=0.06))
        objs.append(box("PillarGlow", (0.58, 0.58, 0.16), (3.75 * s, 0, 3.55),
                        TEAL_E, bevel=0.03))
        objs.append(box("PillarGlow2", (0.58, 0.58, 0.16), (3.75 * s, 0, 1.15),
                        TEAL_E, bevel=0.03))
    objs.append(box("ArchTop", (8.05, 0.55, 0.62), (0, 0, 4.19), INDIGO,
                    bevel=0.06))
    objs.append(box("ArchGlow", (7.5, 0.58, 0.18), (0, 0, 3.98), TEAL_E,
                    bevel=0.04))
    objs.append(box("ArchGlowTop", (7.5, 0.58, 0.14), (0, 0, 4.44), TEAL_E,
                    bevel=0.03))
    return objs

def build_deck():
    objs = []
    # origin at the near-end center; deck extends forward (-Y) 30 m, top z=0
    objs.append(box("DeckSlab", (8.0, 30.0, 0.35), (0, -15.0, -0.175), DECK_M))
    for s in (-1, 1):
        objs.append(box("DeckLine", (0.14, 30.0, 0.03), (3.55 * s, -15.0, 0.012),
                        TEAL_E))
        objs.append(box("DeckRail", (0.22, 30.0, 0.20), (3.9 * s, -15.0, 0.10),
                        INDIGO))
    # center guide dashes (dim teal)
    for i in range(6):
        objs.append(box(f"Dash{i}", (0.16, 1.6, 0.025),
                        (0, -2.5 - i * 5.0, 0.010), TEAL_DK))
    return objs

def build_planet():
    objs = []
    objs.append(sphere("Planet", 10.0, (0, 0, 0), PLANET, seg=28, rings=18))
    # equatorial band
    objs.append(torus("PlanetBand", 10.02, 0.55, (0, 0, 0.8), PLANET2,
                      rot=(0, 0, 0)))
    # ring: flat torus tilted
    r = torus("PlanetRing", 14.2, 1.15, (0, 0, 0), RING_M,
              rot=(math.radians(72), 0, math.radians(12)))
    r.scale = (1, 1, 1)
    objs.append(r)
    # small companion moon
    objs.append(sphere("Moon", 1.7, (13.5, -6.0, 4.5), ROCK2, seg=20, rings=12))
    return objs

BUILDERS = [
    ("drone", build_drone),
    ("asteroid_a", build_asteroid_a),
    ("asteroid_b", build_asteroid_b),
    ("crystal", build_crystal),
    ("barrier", build_barrier),
    ("shard", build_shard),
    ("shield", build_shield),
    ("magnet", build_magnet),
    ("gate", build_gate),
    ("deck", build_deck),
    ("planet", build_planet),
]

def export_and_save(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.wm.save_as_mainfile(
        filepath=os.path.join(BLEND_DIR, name + ".blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(GLB_DIR, name + ".glb"),
        export_format='GLB', use_selection=True)

# ---------------------------------------------------------------- build all
for name, fn in BUILDERS:
    clean_scene()
    objs = fn()
    export_and_save(name, objs)
    print(f"[assets] {name}: {len(objs)} objects")

# ---------------------------------------------------------------- preview
clean_scene()
scene = bpy.context.scene
# rebuild a game-like arrangement
deck_objs = build_deck(); shift(deck_objs, 0, 6, 0)
deck2 = build_deck(); shift(deck2, 0, 36, 0)
drone = build_drone(); shift(drone, 0, 6.5, 0.55)
gate = build_gate(); shift(gate, 0, -6, 0)
ast_a = build_asteroid_a(); shift(ast_a, 2.2, 0.5, 0)
ast_b = build_asteroid_b(); shift(ast_b, -2.4, -3.5, 0)
crys = build_crystal(); shift(crys, -2.2, 3.5, 0)
barr = build_barrier(); shift(barr, 2.2, -2.0, 0)
for i in range(5):
    s = build_shard(); shift(s, 0, 5.5 - i * 1.1, 0.1)
sh = build_shield(); shift(sh, -2.2, -1.0, 0.15)
mg = build_magnet(); shift(mg, 2.2, 4.2, 0.15)
pl = build_planet(); shift(pl, -27, -62, 21)

# lights
bpy.ops.object.light_add(type='SUN', location=(6, 2, 10))
key = bpy.context.active_object
key.data.energy = 3.6
key.data.color = hex_lin("#ffe3c2")
key.rotation_euler = (math.radians(48), math.radians(-18), math.radians(28))
# warm sunset rim from ahead-left
bpy.ops.object.light_add(type='POINT', location=(-9, -14, 5))
rim = bpy.context.active_object
rim.data.energy = 600
rim.data.color = hex_lin("#ff8c42")
# teal fill
bpy.ops.object.light_add(type='POINT', location=(8, 6, 4))
fill = bpy.context.active_object
fill.data.energy = 250
fill.data.color = hex_lin("#2ec4b6")

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (
    *hex_lin("#232a52"), 1.0)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.15
# soft ambient lift so the rocks do not go pitch black
bpy.ops.object.light_add(type='POINT', location=(0, -4, 13))
amb = bpy.context.active_object
amb.data.energy = 350
amb.data.color = hex_lin("#7d8fd4")

# camera: behind/above the drone, looking down the runway (-Y)
bpy.ops.object.camera_add(location=(5.2, 16.5, 5.0))
cam = bpy.context.active_object
scene.camera = cam
target = Vector((0, -2, 0.7))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.render.resolution_x = 960
scene.render.resolution_y = 640
scene.render.filepath = PREVIEW
scene.view_settings.view_transform = 'Khronos PBR Neutral'
bpy.ops.render.render(write_still=True)
print("[assets] preview rendered:", PREVIEW)
