"""Create the original Dew Beacon sculpture in a new Blender scene.

Run in Blender's Python environment. Existing scenes and objects are preserved.
The exported viewer geometry shares the evaluated meshes used by the GLB.
"""
import bpy
import json
import math
from mathutils import Vector, Matrix

ROOT = 'D:/Unity/LY/AgentCommands/ArtGallery'
SLUG = 'meadow_dew_beacon'
OUT = ROOT + '/Models3D/Assets'
if bpy.data.scenes.get('Meadow_Dew_Beacon'):
    raise RuntimeError('Dew Beacon already exists; inspect it before rebuilding.')
scene = bpy.data.scenes.new('Meadow_Dew_Beacon')
bpy.context.window.scene = scene
sculpture = bpy.data.collections.new('Dew Beacon | Sculpture')
studio = bpy.data.collections.new('Dew Beacon | Studio')
scene.collection.children.link(sculpture)
scene.collection.children.link(studio)

# Responsibility: construct original meshes and shader materials.
# Meaning: turned brass rings surround a living sprout, without a glass enclosure.
# Effect: adds objects only to the dedicated new scene; lengths are in metres.
def material(name, color, metal=0, rough=.35, glow=0):
    mat = bpy.data.materials.new(name)
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = glow
    mat.diffuse_color = (*color, 1)
    return mat

brass = material('Brushed champagne brass', (.52,.30,.105), .82, .26)
dark = material('Midnight enamel', (.018,.055,.061), .65, .27)
jade = material('Living jade', (.045,.37,.18), .22, .28)
vein = material('Young leaf veins', (.25,.57,.19), .25, .35)
light = material('Warm guiding light', (.9,.52,.13), .1, .24, 2.8)
dew = material('Turquoise dew crystal', (.11,.62,.53), .5, .15)
floor_mat = material('Studio charcoal', (.021,.031,.039), 0, .62)

def mesh(name, vertices, faces, mat, collection=sculpture):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = True
    return obj

def lathe(name, profile, mat, segments=80):
    vertices = [(r*math.cos(i*2*math.pi/segments),r*math.sin(i*2*math.pi/segments),z)
                for r,z in profile for i in range(segments)]
    faces = [(j*segments+i,j*segments+(i+1)%segments,
              (j+1)*segments+(i+1)%segments,(j+1)*segments+i)
             for j in range(len(profile)-1) for i in range(segments)]
    faces += [tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))]
    return mesh(name,vertices,faces,mat)

def tube(name, points, radius, mat, sides=10, closed=False):
    points = [Vector(p) for p in points]
    vertices = []
    previous_u = None
    for i,p in enumerate(points):
        a = points[(i-1)%len(points)] if closed or i else p
        b = points[(i+1)%len(points)] if closed or i<len(points)-1 else p
        tangent = (b-a).normalized()
        reference = Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((1,0,0))
        # Parallel transport avoids abrupt frame changes at near-vertical tangents.
        u = (previous_u-tangent*previous_u.dot(tangent)).normalized() if previous_u is not None else tangent.cross(reference).normalized()
        previous_u = u
        v = tangent.cross(u).normalized()
        for k in range(sides):
            angle = 2*math.pi*k/sides
            vertices.append(tuple(p+radius*(u*math.cos(angle)+v*math.sin(angle))))
    faces = []
    for i in range(len(points) if closed else len(points)-1):
        j = (i+1)%len(points)
        faces.extend((i*sides+k,i*sides+(k+1)%sides,j*sides+(k+1)%sides,j*sides+k) for k in range(sides))
    if not closed:
        faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))])
    return mesh(name,vertices,faces,mat)

def ring(name, radius, z, thickness, mat, tilt=0, twist=0):
    rotation = Matrix.Rotation(twist,3,'Z') @ Matrix.Rotation(tilt,3,'X')
    points = [rotation @ Vector((radius*math.cos(i*2*math.pi/128),radius*math.sin(i*2*math.pi/128),0))+Vector((0,0,z)) for i in range(128)]
    return tube(name,points,thickness,mat,12,True)

lathe('01 | Obsidian plinth',[(.85,.05),(.91,.09),(.91,.2),(.84,.25)],dark)
lathe('02 | Brass foot',[(.86,.03),(.94,.06),(.94,.1),(.9,.12)],brass)
lathe('03 | Instrument crown',[(.79,.25),(.84,.28),(.84,.33),(.76,.36)],brass)
lathe('04 | Soil cradle',[(.53,.35),(.58,.38),(.55,.48),(.42,.56)],dark)
ring('05 | Cradle rim',.5,.51,.025,brass)
ring('06 | Equatorial dial',1.18,1.5,.055,brass)
ring('07 | Meridian arch',1.36,1.5,.052,brass,math.pi/2,.2)
ring('08 | Oblique orbit',1.12,1.5,.029,dark,.85,-.7)
ring('09 | Fine orbit inlay',1.135,1.5,.012,light,.85,-.7)
for i in range(48):
    angle=2*math.pi*i/48
    r=1.18
    end=r+.12 if i%4==0 else r+.065
    tube('Dial tick %02d'%i,[(r*math.cos(angle),r*math.sin(angle),1.5),(end*math.cos(angle),end*math.sin(angle),1.5)],.012,brass,6)
for i in range(3):
    angle=2*math.pi*i/3+.3
    tube('Swept support %d'%i,[(.66*math.cos(angle),.66*math.sin(angle),.32),(.84*math.cos(angle),.84*math.sin(angle),.7),(1.05*math.cos(angle),1.05*math.sin(angle),1.17),(1.18*math.cos(angle),1.18*math.sin(angle),1.5)],.035,brass,12)
stem_points=[(.13*math.sin(t*2),.06*math.sin(t*3),.53+t*1.55) for t in [i/36 for i in range(37)]]
tube('10 | Living stem',stem_points,.031,jade,12)

# Responsibility: shape leaves as curved, double-sided lens meshes.
# Meaning: the centre rib arches towards light while the narrow tips remain free.
# Effect: five individually editable leaves and raised veins, with real thickness.
for idx,(z,length,angle) in enumerate([(.88,.73,-.2),(1.13,.78,2.6),(1.4,.66,.65),(1.65,.54,3.2),(1.87,.34,1.0)]):
    t=(z-.53)/1.55
    root=Vector((.13*math.sin(t*2),.06*math.sin(t*3),z))
    direction=Vector((math.cos(angle),math.sin(angle),0))
    across=Vector((-math.sin(angle),math.cos(angle),0))
    vertices=[]
    nu,nv=20,8
    for layer in [-1,1]:
        for u in range(nu+1):
            f=u/nu
            centre=root+direction*length*f+Vector((0,0,.3*math.sin(math.pi*f*.7)))
            width=length*.28*math.sin(math.pi*f)
            for v in range(nv+1):
                g=2*v/nv-1
                vertices.append(tuple(centre+across*width*g+Vector((0,0,.07*(1-g*g)*math.sin(math.pi*f)+layer*.008))))
    stride=(nu+1)*(nv+1)
    faces=[]
    for layer in range(2):
        for u in range(nu):
            for v in range(nv):
                a=layer*stride+u*(nv+1)+v
                face=(a,a+1,a+nv+2,a+nv+1)
                faces.append(face if layer else tuple(reversed(face)))
    edge=[u*(nv+1) for u in range(nu+1)]+[nu*(nv+1)+v for v in range(1,nv+1)]+[u*(nv+1)+nv for u in range(nu-1,-1,-1)]+list(range(nv-1,0,-1))
    faces.extend((a,b,b+stride,a+stride) for a,b in zip(edge,edge[1:]+edge[:1]))
    mesh('Leaf %02d'%idx,vertices,faces,jade)
    rib=[root+direction*length*f+Vector((0,0,.3*math.sin(math.pi*f*.7)+.07*math.sin(math.pi*f)+.012)) for f in [i/20 for i in range(21)]]
    tube('Leaf vein %02d'%idx,rib,.008,vein,6)

lathe('11 | Zenith finial',[(.06,2.84),(.085,2.9),(.04,3.03),(.001,3.1)],brass,40)
for i in range(3):
    angle=2*math.pi*i/3+.8
    # Crystal droplets are manually faceted, unlike the smooth brass structure.
    c=Vector((.64*math.cos(angle),.64*math.sin(angle),2.16+i*.08))
    vertices=[tuple(c+Vector((0,0,.13))),tuple(c+Vector((0,0,-.11)))]
    vertices += [tuple(c+Vector((.075*math.cos(k*2*math.pi/8),.075*math.sin(k*2*math.pi/8),0))) for k in range(8)]
    obj=mesh('Dew crystal %d'%i,vertices,[(0,2+k,2+(k+1)%8) for k in range(8)]+[(1,2+(k+1)%8,2+k) for k in range(8)],dew)
    for face in obj.data.polygons: face.use_smooth=False
ring('12 | Halo over soil',.36,.6,.012,light)

# Responsibility: provide a studio render and editable lighting setup.
# Meaning: warm key light and cool rim light reveal brass and living jade.
# Effect: studio objects are excluded from the downloadable sculpture geometry.
mesh('Studio floor',[(-200,-200,0),(200,-200,0),(200,200,0),(-200,200,0)],[(0,1,2,3)],floor_mat,studio)
def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,position,power,color,size in [('Key',(3,-4,6),950,(1,.79,.53),4),('Rim',(-3,2,4),1300,(.34,.77,1),3),('Fill',(1,4,2.8),700,(.65,1,.78),3)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.size=size
    obj=bpy.data.objects.new(name,data); studio.objects.link(obj); obj.location=position; aim(obj,(0,0,1.5))
data=bpy.data.cameras.new('Exhibition camera')
camera=bpy.data.objects.new('Exhibition camera',data); studio.objects.link(camera)
camera.location=(5,-7,4.7); aim(camera,(0,0,1.5)); data.lens=66; scene.camera=camera
scene.world=bpy.data.worlds.new('Dew Beacon studio world'); scene.world.color=(.06,.06,.06)
scene.render.resolution_x=1400; scene.render.resolution_y=1400; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=ROOT+'/RawImages/'+SLUG+'.png'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/'+SLUG+'.blend')
print('Dew Beacon model created:',len(sculpture.objects),'sculpture objects. Original scene preserved.')
