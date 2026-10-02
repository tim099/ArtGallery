"""Build an original three-masted display galleon; preserve existing scenes.

All dimensions are in model metres. Hull, cloth and rigging are editable meshes.
Run once in Blender, then export the dedicated model collection as GLB.
"""
import bpy
import math
import json
from mathutils import Vector

ROOT = 'D:/Unity/LY/AgentCommands/ArtGallery'
SLUG = 'meadow_crimson_galleon'
if bpy.data.scenes.get('Meadow_Crimson_Galleon'):
    raise RuntimeError('Galleon scene already exists; inspect before rebuilding.')
engine = bpy.context.scene.render.engine
scene = bpy.data.scenes.new('Meadow_Crimson_Galleon')
bpy.context.window.scene = scene
model = bpy.data.collections.new('Crimson Galleon | Model')
studio = bpy.data.collections.new('Crimson Galleon | Studio')
scene.collection.children.link(model)
scene.collection.children.link(studio)

def material(name, color, metal=0, rough=.5):
    m = bpy.data.materials.new(name)
    n = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value = (*color, 1)
    n.inputs['Metallic'].default_value = metal
    n.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*color, 1)
    return m

wood = material('Galleon | honey oak', (.30,.135,.052))
plank = material('Galleon | golden plank edges', (.48,.265,.105))
darkwood = material('Galleon | walnut wales', (.095,.037,.018))
deckmat = material('Galleon | scrubbed teak', (.47,.32,.18))
cloth = material('Galleon | ivory canvas', (.88,.80,.61), rough=.85)
seammat = material('Galleon | sail seams', (.48,.39,.26), rough=.8)
rope = material('Galleon | tarred rigging', (.045,.032,.022), rough=.9)
brass = material('Galleon | aged gold', (.54,.32,.09), .72,.3)
red = material('Galleon | crimson pennants', (.55,.022,.025))
black = material('Galleon | iron gunports', (.013,.019,.022), .55)
glass = material('Galleon | stern window enamel', (.025,.14,.16), .4,.25)
base = material('Galleon | midnight display stand', (.019,.039,.049), .25)
floor = material('Galleon | studio ground', (.055,.075,.088))

def mesh(name, vs, fs, mat, collection=model, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vs, [], fs)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    return obj

def box(name, center, size, mat, collection=model):
    x,y,z = center
    a,b,c = [s/2 for s in size]
    vs = [(x+i*a,y+j*b,z+k*c) for k in (-1,1) for j in (-1,1) for i in (-1,1)]
    return mesh(name, vs, [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)], mat, collection, False)

def tube(name, points, radius, mat, sides=6):
    ps = [Vector(p) for p in points]
    vs = []
    prev = None
    for i,p in enumerate(ps):
        t = (ps[min(i+1,len(ps)-1)]-ps[max(0,i-1)]).normalized()
        ref = Vector((0,0,1)) if abs(t.z)<.95 else Vector((1,0,0))
        u = (prev-t*prev.dot(t)).normalized() if prev is not None else t.cross(ref).normalized()
        prev = u
        v = t.cross(u)
        for k in range(sides):
            q = p + radius*(u*math.cos(k*math.tau/sides)+v*math.sin(k*math.tau/sides))
            vs.append(tuple(q))
    fs = [(j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k) for j in range(len(ps)-1) for k in range(sides)]
    fs += [tuple(reversed(range(sides))),tuple((len(ps)-1)*sides+k for k in range(sides))]
    return mesh(name,vs,fs,mat)

def line(name,a,b,r=.014,mat=rope):
    return tube(name,[a,b],r,mat)

def ring(name, center, radius, mat, thickness=.02, plane='xy'):
    x,y,z=center
    ps=[]
    for i in range(49):
        a=i*math.tau/48
        ps.append((x+radius*math.cos(a),y+radius*math.sin(a),z) if plane=='xy' else (x+radius*math.cos(a),y,z+radius*math.sin(a)))
    return tube(name,ps,thickness,mat,8)

# Lofted hull: full stern, deep belly and a narrow rising bow.
stations = [(-4.25,.68,1.05),(-3.8,1.02,.65),(-3,1.30,.35),(-2,1.44,.22),(0,1.50,.18),(2,1.30,.30),(3.25,.91,.66),(4,.35,1.20),(4.45,.025,1.85)]
def section(x,w,k,t,side=1):
    return (x,side*w*(math.sin(t*math.pi/2)**.75),k+(2.35-k)*t)
vs=[section(x,w,k,t,side) for side in (-1,1) for x,w,k in stations for t in [j/16 for j in range(17)]]
fs=[]
for s in range(2):
    offset=s*len(stations)*17
    for i in range(len(stations)-1):
        for j in range(16):
            a=offset+i*17+j
            f=(a,a+17,a+18,a+1)
            fs.append(f if s==1 else tuple(reversed(f)))
fs.append(tuple(list(range(17))+list(reversed(range(len(stations)*17,len(stations)*17+17)))))
mesh('Curved oak hull',vs,fs,wood)
for side in (-1,1):
    for j in range(1,17):
        t=j/16
        tube('Hull plank seam', [section(x,w+.008,k,t,side) for x,w,k in stations], .017 if j%4 else .045, plank if j%4 else darkwood)
    for z in (2.42,2.72):
        tube('Sheer rail',[(x,side*w,z+.12*(abs(x)/4.5)**2) for x,w,k in stations],.055,darkwood,8)
    for i in range(37):
        x=-3.8+i*.205
        w=1.48*(1-(x/4.7)**2)**.5
        line('Main bulwark spindle',(x,side*w,2.42),(x,side*w,2.74),.022,brass)
    for x in (-2.9,-1.8,-.7,.4,1.5,2.6):
        w=1.48*(1-(x/4.7)**2)**.5
        box('Gunport black recess',(x,side*(w+.025),1.91),(.40,.045,.32),black)
        for dx in (-.23,.23):
            box('Gunport brass frame',(x+dx,side*(w+.056),1.91),(.045,.035,.40),brass)
        for z in (1.71,2.11):
            box('Gunport brass lintel',(x,side*(w+.056),z),(.50,.035,.035),brass)
        line('Iron cannon muzzle',(x,side*w,1.91),(x,side*(w+.29),1.91),.095,black)

# The weather deck follows the plan of the hull; deck seams remain separate meshes.
dv=[(x,side*w,2.34) for side in (-1,1) for x,w,k in stations]
mesh('Weather deck',dv,[tuple(list(range(len(stations)))+list(reversed(range(len(stations),2*len(stations)))))],deckmat,smooth=False)
for y in [i*.16 for i in range(-7,8)]:
    line('Deck caulking',(-3.65,y,2.352),(3.2,y,2.352),.008,darkwood)
box('Raised sterncastle',(-3.3,0,2.85),(1.8,2.00,1.02),wood)
box('Quarterdeck',(-3.3,0,3.39),(1.96,2.14,.12),deckmat)
box('Poop deck cabin',(-3.83,0,3.69),(.72,1.86,.48),wood)
box('Poop deck',(-3.83,0,3.96),(.89,2.00,.08),deckmat)
for side in (-1,1):
    for z in (2.57,2.88,3.18,3.40,3.97):
        line('Stern gilded gallery',(-4.23,side*1.035,z),(-2.34,side*1.035,z),.028,brass)
    for x in (-3.92,-3.55,-3.18,-2.81):
        box('Stern gallery window',(x,side*1.012,3.06),(.25,.035,.30),glass)
        line('Window mullion',(x,side*1.035,2.91),(x,side*1.035,3.21),.016,brass)
    for i in range(13):
        x=-4.2+i*.15
        line('Quarterdeck rail pillar',(x,side*1.09,3.42),(x,side*1.09,3.78),.018,brass)
    line('Quarterdeck handrail',(-4.22,side*1.09,3.79),(-2.32,side*1.09,3.79),.04,darkwood)
for y in (-.66,-.22,.22,.66):
    box('Transom window',(-4.215,y,3.1),(.03,.32,.40),glass)
    line('Transom window trim',(-4.245,y,2.88),(-4.245,y,3.32),.026,brass)
line('Rudder',(-4.32,0,.38),(-4.38,0,1.85),.14,darkwood)
line('Bowsprit',(3.38,0,2.40),(6.2,0,3.62),.075,wood)
for y in (-.8,.8):
    line('Bowsprit martingale',(4.2,0,1.58),(5.9,y*.12,3.49),.019)
box('Forecastle',(2.7,0,2.53),(1.22,1.6,.36),wood)
box('Forecastle deck',(2.7,0,2.75),(1.34,1.74,.08),deckmat)
box('Main hatch',(.8,0,2.44),(.95,.80,.15),darkwood)
for i in range(7):
    line('Hatch grating',(.38,-.34+i*.11,2.53),(1.2,-.34+i*.11,2.53),.015,brass)

# Canvas grid bulges forward between yard and foot; narrow seams follow the surface.
def sail(name,x,top,height,width):
    def point(u,v):
        return (x+.67*math.sin(math.pi*v)*math.cos(u*math.pi/2),u*width/2*(1-.13*v),top-height*v+.17*u*u*math.sin(math.pi*v))
    nu,nv=24,16
    verts=[point(-1+2*i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
    faces=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
    mesh(name,verts,faces,cloth)
    for i in range(13):
        u=-1+i/6
        tube(name+' stitched seam',[point(u,j/20) for j in range(21)],.009,seammat)
    for u in (-1,1):
        tube(name+' bolt rope',[point(u,j/20) for j in range(21)],.021,seammat)
    tube(name+' foot rope',[point(-1+i/24,1) for i in range(49)],.023,seammat)
    line(name+' yard',(x,-width*.56,top+.035),(x,width*.56,top+.035),.052,darkwood)
    for side in (-1,1):
        line(name+' sheet',point(side,1),(x-.8,side*1.28,2.65),.016)

for label,x,top,lower,width in [('Mizzen',-2.62,7.10,5.32,2.50),('Main',-.65,9.00,6.25,3.8),('Fore',2.05,8.10,5.75,3.25)]:
    line(label+' mast',(x,0,2.34),(x,0,top),.065,wood)
    line(label+' lower mast',(x,0,2.34),(x,0,lower+.1),.105,wood)
    for z in (lower-.22,lower+.03):
        ring(label+' fighting top',(x,0,z),.39,darkwood,.062)
    for i in range(12):
        a=i*math.tau/12
        line('Fighting top stanchion',(x+.38*math.cos(a),.38*math.sin(a),lower-.22),(x+.38*math.cos(a),.38*math.sin(a),lower+.03),.018,wood)
    sail(label+' course',x,lower-.33,1.96 if label!='Mizzen' else 1.5,width)
    sail(label+' topsail',x,top-.62,1.60 if label!='Mizzen' else 1.0,width*.66)
    for side in (-1,1):
        for i in range(5):
            a=(x-.57+i*.25,side*1.40,2.50)
            b=(x,side*.12,lower-.23)
            line(label+' shroud',a,b,.018)
            ring('Shroud deadeye',(a[0],a[1],2.56),.055,darkwood,.020,'xz')
        for j in range(1,15):
            t=j/16
            z=2.50+(lower-.23-2.50)*t
            line(label+' ratline',(x-.57*(1-t),side*(1.4*(1-t)+.12*t),z),(x+.43*(1-t),side*(1.4*(1-t)+.12*t),z),.009)
    flagverts=[]
    for i in range(25):
        t=i/24
        flagverts.extend([(x+1.5*t,.13*math.sin(t*math.tau*1.4),top+.15-.10*t+.05*math.sin(t*math.tau)),(x+1.5*t,.13*math.sin(t*math.tau*1.4),top-.04-.10*t+.05*math.sin(t*math.tau))])
    mesh(label+' crimson pennant',flagverts,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(24)],red)
    tube(label+' pennant white hem',[flagverts[2*i+1] for i in range(25)],.018,cloth)
line('Fore royal stay',(2.05,0,8.0),(6.15,0,3.6),.019)
line('Main forward stay',(-.65,0,8.8),(3.15,0,2.86),.022)
line('Mizzen aft stay',(-2.62,0,6.95),(-4.22,0,4.05),.021)
for a,b in [((-2.62,0,6.95),(-.65,0,8.75)),((-.65,0,8.75),(2.05,0,7.95))]:
    tube('Catenary mast stay',[tuple(Vector(a).lerp(Vector(b),i/24)-Vector((0,0,.5*math.sin(math.pi*i/24)))) for i in range(25)],.016,rope)

# Museum stand belongs to the export; the lighting floor does not.
box('Museum plinth',(0,0,-.18),(9.25,3.40,.22),base)
box('Plinth gold reveal',(0,0,-.045),(9.0,3.18,.045),brass)
for x in (-2.1,2.1):
    box('Cradle support',(x,0,.15),(.26,1.15,.50),darkwood)
box('Exhibit brass nameplate',(0,-1.708,-.17),(2.1,.035,.12),brass)
box('Studio floor',(0,0,-.40),(200,200,.16),floor,studio)
scene.world=bpy.data.worlds.new('Galleon | studio ambience')
scene.world.color=(.15,.15,.15)
for name,loc,power,size in [('Warm key',(1,-7,13),2100,7),('Cool rim',(-3,6,10),2600,6),('Bow fill',(8,-2,6),1200,5)]:
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(Vector((0,0,4))-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Galleon presentation camera',bpy.data.cameras.new('Galleon camera'))
studio.objects.link(camera)
camera.location=(13,-22,12)
camera.rotation_euler=(Vector((.5,0,4.2))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=15.2
scene.camera=camera
scene.render.engine=engine
scene.render.resolution_x=1600
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=ROOT+'/RawImages/'+SLUG+'.png'
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in model.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active=next(iter(model.objects))
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/Models3D/Assets/'+SLUG+'.blend')
bpy.ops.render.render(write_still=True)
print(json.dumps({'objects':len(model.objects),'scene':scene.name,'render':scene.render.filepath}))
