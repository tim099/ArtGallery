/* Responsibility: draw the exhibit's embedded GLB without a CDN or fetch.
 * Meaning: visitors orbit actual Blender mesh geometry, rather than a turntable movie.
 * Effect: reads glTF 2 triangle meshes with position/normal and basic PBR colours;
 * the simplified studio shader omits textures, skinning and transmission.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('model'), status = document.getElementById('status');
  // Sandboxed gallery embeds use the outer gallery's download links.
  if(window.self !== window.top)document.querySelectorAll('footer a').forEach(link=>{link.hidden=true;});
  const fallback = message => { document.getElementById('fallback').hidden = false; status.textContent = message; };
  try {
    const gl = canvas.getContext('webgl', {antialias:true, alpha:true, preserveDrawingBuffer:true});
    if (!gl) throw Error('此瀏覽器不支援 WebGL，改看渲染圖。');
    const identity = () => [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    const mul = (a,b) => Array.from({length:16},(_,i) => {
      const r=i%4,c=Math.floor(i/4); return a[r]*b[c*4]+a[r+4]*b[c*4+1]+a[r+8]*b[c*4+2]+a[r+12]*b[c*4+3];
    });
    const sub = (a,b) => a.map((v,i)=>v-b[i]);
    const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
    const norm = a => {const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
    const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const point = (m,p) => [0,1,2].map(r=>m[r]*p[0]+m[r+4]*p[1]+m[r+8]*p[2]+m[r+12]);
    const transform = n => {
      if(n.matrix)return n.matrix;
      const [x,y,z,w]=n.rotation||[0,0,0,1], s=n.scale||[1,1,1],t=n.translation||[0,0,0];
      return [(1-2*y*y-2*z*z)*s[0],(2*x*y+2*z*w)*s[0],(2*x*z-2*y*w)*s[0],0,
        (2*x*y-2*z*w)*s[1],(1-2*x*x-2*z*z)*s[1],(2*y*z+2*x*w)*s[1],0,
        (2*x*z+2*y*w)*s[2],(2*y*z-2*x*w)*s[2],(1-2*x*x-2*y*y)*s[2],0,...t,1];
    };
    const raw = Uint8Array.from(atob(window.MODEL_GLB_BASE64),c=>c.charCodeAt(0));
    const view=new DataView(raw.buffer);
    if(view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==raw.length)throw Error('模型檔案不完整。');
    let documentGLTF, binary;
    for(let offset=12;offset<raw.length;){
      const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
      if(type===0x4e4f534a)documentGLTF=JSON.parse(new TextDecoder().decode(raw.subarray(offset,offset+length)));
      if(type===0x004e4942)binary=raw.subarray(offset,offset+length);
      offset+=length;
    }
    if(!documentGLTF || !binary)throw Error('模型缺少幾何資料。');
    const d=documentGLTF;
    function accessor(index){
      const a=d.accessors[index], b=d.bufferViews[a.bufferView];
      if(a.sparse || a.normalized || b.buffer!==0)throw Error('模型使用尚未支援的頂點格式。');
      const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
      const format={5126:[4,'getFloat32'],5125:[4,'getUint32'],5123:[2,'getUint16'],5121:[1,'getUint8']}[a.componentType];
      if(!components || !format)throw Error('模型頂點格式不相容。');
      const bytes=new DataView(binary.buffer,binary.byteOffset,binary.byteLength), out=[];
      for(let i=0;i<a.count;i++)for(let k=0;k<components;k++)out.push(bytes[format[1]]((b.byteOffset||0)+(a.byteOffset||0)+i*(b.byteStride||components*format[0])+k*format[0],true));
      return out;
    }
    const items=[], min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    let triangles=0;
    function visit(index,parent){
      const node=d.nodes[index], world=mul(parent,transform(node));
      if(node.mesh!==undefined)for(const primitive of d.meshes[node.mesh].primitives){
        if((primitive.mode??4)!==4 || primitive.attributes.NORMAL===undefined)throw Error('目前展區只接受含法線的三角網格。');
        const positions=accessor(primitive.attributes.POSITION), normals=accessor(primitive.attributes.NORMAL);
        const indices=primitive.indices===undefined?Array.from({length:positions.length/3},(_,i)=>i):accessor(primitive.indices);
        const mat=d.materials?.[primitive.material]||{},pbr=mat.pbrMetallicRoughness||{};
        const colour=pbr.baseColorFactor||[.5,.5,.5,1], metal=pbr.metallicFactor??1;
        // Bake world-space vertices so normals use inverse-transpose even for scaled nodes.
        const a=[world[0],world[1],world[2]],b=[world[4],world[5],world[6]],c=[world[8],world[9],world[10]];
        const bc=cross(b,c),ca=cross(c,a),ab=cross(a,b),det=dot(a,bc);
        if(Math.abs(det)<1e-10)throw Error('模型包含不可顯示的零尺度物件。');
        const packed=[];
        for(const i of indices){
          const p=point(world,positions.slice(i*3,i*3+3)),n=norm([0,1,2].map(k=>(bc[k]*normals[i*3]+ca[k]*normals[i*3+1]+ab[k]*normals[i*3+2])/det));
          for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
          packed.push(...p,...n);
        }
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(packed),gl.STATIC_DRAW);
        items.push({buffer,count:indices.length,colour:colour.slice(0,3),metal,glow:mat.emissiveFactor||[0,0,0]});triangles+=indices.length/3;
      }
      for(const child of node.children||[])visit(child,world);
    }
    for(const root of d.scenes[d.scene||0].nodes)visit(root,identity());
    if(!items.length)throw Error('模型中沒有可展示的網格。');
    const centre=min.map((v,i)=>(v+max[i])/2),radius=Math.hypot(...sub(max,min))/2;
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec3 n; uniform mat4 vp; varying vec3 normal; varying vec3 pos; void main(){normal=n;pos=p;gl_Position=vp*vec4(p,1.);}'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 normal; varying vec3 pos; uniform vec3 colour; uniform vec3 eye; uniform vec3 glow; uniform float metal; void main(){vec3 N=normalize(normal);if(!gl_FrontFacing)N=-N;vec3 V=normalize(eye-pos);vec3 L=normalize(vec3(3.,5.,4.));float key=max(dot(N,L),0.);float rim=max(dot(N,normalize(vec3(-3.,2.,-4.))),0.);float spec=pow(max(dot(N,normalize(L+V)),0.),40.);vec3 C=colour*(.22+key*.95+rim*.42)+mix(vec3(.23),colour,metal)*spec*1.5+glow*.15;C=C/(C+vec3(.65));gl_FragColor=vec4(pow(C,vec3(1./2.2)),1.);}'));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const p=gl.getAttribLocation(program,'p'),n=gl.getAttribLocation(program,'n');gl.enableVertexAttribArray(p);gl.enableVertexAttribArray(n);gl.enable(gl.DEPTH_TEST);
    const uniforms=Object.fromEntries(['vp','colour','eye','glow','metal'].map(name=>[name,gl.getUniformLocation(program,name)]));
    let yaw=.62,pitch=.28,distance=radius*2.3,spinning=false,drag=null,last=0,dirty=true;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    function camera(){
      const eye=[centre[0]+distance*Math.sin(yaw)*Math.cos(pitch),centre[1]+distance*Math.sin(pitch),centre[2]+distance*Math.cos(yaw)*Math.cos(pitch)];
      const z=norm(sub(eye,centre)),x=norm(cross([0,1,0],z)),y=cross(z,x);
      const v=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
      const f=1/Math.tan(Math.PI/8),aspect=canvas.width/canvas.height,near=radius*.01,far=radius*40;
      return {eye,vp:mul([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],v)};
    }
    function draw(now){
      const width=Math.round(canvas.clientWidth*Math.min(devicePixelRatio,2)),height=Math.round(canvas.clientHeight*Math.min(devicePixelRatio,2));
      if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;dirty=true;}
      if(spinning && !document.hidden){yaw+=Math.min((now-last)/1000,.05)*.23;dirty=true;}last=now;
      if(dirty && width && height){
        gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        const c=camera();gl.uniformMatrix4fv(uniforms.vp,false,new Float32Array(c.vp));gl.uniform3fv(uniforms.eye,c.eye);
        for(const item of items){gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);gl.vertexAttribPointer(p,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(n,3,gl.FLOAT,false,24,12);gl.uniform3fv(uniforms.colour,item.colour);gl.uniform3fv(uniforms.glow,item.glow);gl.uniform1f(uniforms.metal,item.metal);gl.drawArrays(gl.TRIANGLES,0,item.count);}dirty=false;
      }
      requestAnimationFrame(draw);
    }
    function zoom(amount){distance=Math.max(radius*1.3,Math.min(radius*8,distance*Math.exp(amount)));dirty=true;}
    canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();});
    canvas.addEventListener('pointermove',e=>{if(!drag || drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.008;pitch=Math.max(-1.35,Math.min(1.35,pitch+(e.clientY-drag.y)*.008));drag.x=e.clientX;drag.y=e.clientY;dirty=true;});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null;});
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.001);},{passive:false});
    function reset(){yaw=.62;pitch=.28;distance=radius*2.3;dirty=true;}
    canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;if(e.key==='ArrowUp')pitch=Math.min(1.35,pitch+.12);if(e.key==='ArrowDown')pitch=Math.max(-1.35,pitch-.12);if(e.key==='+'||e.key==='=')zoom(-.12);if(e.key==='-')zoom(.12);if(e.key==='Home')reset();dirty=true;});
    document.getElementById('reset').onclick=reset;
    document.getElementById('front').onclick=()=>{yaw=0;pitch=.05;dirty=true;};
    document.getElementById('spin').onclick=()=>{spinning=!spinning;document.getElementById('spin').setAttribute('aria-pressed',String(spinning));document.getElementById('spin').textContent=spinning?'停止旋轉':'自動旋轉';};
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('3D 顯示中斷，請重新整理；目前顯示渲染圖。');});
    status.textContent=`${items.length} 部件 · ${triangles.toLocaleString()} 三角面 · 拖曳旋轉／滾輪縮放`;
    if(reduced)document.getElementById('spin').title='已尊重減少動態效果設定；按下才會旋轉。';
    requestAnimationFrame(draw);
  } catch(error){fallback(error.message || '模型載入失敗，改看渲染圖。');}
})();
