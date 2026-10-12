// ───────────────────────── WebGL ─────────────────────────
var cv = $('cv'), gl = cv.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
function fail(msg) { var e = $('err'); e.style.display = 'block'; e.textContent = msg; $('load').textContent = msg; }
if (!gl) { fail('這個瀏覽器沒有 WebGL2，畫不出來。'); throw new Error('no WebGL2'); }   // 拆檔後這裡是閉包的頂層：throw ＝ 原本的 return（停下來）

var P = {};
function programs() {
  P.vox = VK.compile(gl, VK.VOXEL_VS, VK.VOXEL_FS);
  P.deb = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec4 iP; layout(location=3) in vec4 iQ; layout(location=4) in float iC;\n' +
    'uniform mat4 uVP; out vec3 vN; out vec3 vW; flat out float vC;\n' +
    'vec3 rq(vec4 q, vec3 v){ return v+2.0*cross(q.xyz, cross(q.xyz,v)+q.w*v); }\n' +
    'void main(){ vec3 w=iP.xyz+rq(iQ,aP*iP.w); vW=w; vN=rq(iQ,aN); vC=iC; gl_Position=uVP*vec4(w,1.0); }\n',
    '#version 300 es\nprecision highp float; in vec3 vN; in vec3 vW; flat in float vC; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD; out vec4 o;\n' +
    'void main(){ uint c=uint(vC+0.5); vec3 b=vec3(float((c>>5u)&7u)/7.0,float((c>>2u)&7u)/7.0,float(c&3u)/3.0); vec3 n=normalize(vN);\n' +
    ' vec3 col=b*(mix(uGround,uSky,n.y*0.5+0.5)*0.62+vec3(1.0,0.96,0.88)*max(dot(n,uSun),0.0)*0.78);\n' +
    ' if(vW.y<0.0) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
  P.tri = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; uniform mat4 uModel,uVP; out vec3 vN; out vec3 vW; out vec3 vC;\n' +
    'void main(){ vec4 w=uModel*vec4(aP,1.0); vW=w.xyz; vN=mat3(uModel)*aN; vC=aC; gl_Position=uVP*w; }\n',
    '#version 300 es\nprecision highp float; in vec3 vN; in vec3 vW; in vec3 vC; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD,uLit; out vec4 o;\n' +
    'void main(){ vec3 n=normalize(vN); float d=abs(dot(n,uSun)); vec3 col=uLit>0.5 ? vC*(mix(uGround,uSky,0.6)*0.65+vec3(1.0,0.96,0.88)*d*0.7) : vC;\n' +
    ' if(vW.y<0.0) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
  // 帆：頂點法線（平滑，不是一個三角形一個平面）；法線翻向看的那一面；包覆光（背光面不死黑、明暗過渡慢）＋太陽在帆後面時布透出暖光
  P.sail = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; uniform mat4 uModel,uVP; out vec3 vN; out vec3 vW; out vec3 vC;\n' +
    'void main(){ vec4 w=uModel*vec4(aP,1.0); vW=w.xyz; vN=mat3(uModel)*aN; vC=aC; gl_Position=uVP*w; }\n',
    '#version 300 es\nprecision highp float; in vec3 vN; in vec3 vW; in vec3 vC; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD; out vec4 o;\n' +
    'void main(){ vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n; float s=dot(n,uSun);\n' +
    ' float lit=max(s,0.0)*0.45+(s*0.5+0.5)*0.32; float thru=max(-s,0.0)*0.30;\n' +
    ' vec3 col=vC*(mix(uGround,uSky,n.y*0.5+0.5)*0.62+vec3(1.0,0.96,0.88)*lit)+vC*vec3(1.0,0.88,0.66)*thru;\n' +
    ' if(vW.y<0.0) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
  P.pt = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in float aS; layout(location=2) in vec4 aC; layout(location=3) in float aT; uniform mat4 uVP; uniform float uPx; out vec4 vC; out float vT; out float vR;\n' +
    'void main(){ vec4 c=uVP*vec4(aP,1.0); gl_Position=c; gl_PointSize=clamp(aS*uPx/max(c.w,0.1),1.0,256.0); vC=aC; vT=aT; vR=aP.y*0.9+aT*1.7; }\n',
    // 類型 4（vT ≥ 16）＝ 帆的布片：程式畫的菱形，角度跟著高度轉、側過來時變窄（像在翻）；fx.png 沒有這一列 ⇒ 一律程式畫
    '#version 300 es\nprecision highp float; in vec4 vC; in float vT; in float vR; uniform sampler2D uFx; uniform float uUseFx; out vec4 o;\n' +
    'void main(){ if(vT>=16.0){ vec2 d=gl_PointCoord*2.0-1.0; float cr=cos(vR), sr=sin(vR); vec2 q=vec2(cr*d.x-sr*d.y, sr*d.x+cr*d.y);\n' +
    '   float fl=0.3+0.7*abs(sin(vR*0.7)); if(abs(q.x)/(0.95*fl)+abs(q.y)/(0.5+0.12*(vT-16.0))>1.0) discard; o=vec4(vC.rgb*(0.75+0.25*fl),vC.a); return; }\n' +
    ' if(uUseFx>0.5 && vT>=0.0){ float ty=floor(vT/4.0), va=vT-ty*4.0; vec4 t=texture(uFx,(vec2(va,ty)+gl_PointCoord)/4.0); if(t.a<0.02) discard; o=vec4(t.rgb,t.a*vC.a); return; }\n' +
    ' vec2 d=gl_PointCoord*2.0-1.0; float r=dot(d,d); if(r>1.0) discard; float a=vC.a*(1.0-r*r); o=vec4(vC.rgb*(1.0-0.25*r),a); }\n');
  P.water = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec2 aP; uniform mat4 uVP; out vec3 vW; void main(){ vW=vec3(aP.x,0.0,aP.y); gl_Position=uVP*vec4(vW,1.0); }\n',
    '#version 300 es\nprecision highp float; in vec3 vW; uniform vec3 uEye,uSun,uFog,uSky; uniform float uT,uFogD; out vec4 o;\n' +
    // 船艙裡不畫海：海面那一點換到船的格座標，落在原本船殼的外形裡（uHull：每個 (x, z) 船殼的半寬）⇒ 丟掉。uHide ＝ 那艘還沒開始沉（見 render）
    'uniform mat4 uInv0,uInv1; uniform vec2 uHide; uniform sampler2D uHull; uniform vec3 uHullK;\n' +
    'bool inHull(mat4 inv){ vec4 l=inv*vec4(vW,1.0); if(l.x<0.0||l.z<0.0||l.x>=uHullK.x||l.z>=uHullK.y) return false; float hb=texelFetch(uHull,ivec2(int(l.x),int(l.z)),0).r*255.0; return hb>0.0 && abs(l.y-uHullK.z)<hb; }\n' +
    'vec2 wv(vec2 p,vec2 d,float f,float s){ float k=dot(p,d)*f+uT*s; return d*cos(k)*f; }\n' +
    'void main(){ if((uHide.x>0.5&&inHull(uInv0))||(uHide.y>0.5&&inHull(uInv1))) discard; vec2 p=vW.xz; float fd0=length(vW-uEye); float k0=1.0-smoothstep(120.0,520.0,fd0), k1=1.0-smoothstep(60.0,260.0,fd0), k2=1.0-smoothstep(25.0,110.0,fd0);\n' +
    ' vec2 g=0.10*k0*wv(p,normalize(vec2(1.0,0.3)),0.35,1.3)+0.07*k1*wv(p,normalize(vec2(-0.4,1.0)),0.6,1.9)+0.04*k2*wv(p,normalize(vec2(0.7,-0.7)),1.3,2.7)+0.02*k2*wv(p,normalize(vec2(0.2,0.9)),2.9,3.9);\n' +
    ' vec3 n=normalize(vec3(-g.x,1.0,-g.y)); vec3 v=normalize(uEye-vW); float fr=0.04+0.96*pow(1.0-max(dot(n,v),0.0),5.0);\n' +
    ' vec3 r=reflect(-v,n); vec3 sky=mix(uFog,uSky,clamp(r.y*1.6,0.0,1.0)); float sp=pow(max(dot(r,uSun),0.0),180.0)*1.6;\n' +
    ' vec3 deep=vec3(0.03,0.16,0.21); vec3 c=mix(deep,sky,fr)+vec3(1.0,0.92,0.75)*sp; float fd=length(vW-uEye);\n' +
    ' c=mix(c,uFog,1.0-exp(-fd*uFogD)); o=vec4(c,mix(0.86,1.0,clamp(fd/600.0,0.0,1.0))); }\n');
  P.sky = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec2 aP; uniform mat4 uInv; out vec3 vD; void main(){ vec4 a=uInv*vec4(aP,1.0,1.0); vD=a.xyz/a.w; gl_Position=vec4(aP,0.9999,1.0); }\n',
    '#version 300 es\nprecision highp float; in vec3 vD; uniform vec3 uEye,uSun,uFog,uSky; out vec4 o;\n' +
    'void main(){ vec3 d=normalize(vD-uEye); float h=clamp(d.y,0.0,1.0); vec3 c=mix(uFog,uSky,pow(h,0.55)); float s=max(dot(d,uSun),0.0);\n' +
    ' c+=vec3(1.0,0.85,0.6)*(pow(s,600.0)*3.0+pow(s,12.0)*0.18); if(d.y<0.0) c=uFog; o=vec4(c,1.0); }\n');
}
function setCommon(p) {
  var u = p.u;
  if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, CAM.vp);
  if (u.uSun) gl.uniform3fv(u.uSun, SUN);
  if (u.uEye) gl.uniform3fv(u.uEye, CAM.eye);
  if (u.uFog) gl.uniform3fv(u.uFog, HORIZON);
  if (u.uSky) gl.uniform3fv(u.uSky, SKY);
  if (u.uGround) gl.uniform3fv(u.uGround, GROUND);
  if (u.uFogD) gl.uniform1f(u.uFogD, 0.0016);
  if (u.uWater) gl.uniform1f(u.uWater, 0.0);
  if (u.uTint) gl.uniform1f(u.uTint, 0.0);
}

