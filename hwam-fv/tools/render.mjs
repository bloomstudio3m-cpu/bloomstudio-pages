// Render hwam-fv/index.html to MP4 (1920x1080, 60fps, BGM muxed) or to still frames.
//   node tools/render.mjs                 -> hwam-fv/hwam-fv.mp4 (run tools/make-bgm.mjs first)
//   node tools/render.mjs --stills 1,4.2  -> stills/<t>.png
// Needs Playwright (Chromium) and an ffmpeg with libx264 (FFMPEG env var or ffmpeg on PATH).
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const FPS = 60, DUR = 15;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
// Fetch Google Fonts through curl (uses the system CA / proxy setup) and hand them to the page.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
await page.route(/fonts\.(googleapis|gstatic)\.com/, route => {
  const url = route.request().url();
  const body = execFileSync('curl', ['-sSL', '-A', UA, url], { maxBuffer: 64 << 20 });
  const contentType = url.includes('googleapis') ? 'text/css' : 'font/woff2';
  route.fulfill({ status: 200, body, contentType, headers: { 'access-control-allow-origin': '*' } });
});
await page.goto(pathToFileURL(path.join(here, 'index.html')).href + '?render=1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

const grab = (t, type) => page.evaluate(([t, type]) => {
  window.renderFrame(t);
  return document.getElementById('c').toDataURL(type, 0.95).split(',')[1];
}, [t, type]);

if (stillsArg) {
  const dir = path.join(here, 'stills'); mkdirSync(dir, { recursive: true });
  for (const s of stillsArg.split(',')) {
    writeFileSync(path.join(dir, `${s}.png`), Buffer.from(await grab(+s, 'image/png'), 'base64'));
  }
} else {
  const out = path.join(here, 'fv-video.mp4');
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', [
    '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < FPS * DUR; f++) {
    const buf = Buffer.from(await grab(f / FPS, 'image/jpeg'), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${FPS * DUR}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  const final = path.join(here, 'hwam-fv.mp4');
  execFileSync(process.env.FFMPEG || 'ffmpeg', ['-loglevel', 'error', '-y', '-i', out, '-i', path.join(here, 'assets', 'bgm.wav'),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final]);
  console.log('\nwrote', final, '(+ silent loop', out + ')');
}
await browser.close();
