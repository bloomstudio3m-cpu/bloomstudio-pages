// NOIR COFFEE — インパクト版15秒動画（第4次制作指示）
//
// 使い方（claude-code-version/ で実行）:  node video/build-impact.js
//
// 出力（video/）:
//   noir-coffee-claude-code-impact-15s.mp4
//   clips/impact_01_opening_0-3s.mp4
//   clips/impact_02_price_6.8-9.8s.mp4
//   stills/impact_*.png
//
// 編集の手法（アプリ本体は変更しない）:
//   - スピードランプ：区間ごとにアプリの再生速度を変える（切替を1.4倍、NOIRの立ち上がりを0.85倍など）
//   - カメラ：撮影範囲を拡大・移動する（4倍で再ラスタライズするので、1.5倍までズームしても劣化しない）
//   - テロップ・ラベル・タップ位置の丸：撮影時だけ注入するオーバーレイ
//   アプリのUI・色・動きそのものには手を加えない（比較の公平性を保つため）。

const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'index.html');
const OUT = __dirname;
const FPS = 30, DURATION = 15, SLOW = 12;
const VW = 405, VH = 720; // 9:16 → 1080×1920

// ---------- 速度（動画の1秒あたりにアプリが進む秒数） ----------
const SPEED = [ // [開始秒, 速度]
  [0, 1],
  [2.6, 1.4],   // 静的メニュー → アプリの切替を速く
  [2.95, 4.0],  // メニュー表が抜けてからNOIRが出るまでの「間」を詰める
  [3.15, 0.85],  // NOIRの立ち上がりを少しだけゆっくり
  [4.9, 1],
];
const speedAt = t => SPEED.filter(([s]) => s <= t + 1e-9).pop()[1];

// ---------- カメラ ----------
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
// [秒, ズーム, アンカーX(0-1), アンカーY(0-1), この区間の補間 'ease'|'cut']
const CAM = [
  [0.0, 1.0, .5, .5, 'cut'],
  [2.0, 1.0, .5, .5, 'cut'],
  [2.6, 1.07, .5, .55, 'ease'],    // 静的メニューへ少し寄る
  [2.62, 1.0, .5, .5, 'cut'],      // タップの瞬間に引く
  [3.15, 1.28, .02, .3, 'cut'],    // アプリが出た瞬間、NOIRに寄った画で切る（NOIRが画面幅に収まる倍率）
  [5.0, 1.0, .02, .3, 'ease'],    // NOIRがせり上がる間に引いていく
  [6.6, 1.0, .5, 1, 'cut'],
  [7.0, 1.1, .5, 1, 'ease'],       // 下部バーと商品に寄る（左右の文字が切れない倍率）
  [9.5, 1.1, .5, 1, 'cut'],
  [10.0, 1.0, .5, 1, 'ease'],
  [12.5, 1.0, .5, .72, 'cut'],
  [15.0, 1.05, .5, .72, 'ease'],   // 完了画面にゆっくり寄る
];
const PUNCH = [7.05, 7.75, 9.05]; // 金額が変わる瞬間
function camAt(t) {
  let i = CAM.findIndex(k => k[0] > t);
  if (i === -1) i = CAM.length;
  const a = CAM[Math.max(0, i - 1)], b = CAM[i];
  let z = a[1], ax = a[2], ay = a[3];
  if (b && b[4] === 'ease') {
    const k = ease((t - a[0]) / (b[0] - a[0]));
    z = a[1] + (b[1] - a[1]) * k; ax = a[2] + (b[2] - a[2]) * k; ay = a[3] + (b[3] - a[3]) * k;
  }
  for (const p of PUNCH) { // 0.1秒で+0.05寄って、0.4秒で戻る
    const d = t - p;
    if (d >= 0 && d < 0.1) z += 0.05 * easeOut(d / 0.1);
    else if (d >= 0.1 && d < 0.5) z += 0.05 * (1 - ease((d - 0.1) / 0.4));
  }
  return { z, ax, ay };
}

// ---------- 撮影時のみ注入 ----------
const OVERLAY = () => {
  // アプリのタイマーを「アプリ内時刻」で動かす（撮影側が毎フレーム __advance で進める）
  let now = 0, seq = 0; const timers = new Map();
  window.setTimeout = (fn, ms, ...a) => { const id = ++seq; timers.set(id, { due: now + (ms || 0), fn, a }); return id; };
  window.clearTimeout = id => timers.delete(id);
  window.__advance = dt => {
    now += dt;
    for (;;) {
      let next = null;
      for (const [id, t] of timers) if (t.due <= now && (!next || t.due < next[1].due)) next = [id, t];
      if (!next) break;
      timers.delete(next[0]); try { next[1].fn(...next[1].a); } catch (e) { console.error(e); }
    }
  };
  const st = fn => window.setTimeout(fn, 700);
  addEventListener('DOMContentLoaded', () => {
    const css = document.createElement('style');
    css.textContent = `
      .__tap{position:fixed;z-index:9998;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
        background:rgba(11,11,11,.22);border:2px solid #f4f2ee;box-shadow:0 0 0 1px #0b0b0b;pointer-events:none;
        animation:__t .55s ease-out forwards}
      @keyframes __t{from{transform:scale(.6);opacity:1}to{transform:scale(1.7);opacity:0}}
      .__card{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;justify-content:center;
        font-family:"Helvetica Neue",Helvetica,Arial,"Hiragino Sans","Noto Sans JP",sans-serif}
      .__a{background:#f4f2ee;color:#0b0b0b;align-items:center}
      .__a b{font-weight:900;font-size:138px;line-height:.82;letter-spacing:-.05em;animation:__settle .5s cubic-bezier(.2,.7,.1,1) both}
      @keyframes __settle{from{transform:scale(1.12)}}
      .__b{background:#0b0b0b;color:#f4f2ee;padding:0 34px}
      .__b .__tag{font-weight:900;letter-spacing:.32em;font-size:15px;margin:0 0 26px;animation:__fade .3s both}
      .__b h1{margin:0;font-weight:900;font-size:47px;line-height:1.25;letter-spacing:-.01em}
      .__b .l{display:block;overflow:hidden}
      .__b .l>span{display:block;animation:__up .38s cubic-bezier(.2,.7,.1,1) both}
      .__b .l:nth-child(2)>span{animation-delay:.07s}
      .__b .rule{height:3px;background:#f4f2ee;margin-top:28px;transform-origin:left;animation:__grow .5s .12s cubic-bezier(.2,.7,.1,1) both}
      @keyframes __up{from{transform:translateY(105%)}}
      @keyframes __grow{from{transform:scaleX(0)}}
      @keyframes __fade{from{opacity:0}}
      .__out{clip-path:inset(0 0 100% 0);transition:clip-path .24s cubic-bezier(.7,0,.3,1)}
      dialog.__lab{position:fixed;inset:auto 0 0 0;width:100vw!important;max-width:none!important;height:154px!important;max-height:none!important;
        margin:0!important;border:0!important;padding:0 26px;background:#0b0b0b;color:#f4f2ee;display:flex;align-items:center;justify-content:space-between;
        font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;animation:__lab .34s cubic-bezier(.2,.7,.1,1) both!important}
      dialog.__lab::backdrop{background:transparent}
      @keyframes __lab{from{transform:translateY(100%)}}
      .__lab .m{font-weight:900;font-size:44px;line-height:1;letter-spacing:-.02em;margin:0}
      .__lab .v{font-weight:700;font-size:15px;letter-spacing:.5em;margin:0}
    `;
    document.head.appendChild(css);
    addEventListener('pointerdown', e => {
      const d = document.createElement('div'); d.className = '__tap';
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
      document.body.appendChild(d); st(() => d.remove());
    }, true);
  });
  window.__A = () => {
    const c = document.createElement('div'); c.className = '__card __a'; c.id = '__A';
    c.innerHTML = '<b>NOIR</b>'; document.body.appendChild(c);
  };
  window.__B = () => {
    document.getElementById('__A').remove();
    const c = document.createElement('div'); c.className = '__card __b'; c.id = '__B';
    c.innerHTML = `<p class="__tag">NOIR COFFEE</p><h1><span class="l"><span>同じ指示で、</span></span><span class="l"><span>ここまで違う。</span></span></h1><div class="rule"></div>`;
    document.body.appendChild(c);
  };
  window.__Bout = () => document.getElementById('__B').classList.add('__out');
  window.__label = () => {
    const c = document.createElement('dialog'); c.className = '__lab';
    c.innerHTML = '<p class="m">Claude Code</p><p class="v">VERSION</p>';
    document.body.appendChild(c); c.showModal(); c.blur();
  };
};

// ---------- 台本 ----------
const tap = sel => ({ type: 'tap', sel });
const scroll = (sel, dur) => ({ type: 'scroll', sel, dur });
const js = fn => ({ type: 'js', fn });
const STEPS = [
  [0.0, js('__A()')],                 // 0〜0.5 NOIRの大型タイポ
  [0.5, js('__B()')],                 // 0.5〜2 テロップ（白→黒の反転カット）
  [2.0, js('__Bout()')],              // 2.0 静的メニューへワイプ
  [2.6, tap('#introGo')],             // 2.6 アプリへ切替（1.4倍速）
  [5.25, scroll('#grid [data-id="c2"]', 1.25)], // 商品一覧を流す
  [7.0, tap('#grid [data-add="c2"]')],
  [7.7, tap('#grid [data-inc="c2"]')],
  [8.15, scroll('#grid [data-id="p3"]', 0.6)],
  [9.0, tap('#grid [data-add="p3"]')],
  [10.0, tap('#barBtn')],
  [10.95, tap('#dlg [data-place]')],
  [12.5, js('__label()')],
];
const STILLS = { 0.25: 'impact_00_noir', 1.4: 'impact_01_telop', 3.8: 'impact_02_noir_zoom', 8.0: 'impact_03_price', 13.6: 'impact_04_complete_label' };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ja-JP' });
  const p = await ctx.newPage();
  await p.addInitScript(OVERLAY);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');

  const outFile = path.join(OUT, 'noir-coffee-claude-code-impact-15s.mp4');
  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });

  await p.goto('file://' + APP + '?intro=1');
  const steps = STEPS.slice(), tweens = [];
  const stills = Object.entries(STILLS).map(([t, n]) => [Math.round(+t * FPS), n]);
  const total = DURATION * FPS;
  let curSpeed = null, realMs = 0, late = 0;
  const t0 = Date.now();

  for (let f = 0; f < total; f++) {
    const vt = f / FPS;
    const sp = speedAt(vt);
    if (sp !== curSpeed) {
      curSpeed = sp;
      await cdp.send('Animation.setPlaybackRate', { playbackRate: sp / SLOW });
    }
    while (steps.length && steps[0][0] <= vt + 1e-6) {
      const [, s] = steps.shift();
      if (s.type === 'js') await p.evaluate(s.fn);
      if (s.type === 'tap') {
        const bb = await p.locator(s.sel).first().boundingBox();
        if (!bb) throw new Error(`${s.sel} not found at ${vt}s`);
        await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      }
      if (s.type === 'scroll') {
        const [from, to] = await p.evaluate(sel => [scrollY, document.querySelector(sel).getBoundingClientRect().top + scrollY - 70], s.sel);
        tweens.push({ start: vt, dur: s.dur, from, to });
      }
    }
    for (const tw of tweens) {
      const k = Math.min(1, Math.max(0, (vt - tw.start) / tw.dur));
      if (k > 0 && !tw.done) await p.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), tw.from + (tw.to - tw.from) * ease(k));
      if (k >= 1) tw.done = true;
    }
    const target = t0 + realMs;
    const wait = target - Date.now();
    if (wait > 0) await p.waitForTimeout(wait); else late++;
    // 実時間は毎フレーム一定。CSSアニメは playbackRate、タイマーは __advance で同じだけ進む
    realMs += (1000 / FPS) * SLOW;
    await p.evaluate(dt => window.__advance(dt), (1000 / FPS) * sp);

    const { z, ax, ay } = camAt(vt);
    const w = VW / z, h = VH / z;
    const sy = await p.evaluate(() => scrollY);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false,
      clip: { x: ax * (VW - w), y: sy + ay * (VH - h), width: w, height: h, scale: 1080 / w },
    });
    const png = Buffer.from(shot.data, 'base64');
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    const s = stills.find(([sf]) => sf === f);
    if (s) fs.writeFileSync(path.join(OUT, 'stills', s[1] + '.png'), png);
    if (f % 90 === 0) process.stdout.write(`impact ${vt.toFixed(1)}s\n`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  await b.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`→ noir-coffee-claude-code-impact-15s.mp4  (late frames: ${late}/${total})`);

  fs.mkdirSync(path.join(OUT, 'clips'), { recursive: true });
  for (const [file, ss, t] of [['impact_01_opening_0-3s.mp4', 0, 3], ['impact_02_price_6.8-9.8s.mp4', 6.8, 3]]) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(ss), '-i', outFile, '-t', String(t),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'clips', file)]);
    console.log('→ clips/' + file);
  }
})().catch(e => { console.error(e); process.exit(1); });
