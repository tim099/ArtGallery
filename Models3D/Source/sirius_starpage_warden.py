"""Original mesh sculpture. Run in Blender's Python context; preserves existing scenes."""
import bpy
import math
from mathutils import Vector, Quaternion

ROOT = 'D:/Unity/LY/AgentCommands/ArtGallery'
SLUG = 'sirius_starpage_warden'
scene = bpy.data.scenes.new('Sirius_Starpage_Warden')
bpy.context.window.scene = scene
model = bpy.data.collections.new('Starpage | Sculpture')
studio = bpy.data.collections.new('Starpage | Studio')
scene.collection.children.link(model)
scene.collection.children.link(studio)

def material(name, color, metal=0, rough=.35):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    node = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    return m

gold = material('SP | Aged brass', (.55,.29,.085), .8)
blue = material('SP | Midnight enamel', (.016,.055,.11), .48, .26)
ivory = material('SP | Porcelain feathers', (.78,.67,.43), .12)
paper = material('SP | Warm paper', (.73,.58,.35), 0, .65)
dark = material('SP | Obsidian pupil', (.006,.01,.022), .2, .22)
amber = material('SP | Amber iris', (.8,.35,.045), .55, .24)
teal = material('SP | Turquoise inlay', (.025,.36,.37), .5)
floor = material('SP | Studio slate', (.018,.025,.038), 0, .8)

def mesh(name, vertices, faces, mat, collection=model, smooth=True):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj=bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    for face in data.polygons: face.use_smooth=smooth
    return obj

def ellipsoid(name, center, radii, mat, segments=32, rings=16):
    vertices=[]
    for j in range(rings+1):
        t=math.pi*j/rings
        for i in range(segments):
            p=2*math.pi*i/segments
            vertices.append((center[0]+radii[0]*math.sin(t)*math.cos(p),center[1]+radii[1]*math.sin(t)*math.sin(p),center[2]+radii[2]*math.cos(t)))
    faces=[(j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i) for j in range(rings) for i in range(segments)]
    return mesh(name,vertices,faces,mat)

def tube(name, points, radius, mat, sides=8):
    pts=[Vector(p) for p in points]
    vertices=[]
    for i,p in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        axis=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0))
        u=tangent.cross(axis).normalized(); v=tangent.cross(u)
        vertices.extend(tuple(p+radius*(u*math.cos(k*2*math.pi/sides)+v*math.sin(k*2*math.pi/sides))) for k in range(sides))
    faces=[(i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k) for i in range(len(pts)-1) for k in range(sides)]
    faces.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+k for k in range(sides))])
    return mesh(name,vertices,faces,mat)

def ring(name, center, radius, thickness, mat, axis='Z'):
    pts=[]
    for i in range(81):
        a=2*math.pi*i/80
        delta=(radius*math.cos(a),radius*math.sin(a),0) if axis=='Z' else (radius*math.cos(a),0,radius*math.sin(a))
        pts.append(tuple(Vector(center)+Vector(delta)))
    return tube(name,pts,thickness,mat,10)

def lathe(name, profile, mat):
    n=64
    vertices=[(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z) for r,z in profile for i in range(n)]
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
    faces.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))])
    return mesh(name,vertices,faces,mat)

# The book's curved top is real geometry, with a shallow central binding valley.
lathe('01 | Enamel plinth',[(0,0),(.85,0),(.94,.08),(.94,.18),(.85,.24),(.85,.3),(0,.3)],blue)
ring('Plinth upper brass band',(0,0,.245),.87,.022,gold)
ring('Plinth lower brass band',(0,0,.09),.943,.019,gold)
for i in range(24):
    a=i*2*math.pi/24
    tube('Plinth compass tick',[(.87*math.cos(a),.87*math.sin(a),.19),(.88*math.cos(a),.88*math.sin(a),.215)],.008,gold,6)

for side in [-1,1]:
    verts=[]
    for layer in [0,1]:
        for j in range(13):
            x=side*(.045+.94*j/12)
            z=.43+.10*math.sin(math.pi*j/12)+.045*j/12
            for y in [-.63,.63]: verts.append((x,y,z if layer else .325))
    stride=26
    faces=[]
    for j in range(12):
        a=2*j
        faces += [(a,a+2,a+3,a+1),(a+stride,a+stride+1,a+stride+3,a+stride+2),(a,a+stride,a+stride+2,a+2),(a+1,a+3,a+stride+3,a+stride+1)]
    faces += [(0,1,27,26),(24,50,51,25)]
    if side<0: faces=[tuple(reversed(f)) for f in faces]
    mesh('02 | Curved page block',verts,faces,paper,smooth=False)
    for k in range(6):
        tube('Exposed page line',[(side*.05,-.637,.34+k*.012),(side*.985,-.637,.34+k*.012)],.0025,ivory,5)
    for line in range(7):
        y=-.48+line*.15
        pts=[]
        for k in range(20):
            f=.15+.7*k/19
            pts.append((side*(.045+.94*f),y,.433+.10*math.sin(math.pi*f)+.045*f))
        tube('Engraved page text',pts,.0035,gold,5)
    tube('Book cover edge',[(side*.04,-.66,.32),(side*1.02,-.66,.32),(side*1.02,.66,.32),(side*.04,.66,.32)],.024,blue)
tube('Book spine',[(0,-.66,.345),(0,.66,.345)],.06,blue,12)
tube('Ribbon bookmark',[(.12,-.1,.49),(.13,-.65,.46),(.12,-.85,.31),(.2,-.94,.25)],.024,teal)

# An owl is assembled from sculpted ellipsoids and layered solid feather plates.
ellipsoid('03 | Body shell',(0,.04,1.38),(.56,.38,.70),blue)
ellipsoid('04 | Heart breast',(0,-.275,1.4),(.41,.18,.5),ivory)
ellipsoid('05 | Head shell',(0,0,2.18),(.65,.37,.47),blue)
for side in [-1,1]:
    ellipsoid('Facial porcelain disc',(side*.29,-.28,2.22),(.305,.12,.33),ivory)
    for radius,thick,mat in [(.25,.027,gold),(.188,.021,blue),(.15,.02,gold)]:
        ring('Eye concentric bezel',(side*.29,-.415,2.24),radius,thick,mat,'Y')
    ellipsoid('Amber iris',(side*.29,-.414,2.24),(.16,.035,.16),amber)
    ellipsoid('Obsidian pupil',(side*.29,-.449,2.24),(.078,.024,.092),dark)
    ellipsoid('Eye glint',(side*.265,-.47,2.29),(.023,.009,.023),ivory,16,8)
    for k in range(12):
        a=2*math.pi*k/12
        tube('Iris radial tooth',[(side*.29+.174*math.cos(a),-.443,2.24+.174*math.sin(a)),(side*.29+.193*math.cos(a),-.443,2.24+.193*math.sin(a))],.008,gold,6)
    # Pointed, thick ear plates give the silhouette an alert expression.
    mesh('Ear brass crest',[(side*.39,-.03,2.5),(side*.61,.015,2.96),(side*.65,.09,2.47),(side*.43,.15,2.51)],[(0,1,2),(0,2,3),(0,3,1),(1,3,2)],gold,smooth=False)
    tube('Leg',[(side*.22,0,.51),(side*.22,-.02,.83)],.055,gold,12)
    for toe in [-1,0,1]:
        tube('Curved talon',[(side*.22+toe*.052,-.01,.58),(side*.22+toe*.065,-.16,.53),(side*.22+toe*.07,-.26,.52)],.022,gold,8)
    for row in range(4):
        for col in range(3):
            x=side*(.4+.055*col+.015*row)
            z=1.88-.19*row-.065*col
            ellipsoid('Layered wing feather',(x,.04+col*.075,z),(.12,.18,.265),gold if col==0 else blue,24,12)
            tube('Wing feather inlay',[(x+side*.04,-.08+col*.075,z+.1),(x+side*.05,-.095+col*.075,z-.13)],.01,teal,6)
    tube('Shoulder trim',[(side*.49,-.08,1.98),(side*.6,-.03,1.84),(side*.65,.06,1.56),(side*.59,.13,1.13)],.025,gold,10)
mesh('06 | Hooked beak',[(0,-.48,2.20),(-.095,-.385,2.12),(.095,-.385,2.12),(0,-.48,1.96),(0,-.30,2.1)],[(0,1,3),(0,3,2),(0,2,4),(0,4,1),(1,4,3),(2,3,4)],gold,smooth=False)
for row in range(4):
    count=5 if row<2 else 3
    for k in range(count):
        x=(k-(count-1)/2)*.12
        z=1.69-row*.16
        y=-.39+.15*(x/.4)**2
        ellipsoid('Breast scallop',(x,y,z),(.074,.042,.105),ivory,20,10)
ring('07 | Heart clock rim',(0,-.455,1.46),.105,.014,gold,'Y')
ellipsoid('Heart clock face',(0,-.45,1.46),(.09,.018,.09),blue,24,12)
tube('Clock hand',[(0,-.475,1.46),(.04,-.475,1.52)],.007,gold,6)
tube('Clock second hand',[(0,-.475,1.46),(-.05,-.475,1.46)],.004,teal,6)

# Broken celestial arc behind the head: a crown, with genuine mesh stars.
pts=[(.81*math.cos(a),.19,2.17+.81*math.sin(a)) for a in [math.pi*.12+i*math.pi*.76/72 for i in range(73)]]
tube('08 | Star chart crown',pts,.018,gold,10)
for i in range(9):
    a=math.pi*.15+i*math.pi*.7/8
    c=Vector((.81*math.cos(a),.19,2.17+.81*math.sin(a)))
    verts=[tuple(c+Vector((0,-.018,0))),tuple(c+Vector((0,.018,0)))]+[tuple(c+Vector(((.065 if j%2==0 else .026)*math.sin(j*math.pi/4),0,(.065 if j%2==0 else .026)*math.cos(j*math.pi/4)))) for j in range(8)]
    mesh('Crown star',verts,[(0,2+j,2+(j+1)%8) for j in range(8)]+[(1,2+(j+1)%8,2+j) for j in range(8)],gold,smooth=False)
for k in range(5):
    ellipsoid('Back tail feather',((k-2)*.1,.34,.97),(.085,.17,.34),blue)

mesh('Studio floor',[(-200,-200,-.015),(200,-200,-.015),(200,200,-.015),(-200,200,-.015)],[(0,1,2,3)],floor,studio,False)
def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,color,size in [('Key',(3,-4,5),850,(1,.8,.58),4),('Rim',(-3,2,4),1100,(.35,.67,1),3),('Fill',(-3,-3,2.5),500,(.7,.84,1),3)]:
    data=bpy.data.lights.new('SP | '+name,'AREA');data.energy=power;data.color=color;data.size=size
    obj=bpy.data.objects.new('SP | '+name,data);studio.objects.link(obj);obj.location=loc;aim(obj,(0,0,1.5))
data=bpy.data.cameras.new('SP | Exhibition camera');data.type='ORTHO';data.ortho_scale=4.0
camera=bpy.data.objects.new('SP | Exhibition camera',data);studio.objects.link(camera);camera.location=(3,-7,3.4);aim(camera,(0,0,1.45));scene.camera=camera
scene.world=bpy.data.worlds.new('SP | Night studio');scene.world.color=(.08,.08,.08)
scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=ROOT+'/RawImages/'+SLUG+'.png'
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='MATERIAL'
print('Created',len(model.objects),'model meshes. Existing scenes preserved.')

# Export the current exhibit only; saving a copy keeps the user's session file intact.
bpy.ops.object.select_all(action='DESELECT')
for obj in model.objects: obj.select_set(True)
bpy.context.view_layer.objects.active=model.objects[0]
bpy.ops.export_scene.gltf(filepath=ROOT+'/Models3D/Assets/'+SLUG+'.glb',use_selection=True,use_active_scene=True,export_cameras=False,export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/Models3D/Assets/'+SLUG+'.blend',copy=True)
bpy.ops.render.render(write_still=True)
