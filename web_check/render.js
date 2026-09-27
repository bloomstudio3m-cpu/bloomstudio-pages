// 診断HTMLの .card を1枚ずつPNGに書き出す
// 使い方: node render.js <診断HTML> [出力フォルダ] [ローカルフォントCSS]
// ローカルフォントCSSを渡すと、Google Fontsの読み込みを差し替える（ネットワーク制限がある環境向け）
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const [src, outDir = 'out', fontCss] = process.argv.slice(2);
  let html = fs.readFileSync(src, 'utf8');
  if (fontCss) {
    html = html.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/, `<link rel="stylesheet" href="file://${path.resolve(fontCss)}">`);
  }
  const tmp = path.resolve(path.dirname(src), '.render_tmp.html');
  fs.writeFileSync(tmp, html);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 2400 } });
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(src, '.html');
  const cards = await page.$$('.card');
  for (let i = 0; i < cards.length; i++) {
    await cards[i].screenshot({ path: path.join(outDir, `${base}_${i + 1}.png`) });
  }
  // はみ出しチェック：中身がカードの高さを超えていたら知らせる
  const over = await page.$$eval('.card', els => els.map(e => e.scrollHeight - e.clientHeight));
  over.forEach((o, i) => o > 0 && console.warn(`card${i + 1}: ${o}px はみ出し`));
  await browser.close();
  fs.unlinkSync(tmp);
})();
