// ───────────────────────── 鏡頭 ─────────────────────────
var CAM = { yaw: 2.2, pitch: 0.24, dist: 175, tgt: [0, 6, 0], eye: [0, 0, 0], vp: null, inv: null, mode: 4, follow: null, hold: 0, w: 1, h: 1, track: true, aoff: 0 };
var CAM_NAMES = ['自由鏡頭', '追砲彈', '看敵艦', '看我艦', '我艦→敵艦'];
var CAM_ORDER = [4, 0, 1, 2, 3];                 // C 鍵循環的順序：我艦→敵艦（預設）→ 自由 → 追砲彈 → 看敵艦 → 看我艦
function camUpdate(dt) {
  // 我艦→敵艦（預設，mode 4）：注視點 ＝ 我艦中心（略高），鏡頭在我艦背對敵艦的那一側 ⇒ 畫面中間是我艦、敵艦在它後方；
  // 兩艘繞著彼此轉時鏡頭跟著轉。拖曳改的是相對這條視線的角度（aoff）與俯仰，滾輪改遠近。沒有敵艦 ⇒ 看船頭方向。
  if (CAM.mode === 4 && SHIPS.length) {
    var m4 = SHIPS[PLAYER_I], f4 = SHIPS[1 - PLAYER_I], c4 = m4.center || shipCenter(m4), fc = f4 && (f4.center || shipCenter(f4));
    var a4 = fc && Math.hypot(fc[0] - c4[0], fc[2] - c4[2]) > 1 ? Math.atan2(fc[2] - c4[2], fc[0] - c4[0]) : Math.atan2(-Math.sin(m4.yaw), Math.cos(m4.yaw));
    var y4 = a4 + Math.PI + CAM.aoff, t4 = [c4[0], c4[1] + 4, c4[2]];
    var e4 = [t4[0] + Math.cos(y4) * Math.cos(CAM.pitch) * CAM.dist, t4[1] + Math.sin(CAM.pitch) * CAM.dist, t4[2] + Math.sin(y4) * Math.cos(CAM.pitch) * CAM.dist];
    if (e4[1] < 1.5) e4[1] = 1.5;
    var k4 = CAM.snap ? 1 : 1 - Math.exp(-dt * 4); CAM.snap = false;
    CAM.eye = lerp3(CAM.eye, e4, k4); CAM.look = lerp3(CAM.look || t4, t4, k4); CAM.trMe = CAM.trYaw = null;
    var pr4 = M4.persp(0.9, CAM.w / CAM.h, 0.5, 5000); CAM.vp = M4.mul(pr4, M4.lookAt(CAM.eye, CAM.look, [0, 1, 0])); CAM.inv = M4.inv(CAM.vp);
    return;
  }
  // 鏡頭跟船（預設；V 關掉 ⇒ 固定在世界上）：跟著那艘移動、旋轉 —— 拖曳改的是相對船頭的角度、偏移與遠近。
  // 自由鏡頭的注視點照我艦平移＋繞我艦中心轉；鏡頭角度跟著被看的那艘轉（看敵艦 ⇒ 敵艦，其他 ⇒ 我艦）。
  // ⛔ 跟兩艘的中點：兩艘繞著中點轉圈 ⇒ 中點幾乎不動，看起來像沒在跟。
  // 角度慣例：鏡頭 yaw 是 (x, z) 平面上 atan2(z, x)；船頭方向的這個角 ＝ −sh.yaw ⇒ 船 yaw 增 Δ，鏡頭 yaw 減 Δ。
  if (SHIPS.length === 2 && CAM.track) {
    var me = SHIPS[PLAYER_I], mc = me.center || shipCenter(me);
    if (CAM.trMe) {
      var d0 = -(me.yaw - CAM.trMe.yaw), c0 = Math.cos(d0), s0 = Math.sin(d0), ox = CAM.tgt[0] - CAM.trMe.c[0], oz = CAM.tgt[2] - CAM.trMe.c[2];
      CAM.tgt[0] = mc[0] + ox * c0 - oz * s0; CAM.tgt[2] = mc[2] + ox * s0 + oz * c0;
    }
    CAM.trMe = { yaw: me.yaw, c: mc.slice() };
    var ts = SHIPS[CAM.mode === 2 ? 1 - PLAYER_I : PLAYER_I];
    if (CAM.trYaw && CAM.trYaw.i === ts.i) CAM.yaw -= ts.yaw - CAM.trYaw.yaw;
    CAM.trYaw = { i: ts.i, yaw: ts.yaw };
  } else CAM.trMe = CAM.trYaw = null;
  var tgt = CAM.tgt, dist = CAM.dist, yaw = CAM.yaw, pitch = CAM.pitch, eye;
  if (CAM.mode === 1 && CAM.follow) {
    var b = CAM.follow, vd = norm(b.v);
    eye = add(sub(b.p, mul(vd, 9)), [0, 2.2, 0]); tgt = add(b.p, mul(vd, 25));
    CAM.eye = lerp3(CAM.eye, eye, 1 - Math.exp(-dt * 10)); CAM.look = lerp3(CAM.look || tgt, tgt, 1 - Math.exp(-dt * 10));
  } else {
    if (CAM.mode === 2 || CAM.mode === 3) { var sh = SHIPS[CAM.mode === 2 ? 1 - PLAYER_I : PLAYER_I]; if (sh) tgt = shipCenter(sh); }
    eye = [tgt[0] + Math.cos(yaw) * Math.cos(pitch) * dist, tgt[1] + Math.sin(pitch) * dist, tgt[2] + Math.sin(yaw) * Math.cos(pitch) * dist];
    if (eye[1] < 1.5) eye[1] = 1.5;
    var k = CAM.snap ? 1 : 1 - Math.exp(-dt * 6); CAM.snap = false;
    CAM.eye = lerp3(CAM.eye, eye, k); CAM.look = lerp3(CAM.look || tgt, tgt, k);
  }
  var proj = M4.persp(0.9, CAM.w / CAM.h, 0.5, 5000), view = M4.lookAt(CAM.eye, CAM.look, [0, 1, 0]);
  CAM.vp = M4.mul(proj, view); CAM.inv = M4.inv(CAM.vp);
}
function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

