"""Original Starpost Snail sculpture. Run with Blender --background --python.

Creates an independent scene and exports only its exhibit collection. No
downloaded geometry, textures or fonts are needed by the model or its viewer.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SLUG = 'meadow_starpost_snail'
scene = bpy.data.scenes.new('Starpost Snail — meadow')
if bpy.context.window:
    bpy.context.window.scene = scene
exhibit = bpy.data.collections.new('Starpost Snail | Exhibit')
studio = bpy.data.collections.new('Starpost Snail | Studio')
scene.collection.children.link(exhibit)
scene.collection.children.link(studio)

def material(name, rgb, metal=0, rough=0.35):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    return mat

teal = material('Glazed seafoam', (0.11, 0.42, 0.39), 0.28)
dark = material('Midnight enamel', (0.019, 0.075, 0.11), 0.3)
brass = material('Warm brass', (0.74, 0.43, 0.13), 0.7)
cream = material('Letter ivory', (0.91, 0.82, 0.62))
wood = material('Cherry post office', (0.30, 0.085, 0.045))
light = material('Honey lantern', (1.0, 0.59, 0.17), 0.1)
black = material('Obsidian eyes', (0.008, 0.013, 0.017), 0.1, 0.16)
floor = material('Studio indigo', (0.022, 0.029, 0.049), 0, 0.7)

def route(obj, name, mat, collection=exhibit):
    obj.name = name
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def sphere(name, p, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=p)
    obj = route(bpy.context.object, name, mat)
    obj.scale = scale
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj

def box(name, p, size, mat, bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    obj = route(bpy.context.object, name, mat)
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Hand softened edges', 'BEVEL')
    mod.width, mod.segments = bevel, 3
    return obj

def wire(name, points, radius, mat):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth, data.bevel_resolution = radius, 3
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for dst, p in zip(spline.points, points):
        dst.co = (*p, 1)
    obj = bpy.data.objects.new(name, data)
    exhibit.objects.link(obj)
    data.materials.append(mat)
    return obj

def ring(name, p, radius, thickness, mat, rotation=(0,0,0)):
    points = [(radius*math.cos(i*math.tau/96), radius*math.sin(i*math.tau/96), 0) for i in range(97)]
    obj = wire(name, points, thickness, mat)
    obj.location, obj.rotation_euler = p, rotation
    return obj

def star(name, p, radius, mat):
    outline = [(math.sin(i*math.pi/5)*(radius if i%2==0 else radius*0.44), math.cos(i*math.pi/5)*(radius if i%2==0 else radius*0.44)) for i in range(10)]
    verts = [(x,y,z) for y in (-0.025,0.025) for x,z in outline]
    faces = [tuple(reversed(range(10))), tuple(range(10,20))]
    faces += [(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name,mesh)
    exhibit.objects.link(obj)
    mesh.materials.append(mat)
    obj.location = p
    return obj

# Porcelain animal resting on an engraved, low circular display plinth.
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=2.3, depth=0.22, location=(0,0,0.11))
route(bpy.context.object, 'Night route plinth', dark)
ring('Plinth brass rim', (0,0,0.23), 2.22, 0.025, brass)
for i in range(24):
    a = i*math.tau/24
    wire('Route tick', [(r*math.cos(a),r*math.sin(a),0.232) for r in (2.02,2.12)],0.008,brass)
sphere('Soft snail foot', (0,0,0.50), (1.98,0.62,0.30), teal)
sphere('Raised curious head', (1.35,0,0.91), (0.52,0.48,0.61), teal)
for y in (-0.30,0.30):
    wire('Eyestalk', [(1.46,y,1.20),(1.56,y*1.15,1.59),(1.61,y*1.30,1.91)],0.052,teal)
    sphere('Bright round eye', (1.61,y*1.30,1.91), (0.115,0.115,0.115),black)
    sphere('Eye catchlight', (1.68,y*1.30-0.055,1.955), (0.023,0.023,0.023),cream)
wire('Gentle smile', [(1.79,-0.32,0.92),(1.83,-0.23,0.87),(1.84,-0.13,0.90)],0.012,dark)
sphere('Large midnight shell', (-0.45,0,1.33), (1.10,0.63,1.08), dark)
# Separate continuous gold spirals on both faces make the back worth exploring.
for side in (-1,1):
    points=[]
    for i in range(241):
        t=i/240
        a=t*math.tau*2.4
        r=0.06+0.93*t
        points.append((-0.45+r*math.cos(a),side*(0.64-0.25*t*t),1.33+r*math.sin(a)))
    wire('Shell postal spiral',points,0.027,brass)

# A tiny timber post office, a teal gable roof and luminous mail window.
box('Post office body',(-0.46,0,2.48),(0.88,0.76,0.66),wood)
for x in (-0.83,-0.09):
    for y in (-0.36,0.36):
        box('Corner brass trim',(x,y,2.49),(0.035,0.035,0.69),brass,0.008)
for side in (-1,1):
    roof=box('Overhanging gable roof',(-0.46,side*0.24,2.99),(1.16,0.62,0.10),teal)
    roof.rotation_euler.x=-side*math.radians(32)
    for x in (-0.99,-0.72,-0.46,-0.20,0.07):
        wire('Roof raised seam',[(x,0,3.16),(x,side*0.53,2.83)],0.009,brass)
box('Glowing counter window',(-0.46,-0.396,2.49),(0.49,0.025,0.35),light,0.01)
for x in (-0.71,-0.46,-0.21):
    box('Window mullion',(x,-0.425,2.49),(0.022,0.03,0.39),brass,0.006)
box('Window sill',(-0.46,-0.46,2.28),(0.64,0.19,0.04),cream,0.008)
star('Postal star sign',(-0.46,-0.45,2.90),0.13,brass)
box('Rear mail door',(-0.46,0.397,2.46),(0.35,0.024,0.46),teal)
sphere('Door knob',(-0.34,0.432,2.43),(0.03,0.025,0.03),brass)
box('Roof chimney',(-0.79,0.14,3.12),(0.14,0.15,0.38),wood)
box('Chimney cap',(-0.79,0.14,3.32),(0.21,0.22,0.06),brass)

# A satchel and sealed letters are modeled rather than drawn into textures.
box('Postal satchel',(0.35,-0.60,0.95),(0.47,0.22,0.47),wood,0.065)
box('Satchel flap',(0.35,-0.73,1.08),(0.48,0.035,0.21),teal)
box('Satchel buckle',(0.35,-0.765,1.02),(0.07,0.02,0.08),brass,0.005)
wire('Satchel strap',[(0.16,-0.68,1.16),(0.08,-0.48,1.49),(0.12,0.27,1.57)],0.025,brass)
for i in range(3):
    x=-1.42+i*0.20
    box('Stacked letter',(x,-0.67,0.43+i*0.07),(0.37,0.26,0.035),cream,0.008)
    wire('Envelope folded seam',[(x-0.15,-0.78,0.46+i*0.07),(x,-0.67,0.46+i*0.07),(x+0.15,-0.78,0.46+i*0.07)],0.005,wood)
wire('Lantern bracket',[(0.03,-0.12,2.75),(0.44,-0.12,2.75),(0.44,-0.12,2.52)],0.023,brass)
box('Lantern heart',(0.44,-0.12,2.36),(0.14,0.14,0.22),light)
for z in (2.22,2.49):
    box('Lantern cap',(0.44,-0.12,z),(0.24,0.24,0.045),brass)
for dx in (-0.09,0.09):
    for dy in (-0.09,0.09):
        wire('Lantern frame',[(0.44+dx,-0.12+dy,2.24),(0.44+dx,-0.12+dy,2.48)],0.01,brass)
wire('Star flagpole',[(-0.10,0.10,3.08),(-0.10,0.10,3.69)],0.018,brass)
star('North star finial',(-0.10,0.10,3.76),0.15,brass)

# Isolated studio rig. Render is the reference for the sculpture's materials.
bpy.ops.mesh.primitive_plane_add(size=200)
route(bpy.context.object,'Studio floor',floor,studio)
camera_data=bpy.data.cameras.new('Exhibit camera')
camera=bpy.data.objects.new('Exhibit camera',camera_data)
studio.objects.link(camera)
camera.location=(7,-10,7)
target=Vector((0,0,1.72))
camera.rotation_euler=(target-Vector(camera.location)).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=5.6
scene.camera=camera
for name,p,energy,size,color in [('Warm key',(-3,-4,7),1100,5,(1,0.82,0.63)),('Blue rim',(1,4,6),1400,4,(0.53,0.74,1)),('Front fill',(5,-2,4),650,3,(0.79,0.91,1))]:
    data=bpy.data.lights.new(name,'AREA')
    data.energy,data.size,data.color=energy,size,color
    obj=bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location=p
    obj.rotation_euler=(target-Vector(p)).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Starpost night')
scene.world.use_nodes=True
node=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
node.inputs['Color'].default_value=(0.09,0.12,0.20,1)
node.inputs['Strength'].default_value=0.35
try:
    scene.render.engine='CYCLES'
except TypeError:
    pass
if scene.render.engine=='CYCLES':
    scene.cycles.samples=48
    scene.cycles.use_denoising=True
scene.render.resolution_x=scene.render.resolution_y=1100
scene.render.resolution_percentage=100
formats={i.identifier for i in scene.render.image_settings.bl_rna.properties['file_format'].enum_items}
if 'PNG' not in formats:
    raise RuntimeError('PNG unavailable')
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ROOT/'RawImages'/f'{SLUG}.png')

# Convert curve strokes to triangles before exporting to the gallery renderer.
for obj in list(exhibit.objects):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    if obj.type=='CURVE':
        bpy.ops.object.convert(target='MESH')
    if obj.type=='MESH':
        obj.modifiers.new('Viewer triangle topology','TRIANGULATE')
bpy.ops.object.select_all(action='DESELECT')
for obj in exhibit.objects:
    obj.select_set(True)
assets=ROOT/'Models3D'/'Assets'
assets.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(assets/f'{SLUG}.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(assets/f'{SLUG}.blend'),copy=True)
bpy.ops.render.render(write_still=True)
print({'blender':bpy.app.version_string,'exhibit_objects':len(exhibit.objects),'studio_objects':len(studio.objects),'slug':SLUG})
