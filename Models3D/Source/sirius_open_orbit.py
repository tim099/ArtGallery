"""Build an original book-and-orbit sculpture in an isolated Blender scene.

Run with Blender --background --factory-startup --python this_file.py.
All geometry is opaque, texture-free mesh for the gallery's offline renderer.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SLUG = 'sirius_open_orbit'
print('Blender:', bpy.app.version_string, 'Initial scenes:',
      [(s.name, len(s.objects)) for s in bpy.data.scenes], flush=True)
scene = bpy.data.scenes.new('Sirius | Open Orbit')
bpy.context.window.scene = scene
model = bpy.data.collections.new('Exhibit | Open Orbit')
studio = bpy.data.collections.new('Studio | excluded from GLB')
scene.collection.children.link(model)
scene.collection.children.link(studio)

def material(name, colour, metal=0, rough=.35, emission=0):
    """Use basic opaque colours; the PNG alone gets physical studio lighting."""
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*colour, 1)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*colour, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*colour, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat

navy = material('Midnight enamel', (.019, .045, .105), .55, .26)
silver = material('Brushed moon silver', (.58, .72, .82), .82, .3)
paper = material('Warm ivory paper', (.82, .77, .63), 0, .6)
edge = material('Paper edge', (.57, .55, .46), 0, .7)
ink = material('Blue page inlay', (.075, .21, .31), .35, .4)
gold = material('Warm star brass', (.85, .48, .12), .7, .28)
light = material('Star lantern core', (1, .64, .23), .2, .25, .6)
floor = material('Studio charcoal', (.019, .026, .045), 0, .7)

def mesh(name, verts, faces, mat, collection=model, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    return obj

def tube(name, points, radius, mat, sides=10, collection=model):
    """Parallel local frames turn paths into capped solid tubes, not hair curves."""
    points = list(map(Vector, points))
    verts = []
    for i, p in enumerate(points):
        tangent = (points[min(i+1, len(points)-1)] - points[max(0, i-1)]).normalized()
        reference = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((0, 1, 0))
        u = tangent.cross(reference).normalized()
        v = tangent.cross(u).normalized()
        verts.extend(tuple(p + radius*(u*math.cos(j*math.tau/sides) + v*math.sin(j*math.tau/sides))) for j in range(sides))
    faces = [(i*sides+j, i*sides+(j+1)%sides, (i+1)*sides+(j+1)%sides, (i+1)*sides+j)
             for i in range(len(points)-1) for j in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple((len(points)-1)*sides+j for j in range(sides))]
    return mesh(name, verts, faces, mat, collection, True)

def lathe(name, profile, mat, segments=96):
    verts = [(r*math.cos(i*math.tau/segments), r*math.sin(i*math.tau/segments), z)
             for r, z in profile for i in range(segments)]
    faces = [(j*segments+i, j*segments+(i+1)%segments, (j+1)*segments+(i+1)%segments, (j+1)*segments+i)
             for j in range(len(profile)-1) for i in range(segments)]
    faces += [tuple(reversed(range(segments))), tuple((len(profile)-1)*segments+i for i in range(segments))]
    return mesh(name, verts, faces, mat, smooth=True)

def star(name, centre, radius, mat):
    """Four-point folded stars have actual depth, visible from the back."""
    c = Vector(centre)
    outline = [c+Vector(((radius if j%2 == 0 else radius*.32)*math.sin(j*math.pi/4), 0,
                         (radius if j%2 == 0 else radius*.32)*math.cos(j*math.pi/4))) for j in range(8)]
    verts = [tuple(c+Vector((0, -.07, 0))), tuple(c+Vector((0, .07, 0)))] + list(map(tuple, outline))
    return mesh(name, verts, [(0, 2+j, 2+(j+1)%8) for j in range(8)] +
                [(1, 2+(j+1)%8, 2+j) for j in range(8)], mat)

# Stepped enamel plinth and fine concentric metal edging provide a quiet anchor.
lathe('01 | Midnight plinth', [(0, .02), (1.4, .02), (1.45, .06), (1.45, .15), (1.39, .22), (1.32, .25), (0, .25)], navy)
for z, r in [(.07, 1.451), (.18, 1.414), (.252, 1.29)]:
    tube('Silver plinth rim', [(r*math.cos(a), r*math.sin(a), z) for a in [i*math.tau/128 for i in range(129)]], .013, silver)
for i in range(12):
    a = i*math.tau/12
    tube('Plinth radial notch', [(r*math.sin(a), -r*math.cos(a), .258) for r in [1.17, 1.25]], .009, silver, 6)

# Each book half is a closed curved slab. Multiple edges distinguish the leaf block
# from its thick blue cover; increasing subdivisions only improves the silhouette.
def leaf_height(t):
    return .38 + .135*math.sin(math.pi*t) + .045*t

for side in [-1, 1]:
    for name, zoffset, thickness, mat, width in [('Cover', -.085, .055, navy, 1.03),
                                               ('Page block', -.025, .055, edge, .98),
                                               ('Top leaf', 0, .012, paper, .98)]:
        verts = []
        count = 32
        for dz in [0, -thickness]:
            for y in [-.64, .65]:
                verts += [(side*(.025+width*i/count), y, leaf_height(i/count)+zoffset+dz) for i in range(count+1)]
        row = count+1
        faces = []
        for i in range(count):
            faces.extend([(i, i+1, row+i+1, row+i), (2*row+i, 3*row+i, 3*row+i+1, 2*row+i+1),
                          (i, 2*row+i, 2*row+i+1, i+1), (row+i, row+i+1, 3*row+i+1, 3*row+i)])
        faces += [(0, row, 3*row, 2*row), (count, 2*row-1, 4*row-1, 3*row-1)]
        if side < 0:
            faces = [tuple(reversed(face)) for face in faces]
        mesh('02 | '+name, verts, faces, mat)
    for k in range(5):
        tube('Leaf edges', [(side*(.025+.98*t), -.647, leaf_height(t)-.018-k*.009) for t in [i/32 for i in range(33)]], .002, paper, 6)
    for k in range(7):
        y = -.46+k*.13
        tube('Quiet lines on page', [(side*(.025+.98*t), y, leaf_height(t)+.006) for t in [.15+i*.65/24 for i in range(25)]], .003, ink, 6)
tube('Book spine', [(0, -.64, .32), (0, .65, .32)], .047, navy)
tube('Brass ribbon bookmark', [(.13, .3, .445), (.14, -.2, .454), (.14, -.65, .437), (.17, -.83, .31), (.28, -.94, .27)], .017, gold)

# The broken orbit deliberately leaves the right side open. Two thin rails and
# short ticks give it the language of an instrument without enclosing the book.
centre_z = 1.59
for radius, thickness in [(1.23, .034), (1.12, .012)]:
    tube('03 | Unclosed silver orbit', [(radius*math.cos(a), .48, centre_z+radius*math.sin(a))
          for a in [math.radians(38+284*i/144) for i in range(145)]], thickness, silver, 12)
for degree in range(45, 320, 10):
    a = math.radians(degree)
    tube('Orbit graduation', [(r*math.cos(a), .48, centre_z+r*math.sin(a)) for r in [1.15, 1.205]], .009, silver, 6)
for x in [-.48, .48]:
    tube('Orbit support', [(x, .48, .25), (x, .48, .49)], .04, navy)
for degree in [72, 130, 196, 260]:
    a = math.radians(degree)
    star('Small chart star', (1.23*math.cos(a), .455, centre_z+1.23*math.sin(a)), .075, silver)

# A slender brass branch carries the warm star inside the missing arc. Its stem
# returns to the page: the glow is offered to the next page, rather than the sky.
tube('04 | Lantern branch', [(.76, .22, .48), (.89, .27, .82), (1.02, .3, 1.2), (1.1, .32, 1.48)], .024, gold)
star('05 | Lantern star', (1.1, .31, 1.62), .265, gold)
star('Lantern warm core', (1.1, .225, 1.62), .16, light)
for i in range(3):
    x, y = [(-.67, -.29), (-.44, -.13), (-.76, .12)][i]
    t = (abs(x)-.025)/.98
    tube('Page constellation dot', [(x, y, leaf_height(t)+.014), (x, y, leaf_height(t)+.019)], .025, gold, 12)
tube('Page constellation thread', [(x, y, leaf_height((abs(x)-.025)/.98)+.015) for x, y in [(-.67, -.29), (-.44, -.13), (-.76, .12)]], .006, gold, 6)

def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()

mesh('Studio floor', [(-100, -100, 0), (100, -100, 0), (100, 100, 0), (-100, 100, 0)], [(0, 1, 2, 3)], floor, studio)
for name, location, power, colour, size in [('Key', (2, -4, 6), 900, (1, .86, .68), 4),
                                          ('Rim', (-3, 2, 4), 1100, (.42, .68, 1), 3),
                                          ('Fill', (-4, -2, 2), 450, (.65, .8, 1), 3)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.size = power, colour, size
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = location
    aim(obj, (0, 0, 1.2))
data = bpy.data.cameras.new('Exhibition camera')
data.type, data.ortho_scale = 'ORTHO', 3.75
camera = bpy.data.objects.new('Exhibition camera', data)
studio.objects.link(camera)
camera.location = (3.1, -7.5, 4.3)
aim(camera, (0, 0, 1.32))
scene.camera = camera
scene.world = bpy.data.worlds.new('Quiet blue studio')
scene.world.color = (.09, .09, .09)
engines = scene.render.bl_rna.properties['engine'].enum_items
available = {item.identifier for item in engines}
scene.render.engine = 'CYCLES' if 'CYCLES' in available else 'BLENDER_EEVEE_NEXT'
if scene.render.engine == 'CYCLES':
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(ROOT/'RawImages'/f'{SLUG}.png')
scene.view_settings.view_transform = 'AgX'
for obj in scene.objects:
    obj.select_set(False)
for obj in model.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = model.objects[0]
# Selection is the export boundary: no studio object enters the portable model.
bpy.ops.export_scene.gltf(filepath=str(ROOT/'Models3D/Assets'/f'{SLUG}.glb'),
                          use_selection=True, use_active_scene=True,
                          export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Models3D/Assets'/f'{SLUG}.blend'), copy=True)
print('Exhibit meshes:', len(model.objects), 'Studio objects:', len(studio.objects), flush=True)
bpy.ops.render.render(write_still=True)
