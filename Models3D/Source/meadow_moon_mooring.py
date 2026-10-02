"""Build Moon Mooring as an independent Blender scene; retain existing scenes.

Original solid geometry uses folded porcelain, a bronze crescent and thin
gold ripple inlays. Studio objects stay outside the exported exhibit collection.
Run inside Blender, then export only the Moon Mooring collection.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SLUG = 'meadow_moon_mooring'

# Scene isolation keeps the user's original scene and objects intact.
scene = bpy.data.scenes.new('Moon Mooring — meadow')
bpy.context.window.scene = scene
exhibit = bpy.data.collections.new('Moon Mooring | Sculpture')
studio = bpy.data.collections.new('Moon Mooring | Studio')
scene.collection.children.link(exhibit)
scene.collection.children.link(studio)

def material(name, rgb, metallic=0.0, roughness=0.4):
    """Set both viewport colour and rendered Principled inputs by node type."""
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*rgb, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return mat

bronze = material('MM | Brushed bronze', (0.39, 0.19, 0.065), 0.78, 0.3)
gold = material('MM | Warm gold inlay', (0.83, 0.54, 0.18), 0.72, 0.25)
navy = material('MM | Midnight enamel', (0.013, 0.045, 0.075), 0.35, 0.25)
ivory = material('MM | Porcelain paper', (0.89, 0.84, 0.70), 0.05, 0.34)
fold = material('MM | Porcelain fold shade', (0.64, 0.71, 0.69), 0.08, 0.4)
ground = material('MM | Studio charcoal', (0.025, 0.033, 0.05), 0, 0.65)

def move(obj, mat, collection=exhibit):
    """Route each object explicitly; studio geometry cannot enter the GLB."""
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def mesh(name, verts, faces, mat, bevel=0):
    """Build closed authored surfaces; bevel widths are in scene metres."""
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    exhibit.objects.link(obj)
    data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft crafted edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
    return obj

def tube(name, points, radius, mat, cyclic=False):
    """A round metal wire follows points without textures or external assets."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, xyz in zip(spline.points, points):
        p.co = (*xyz, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    exhibit.objects.link(obj)
    data.materials.append(mat)
    return obj

def cylinder(name, radius, depth, z, mat):
    """Round stepped plinth with subtle bevels catches the studio highlights."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=radius, depth=depth, location=(0, 0, z))
    obj = move(bpy.context.object, mat)
    obj.name = name
    mod = obj.modifiers.new('Turned rim', 'BEVEL')
    mod.width = 0.045
    mod.segments = 3
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return obj

cylinder('Bronze foot', 1.72, 0.16, 0.08, bronze)
cylinder('Midnight pool', 1.62, 0.19, 0.235, navy)
for r, z in [(1.60, 0.32), (1.68, 0.14)]:
    tube('Plinth gold rim', [(r*math.cos(t*math.tau/128), r*math.sin(t*math.tau/128), z) for t in range(128)], 0.014, gold, True)
for r in (0.48, 0.78, 1.1, 1.4):
    tube('Still water ripple', [(0.12+r*math.cos(t*math.tau/128), r*math.sin(t*math.tau/128), 0.342) for t in range(128)], 0.009, gold, True)

# Crescent has two different sinusoidal contours meeting at tapered tips.
# Closed front/back skins and side walls give it real thickness at every angle.
steps = 96
outline = [(-1.62*math.sin(i*math.pi/steps)-0.12, 2.08+1.78*math.cos(i*math.pi/steps)) for i in range(steps+1)]
outline += [(-0.65*math.sin(i*math.pi/steps)-0.12, 2.08+1.78*math.cos(i*math.pi/steps)) for i in range(steps-1, 0, -1)]
n = len(outline)
verts = [(x, y, z) for y in (0.43, 0.68) for x, z in outline]
faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
mesh('Solid bronze crescent', verts, faces, bronze, 0.035)
for i in range(13, 86, 9):
    t = i*math.pi/steps
    x, z = -1.62*math.sin(t)-0.12, 2.08+1.78*math.cos(t)
    tube('Crescent engraved ray', [(x+0.09, 0.411, z), (x+0.22, 0.411, z)], 0.008, gold)

# The paper boat is a closed low-poly hull with contrasting triangular folds.
cx = 0.35
v = [(cx-1.13,0,1.10),(cx+1.13,0,1.10),(cx-0.65,-0.42,0.91),(cx+0.65,-0.42,0.91),
     (cx-0.65,0.42,0.91),(cx+0.65,0.42,0.91),(cx-0.6,0,0.59),(cx+0.6,0,0.59)]
hull = mesh('Folded porcelain hull', v, [(0,2,6),(2,3,7,6),(3,1,7),(0,6,4),(4,6,7,5),(5,7,1),(0,4,5,1,3,2)], ivory, 0.016)
hull.data.materials.append(fold)
for i in (0,2,4):
    hull.data.polygons[i].material_index = 1
for y, z, mat in [(-0.19,1.72,ivory),(0.16,1.55,fold)]:
    sail = mesh('Central paper fold', [(cx-0.77,y,1.00),(cx+0.77,y,1.00),(cx,y,z)], [(0,1,2)], mat)
    solid = sail.modifiers.new('Porcelain sheet thickness', 'SOLIDIFY')
    solid.thickness = 0.035
    mod = sail.modifiers.new('Fold edge softness', 'BEVEL')
    mod.width = 0.012
    mod.segments = 2
tube('Boat keel support', [(cx,0,0.34),(cx,0,0.62)], 0.055, bronze)

def star(name, x, y, z, size):
    """Five-point solid brass star, with bevels small enough to keep its tips."""
    contour = [(x+math.sin(i*math.pi/5)*(size if i%2==0 else size*0.43), z+math.cos(i*math.pi/5)*(size if i%2==0 else size*0.43)) for i in range(10)]
    vs = [(a, yy, b) for yy in (y-0.04,y+0.04) for a,b in contour]
    fs = [tuple(reversed(range(10))), tuple(range(10,20))]
    fs += [(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
    mesh(name, vs, fs, gold, 0.008)

tube('Starlight anchor', [(-0.4,0.55,3.80),(-0.12,0.55,3.80)], 0.018, gold)
for x,z,size,top in [(0.54,2.94,0.23,3.73),(1.18,2.31,0.15,3.52),(0.05,2.39,0.095,3.80)]:
    tube('Suspended starlight arm', [(-0.12,0.55,3.80),(x,0.55,top),(x,0.55,z+size)], 0.012, gold)
    star('Hanging brass star', x, 0.55, z, size)
for x,y in [(-0.85,-0.73),(0.35,-1.16),(1.04,-0.51),(0.76,0.98)]:
    star('Water star inlay',0,0,0,0.06)
    obj = list(exhibit.objects)[-1]
    obj.rotation_euler.x = math.pi/2
    obj.location = (x,y,0.37)

# Studio is separate from the sculptural asset; camera frames generous margins.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-0.012))
move(bpy.context.object, ground, studio).name = 'Studio floor'
camera_data = bpy.data.cameras.new('Moon Mooring camera')
camera = bpy.data.objects.new('Moon Mooring camera', camera_data)
studio.objects.link(camera)
camera.location = (6.6,-10.5,6.2)
target = Vector((0,0,1.86))
camera.rotation_euler = (target-Vector(camera.location)).to_track_quat('-Z','Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 5.4
scene.camera = camera
for name,location,energy,size,color in [('Warm key',(-3,-4,6),950,5,(1,0.83,0.65)),('Cool rim',(2,3,5),1300,4,(0.48,0.71,1)),('Soft fill',(4,-2,3),450,3,(0.75,0.88,1))]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size, light.color = energy, size, color
    obj = bpy.data.objects.new(name,light)
    studio.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (target-Vector(location)).to_track_quat('-Z','Y').to_euler()
world = bpy.data.worlds.new('Moon Mooring world')
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (0.075,0.10,0.16,1)
background.inputs['Strength'].default_value = 0.4
scene.world = world
scene.render.resolution_x = scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(ROOT/'RawImages'/f'{SLUG}.png')
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
print({'scene':scene.name,'sculpture_objects':len(exhibit.objects),'studio_objects':len(studio.objects)})
