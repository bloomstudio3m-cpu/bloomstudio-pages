// 15秒のSNS用操作動画を録画する（Playwright + ffmpeg）
// 使い方: node record-video.js  → video/noir-coffee-claude-code-15s.mp4
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const DIR = __dirname, OUT = path.join(DIR, 'video'), TMP = path.join(OUT, '_raw');
(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    recordVideo: { dir: TMP, size: { width: 780, height: 1688 } } });
  const p = await ctx.newPage();
  // 録画専用：タップ位置を丸で表示（アプリ本体には含めない）
  await p.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '.__tap{position:fixed;z-index:9999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(11,11,11,.25);border:2px solid #f4f2ee;pointer-events:none;animation:__t .5s ease-out forwards}@keyframes __t{to{transform:scale(1.8);opacity:0}}';
      document.head.appendChild(st);
      addEventListener('pointerdown', e => { const d = document.createElement('div'); d.className = '__tap'; d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 600); }, true);
    });
  });
  const t0 = Date.now();
  const at = async ms => { const w = ms - (Date.now() - t0); if (w > 0) await p.waitForTimeout(w); };
  const settle = async () => { let y = -1; for (let i = 0; i < 40; i++) { const ny = await p.evaluate(() => scrollY); if (ny === y) break; y = ny; await p.waitForTimeout(50); } };
  const tap = async sel => { await settle(); const el = p.locator(sel).first(); await el.waitFor({ timeout: 3000 }); const bb = await el.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); };
  const log = [];
  const mark = s => log.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + s);
  await p.goto('file://' + DIR + '/index.html?intro=auto'); mark('静的メニュー表示');
  await at(2800); mark('自動でアプリへ変化');
  await at(6000); await p.evaluate(() => { const m = document.querySelector('#grid [data-id="c2"]'); scrollTo({ top: m.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth' }); }); mark('メニューへスクロール');
  await at(7000); await tap('#grid [data-add="c2"]'); mark('モノクロ・ラテを追加');
  await at(7900); await tap('#grid [data-inc="c2"]'); mark('数量+1');
  await at(8600); await p.evaluate(() => { const el = document.querySelector('#grid [data-id="p3"]'); scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth' }); });
  await at(9700); await tap('#grid [data-add="p3"]'); mark('ソルト・バニラ・カヌレを追加');
  await at(10800); await tap('#barBtn'); mark('注文確認');
  await at(12300); await tap('#dlg [data-place]'); mark('デモ注文完了・ロゴ');
  await at(15600);
  const raw = await p.video().path();
  await ctx.close(); await b.close();
  // 動画の先頭には goto 前の白画面が入るため、ページ表示開始に合わせて切り出す
  const mp4 = path.join(OUT, 'noir-coffee-claude-code-15s.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-i', raw, '-t', '15', '-r', '30',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4]);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(log.join('\n')); console.log('→', mp4);
})();
