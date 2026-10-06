"""Original tide beacon sculpture. Run inside Blender; preserve existing scenes.

Mesh-only colours suit the gallery's offline viewer. Studio is excluded from GLB.
"""
import bpy
import math
from mathutils import Vector, Matrix

SLUG = 'sirius_tide_beacon'
ROOT = 'D:/Unity/LY/AgentCommands/ArtGallery'
scene = bpy.data.scenes.new('Sirius_Tide_Beacon')
bpy.context.window.scene = scene
exhibit = bpy.data.collections.new('Tide Beacon • exhibit')
studio = bpy.data.collections.new('Tide Beacon • studio')
scene.collection.children.link(exhibit)
scene.collection.children.link(studio)

def material(name, rgb, metal=0.0, rough=0.4):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, 1)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    return mat

blue = material('Tide • glazed midnight blue', (0.018, 0.085, 0.14), 0.35, 0.29)
brass = material('Tide • brushed antique brass', (0.63, 0.33, 0.105), 0.8, 0.28)
light = material('Tide • warm amber core', (1.0, 0.47, 0.085), 0.12, 0.27)
porcelain = material('Tide • pale sea foam', (0.52, 0.81, 0.79), 0.2, 0.32)
dark = material('Studio • slate', (0.028, 0.043, 0.062), 0.1, 0.65)

def mesh(name, vertices, faces, mat, collection=exhibit, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = smooth
    return obj

def lathe(name, profile, mat, segments=64, smooth=True, collection=exhibit):
    verts = [(r*math.cos(i*2*math.pi/segments), r*math.sin(i*2*math.pi/segments), z)
             for r,z in profile for i in range(segments)]
    faces = [(j*segments+i, j*segments+(i+1)%segments,
              (j+1)*segments+(i+1)%segments, (j+1)*segments+i)
             for j in range(len(profile)-1) for i in range(segments)]
    faces += [tuple(reversed(range(segments))),
              tuple((len(profile)-1)*segments+i for i in range(segments))]
    return mesh(name, verts, faces, mat, collection, smooth)

def tube(name, points, radius, mat, sides=10, closed=False):
    verts = []
    count = len(points)
    for i,p in enumerate(points):
        tangent = Vector(points[(i+1)%count]) - Vector(points[(i-1)%count]) if closed else Vector(points[min(i+1,count-1)])-Vector(points[max(0,i-1)])
        tangent.normalize()
        axis = Vector((0,0,1)) if abs(tangent.z)<0.9 else Vector((1,0,0))
        a = tangent.cross(axis).normalized()
        b = tangent.cross(a).normalized()
        for k in range(sides):
            verts.append(Vector(p)+radius*(math.cos(k*2*math.pi/sides)*a+math.sin(k*2*math.pi/sides)*b))
    faces = [(i*sides+k, i*sides+(k+1)%sides, ((i+1)%count)*sides+(k+1)%sides, ((i+1)%count)*sides+k)
             for i in range(count if closed else count-1) for k in range(sides)]
    if not closed:
        faces += [tuple(reversed(range(sides))),tuple((count-1)*sides+k for k in range(sides))]
    return mesh(name,verts,faces,mat)

def ring(name,r,z,thickness,mat,tilt=0,phase=0):
    rot = Matrix.Rotation(tilt,4,'X') @ Matrix.Rotation(phase,4,'Z')
    points = [rot @ Vector((r*math.cos(i*2*math.pi/96),r*math.sin(i*2*math.pi/96),0))+Vector((0,0,z)) for i in range(96)]
    return tube(name,points,thickness,mat,12,True)

lathe('01 • stepped tidal plinth',[(1.02,0.03),(1.1,0.08),(1.1,0.17),(1.04,0.23),(0.95,0.23),(0.95,0.3),(0.88,0.35)],blue)
ring('02 • brass waterline',1.055,0.23,0.022,brass)
ring('03 • inner foam circle',0.77,0.352,0.014,porcelain)
lathe('04 • lantern foot',[(0.31,0.35),(0.33,0.39),(0.26,0.45),(0.19,0.5),(0.19,0.57)],brass)
lathe('05 • faceted amber lantern',[(0.12,0.57),(0.23,0.7),(0.23,1.55),(0.09,1.77),(0.035,1.83)],light,8,False)
lathe('06 • lantern crown',[(0.24,1.52),(0.27,1.58),(0.27,1.63),(0.16,1.73),(0.055,1.81)],brass,32)
ring('07 • equatorial instrument ring',0.84,1.19,0.031,brass)
ring('08 • inclined celestial ring',0.86,1.2,0.028,brass,1.05,0.2)
ring('09 • upper lantern collar',0.26,1.5,0.018,brass)
ring('10 • lower lantern collar',0.26,0.75,0.018,brass)

# Three curling wave vanes, each a solid ribbon with independently readable edges.
for n in range(3):
    phase=n*2*math.pi/3+0.3
    verts=[]
    for i in range(33):
        t=i/32
        angle=phase+1.1*t
        r=0.77-0.31*math.sin(math.pi*t)
        z=0.36+1.34*t
        width=0.055+0.16*math.sin(math.pi*t)**1.4
        for dr,dz in [(-width,-0.017),(width,-0.017),(width,0.017),(-width,0.017)]:
            verts.append(((r+dr)*math.cos(angle),(r+dr)*math.sin(angle),z+dz))
    faces=[(i*4+k,i*4+(k+1)%4,(i+1)*4+(k+1)%4,(i+1)*4+k) for i in range(32) for k in range(4)]
    faces += [(3,2,1,0),(128,129,130,131)]
    mesh('11 • curled ocean vane '+str(n+1),verts,faces,blue)
    pts=[]
    for i in range(33):
        t=i/32; angle=phase+1.1*t
        r=0.77-0.31*math.sin(math.pi*t)+0.055+0.16*math.sin(math.pi*t)**1.4
        pts.append((r*math.cos(angle),r*math.sin(angle),0.38+1.34*t))
    tube('12 • gilded wave edge '+str(n+1),pts,0.015,brass)

# Twelve measuring studs around the base, and eight lantern cage ribs.
for n in range(12):
    a=n*math.pi/6
    obj=lathe('13 • tide hour '+str(n+1),[(0.028,0.354),(0.028,0.37),(0.014,0.389)],brass,12)
    obj.location.x=0.87*math.cos(a); obj.location.y=0.87*math.sin(a)
for n in range(8):
    a=n*math.pi/4
    tube('14 • lantern rib '+str(n+1),[(0.27*math.cos(a),0.27*math.sin(a),0.75),(0.27*math.cos(a),0.27*math.sin(a),1.5)],0.012,brass,8)
lathe('15 • north finial',[(0.035,1.81),(0.065,1.9),(0,2.03)],porcelain,8,False)

# Separate studio objects are retained in the editable .blend only.
lathe('Studio floor',[(200,-0.04),(200,0)],dark,64,collection=studio)
camera_data=bpy.data.cameras.new('Tide • camera')
camera=bpy.data.objects.new('Tide • camera',camera_data)
studio.objects.link(camera)
camera.location=(3.6,-5.2,3.0)
camera.rotation_euler=(Vector((0,0,0.95))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type=next(i.identifier for i in camera_data.bl_rna.properties['type'].enum_items if i.identifier=='ORTHO')
camera_data.ortho_scale=3.2
scene.camera=camera
for name,pos,power,size,color in [('Key', (1,-3,5),900,4,(1,0.82,0.6)),('Fill',(-3,-1,2.8),700,3,(0.4,0.68,1)),('Rim',(2,3,3.5),1100,2.5,(1,0.58,0.3))]:
    data=bpy.data.lights.new('Tide • '+name,'AREA')
    data.energy=power; data.shape=next(i.identifier for i in data.bl_rna.properties['shape'].enum_items if i.identifier=='DISK')
    data.size=size; data.color=color
    obj=bpy.data.objects.new(data.name,data); studio.objects.link(obj); obj.location=pos
    obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Tide • midnight studio')
scene.world.use_nodes=True
background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs['Color'].default_value=(0.035,0.06,0.11,1)
background.inputs['Strength'].default_value=0.4
scene.render.resolution_x=1100; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.render.image_settings.file_format=next(i.identifier for i in scene.render.image_settings.bl_rna.properties['file_format'].enum_items if i.identifier=='PNG')
scene.render.filepath=ROOT+'/RawImages/'+SLUG+'.png'
for obj in scene.objects:
    obj.select_set(obj.name in exhibit.objects)
bpy.context.view_layer.objects.active=next(iter(exhibit.objects))
print('Built',len(exhibit.objects),'exhibit meshes; original scenes preserved. Render engine:',scene.render.engine)

# Explicit scene/collection scope excludes selections in the user's other scenes.
bpy.ops.render.render(write_still=True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/Models3D/Assets/'+SLUG+'.glb',
    export_format='GLB', use_selection=True, use_active_scene=True,
    collection=exhibit.name, export_normals=True, export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/Models3D/Assets/'+SLUG+'.blend')
