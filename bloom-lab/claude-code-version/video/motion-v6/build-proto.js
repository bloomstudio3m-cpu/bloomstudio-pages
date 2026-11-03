// 第6次 試作：7〜9秒「コードからUIへの変形」2秒
// 使い方:  node bloom-lab/claude-code-version/video/motion-v6/build-proto.js
// 出力（motion-v6/）: proto-code-to-ui-2s.mp4、frames/contact.png、frames/f_*.png
//
// 制作方法：
//   - シーンは proto-morph.html（HTML/CSSの3D変形・clip-pathマスク・自作のイージング。外部ライブラリなし）
//   - Playwright（Chromium）で1フレームずつ描画し、CDPの Page.captureScreenshot で 1080×1920 に再ラスタライズ
//   - FFmpeg（libx264）で30fpsのH.264にまとめる
//   - コードは git 3933b0a の index.html の実際の行、変形先は実物のアプリの要素位置

const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');   // claude-code-version/
const OUT = __dirname;
const FPS = 30, DUR = 2, PORT = 8766;

const src = execFileSync('git', ['show', '3933b0a:bloom-lab/claude-code-version/index.html'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
const L = n => src[n - 1];
const cut = s => s.length > 150 ? s.slice(0, 150) + ' …' : s;   // 長すぎる1行は「…」で省略（中身は書き換えない）
const ROWS = [
  ...[508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519, 520, 521].map(n => [n, cut(L(n))]),
  ['…'],
  ...[524, 525, 526].map(n => [n, cut(L(n))]),
  ['…'],
  ...[599, 600, 601, 602, 603, 604].map(n => [n, cut(L(n))]),
];
const TOKENS = [
  { key: 'name', line: 511, src: 'モノクロ・ラテ' },
  { key: 'en', line: 511, src: 'Monochrome Latte' },
  { key: 'desc', line: 512, src: 'エスプレッソとスチームミルク。白と黒の二層で提供します。' },
  { key: 'price', line: 511, src: '580' },
  { key: 'art', line: 525, src: 'latte' },
  { key: 'btn', line: 603, src: 'class="add"' },
];
for (const t of TOKENS) if (!cut(L(t.line)).includes(t.src)) throw new Error(`token ${t.key} not on line ${t.line}`);
const artSvg = L(525).match(/`(<svg[\s\S]*?<\/svg>)`/)[1];

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1, locale: 'ja-JP' });
    const p = await ctx.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(`http://127.0.0.1:${PORT}/video/motion-v6/proto-morph.html`);
    await p.evaluate(d => window.__setup(d), { rows: ROWS, tokens: TOKENS, artSvg, appUrl: `http://127.0.0.1:${PORT}/index.html` });
    const cdp = await ctx.newCDPSession(p);

    fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
    const outFile = path.join(OUT, 'proto-code-to-ui-2s.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < FPS * DUR; f++) {
      const t = f / FPS;
      await p.evaluate(t => window.__render(t), t);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 405, height: 720, scale: 1080 / 405 } });
      const png = Buffer.from(shot.data, 'base64');
      ff.stdin.write(png);
      if (f % 3 === 0) fs.writeFileSync(path.join(OUT, 'frames', `f_${String(f / 3).padStart(2, "0")}.png`), png);
    }
    ff.stdin.end();
    await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    if (errors.length) throw new Error(errors.join('\n'));
    // コマ送りの一覧（0.1秒ごと・20コマ）
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'frames', 'f_%02d.png'),
      '-vf', 'scale=216:-1,tile=10x2:padding=6:color=0x222222', '-frames:v', '1', path.join(OUT, 'frames', 'contact.png')]);
    console.log('→', outFile);
  } finally { await b.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
