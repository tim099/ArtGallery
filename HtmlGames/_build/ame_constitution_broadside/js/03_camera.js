// ───────────────────────── 鏡頭 ─────────────────────────
var CAM = { yaw: 2.2, pitch: 0.24, dist: 175, tgt: [0, 6, 0], eye: [0, 0, 0], vp: null, inv: null, mode: 4, follow: null, hold: 0, w: 1, h: 1, track: true, aoff: 0, pan: [0, 0], see: null };
/** 跟船的鏡頭看哪一艘：看敵艦（2）⇒ 我艦的目標；看我艦（3）⇒ CAM.see（詳細資訊的「🎥 看這艘」；Tim 2026-10-14）或我艦；追砲彈沒在追（1）⇒ 我艦。 */
function camShip() {
  var me = SHIPS[PLAYER_I];
  if (CAM.mode === 2) return foeOf(me) || me;
  if (CAM.mode === 3 && CAM.see && SHIPS.indexOf(CAM.see) >= 0) return CAM.see;
  return me;
}
/** 跟船的鏡頭的平移（右鍵拖曳、兩指拖曳；Tim 2026-10-14：拖完不要換成自由鏡頭）：CAM.pan ＝ [往船頭, 往右舷] 公尺，照那艘船的方向 ⇒ 船轉彎偏移跟著轉。換鏡頭（C）、重新開始 ⇒ 歸零。 */
function camPan(sh) { if (!sh || (!CAM.pan[0] && !CAM.pan[1])) return [0, 0, 0]; var F = fwd(sh.yaw); return [F[0] * CAM.pan[0] - F[2] * CAM.pan[1], 0, F[2] * CAM.pan[0] + F[0] * CAM.pan[1]]; }
var CAM_NAMES = ['自由鏡頭', '追砲彈', '看敵艦', '看我艦', '我艦→敵艦'];
var CAM_ORDER = [4, 0, 1, 2, 3];                 // C 鍵循環的順序：我艦→敵艦（預設）→ 自由 → 追砲彈 → 看敵艦 → 看我艦
function camUpdate(dt) {
  // 我艦→敵艦（預設，mode 4）：注視點 ＝ 我艦中心（略高），鏡頭在我艦背對敵艦的那一側 ⇒ 畫面中間是我艦、敵艦在它後方；
  // 兩艘繞著彼此轉時鏡頭跟著轉。拖曳改的是相對這條視線的角度（aoff）與俯仰，滾輪改遠近。沒有敵艦 ⇒ 看船頭方向。
  if (CAM.mode === 4 && SHIPS.length) {
    var m4 = SHIPS[PLAYER_I], f4 = foeOf(m4), c4 = m4.center || shipCenter(m4), fc = f4 && (f4.center || shipCenter(f4));
    var a4 = fc && Math.hypot(fc[0] - c4[0], fc[2] - c4[2]) > 1 ? Math.atan2(fc[2] - c4[2], fc[0] - c4[0]) : Math.atan2(-Math.sin(m4.yaw), Math.cos(m4.yaw));
    var o4 = camPan(m4), y4 = a4 + Math.PI + CAM.aoff, t4 = [c4[0] + o4[0], c4[1] + 4, c4[2] + o4[2]];
    var e4 = [t4[0] + Math.cos(y4) * Math.cos(CAM.pitch) * CAM.dist, t4[1] + Math.sin(CAM.pitch) * CAM.dist, t4[2] + Math.sin(y4) * Math.cos(CAM.pitch) * CAM.dist];
    var e4s = seaH(e4[0], e4[2], SIMT) + 1.5; if (e4[1] < e4s) e4[1] = e4s;          // 鏡頭不鑽到浪底下
    var k4 = CAM.snap ? 1 : 1 - Math.exp(-dt * 4); CAM.snap = false;
    CAM.eye = lerp3(CAM.eye, e4, k4); CAM.look = lerp3(CAM.look || t4, t4, k4); CAM.trMe = CAM.trYaw = null;
    var pr4 = M4.persp(0.9, CAM.w / CAM.h, 0.5, 5000); CAM.vp = M4.mul(pr4, M4.lookAt(CAM.eye, CAM.look, [0, 1, 0])); CAM.inv = M4.inv(CAM.vp);
    return;
  }
  // 鏡頭跟船（預設；V 關掉 ⇒ 固定在世界上）：跟著那艘移動、旋轉 —— 拖曳改的是相對船頭的角度、偏移與遠近。
  // 自由鏡頭的注視點照我艦平移＋繞我艦中心轉；鏡頭角度跟著被看的那艘轉（看敵艦 ⇒ 敵艦，其他 ⇒ 我艦）。
  // ⛔ 跟兩艘的中點：兩艘繞著中點轉圈 ⇒ 中點幾乎不動，看起來像沒在跟。
  // 角度慣例：鏡頭 yaw 是 (x, z) 平面上 atan2(z, x)；船頭方向的這個角 ＝ −sh.yaw ⇒ 船 yaw 增 Δ，鏡頭 yaw 減 Δ。
  if (SHIPS.length >= 2 && CAM.track) {
    var me = SHIPS[PLAYER_I], mc = me.center || shipCenter(me);
    if (CAM.trMe) {
      var d0 = -(me.yaw - CAM.trMe.yaw), c0 = Math.cos(d0), s0 = Math.sin(d0), ox = CAM.tgt[0] - CAM.trMe.c[0], oz = CAM.tgt[2] - CAM.trMe.c[2];
      CAM.tgt[0] = mc[0] + ox * c0 - oz * s0; CAM.tgt[2] = mc[2] + ox * s0 + oz * c0;
    }
    CAM.trMe = { yaw: me.yaw, c: mc.slice() };
    var ts = camShip() || me;
    if (CAM.trYaw && CAM.trYaw.i === ts.i) CAM.yaw -= ts.yaw - CAM.trYaw.yaw;
    CAM.trYaw = { i: ts.i, yaw: ts.yaw };
  } else CAM.trMe = CAM.trYaw = null;
  var tgt = CAM.tgt, dist = CAM.dist, yaw = CAM.yaw, pitch = CAM.pitch, eye;
  if (CAM.mode === 1 && CAM.follow) {
    var b = CAM.follow, vd = norm(b.v);
    eye = add(sub(b.p, mul(vd, 9)), [0, 2.2, 0]); tgt = add(b.p, mul(vd, 25));
    CAM.eye = lerp3(CAM.eye, eye, 1 - Math.exp(-dt * 10)); CAM.look = lerp3(CAM.look || tgt, tgt, 1 - Math.exp(-dt * 10));
  } else {
    if (CAM.mode >= 1 && CAM.mode <= 3) { var sh = camShip(); if (sh) tgt = add(shipCenter(sh), camPan(sh)); }   // 追砲彈沒有在追的 ⇒ 跟看我艦一樣
    eye = [tgt[0] + Math.cos(yaw) * Math.cos(pitch) * dist, tgt[1] + Math.sin(pitch) * dist, tgt[2] + Math.sin(yaw) * Math.cos(pitch) * dist];
    var eys = seaH(eye[0], eye[2], SIMT) + 1.5; if (eye[1] < eys) eye[1] = eys;
    var k = CAM.snap ? 1 : 1 - Math.exp(-dt * 6); CAM.snap = false;
    CAM.eye = lerp3(CAM.eye, eye, k); CAM.look = lerp3(CAM.look || tgt, tgt, k);
  }
  var proj = M4.persp(0.9, CAM.w / CAM.h, 0.5, 5000), view = M4.lookAt(CAM.eye, CAM.look, [0, 1, 0]);
  CAM.vp = M4.mul(proj, view); CAM.inv = M4.inv(CAM.vp);
}
function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
// 追砲彈（mode 1；Tim 2026-10-13）：只追我艦打的（觀戰也是）；追著的那顆打中或落水才換（落點停 1.2 秒，CAM.hold）。
//   挑下一顆的時機：這輪齊射打完（最新那顆飛了 BALL_SETTLE 秒）或最舊那顆飛了 BALL_WAIT 秒（連續開火時不等到天荒地老）；
//   挑哪顆：照現在的位置與速度往前推算（重力、打水漂同 stepBall；敵艦照現在的船速平移），會打中敵艦的優先、其中離命中最久的那顆；
//   都不中 ⇒ 只追剛開出去的（飛不到 BALL_FRESH 秒）；連這也沒有 ⇒ 落點停完就回去看我艦（CAM.follow ＝ null，鏡頭照看我艦平滑移過去），等下一輪
//   （⛔ 追一顆快落水的不中彈 ⇒ 看不到東西；⛔ 停在落點等 ⇒ 不開砲就一直看著水面，Tim 2026-10-13）。
//   每顆只推算一次（BALL_PRED；一次最多約 20 ms，⛔ 每一格重算會卡）。
//   ⛔ 以前每開一砲就切到新那顆 ⇒ 齊射時鏡頭一直跳、追的那顆還沒打中就換掉；觀戰還會追到敵艦的砲彈。
//   只在畫面這一層跑（frame），不抽 rnd()、不改狀態 ⇒ 戰局不受影響。
var BALL_SETTLE = 0.25, BALL_WAIT = 1.2, BALL_FRESH = 0.6, BALL_PRED = new WeakMap();
/** 砲彈 b 照現在的速度飛下去，幾秒後打中別艘（格或模型；開砲那艘以外最早打中的那艘）；不會中 ⇒ null。 */
function ballPredict(b) {
  var best = null;
  SHIPS.forEach(function (o) { if (o.i === b.owner) return; var t = ballPredictOn(b, o); if (t !== null && (best === null || t < best)) best = t; });
  return best;
}
function ballPredictOn(b, foe) {
  if (!foe || !foe.center || !foe.inv || foe.sunk) return null;
  var p = b.p.slice(), v = b.v.slice(), bounced = b.bounced, h = 1 / 1500, M = foe.inv, c = foe.center, fv = foe.vel || [0, 0, 0], g = foe.grid;
  for (var t = 0; t < 12 - b.age; t += h) {                            // 每步約 0.1 m（初速 175 m/s）
    v[1] -= G * h; p[0] += v[0] * h; p[1] += v[1] * h; p[2] += v[2] * h;
    var sea = seaH(p[0], p[2], SIMT + t);
    if (p[1] < sea) {
      var sp = len(v);
      if (b.ammo === 0 && !bounced && Math.asin(-v[1] / sp) < 0.11 && sp > 90) { v[1] = -v[1] * 0.45; v[0] *= 0.7; v[2] *= 0.7; p[1] = sea + 0.01; bounced = true; continue; }
      return null;
    }
    var x = p[0] - fv[0] * t, y = p[1], z = p[2] - fv[2] * t, dx = x - c[0], dy = y - c[1], dz = z - c[2];   // 換到敵艦「現在」的座標（它照船速平移）
    if (dx * dx + dy * dy + dz * dz > foe.rad2) continue;
    var L = [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
    if (g.get(L[0] | 0, L[1] | 0, L[2] | 0) || hitModel(foe, L, b.ammo === 2 ? 10 : 1.5, null)) return t;
  }
  return null;
}
/** 每一格（frame）：追著的那顆沒了 ⇒ 落點停 CAM.hold 秒；之後挑下一顆，沒有就看我艦。debug：__game.camFollow(dt) 手動推進（預覽窗格在背景時 rAF 會停）。 */
function camFollow(dt) {
  if (CAM.mode !== 1) return;
  var f = CAM.follow;
  if (f && f.alive) return;                                            // 追著的那顆還在飛 ⇒ 不換
  if (f && CAM.hold > 0) { CAM.hold -= dt; return; }                   // 落點停一下（50_sim.js 在那顆沒了的時候設）
  CAM.follow = pickBall();                                             // 沒有值得追的 ⇒ null（回去看我艦）
}
/** 下一顆要追的砲彈（還不到挑的時候 ⇒ null）。 */
function pickBall() {
  var mine = BALLS.filter(function (b) { return b.alive && b.owner === PLAYER_I; });
  if (!mine.length) return null;
  var young = 1e9, old = 0; mine.forEach(function (b) { young = Math.min(young, b.age); old = Math.max(old, b.age); });
  if (young < BALL_SETTLE && old < BALL_WAIT) return null;             // 這輪齊射還在開
  var best = null, bt = -1, fresh = null;
  mine.forEach(function (b) {
    if (!BALL_PRED.has(b)) BALL_PRED.set(b, { at: b.age, t: ballPredict(b) });
    var pr = BALL_PRED.get(b), left = pr.t === null ? null : pr.t - (b.age - pr.at);   // 離命中還有幾秒
    if (left !== null && left > 0.05 && left > bt) { bt = left; best = b; }
    if (b.age < BALL_FRESH) fresh = b;
  });
  CAM.pick = { n: mine.length, hit: !!best, t: best ? +bt.toFixed(2) : null };   // 讀數（__game.camera）
  return best || fresh;
}

