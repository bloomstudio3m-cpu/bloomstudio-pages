// Render the original BGM (tools/bgm-synth.js) to hwam-fv/assets/bgm.wav + bgm.mp3
//   node tools/make-bgm.mjs   (FFMPEG env var or ffmpeg on PATH)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'assets');
mkdirSync(assets, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
await page.addScriptTag({ content: readFileSync(path.join(here, 'bgm-synth.js'), 'utf8') });
const b64 = await page.evaluate(async () => {
  const { sr, L, R } = await window.renderBGM(44100);
  const n = L.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true);
  v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let s = ''; const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
});
await browser.close();
const wav = path.join(assets, 'bgm.wav');
writeFileSync(wav, Buffer.from(b64, 'base64'));
const ff = process.env.FFMPEG || 'ffmpeg';
execFileSync(ff, ['-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', path.join(assets, 'bgm.mp3')]);
console.log('wrote', wav, 'and bgm.mp3');
