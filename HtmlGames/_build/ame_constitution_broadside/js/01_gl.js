// ───────────────────────── WebGL ─────────────────────────
var cv = $('cv'), gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });   // 反鋸齒自己做（MSAA framebuffer，畫質設定；60_render.js targets）
function fail(msg) { var e = $('err'); e.style.display = 'block'; e.textContent = msg; $('load').textContent = msg; }
if (!gl) { fail('這個瀏覽器沒有 WebGL2，畫不出來。'); throw new Error('no WebGL2'); }   // 拆檔後這裡是閉包的頂層：throw ＝ 原本的 return（停下來）

var P = {};
// 陰影（畫質；60_render.js shadowPass）：每艘船一張陰影圖（太陽方向的正交投影，uShM[k]），收的那一點落在哪張就用哪張（都在 ⇒ 取暗的）；
//   全部放在同一個深度貼圖陣列 uShA（固定第 4 號）⇒ 船再多也只佔一個貼圖單元（TASK-0537：上限 8 艘時，每艘一張 ⇒ 片段著色器 16 個單元不夠）。
//   第 k 層 ＝ 陰影的第 k 格（60_render.js gpuSlots：視野裡最近的 GFX.shships 艘），只查前 uNS 層（0 ＝ 一層都不查）；
//   全局（沒排進去的船，uShG 開著才查）：矩陣 uShM[MAX_SHIPS]、層 uShGL（＝ uNS，緊接在後面 ⇒ 陣列只配用到的層數）、格子大 ⇒ 沿法線推得遠 uShOffG。
//   一對一 ⇒ 跟以前同一個值：min(2, s0, s1) ＝ min(s0, s1)（shOne 最大就是 2）。
//   uShOn ＝ 0 關、1 低（硬體 2×2）、2 高（再 4 點柔邊）；沿法線推出去 uShOff 公尺再比（⛔ 不推 ⇒ 平面上自己遮自己的條紋）；
//   陽光越斜推越遠（呼叫端把法線乘 1～3 倍：斜面在陰影圖上一格跨的深度大）。
// uClip：反射那一趟丟掉水面以下的（平常是 −10⁹）。
// uSunK：直射光的強度（天氣；晴天 1）—— 收陰影的地方都乘 shadowK，順便乘在這裡。
var NS_SH = String(MAX_SHIPS), NS_MK = String(MASK_NEAR);                // 著色器的陣列長度：陰影照 MAX_SHIPS（＋1 格全局）、船艙遮罩照 MASK_NEAR（00_core.js）
var SHADOW_GLSL = 'uniform highp sampler2DArrayShadow uShA; uniform mat4 uShM[' + (MAX_SHIPS + 1) + ']; uniform int uNS; uniform float uShOn, uShPx, uShOff, uShG, uShGL, uShOffG, uClip, uSunK;\n' +
  'float shOne(int k, float L, vec3 w){ vec4 p=uShM[k]*vec4(w,1.0); vec3 q=p.xyz*0.5+0.5;\n' +
  '  if(q.x<0.002||q.y<0.002||q.x>0.998||q.y>0.998||q.z>0.999) return 2.0; q.z-=0.0006;\n' +
  '  if(uShOn<1.5) return texture(uShA,vec4(q.xy,L,q.z));\n' +
  '  float e=uShPx*0.9; return 0.25*(texture(uShA,vec4(q.xy+vec2(-e,-e),L,q.z))+texture(uShA,vec4(q.xy+vec2(e,-e),L,q.z))+texture(uShA,vec4(q.xy+vec2(-e,e),L,q.z))+texture(uShA,vec4(q.xy+vec2(e,e),L,q.z))); }\n' +
  'float shadowK(vec3 w, vec3 n){ if(uShOn<0.5) return uSunK; vec3 p=w+n*uShOff; float m=2.0;' +
  ' for(int k=0;k<' + NS_SH + ';k++){ if(k>=uNS) break; m=min(m,shOne(k,float(k),p)); }' +
  ' if(uShG>0.5) m=min(m,shOne(' + NS_SH + ',uShGL,w+n*uShOffG)); return min(m,1.0)*uSunK; }\n';
// 船艙遮罩（海、船邊水花的白沫共用；要有 in vec3 vW）：那一點換到船的格座標，落在原本船殼的外形裡 ⇒ 呼叫端丟掉（HULL_HIT）。
//   遮罩照船型一層（uHullA：R8 貼圖陣列，每層 ＝ 那一型每個 (x, z) 船殼的半寬；固定第 1 號；60_render.js hullArr）；
//   格（60_render.js gpuSlots：視野裡最近的 GFX.masks 艘，最多 MASK_NEAR）：uInv[k]（世界 → 格）、uHullK[k] ＝ (那一型的寬, 高, 中線 y, 第幾層)、
//   uHide[k] ＝ 那艘還沒開始沉（60_render.js hullUniforms）。沒用到的那幾格 uHide 0 ⇒ 一比就跳過、不取樣。uNM ＝ 用到幾格（透視 nearAny 也照它）。
var HULL_GLSL = 'uniform mat4 uInv[' + NS_MK + ']; uniform float uHide[' + NS_MK + ']; uniform highp sampler2DArray uHullA; uniform vec4 uHullK[' + NS_MK + ']; uniform int uNM;\n' +
  'bool inHull(int k){ vec4 K=uHullK[k]; vec4 l=uInv[k]*vec4(vW,1.0); if(l.x<0.0||l.z<0.0||l.x>=K.x||l.z>=K.y) return false; float hb=texelFetch(uHullA,ivec3(int(l.x),int(l.z),int(K.w)),0).r*255.0; return hb>0.0 && abs(l.y-K.z)<hb; }\n' +
  'bool hullHit(){ for(int k=0;k<' + NS_MK + ';k++) if(uHide[k]>0.5&&inHull(k)) return true; return false; }\n';
var HULL_HIT = 'hullHit()';                                              // 落在哪一艘的船艙裡
// 剖面與隱藏甲板（停格；74_cutaway.js）：照船的格座標丟掉 —— uCut ＝ (中線 y, 剖哪一邊 ±1（0 ＝ 不剖）, 拿掉到第幾層（−1 ＝ 不拿）, 開關)；
//   uCutT：那艘船型每一層的切高（R32F，寬 ＝ 格的 x、高 ＝ 層；照舷弧逐欄），uCutW.x ＝ 寬。模型、繩、帆另給 uCutInv（世界 → 格）。
//   uCutT 一律指第 8 號（setCommon；沒開時綁 1×1 的空貼圖）：⛔ 預設的第 0 號 ⇒ 那一號綁著正在畫的畫布的貼圖時，整次繪製被丟掉（Feedback loop，量到 203 筆警告）——
//   就算分支沒走到，驅動照樣檢查程式裡每一個取樣器。
//   開著時水線下不染海水色（剖開、拿掉甲板看到的是艙內：⛔ 照染 ⇒ 沒進水的船底看起來像積了一層水）。
var CUT_GLSL = 'uniform highp sampler2D uCutT; uniform vec4 uCut; uniform vec2 uCutW;\n' +
  'bool cutOut(vec3 l){ if(uCut.w<0.5) return false; if(uCut.y*(l.y-uCut.x)>0.0) return true;\n' +
  '  return uCut.z>=0.0 && l.z>=texelFetch(uCutT,ivec2(clamp(int(floor(l.x)),0,int(uCutW.x)-1),int(uCut.z)),0).r; }\n';
// 點光源（Tim 2026-10-14「點燈」：夜燈號船首像的提燈 meta kind=light、餘燼號船尾的燈籠 kind=lantern；60_render.js lampsUpdate）：
//   最多 LAMP_N 盞（離鏡頭近的先）；uLP ＝ 世界座標＋照得到幾公尺、uLC ＝ 顏色×亮度。照亮船殼（voxFS）與模型（P.tri）：距離平方衰減到半徑為 0、朝著燈的面亮一點。⛔ 不投影子。
// 船殼上的燈（格子做的，不是模型；config/game.json ships[].lamps，Tim 2026-10-14：風暴角號船尾的燈改發綠光）：那艘船畫的時候 uVG ＝ 燈的中心（船的格座標）＋半徑、
//   uVGC ＝ 光色＋格子的顏色代碼（rgb332）⇒ 半徑內、顏色對得上的格子發光（60_render.js drawHulls 每艘設；斷開的那一團 ⇒ 0 盞）。
var VLAMP_N = 4, LAMP_N = 8, LAMP_GLSL = 'uniform vec4 uLP[' + LAMP_N + ']; uniform vec4 uLC[' + LAMP_N + ']; uniform int uLN; uniform vec4 uVG[' + VLAMP_N + ']; uniform vec4 uVGC[' + VLAMP_N + ']; uniform int uVGN; uniform float uVGK;\n' +
  'vec3 lampK(vec3 w, vec3 n){ vec3 s=vec3(0.0); for(int i=0;i<' + LAMP_N + ';i++){ if(i>=uLN) break; vec3 L=uLP[i].xyz-w; float d=length(L), a=clamp(1.0-d/uLP[i].w,0.0,1.0);\n' +
  ' s+=uLC[i].rgb*a*a*(0.35+0.65*max(dot(n,L/max(d,0.001)),0.0)); } return s; }\n';
function programs() {
  var cd = gl.createTexture(); gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, cd);   // 第 8 號：剖面切高的空貼圖（見 CUT_GLSL）
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([1e9]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.activeTexture(gl.TEXTURE0);
  P.vox = VK.compile(gl, VK.VOXEL_VS, voxFS());
  P.deb = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec4 iP; layout(location=3) in vec4 iQ; layout(location=4) in float iC;\n' +
    'uniform mat4 uVP; out vec3 vN; out vec3 vW; flat out float vC;\n' +
    'vec3 rq(vec4 q, vec3 v){ return v+2.0*cross(q.xyz, cross(q.xyz,v)+q.w*v); }\n' +
    'void main(){ float k=floor(iC/256.0); vec3 sc=k<0.5?vec3(1.0):k<1.5?vec3(3.2,1.1,0.22):k<2.5?vec3(2.3,1.5,0.22):vec3(4.6,0.8,0.25);\n' +   // DEB_SHAPES：形狀 ＝ iC 的 256 以上（12_effects.js D.sh）；片狀的碎塊長寬厚
    ' vec3 w=iP.xyz+rq(iQ,aP*iP.w*sc); vW=w; vN=rq(iQ,aN); vC=iC-k*256.0; gl_Position=uVP*vec4(w,1.0); }\n',
    '#version 300 es\nprecision highp float;\n' + SEA_GLSL + 'in vec3 vN; in vec3 vW; flat in float vC; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD,uLum; out vec4 o;\n' +
    'void main(){ uint c=uint(vC+0.5); vec3 b=vec3(float((c>>5u)&7u)/7.0,float((c>>2u)&7u)/7.0,float(c&3u)/3.0); vec3 n=normalize(vN);\n' +
    ' vec3 col=b*(mix(uGround,uSky,n.y*0.5+0.5)*0.62+vec3(1.0,0.96,0.88)*max(dot(n,uSun),0.0)*0.78);\n' +
    ' col*=uLum; if(vW.y<seaH(vW.xz)) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
  P.tri = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; uniform mat4 uModel,uVP; out vec3 vN; out vec3 vW; out vec3 vC;\n' +
    'void main(){ vec4 w=uModel*vec4(aP,1.0); vW=w.xyz; vN=mat3(uModel)*aN; vC=aC; gl_Position=uVP*w; }\n',
    '#version 300 es\nprecision highp float;\n' + SEA_GLSL + SHADOW_GLSL + CUT_GLSL + LAMP_GLSL + 'in vec3 vN; in vec3 vW; in vec3 vC; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD,uLit,uGlow; uniform mat4 uCutInv; out vec4 o;\n' +
    'void main(){ if(vW.y<uClip) discard; if(uCut.w>0.5 && cutOut((uCutInv*vec4(vW,1.0)).xyz)) discard; vec3 n=normalize(vN); float sd=dot(n,uSun), d=abs(sd); vec3 col=vC;\n' +
    ' if(uLit>0.5){ d*=shadowK(vW,(sd<0.0?-n:n)*(3.0-2.0*d)); col=vC*(mix(uGround,uSky,0.6)*0.65+vec3(1.0,0.96,0.88)*d*0.7); }\n' +
    ' if(uLN>0) col+=vC*lampK(vW,n);\n' +                                 // 點光源
    // 燈籠（meta kind=lantern；drawModels 設 uGlow）：只有琥珀色的燈罩發光（色 245 ＝ 1, .71, .33）—— 金框（248，藍 0）、暗紅（128）照常受光
    ' if(uGlow>0.0) col=mix(col,vC*1.2+vec3(0.3,0.14,0.0),uGlow*step(0.9,vC.r)*step(0.2,vC.b)*step(vC.b,0.5));\n' +
    ' if(uCut.w<0.5 && vW.y<seaH(vW.xz)) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
  // 帆：頂點法線（平滑，不是一個三角形一個平面）；法線翻向看的那一面；包覆光（背光面不死黑、明暗過渡慢）＋太陽在帆後面時布透出暖光
  // 有貼圖的帆（TASK-0579）：aT ＝ 貼圖集的 uv（11_rig_gpu.js sailBuf；u < 0 ＝ 沒有貼圖，照頂點色）；片段照貼圖取色、alpha < 0.5（已照 alpha_min 二值化）⇒ discard ＝ 洞
  P.sail = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in vec2 aT; uniform mat4 uModel,uVP; out vec3 vN; out vec3 vW; out vec3 vC; out vec2 vT;\n' +
    'void main(){ vec4 w=uModel*vec4(aP,1.0); vW=w.xyz; vN=mat3(uModel)*aN; vC=aC; vT=aT; gl_Position=uVP*w; }\n',
    '#version 300 es\nprecision highp float;\n' + SEA_GLSL + SHADOW_GLSL + CUT_GLSL + 'in vec3 vN; in vec3 vW; in vec3 vC; in vec2 vT; uniform vec3 uSun,uEye,uFog,uSky,uGround; uniform float uFogD; uniform mat4 uCutInv; uniform sampler2D uSailT; out vec4 o;\n' +
    'void main(){ if(vW.y<uClip) discard; vec3 bc=vC; if(vT.x>=0.0){ vec4 t=texture(uSailT,vT); if(t.a<0.5) discard; bc=t.rgb; }\n' +
    ' if(uCut.w>0.5 && cutOut((uCutInv*vec4(vW,1.0)).xyz)) discard; vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n; float s=dot(n,uSun), sk=shadowK(vW,(s<0.0?-n:n)*(3.0-2.0*abs(s)));\n' +
    ' float lit=max(s,0.0)*0.45*sk+(s*0.5+0.5)*0.32*(0.55+0.45*sk); float thru=max(-s,0.0)*0.30*sk;\n' +
    ' vec3 col=bc*(mix(uGround,uSky,n.y*0.5+0.5)*0.62+vec3(1.0,0.96,0.88)*lit)+bc*vec3(1.0,0.88,0.66)*thru;\n' +
    ' if(uCut.w<0.5 && vW.y<seaH(vW.xz)) col=mix(col,vec3(0.04,0.18,0.22),0.6); float fd=length(vW-uEye); o=vec4(mix(col,uFog,1.0-exp(-fd*uFogD)),1.0); }\n');
  P.pt = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in float aS; layout(location=2) in vec4 aC; layout(location=3) in float aT; uniform mat4 uVP; uniform float uPx; out vec4 vC; out float vT; out float vR;\n' +
    'void main(){ vec4 c=uVP*vec4(aP,1.0); gl_Position=c; gl_PointSize=clamp(aS*uPx/max(c.w,0.1),1.0,256.0); vC=aC; vT=aT; vR=aP.y*0.9+aT*1.7; }\n',
    // 類型 4（vT ≥ 16）＝ 帆的布片：程式畫的菱形，角度跟著高度轉、側過來時變窄（像在翻）；fx.png 沒有這一列 ⇒ 一律程式畫
    '#version 300 es\nprecision highp float; in vec4 vC; in float vT; in float vR; uniform sampler2D uFx; uniform float uUseFx; out vec4 o;\n' +
    'void main(){ if(vT>=16.0){ vec2 d=gl_PointCoord*2.0-1.0; float cr=cos(vR), sr=sin(vR); vec2 q=vec2(cr*d.x-sr*d.y, sr*d.x+cr*d.y);\n' +
    '   float fl=0.3+0.7*abs(sin(vR*0.7)); if(abs(q.x)/(0.95*fl)+abs(q.y)/(0.5+0.12*(vT-16.0))>1.0) discard; o=vec4(vC.rgb*(0.75+0.25*fl),vC.a); return; }\n' +
    ' if(uUseFx>0.5 && vT>=0.0){ float ty=floor(vT/4.0), va=vT-ty*4.0; vec4 t=texture(uFx,(vec2(va,ty)+gl_PointCoord)/4.0); if(t.a<0.02) discard; o=vec4(t.rgb,t.a*vC.a); return; }\n' +
    ' vec2 d=gl_PointCoord*2.0-1.0; float r=dot(d,d); if(r>1.0) discard; float a=vC.a*(1.0-r*r); o=vec4(vC.rgb*(1.0-0.25*r),a); }\n');
  // 海：跟著鏡頭的同心圓網格（60_render.js seaGrid；aP ＝ 離中心的 x、z 與那一圈的網格間距），頂點照浪位移（08_sea.js；比網格粗的浪拿掉、1 km 外放平）；
  //   法線在片段裡照解析的坡度算（seaG，遠處淡掉）＋細的漣漪 uDet 道（畫質）—— 漣漪只在畫面上，不進物理。
  P.water = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec3 aP; uniform mat4 uVP; uniform vec2 uC;\n' + SEA_GLSL +
    'out vec3 vW; void main(){ vec2 p=uC+aP.xy; float h=seaHs(p,aP.z)*(1.0-smoothstep(900.0,1600.0,length(aP.xy))); vW=vec3(p.x,h,p.y); gl_Position=uVP*vec4(vW,1.0); }\n',
    '#version 300 es\nprecision highp float; in vec3 vW; uniform vec3 uEye,uSun,uFog,uSky; uniform float uFogD,uDet,uReflOn,uRefr,uFoam; uniform vec2 uView; uniform sampler2D uRefl,uScene,uSceneD; out vec4 o;\n' + SEA_GLSL + SHADOW_GLSL +
    // 反射（uReflOn）：RT.R 是鏡像過來的船，照螢幕座標＋法線擾動讀，沒畫到的地方（a ＝ 0）照舊是天空。
    // 折射（uRefr）：0 不透明、1 半透明（底下的照舊混進來）、2 讀 RT.B（畫海之前的場景）：照法線擾動、照水的厚度（兩個深度相減）吸收成海的顏色。
    'float linZ(float d){ float z=d*2.0-1.0; return 5000.0/(5000.5-z*4999.5); }\n' +
    // 船艙裡不畫海（HULL_GLSL）：海面那一點落在原本船殼的外形裡 ⇒ 丟掉
    HULL_GLSL +
    // 細浪（只在畫面）：uDet 道，波長從 7 m 往下每道 ×0.8 再亂一點、方向在風向 ±70° 亂撒、相位亂撒（雜湊，不抽亂數）⇒ 不成整數比、不會一格一格重複；
    // 每道照像素寬 fp 淡掉（遠處自動變平滑，不疊紋）；再乘一層慢慢飄的雜訊 ⇒ 海面一塊皺、一塊平（陣風吹過的樣子）。
    'float hs1(float n){ return fract(sin(n*12.9898)*43758.5453); }\n' +
    'float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=hs1(dot(i,vec2(1.0,57.0))), b=hs1(dot(i+vec2(1.0,0.0),vec2(1.0,57.0))), c=hs1(dot(i+vec2(0.0,1.0),vec2(1.0,57.0))), d=hs1(dot(i+vec2(1.0,1.0),vec2(1.0,57.0))); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }\n' +
    'vec2 detail(vec2 p,float fp){ vec2 g=vec2(0.0); float L=7.0, st=0.07;\n' +
    '  for(int i=0;i<16;i++){ if(float(i)>=uDet) break; float fi=float(i)+1.0; float l=L*(0.85+0.3*hs1(fi*3.1)); float k=6.2832/l, a=SEA_WA+(hs1(fi*7.7)-0.5)*2.4; vec2 d=vec2(cos(a),sin(a));\n' +
    '    g+=d*st*(1.0-smoothstep(0.25*l,0.6*l,fp))*cos(dot(p,d)*k-sqrt(9.81*k)*uSeaT+hs1(fi*5.3)*6.2832); L*=0.8; st*=0.88; }\n' +
    '  return g*(0.45+1.1*vn(p*0.025+vec2(uSeaT*0.013,uSeaT*0.007))); }\n' +
    // 停格的「🔍 透視」（72_floodui.js）：船附近的海面不畫 ⇒ 看得到水線下的船殼與破口。uXb ＝ 那艘船型在格座標的中心與半長、半寬（xrBox），再往外 6 m（60 格）；uXr ＝ 0 ⇒ 照原本畫
    'uniform float uXr; uniform vec4 uXb[' + NS_MK + ']; bool nearShip(int k){ vec4 b=uXb[k]; vec4 l=uInv[k]*vec4(vW,1.0); vec2 q=abs(l.xy-b.xy)-b.zw; return length(max(q,vec2(0.0)))<60.0; }\n' +
    'bool nearAny(){ for(int k=0;k<' + NS_MK + ';k++){ if(k>=uNM) break; if(nearShip(k)) return true; } return false; }\n' +
    'void main(){ if(' + HULL_HIT + ') discard; if(uXr>0.5&&nearAny()) discard; vec2 p=vW.xz; float fd0=length(vW-uEye); float k0=1.0-smoothstep(300.0,1400.0,fd0), k1=1.0-smoothstep(60.0,260.0,fd0), k2=1.0-smoothstep(25.0,110.0,fd0);\n' +
    ' vec2 dd=fwidth(vW.xz); float fp=max(dd.x,dd.y);\n' +
    ' vec2 g=seaGf(p,fp)+detail(p,fp);\n' +
    ' vec3 n=normalize(vec3(-g.x,1.0,-g.y)); vec3 v=normalize(uEye-vW); float fr=0.04+0.96*pow(1.0-max(dot(n,v),0.0),5.0);\n' +
    ' vec3 r=reflect(-v,n); vec3 sky=mix(uFog,uSky,clamp(r.y*1.6,0.0,1.0)); vec2 sc=gl_FragCoord.xy/uView; float sk=shadowK(vW,vec3(0.0,1.0,0.0));\n' +
    ' if(uReflOn>0.5){ vec4 rc=textureLod(uRefl,sc+n.xz*0.035,0.0); sky=mix(sky,rc.rgb,rc.a); }\n' +
    ' float sp=pow(max(dot(r,uSun),0.0),180.0)*1.6*sk; float fd=length(vW-uEye), a=mix(0.86,1.0,clamp(fd/600.0,0.0,1.0));\n' +
    ' vec3 deep=vec3(0.03,0.16,0.21)*mix(0.72,1.0,sk);\n' +
    ' if(uRefr<0.5) a=1.0; else if(uRefr>1.5){ float zw=linZ(gl_FragCoord.z); vec2 off=n.xz*0.045; float zs=linZ(textureLod(uSceneD,sc+off,0.0).r);\n' +
    '   if(zs<zw){ off=vec2(0.0); zs=linZ(textureLod(uSceneD,sc,0.0).r); } float th=max(zs-zw,0.0);\n' +
    '   vec3 under=textureLod(uScene,sc+off,0.0).rgb*vec3(0.55,0.86,0.92); deep=mix(deep,under,exp(-th*0.3)*clamp(1.0-fd/500.0,0.0,1.0)); a=1.0; }\n' +
    ' vec3 c=mix(deep,sky,fr)+vec3(1.0,0.92,0.75)*sp;\n' +
    // 白沫（天氣：暴風雨）：浪頭（高度在全部振幅的 40% 以上）照一層慢慢飄的雜訊碎成一塊一塊；晴天 uFoam ＝ 0 ⇒ 整段跳過（畫面逐位元組不變）
    ' if(uFoam>0.0){ float hn=seaH(p)/max(uSeaK*1.14,1e-3); float fm=smoothstep(0.4,0.8,hn)*smoothstep(0.3,0.7,vn(p*0.16+vec2(uSeaT*0.05,0.0)))+0.25*smoothstep(0.6,0.9,vn(p*0.9-vec2(0.0,uSeaT*0.2)))*smoothstep(0.2,0.6,hn);\n' +
    '   c=mix(c,vec3(0.82,0.86,0.88)*(0.55+0.45*uSunK),clamp(fm,0.0,1.0)*0.8*uFoam*(1.0-smoothstep(200.0,900.0,fd))); }\n' +
    ' c=mix(c,uFog,1.0-exp(-fd*uFogD)); o=vec4(c,a); }\n');
  // 雨（天氣 × 畫質的「雨」）：整個畫面一層斜的雨絲，三層遠近（越近越粗越快）；欄位照雜湊挑哪幾欄有雨、每欄的相位亂撒。鏡頭轉的時候雨絲跟著水平滑（uYaw）。
  P.rain = VK.compile(gl, '#version 300 es\nlayout(location=0) in vec2 aP; void main(){ gl_Position=vec4(aP,0.0,1.0); }\n',
    '#version 300 es\nprecision highp float; uniform float uT,uRain,uYaw; uniform vec2 uView; out vec4 o;\n' +
    'float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }\n' +
    'float lay(vec2 uv,float sc,float sp,float th){ vec2 q=uv*sc; q.x+=q.y*0.16; float col=floor(q.x), h=h1(col+sc*17.0); if(h<th) return 0.0;\n' +
    '  float y=fract(q.y*0.05+uT*sp*(0.75+0.5*h)+h*7.0); float w=1.0-smoothstep(0.0,0.12,abs(fract(q.x)-0.5)); return w*smoothstep(0.0,0.1,y)*smoothstep(0.4,0.12,y); }\n' +
    'void main(){ vec2 uv=gl_FragCoord.xy/uView.y; uv.x+=uYaw*0.5; float th=1.0-0.55*uRain;\n' +
    ' float a=lay(uv,90.0,1.6,th)*0.35+lay(uv,55.0,1.25,th)*0.5+lay(uv,32.0,0.95,th)*0.65; o=vec4(vec3(0.78,0.82,0.86),clamp(a,0.0,1.0)*0.45*uRain); }\n');
  // 只寫深度（陰影圖）：體素照 VoxelKit 的頂點著色器、模型與帆共用一支
  var NOFS = '#version 300 es\nprecision highp float; void main(){}\n';
  P.dvox = VK.compile(gl, VK.VOXEL_VS, NOFS);
  P.dtri = VK.compile(gl, '#version 300 es\nlayout(location=0) in vec3 aP; uniform mat4 uModel,uVP; void main(){ gl_Position=uVP*(uModel*vec4(aP,1.0)); }\n', NOFS);
  // 帆的陰影（TASK-0579）：貼圖的洞不投影子（同 P.sail 的 discard）
  P.dsail = VK.compile(gl, '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=3) in vec2 aT; uniform mat4 uModel,uVP; out vec2 vT; void main(){ vT=aT; gl_Position=uVP*(uModel*vec4(aP,1.0)); }\n',
    '#version 300 es\nprecision highp float; in vec2 vT; uniform sampler2D uSailT; void main(){ if(vT.x>=0.0 && texture(uSailT,vT).a<0.5) discard; }\n');
  P.sky = VK.compile(gl,
    '#version 300 es\nlayout(location=0) in vec2 aP; uniform mat4 uInv; out vec3 vD; void main(){ vec4 a=uInv*vec4(aP,1.0,1.0); vD=a.xyz/a.w; gl_Position=vec4(aP,0.9999,1.0); }\n',
    '#version 300 es\nprecision highp float; in vec3 vD; uniform vec3 uEye,uSun,uFog,uSky; out vec4 o;\n' +
    'void main(){ vec3 d=normalize(vD-uEye); float h=clamp(d.y,0.0,1.0); vec3 c=mix(uFog,uSky,pow(h,0.55)); float s=max(dot(d,uSun),0.0);\n' +
    ' c+=vec3(1.0,0.85,0.6)*(pow(s,600.0)*3.0+pow(s,12.0)*0.18); if(d.y<0.0) c=uFog; o=vec4(c,1.0); }\n');
}
function setCommon(p) {
  var u = p.u;
  if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, PASS.vp || CAM.vp);          // PASS：反射、陰影那一趟換掉（60_render.js）
  if (u.uSun) gl.uniform3fv(u.uSun, SUN);
  if (u.uEye) gl.uniform3fv(u.uEye, PASS.eye || CAM.eye);
  if (u.uFog) gl.uniform3fv(u.uFog, HORIZON);
  if (u.uSky) gl.uniform3fv(u.uSky, SKY);
  if (u.uGround) gl.uniform3fv(u.uGround, GROUND);
  if (u.uFogD) gl.uniform1f(u.uFogD, WX.fog);                   // 霧（天氣：晴 0.0016、暴風雨 0.0042）
  if (u.uWater) gl.uniform1f(u.uWater, 0.0);
  if (u.uTint) gl.uniform1f(u.uTint, 0.0);
  if (u.uSeaK) gl.uniform1f(u.uSeaK, SEA_K * WX.sea);                  // 浪（08_sea.js）：大小、時間（模擬時間 ⇒ 暫停時浪也停）
  if (u.uSeaT) gl.uniform1f(u.uSeaT, SIMT);
  if (u.uSeaA) gl.uniform1f(u.uSeaA, SEA_A);                           // 這一場的風轉了多少，浪跟著轉（08_sea.js）
  if (u.uClip) gl.uniform1f(u.uClip, PASS.clip);
  if (u.uCutT) gl.uniform1i(u.uCutT, 8);                       // 剖面的切高貼圖（74_cutaway.js）：固定第 8 號
  if (u.uSunK) gl.uniform1f(u.uSunK, WX.sun);                   // 天氣（08_weather.js）：陽光、水手與碎木的亮度、白沫
  if (u.uLum) gl.uniform1f(u.uLum, WX.lum);
  if (u.uLN) { gl.uniform1i(u.uLN, LAMPS.n); if (LAMPS.n) { gl.uniform4fv(u.uLP, LAMPS.p); gl.uniform4fv(u.uLC, LAMPS.c); } }   // 點光源（60_render.js lampsUpdate；沒有 uLN 的著色器 ＝ 陰影那一趟 ⇒ 不給）
  if (u.uFoam) gl.uniform1f(u.uFoam, WX.foam);
  if (u.uNS) gl.uniform1i(u.uNS, SSLOTS.length);               // 陰影用到幾格（60_render.js gpuSlots）
  if (u.uNM) gl.uniform1i(u.uNM, MSLOTS.length);               // 船艙遮罩、透視用到幾格
  if (u.uShOn) {                                              // 陰影圖陣列綁在第 4 號（60_render.js render 開頭綁）；每一層的矩陣一次給（沒用到的 ＝ FAR_M）
    gl.uniform1f(u.uShOn, PASS.sh ? GFX.shadow : 0);
    gl.uniform1i(u.uShA, 4); gl.uniformMatrix4fv(u.uShM, false, SHM.mats);
    gl.uniform1f(u.uShPx, 1 / SHM.n); gl.uniform1f(u.uShOff, SHM.off);
    gl.uniform1f(u.uShG, SHM.glob ? 1 : 0); gl.uniform1f(u.uShGL, SSLOTS.length); gl.uniform1f(u.uShOffG, SHM.offG);
  }
}
/** 船殼的著色器：VoxelKit 那一份＋這個遊戲要的（水下的顏色照浪的水面）。⛔ 不改 VoxelKit（別的作品也用）；找不到要換的那一段 ⇒ 照原本的畫。 */
function voxFS() {
  var s = VK.VOXEL_FS, a = 'out vec4 o;', b = 'if(vW.y<uWater){ float dd=clamp((uWater-vW.y)*0.12', c = 'float di=max(dot(n,uSun),0.0);', d = 'void main(){', e = 'vec3 c=base*(amb*0.62+vec3(1.0,0.96,0.88)*di*0.78);';
  if ([a, b, c, d, e].some(function (x) { return s.indexOf(x) < 0; })) { console.warn('VoxelKit 的體素著色器改過了：船殼不跟著浪著色、不收陰影、不吃點光源'); return s; }
  return s.replace(e, e + ' if(uLN>0) c+=base*lampK(vW,n); if(uVGN>0){ for(int i=0;i<' + VLAMP_N + ';i++){ if(i>=uVGN) break; if(abs(float(vC)-uVGC[i].w)<0.5 && distance(vL,uVG[i].xyz)<uVG[i].w) c=mix(c,base*0.35+uVGC[i].rgb*1.15,uVGK); } }').replace(a, SEA_GLSL + SHADOW_GLSL + CUT_GLSL + LAMP_GLSL + a).replace(b, 'float wy=uWater+seaH(vW.xz); if(uCut.w<0.5 && vW.y<wy){ float dd=clamp((wy-vW.y)*0.12')
    .replace(c, 'float di=max(dot(n,uSun),0.0); if(di>0.0) di*=shadowK(vW,n*(3.0-2.0*di));').replace(d, d + ' if(vW.y<uClip) discard; if(cutOut(vL)) discard;');   // cutOut：剖面與隱藏甲板（vL ＝ 格座標）
}

