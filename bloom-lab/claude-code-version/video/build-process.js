// NOIR COFFEE — 制作過程15秒動画（第5次・全面改訂指示）
//
// 使い方（リポジトリ内のどこからでも）:  node bloom-lab/claude-code-version/video/build-process.js
//
// 出力（video/）:
//   noir-coffee-claude-code-process-15s.mp4      本編（1080×1920／15秒／30fps／H.264／音声なし）
//   clips/process_01_making_0-7s.mp4             制作過程の部分
//   clips/process_02_app_7-15s.mp4               完成アプリの部分
//   stills/process_*.png                         代表フレーム
//
// 素材の出どころ:
//   0〜7秒  作業画面は「制作ログから再現」。中身はすべて実際の記録から取っている。
//           - コード：git 3933b0a（初回コミット 06:12:05 UTC）の index.html / menu.html / README.md
//           - 指示書：MAIから渡された「Claude Code・Codex 共通制作指示書」の本文
//           - ターミナル：実際に実行したコマンドと出力（初回テストのエラー → 修正 → 0 failed / 32）
//           - 時刻：開始 06:06:38 UTC（作業開始時に記録）→ 初回コミット 06:12:05 UTC
//           - プレビュー：初回テストで実際に撮ったスクリーンショット
//   7〜15秒 実物のアプリ（../index.html）をiframeで読み込み、実際に操作して撮影。アプリ本体は変更しない。

const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');        // claude-code-version/
const OUT = __dirname;
const FPS = 30, DURATION = 15, SLOW = 12;
const PORT = 8765;
const FIRST = '3933b0a';                            // 初回コミット

// ---------- 実際の記録 ----------
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' });
const at = (file, from, count) => git('show', `${FIRST}:bloom-lab/claude-code-version/${file}`).split('\n')
  .map((l, i) => [i + 1, l]).slice(from - 1, from - 1 + count);
const src0 = git('show', `${FIRST}:bloom-lab/claude-code-version/index.html`).split('\n');
const jsStart = src0.findIndex(l => l.includes('const CATS')) + 1; // 商品データの定義から
const DATA = {
  code: at('index.html', jsStart, 150),
  menu: at('menu.html', 1, 55),
  readme: at('README.md', 1, 40),
  // [出現秒, クラス, テキスト] — 実際の操作ログ（順序も実際どおり）
  term: [
    [0.05, 'user', '$ claude'],
    [0.15, 'user', '> （指示書を貼り付け）BLOOM LAB｜NOIR COFFEE'],
    [0.25, 'user', '  Claude Code・Codex 共通制作指示書'],
    [0.4, 'dot', 'Write  bloom-lab/claude-code-version/index.html'],
    [4.3, 'dot', 'Write  menu.html'],
    [4.85, 'dot', 'Bash   node test.js'],
    [5.1, 'err', 'Error: strict mode violation'],
    [5.2, 'mute', "  locator('[data-inc=\"c1\"]') resolved to 2 elements"],
    [5.45, 'dot', 'テストのセレクタを #grid に限定して再実行'],
    [5.65, 'ok', '  PASS 6 items'],
    [5.73, 'ok', '  PASS filter スイーツ shows 3'],
    [5.81, 'ok', '  PASS bar total 580*2+380=1540'],
    [5.89, 'ok', '  PASS confirm DEMO shown'],
    [5.97, 'ok', '  PASS keyboard filter'],
    [6.05, 'ok', '  PASS reduced motion: marquee stopped'],
    [6.15, 'big', '0 failed / 32'],
    [6.4, 'dot', 'Edit   .name { text-wrap: balance; }'],
    [6.6, 'dot', 'Bash   git commit → 3933b0a'],
  ],
  punch: [10.55, 11.15, 12.05], // 金額が変わる瞬間
};

// ---------- 完成アプリの操作（7秒以降・実物） ----------
const APP = `http://127.0.0.1:${PORT}/index.html`;
const STEPS = [
  [6.85, { type: 'load' }],                                   // プレビュー枠の中で実物のアプリを起動
  [8.6, { type: 'scroll', sel: '#menu', dur: 1.0, top: 0 }],  // 商品一覧へ
  [9.9, { type: 'scroll', sel: '#grid [data-id="c2"] .row', dur: 0.5, row: true }],
  [10.55, { type: 'tap', sel: '#grid [data-add="c2"]' }],
  [11.15, { type: 'tap', sel: '#grid [data-inc="c2"]' }],
  [11.5, { type: 'scroll', sel: '#grid [data-id="p3"] .row', dur: 0.45, row: true }],
  [12.05, { type: 'tap', sel: '#grid [data-add="p3"]' }],
  [12.55, { type: 'tap', sel: '#barBtn' }],
  [13.05, { type: 'tap', sel: '#dlg [data-place]' }],
];
const STILLS = { 1.2: 'process_00_ai_screen', 3.0: 'process_01_brief', 6.2: 'process_02_making', 7.25: 'process_03_switch', 8.2: 'process_04_complete', 11.3: 'process_05_order', 14.2: 'process_06_version' };

// 撮影時のみ注入（各フレーム共通）：アプリのタイマーを動画の時間で進める・タップ位置の丸
const INIT = () => {
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
  addEventListener('DOMContentLoaded', () => {
    if (window === window.top) return;
    const css = document.createElement('style');
    css.textContent = `.__tap{position:fixed;z-index:9998;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
      background:rgba(11,11,11,.22);border:2px solid #f4f2ee;box-shadow:0 0 0 1px #0b0b0b;pointer-events:none;animation:__t .55s ease-out forwards}
      @keyframes __t{from{transform:scale(.6);opacity:1}to{transform:scale(1.7);opacity:0}}`;
    document.head.appendChild(css);
    addEventListener('pointerdown', e => {
      const d = document.createElement('div'); d.className = '__tap';
      d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
      document.body.appendChild(d); window.setTimeout(() => d.remove(), 700);
    }, true);
  });
};

const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    const p = await ctx.newPage();
    await p.addInitScript(INIT);
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
    await p.goto(`http://127.0.0.1:${PORT}/video/process/scene.html`);
    await p.evaluate(d => window.__setData(d), DATA);
    await p.waitForFunction(() => [...document.images].every(i => i.complete));

    const outFile = path.join(OUT, 'noir-coffee-claude-code-process-15s.mp4');
    fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });

    const app = () => p.frames().find(f => f.url().startsWith(APP));
    const steps = STEPS.slice(), tweens = [];
    const stills = Object.entries(STILLS).map(([t, n]) => [Math.round(+t * FPS), n]);
    const total = DURATION * FPS;
    const t0 = Date.now();
    let late = 0;

    for (let f = 0; f < total; f++) {
      const vt = f / FPS;
      while (steps.length && steps[0][0] <= vt + 1e-6) {
        const [, s] = steps.shift();
        if (s.type === 'load') {
          await p.evaluate(u => { document.getElementById('app').src = u; }, APP);
          await p.waitForFunction(u => { const d = document.getElementById('app').contentDocument; return d && d.readyState === 'complete' && d.location.href.startsWith(u); }, APP);
        }
        if (s.type === 'tap') {
          const bb = await app().locator(s.sel).first().boundingBox();
          if (!bb) throw new Error(`${s.sel} not found at ${vt}s`);
          await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
        }
        if (s.type === 'scroll') {
          const [from, to] = await app().evaluate(({ sel, row }) => {
            const r = document.querySelector(sel).getBoundingClientRect();
            // row: 商品の価格行を、下部バー（74px）の上に来る位置へ
            return [scrollY, row ? r.bottom + scrollY - (innerHeight - 74 - 18) : r.top + scrollY - 57];
          }, s);
          tweens.push({ start: vt, dur: s.dur, from, to });
        }
      }
      for (const tw of tweens) {
        const k = Math.min(1, Math.max(0, (vt - tw.start) / tw.dur));
        if (k > 0 && !tw.done) await app().evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), tw.from + (tw.to - tw.from) * ease(k));
        if (k >= 1) tw.done = true;
      }
      await p.evaluate(t => window.__render(t), vt);

      const wait = t0 + vt * 1000 * SLOW - Date.now();
      if (wait > 0) await p.waitForTimeout(wait); else late++;
      for (const fr of p.frames()) await fr.evaluate(dt => window.__advance && window.__advance(dt), 1000 / FPS).catch(() => {});

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 405, height: 720, scale: 1080 / 405 } });
      const png = Buffer.from(shot.data, 'base64');
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      const st = stills.find(([sf]) => sf === f);
      if (st) fs.writeFileSync(path.join(OUT, 'stills', st[1] + '.png'), png);
      if (f % 90 === 0) process.stdout.write(`process ${vt.toFixed(1)}s\n`);
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`→ noir-coffee-claude-code-process-15s.mp4  (late frames: ${late}/${total})`);

    fs.mkdirSync(path.join(OUT, 'clips'), { recursive: true });
    for (const [file, ss, t] of [['process_01_making_0-7s.mp4', 0, 7], ['process_02_app_7-15s.mp4', 7, 8]]) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(ss), '-i', outFile, '-t', String(t),
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'clips', file)]);
      console.log('→ clips/' + file);
    }
  } finally {
    await b.close();
    server.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
