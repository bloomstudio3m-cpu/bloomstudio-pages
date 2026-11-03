// NOIR COFFEE — SNS用15秒動画の書き出し（Claude Code版）
//
// 使い方（claude-code-version/ で実行）:
//   node video/build-video.js
//
// 仕組み:
//   実時間で録画すると画質と滑らかさが落ちるため、ページ内のCSSアニメーションと
//   setTimeoutを1/10の速さに落とし、1フレームずつ 1080×1920 のPNGで撮影して
//   30fpsのH.264に書き出す。
//   テロップ・エンドカード・タップ位置の丸は撮影時だけ注入する（アプリ本体は変更しない）。
//
// 出力（video/）:
//   noir-coffee-claude-code-reel-15s.mp4    テロップ・エンドカード付き（Instagram/Threads用）
//   noir-coffee-claude-code-clean-15s.mp4   テロップなし（Codex版との比較用）
//   clips/01_opening_0-3s.mp4 ほか          比較用の切り出し素材
//   stills/*.png                            代表スクリーンショット（1080×1920）

const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', 'index.html');
const OUT = __dirname;
const FPS = 30;
const DURATION = 15;
const SLOW = 10;                       // 撮影中は10倍遅く動かす
const VIEW = { width: 405, height: 720 }; // ×(1080/405) = 1080×1920 (9:16)

// ---------- 撮影時のみ注入するオーバーレイ ----------
const OVERLAY = ({ SLOW }) => {
  // アプリ内のsetTimeout（トースト・イントロの切替）もアニメーションと同じ速さに揃える
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) * SLOW, ...a);

  addEventListener('DOMContentLoaded', () => {
    const css = document.createElement('style');
    css.textContent = `
      .__tap{position:fixed;z-index:9998;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
        background:rgba(11,11,11,.22);border:2px solid #f4f2ee;box-shadow:0 0 0 1px #0b0b0b;pointer-events:none;
        animation:__t .55s ease-out forwards}
      @keyframes __t{from{transform:scale(.6);opacity:1}to{transform:scale(1.7);opacity:0}}

      .__card{position:fixed;inset:0;z-index:9999;background:#0b0b0b;color:#f4f2ee;
        display:flex;flex-direction:column;justify-content:center;padding:0 34px;
        font-family:"Helvetica Neue",Helvetica,Arial,"Hiragino Sans","Noto Sans JP",sans-serif}
      .__card .l{display:block;overflow:hidden}
      .__card .l>span{display:block;animation:__up .7s cubic-bezier(.2,.7,.1,1) both}
      .__title{margin:0;font-weight:900;font-size:58px;line-height:1.16;letter-spacing:-.01em}
      .__title .l:nth-child(2)>span{animation-delay:.08s}
      .__title .l:nth-child(3)>span{animation-delay:.16s}
      .__rule{height:3px;background:#f4f2ee;margin:30px 0 22px;transform-origin:left;
        animation:__grow .7s .3s cubic-bezier(.2,.7,.1,1) both}
      .__sub{margin:0;font-size:25px;line-height:1.5;font-weight:700;letter-spacing:.04em;white-space:nowrap;animation:__fade .6s .45s both}
      @keyframes __up{from{transform:translateY(105%)}}
      @keyframes __grow{from{transform:scaleX(0)}}
      @keyframes __fade{from{opacity:0;transform:translateY(8px)}}
      .__out{clip-path:inset(0 0 100% 0);transition:clip-path .38s cubic-bezier(.6,0,.2,1)}
      .__in{animation:__wipe .42s cubic-bezier(.2,.7,.1,1) both}
      @keyframes __wipe{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}

      dialog.__end{position:fixed;inset:0;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:none!important;
        margin:0!important;border:0!important;padding:0 34px;display:flex}
      dialog.__end::backdrop{background:transparent}
      dialog.__end[open]{animation:__wipe .42s cubic-bezier(.2,.7,.1,1) both!important}
      .__end{align-items:flex-start}
      .__end .brand{font-weight:900;letter-spacing:.32em;font-size:20px;margin:0 0 auto;padding-top:64px;animation:__fade .5s .1s both}
      .__end .main{margin:0;font-weight:900;font-size:66px;line-height:1;letter-spacing:-.02em}
      .__end .ver{margin:16px 0 0;font-weight:700;font-size:22px;letter-spacing:.5em;animation:__fade .5s .25s both}
      .__end .sp{margin-bottom:auto}
    `;
    document.head.appendChild(css);
    addEventListener('pointerdown', e => {
      const d = document.createElement('div'); d.className = '__tap';
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
      document.body.appendChild(d); st(() => d.remove(), 700 * SLOW);
    }, true);
  });

  window.__telopShow = () => {
    const c = document.createElement('div'); c.className = '__card'; c.id = '__telop';
    c.innerHTML = `<h1 class="__title"><span class="l"><span>同じ指示を</span></span><span class="l"><span>2つのAIに</span></span><span class="l"><span>渡したら？</span></span></h1>
      <div class="__rule"></div><p class="__sub">Canvaなし。<br>コードだけで制作。</p>`;
    document.body.appendChild(c);
  };
  window.__telopHide = () => { const c = document.getElementById('__telop'); c.classList.add('__out'); };
  window.__endShow = () => {
    // アプリの確認画面はモーダル（top layer）なので、エンドカードもモーダルとして重ねる
    const c = document.createElement('dialog'); c.className = '__card __end __in';
    c.innerHTML = `<p class="brand">NOIR COFFEE</p><p class="main">Claude<br>Code</p><p class="ver">VERSION</p><div class="sp"></div>`;
    document.body.appendChild(c); c.showModal(); c.blur();
  };
};

// ---------- 台本（動画内の秒数） ----------
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const tapAt = sel => ({ type: 'tap', sel });
const scrollTo = (sel, dur) => ({ type: 'scroll', sel, dur });
const js = fn => ({ type: 'js', fn });

const SCRIPTS = {
  reel: {
    file: 'noir-coffee-claude-code-reel-15s.mp4',
    stills: { 1.2: 'reel_00_telop', 14.4: 'reel_99_endcard' },
    steps: [
      [0.0, js('__telopShow()')],
      [2.0, js('__telopHide()')],
      [3.4, tapAt('#introGo')],
      [6.2, scrollTo('#grid [data-id="c2"]', 0.8)],
      [7.1, tapAt('#grid [data-add="c2"]')],
      [7.8, tapAt('#grid [data-inc="c2"]')],
      [8.3, scrollTo('#grid [data-id="p3"]', 0.7)],
      [9.2, tapAt('#grid [data-add="p3"]')],
      [9.9, tapAt('#barBtn')],
      [11.2, tapAt('#dlg [data-place]')],
      [13.5, js('__endShow()')],
    ],
  },
  clean: {
    file: 'noir-coffee-claude-code-clean-15s.mp4',
    stills: { 1.5: '01_static_menu', 5.6: '02_hero', 9.6: '03_menu_cart_bar', 11.2: '04_review', 13.8: '05_complete' },
    steps: [
      [3.0, tapAt('#introGo')],
      [5.8, scrollTo('#grid [data-id="c2"]', 0.8)],
      [6.8, tapAt('#grid [data-add="c2"]')],
      [7.6, tapAt('#grid [data-inc="c2"]')],
      [8.2, scrollTo('#grid [data-id="p3"]', 0.7)],
      [9.1, tapAt('#grid [data-add="p3"]')],
      [10.0, tapAt('#barBtn')],
      [11.6, tapAt('#dlg [data-place]')],
    ],
  },
};

const CLIPS = [ // clean版から切り出す比較用素材
  ['01_opening_0-3s.mp4', 0, 3],
  ['02_transform_3-6s.mp4', 3, 3],
  ['03_order_5.8-11.6s.mp4', 5.8, 5.8],
  ['04_complete_11.6-15s.mp4', 11.6, 3.4],
];

async function render(name) {
  const S = SCRIPTS[name];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VIEW, deviceScaleFactor: 1080 / VIEW.width, isMobile: true, hasTouch: true, locale: 'ja-JP' });
  const p = await ctx.newPage();
  await p.addInitScript(OVERLAY, { SLOW });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });

  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  const outFile = path.join(OUT, S.file);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });

  await p.goto('file://' + APP + '?intro=1');
  const steps = S.steps.slice();
  const tweens = [];
  const stillAt = Object.entries(S.stills).map(([t, n]) => [Math.round(+t * FPS), n]);
  const total = DURATION * FPS;
  const t0 = Date.now();
  let late = 0;

  for (let f = 0; f < total; f++) {
    const vt = f / FPS;
    while (steps.length && steps[0][0] <= vt + 1e-6) {
      const [, s] = steps.shift();
      if (s.type === 'js') await p.evaluate(s.fn);
      if (s.type === 'tap') {
        const bb = await p.locator(s.sel).first().boundingBox();
        if (!bb) throw new Error(`${name}: ${s.sel} not found at ${vt}s`);
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
    // このフレームの実時刻まで待つ（撮影中は SLOW 倍の実時間が流れる）
    const target = t0 + vt * 1000 * SLOW;
    const wait = target - Date.now();
    if (wait > 0) await p.waitForTimeout(wait); else late++;
    const png = await p.screenshot({ type: 'png', animations: 'allow', caret: 'initial', scale: 'device' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    const st = stillAt.find(([sf]) => sf === f);
    if (st) fs.writeFileSync(path.join(OUT, 'stills', st[1] + '.png'), png);
    if (f % 90 === 0) process.stdout.write(`${name} ${vt.toFixed(1)}s\n`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  await b.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`→ ${S.file}  (late frames: ${late}/${total})`);
  return outFile;
}

(async () => {
  const only = process.argv[2];
  for (const name of Object.keys(SCRIPTS)) if (!only || only === name) await render(name);
  if (!only || only === 'clean') {
    const src = path.join(OUT, SCRIPTS.clean.file);
    fs.mkdirSync(path.join(OUT, 'clips'), { recursive: true });
    for (const [file, ss, t] of CLIPS) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(ss), '-i', src, '-t', String(t),
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'clips', file)]);
      console.log('→ clips/' + file);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
