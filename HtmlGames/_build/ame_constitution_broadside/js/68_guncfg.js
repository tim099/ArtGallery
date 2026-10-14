// ───────────────────────── 砲的設定（主選單「砲的設定…」；Tim 2026-10-14：單獨一頁設定每種砲的參數 —— 速射砲一次六發、砲的基礎重量、基礎傷害…） ─────────────────────────
// 一種砲一份：所有船上同一種砲都照這一份。預設 ＝ config/game.json 的 guns（後台管理頁的砲種表）；每發傷害的預設 ＝ LIM.dmg*（原本在細節設定，搬來這裡）。
// 這一頁改的直接寫進 GUNS（開火、裝填、重量、砲班都讀它）⇒ 下一場生效；存檔只存跟預設不一樣的（69_prefs.js：guns ＝ GUN_SET、dmg ＝ DMG 照舊）。
// 網址的 ?dmg24= 那幾個照舊（04_state.js DMG）。
var GUNS0 = JSON.parse(JSON.stringify(GUNS));   // 設定檔的原樣（回到預設用）
var GUN_SET = {};                                // { 砲種: { 鍵: 值 } }：跟 GUNS0 不一樣的
var GUN_ITEMS = [
  { k: 'dmg', name: '每發傷害', step: 5, int: true, note: '打到砲、帆、人時的基準，再乘細節設定的彈種倍率' },
  { k: 'mass', name: '重量', lim: [0.1, 5], step: 0.1, unit: ' 噸', fix: 1, note: '算進船的重量（再乘船隻配置頁的「砲的重量」倍率）' },
  { k: 'V', name: '初速', lim: [80, 260], step: 5, unit: ' m/s', int: true, note: '越快射得越遠、彈道越平' },
  { k: 'reload', name: '裝填時間', lim: [0.3, 2.5], step: 0.05, unit: '×', fix: 2, note: '24 磅長砲 ＝ 1；越小裝得越快' },
  { k: 'burst', name: '連發數', lim: [1, 20], step: 1, unit: ' 發', int: true, def: 1, note: '連發：裝填一次打幾發（風暴角號的 3 磅追擊砲 6 發）' },
  { k: 'burstGap', name: '連發間隔', lim: [0.02, 2], step: 0.01, unit: ' 秒', fix: 2, def: 0.15, note: '連發時每一發隔幾秒' },
  { k: 'hole', name: '打出的洞', lim: [0.3, 1.5], step: 0.05, unit: '×', fix: 2, def: 1, note: '打穿船殼的洞多大（24 磅長砲 ＝ 1）' },
  { k: 'crew', name: '標準砲班', lim: [1, 10], step: 1, unit: ' 人', int: true, note: '射速照這個人數算；各船實際配幾個人在船隻配置頁' },
  { k: 'min', name: '最少人數', lim: [1, 10], step: 1, unit: ' 人', int: true, note: '少於這個人數 ⇒ 這門砲不開' }
];
function gunItem(k) { return GUN_ITEMS.filter(function (it) { return it.k === k; })[0]; }
function gunLim(t, it) { return it.k === 'dmg' ? LIM[DMG_Q[t]] : it.lim; }
function gunDef(t, k) { if (k === 'dmg') return LIM[DMG_Q[t]][2]; var v = GUNS0[t][k]; return v === undefined ? gunItem(k).def : v; }
function gunVal(t, k) { if (k === 'dmg') return DMG[t]; var v = GUNS[t][k]; return v === undefined ? gunItem(k).def : v; }
/** 改一項（夾進範圍、整數的取整）；跟預設一樣 ⇒ 從 GUN_SET 拿掉。標準砲班 ＜ 最少 ⇒ 最少跟著降。 */
function gunSet(t, k, v) {
  var it = gunItem(k); if (!it || !GUNS[t] || typeof v !== 'number' || !isFinite(v)) return;
  var L = gunLim(t, it); v = clamp(v, L[0], L[1]); v = it.int ? Math.round(v) : Math.round(v / it.step) * it.step; v = +v.toFixed(4);
  if (k === 'min') v = Math.min(v, gunVal(t, 'crew'));
  if (k === 'dmg') { DMG[t] = v; return; }
  var d = gunDef(t, k), S = GUN_SET[t] = GUN_SET[t] || {};
  if (v === d) { delete S[k]; if (GUNS0[t][k] === undefined) delete GUNS[t][k]; else GUNS[t][k] = GUNS0[t][k]; } else { S[k] = v; GUNS[t][k] = v; }
  if (!Object.keys(S).length) delete GUN_SET[t];
  if (k === 'crew' && gunVal(t, 'min') > v) gunSet(t, 'min', v);
}
/** 這一種回到預設（傷害一起）。 */
function gunReset(t) { GUN_ITEMS.forEach(function (it) { gunSet(t, it.k, gunDef(t, it.k)); }); }
/** 存檔用：GUN_SET 的拷貝（傷害照舊存在 dmg）。 */
function gunsSnap() { return JSON.parse(JSON.stringify(GUN_SET)); }
/** 存檔／匯入 ⇒ 變數：看得懂的砲種、鍵才套（照 gunSet 夾範圍）。最少放在標準砲班之後套。 */
function gunsApply(o) {
  if (!o || typeof o !== 'object') return 0;
  var n = 0;
  Object.keys(o).forEach(function (t) {
    if (!GUNS[t] || !o[t] || typeof o[t] !== 'object') return; n++;
    GUN_ITEMS.forEach(function (it) { if (typeof o[t][it.k] === 'number' && !(it.k === 'dmg' && Q.has(DMG_Q[t]))) gunSet(t, it.k, o[t][it.k]); });
  });
  return n;
}
/** 匯出：每一種砲整份（含傷害）。 */
function gunsExport() {
  var g = {}; Object.keys(GUNS).forEach(function (t) { g[t] = {}; GUN_ITEMS.forEach(function (it) { g[t][it.k] = gunVal(t, it.k); }); });
  return { game: 'ame_constitution_broadside', kind: 'guns', v: 1, at: new Date().toISOString(), guns: g };
}
function gunsImport(o) { return o && o.game === 'ame_constitution_broadside' && o.kind === 'guns' ? gunsApply(o.guns) : -1; }
// ── 頁面（71_input.js sliders 接返回、換頁） ──
var GUN_ID = Object.keys(GUNS)[0];
function gunFmt(t, it, v) { return (it.int ? String(v) : v.toFixed(it.fix || 2)) + (it.unit || ''); }
function gunUI() {
  var sel = $('gunSel');
  sel.innerHTML = Object.keys(GUNS).map(function (t) { return '<option value="' + t + '">' + GUNS[t].name + '（' + GUNS[t].code + '）</option>'; }).join('');
  sel.value = GUN_ID; sel.onchange = function () { GUN_ID = sel.value; gunShow(); };
  $('gunItems').innerHTML = GUN_ITEMS.map(function (it) {
    return '<div class="row slide"><label for="gk-' + it.k + '">' + it.name + '</label><input type="range" id="gk-' + it.k + '" step="' + it.step + '" aria-label="' + it.name + '"><span id="gk-' + it.k + 'V"></span></div>' +
      '<div class="row note gkn">' + it.note + '</div>';
  }).join('');
  GUN_ITEMS.forEach(function (it) { var r = $('gk-' + it.k); r.oninput = function () { gunSet(GUN_ID, it.k, +r.value); gunShow(); }; });
  var rArm = 0;
  $('gunR').onclick = function () {                      // 按兩下（跟船隻配置頁一樣：⛔ confirm() 在畫廊彈窗裡直接回 false）
    var b = $('gunR');
    if (performance.now() - rArm > 4000) { rArm = performance.now(); b.textContent = '再按一次：' + GUNS[GUN_ID].name + '回到預設'; setTimeout(function () { if (performance.now() - rArm >= 3900) b.textContent = '這一種回到預設'; }, 4000); return; }
    rArm = 0; b.textContent = '這一種回到預設'; gunReset(GUN_ID); gunShow();
  };
  $('gunE').onclick = function () {
    var s = JSON.stringify(gunsExport(), null, 1), a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' }));
    a.download = 'constitution_broadside_guns_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    $('gunSt').textContent = '已匯出 ' + a.download + '（每一種砲整份）。';
  };
  $('gunI').onclick = function () { $('gunF').value = ''; $('gunF').click(); };
  $('gunF').onchange = function () {
    var f = $('gunF').files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var n = -1; try { n = gunsImport(JSON.parse(r.result)); } catch (e) { n = -1; }
      gunShow();
      $('gunSt').textContent = n < 0 ? '⚠ 匯入失敗：' + f.name + ' 不是這個遊戲匯出的砲的設定。' : '已匯入 ' + f.name + '：' + n + ' 種砲' + (PREFS.write ? '（已存）。' : '（這一頁存不了，下次打開要再匯入）。');
    };
    r.readAsText(f);
  };
}
/** 變數 ⇒ 這一頁（滑桿、數字、跟預設不一樣的標「改過」）。 */
function gunShow() {
  var t = GUN_ID, G = GUNS[t];
  GUN_ITEMS.forEach(function (it) {
    var r = $('gk-' + it.k), L = gunLim(t, it), v = gunVal(t, it.k), d = gunDef(t, it.k);
    r.min = L[0]; r.max = it.k === 'min' ? gunVal(t, 'crew') : L[1]; r.value = v;
    $('gk-' + it.k + 'V').textContent = gunFmt(t, it, v) + (v === d ? '' : '（改過；預設 ' + gunFmt(t, it, d) + '）');
  });
  $('gk-burstGap').disabled = gunVal(t, 'burst') <= 1;
  var where = Object.keys(HULLT).map(function (id) { var n = (HULLT[id].rig.models || []).filter(function (m) { return modelKind(m) === t; }).length; return n ? ((hullInfo(id) || {}).name || id) + ' ' + n + ' 門' : ''; }).filter(Boolean);
  var rl = RELOAD * gunVal(t, 'reload'), bu = gunVal(t, 'burst');
  $('gunInfo').innerHTML = '代號 <b>' + G.code + '</b>・裝填約 <b>' + rl.toFixed(1) + '</b> 秒（標準砲班）' + (bu > 1 ? '・一份彈藥 ' + bu + ' 發、' + ((bu - 1) * gunVal(t, 'burstGap')).toFixed(2) + ' 秒打完' : '') +
    (where.length ? '<br>裝在：' + where.join('、') : '<br><span class="n">（裝在哪幾艘：開過的船才列得出來）</span>');
  var n = Object.keys(GUN_SET).length + Object.keys(DMG_Q).filter(function (k) { return DMG[k] !== LIM[DMG_Q[k]][2]; }).length;
  var b = $('gunB'); b.textContent = n ? '砲的設定（改過）…' : '砲的設定…'; b.className = n ? 'on' : '';
}
