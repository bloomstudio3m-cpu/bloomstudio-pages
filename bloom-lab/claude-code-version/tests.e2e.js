const { chromium } = require('playwright');
const path = require('path');
const DIR = __dirname;
const URL = 'file://' + DIR + '/index.html';
const SHOTS = DIR + '/screenshots';
const results = []; const ok = (n, c) => { results.push((c ? 'PASS ' : 'FAIL ') + n); };
(async () => {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch();
  const errors = [];
  const reqs = [];
  // ---- mobile
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  let p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type()==='error' && errors.push(m.text()));
  p.on('request', r => { if (!r.url().startsWith('file:')) reqs.push(r.url()); });
  await p.goto(URL); await p.waitForTimeout(1600);
  await p.screenshot({ path: SHOTS + '/01_mobile_hero.png' });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  ok('mobile: no horizontal scroll (' + sw + ')', sw <= 390);
  ok('6 items', await p.locator('.item').count() === 6);
  await p.click('[data-filter="pastry"]');
  ok('filter スイーツ shows 3', await p.locator('.item:not([hidden])').count() === 3);
  await p.click('[data-filter="coffee"]');
  ok('filter ドリンク shows 3', await p.locator('.item:not([hidden])').count() === 3);
  await p.click('[data-filter="all"]');
  await p.locator('#menu').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: SHOTS + '/02_mobile_menu.png' });
  await p.click('#grid [data-add="c2"]'); await p.click('#grid [data-inc="c2"]'); await p.click('#grid [data-add="p3"]');
  ok('bar total 580*2+380=1540', (await p.textContent('#barTotal')) === '¥1,540');
  ok('bar visible', await p.evaluate(() => document.querySelector('#bar').classList.contains('show')));
  await p.click('#grid [data-dec="c2"]');
  ok('dec -> ¥960', (await p.textContent('#barTotal')) === '¥960');
  await p.click('#grid [data-add="c3"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: SHOTS + '/03_mobile_cart_bar.png' });
  await p.click('#barBtn'); await p.waitForTimeout(500);
  ok('review dialog open', await p.evaluate(() => document.querySelector('#dlg').open));
  ok('review shows demo notice', (await p.textContent('#dlg')).includes('送信は行われません'));
  await p.screenshot({ path: SHOTS + '/04_mobile_review.png' });
  await p.click('#dlg [data-remove="c3"]');
  ok('remove in review -> ¥960', (await p.textContent('#dlg .grand')).includes('¥960'));
  await p.click('#dlg [data-place]'); await p.waitForTimeout(500);
  ok('confirm DEMO shown', (await p.textContent('#dlg')).includes('デモ注文が完了しました'));
  await p.screenshot({ path: SHOTS + '/05_mobile_confirm.png' });
  await p.click('#dlg [data-new]');
  ok('cart cleared', (await p.textContent('#countTop')) === '0');
  // empty cart
  await p.click('#openCart');
  ok('empty cart message', (await p.textContent('#dlg')).includes('カートは空です'));
  ok('confirm disabled when empty', await p.locator('#dlg [data-place]').isDisabled());
  await p.keyboard.press('Escape');
  ok('escape closes', !(await p.evaluate(() => document.querySelector('#dlg').open)));
  // max qty
  await p.click('#grid [data-add="c1"]'); for (let i=0;i<25;i++) { if (await p.locator('#grid [data-inc="c1"]').isDisabled()) break; await p.click('#grid [data-inc="c1"]'); }
  ok('max qty 20', (await p.textContent('#grid [data-act="c1"] output')) === '20');
  await ctx.close();

  // ---- intro (SNS)
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL + '?intro=1'); await p.waitForTimeout(300);
  ok('intro visible', await p.isVisible('#intro'));
  await p.screenshot({ path: SHOTS + '/00_mobile_intro_static_menu.png' });
  await p.click('#introGo'); await p.waitForTimeout(2600);
  ok('intro dismissed', await p.evaluate(() => document.querySelector('#intro').hidden));
  ok('hero ready', await p.evaluate(() => document.body.classList.contains('ready')));
  await ctx.close();

  // ---- desktop + keyboard
  ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1600);
  await p.screenshot({ path: SHOTS + '/10_desktop_hero.png' });
  const sw2 = await p.evaluate(() => document.documentElement.scrollWidth);
  ok('desktop: no horizontal scroll', sw2 <= 1440);
  await p.focus('[data-filter="pastry"]'); await p.keyboard.press('Enter');
  ok('keyboard filter', await p.locator('.item:not([hidden])').count() === 3);
  await p.click('[data-filter="all"]');
  await p.focus('#grid [data-add="p1"]'); await p.keyboard.press('Enter');
  ok('keyboard add keeps focus on +', await p.evaluate(() => document.activeElement.dataset.inc === 'p1'));
  await p.keyboard.press('Enter');
  ok('aside total ¥960', (await p.textContent('#asideTotals')).includes('¥960'));
  await p.focus('#asideLines [data-remove="p1"]'); await p.keyboard.press('Enter');
  ok('aside remove', (await p.textContent('#asideLines')).includes('カートは空です'));
  await p.click('#grid [data-add="c1"]'); await p.click('#grid [data-add="p2"]');
  await p.locator('#menu').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.screenshot({ path: SHOTS + '/11_desktop_menu_cart.png' });
  await p.focus('#asideReview'); await p.keyboard.press('Enter');
  ok('focus moved into dialog', await p.evaluate(() => document.querySelector('#dlg').contains(document.activeElement)));
  await p.keyboard.press('Escape');
  ok('focus returns to trigger', await p.evaluate(() => document.activeElement.id === 'asideReview'));
  await ctx.close();

  // ---- reduced motion
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  p = await ctx.newPage();
  await p.goto(URL); await p.waitForTimeout(100);
  const op = await p.evaluate(() => getComputedStyle(document.querySelector('.hero-foot')).opacity);
  ok('reduced motion: hero visible immediately (opacity ' + op + ')', op === '1');
  const mq = await p.evaluate(() => getComputedStyle(document.querySelector('.marquee-track')).animationName);
  ok('reduced motion: marquee stopped', mq === 'none');
  await p.goto(URL + '?intro=1'); await p.click('#introGo'); await p.waitForTimeout(100);
  ok('reduced motion: intro closes instantly', await p.evaluate(() => document.querySelector('#intro').hidden));
  await ctx.close();

  // ---- static menu
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p = await ctx.newPage(); await p.goto('file://' + DIR + '/menu.html');
  await p.screenshot({ path: SHOTS + '/20_static_menu.png', fullPage: true });
  ok('static menu no h-scroll', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  await ctx.close();


  // ---- a11y: intro focus
  ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL + '?intro=1'); await p.waitForTimeout(200);
  ok('a11y intro: initial focus on 注文アプリを開く', await p.evaluate(() => document.activeElement.id === 'introGo'));
  for (let i = 0; i < 5; i++) await p.keyboard.press('Tab');
  ok('a11y intro: Tab stays inside intro', await p.evaluate(() => document.querySelector('#intro').contains(document.activeElement) || document.activeElement === document.body));
  ok('a11y intro: background is inert', await p.evaluate(() => document.querySelector('main').inert === true));
  await p.keyboard.press('Enter'); await p.waitForTimeout(1600);
  ok('a11y intro: focus moves to hero h1 after close', await p.evaluate(() => document.activeElement.id === 'heroTitle'));
  ok('a11y intro: background no longer inert', await p.evaluate(() => document.querySelector('main').inert === false));
  // ---- a11y: announcements + focus retention
  await p.click('#grid [data-add="c1"]'); await p.waitForTimeout(150);
  ok('a11y live: add announced', (await p.textContent('#live')).includes('追加しました'));
  ok('a11y: toast is not double-announced', (await p.getAttribute('#toast', 'aria-hidden')) === 'true');
  await p.focus('#grid [data-dec="c1"]'); await p.keyboard.press('Enter');
  ok('a11y focus: dec to 0 in grid -> focus on 追加', await p.evaluate(() => document.activeElement.dataset.add === 'c1'));
  await p.keyboard.press('Enter'); await p.click('#grid [data-add="p2"]');
  await p.click('#openCart'); await p.waitForTimeout(300);
  await p.focus('#dlg [data-inc="c1"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok('a11y focus: + in dialog keeps focus on +', await p.evaluate(() => document.activeElement.dataset.inc === 'c1' && document.querySelector('#dlg').contains(document.activeElement)));
  ok('a11y live: qty change announced inside dialog', (await p.textContent('#dlgLive')).includes('追加しました'));
  await p.focus('#dlg [data-remove="c1"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok('a11y focus: remove in dialog -> focus stays in dialog on remaining item', await p.evaluate(() => document.querySelector('#dlg').contains(document.activeElement) && document.activeElement.closest('.line') !== null));
  ok('a11y live: removal announced', (await p.textContent('#dlgLive')).includes('削除しました'));
  await p.focus('#dlg [data-remove="p2"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok('a11y focus: removing last item -> focus on 閉じる', await p.evaluate(() => document.activeElement.classList.contains('close')));
  await p.click('#dlg [data-close]'); await p.click('#grid [data-add="p1"]');
  await p.click('#openCart'); await p.click('#dlg [data-place]'); await p.waitForTimeout(200);
  ok('a11y confirm: focus on completion heading', await p.evaluate(() => document.activeElement.id === 'dlgTitle' && document.activeElement.textContent.includes('完了')));
  ok('a11y confirm: completion announced inside dialog', (await p.textContent('#dlgLive')).includes('実際の注文は送信されていません'));
  await ctx.close();

  // ---- device emulation (Chromium engine; not real devices)
  for (const name of ['iPhone SE', 'iPhone 13', 'Pixel 7']) {
    const { devices } = require('playwright');
    ctx = await b.newContext({ ...devices[name], defaultBrowserType: undefined });
    p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(URL); await p.waitForTimeout(1400);
    const vw = await p.evaluate(() => innerWidth);
    ok(`${name}: no horizontal scroll`, (await p.evaluate(() => document.documentElement.scrollWidth)) <= vw);
    const over = await p.evaluate(() => [...document.querySelectorAll('.name, .desc, .price, .add, .filter, .lede')].filter(el => el.scrollWidth > el.clientWidth + 1).length);
    ok(`${name}: no text overflow in cards`, over === 0);
    await p.tap('#grid [data-add="c3"]'); await p.tap('#grid [data-inc="c3"]');
    await p.waitForTimeout(500); const barBox = await p.locator('#bar').boundingBox();
    ok(`${name}: bottom bar pinned to bottom`, Math.abs(barBox.y + barBox.height - (await p.evaluate(() => innerHeight))) < 2);
    await p.tap('#barBtn'); await p.waitForTimeout(400);
    // 日本語の折り返し：行頭に「ュ」「ー」などの小書き文字・長音が来ていないか
    const badStarts = await p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#grid .name, #dlg .line .ln').forEach(h => {
        const r = document.createRange(); let lastTop = null;
        const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('.en') ? 2 : 1 });
        for (let tn; (tn = w.nextNode());) for (let i = 0; i < tn.textContent.length; i++) {
          r.setStart(tn, i); r.setEnd(tn, i + 1); const t = r.getBoundingClientRect().top;
          if (lastTop !== null && t - lastTop > 5 && /[ァィゥェォッャュョーぁぃぅぇぉっゃゅょ]/.test(tn.textContent[i])) bad.push(h.textContent);
          lastTop = t;
        }
      });
      return bad;
    });
    ok(`${name}: no small kana / ー at line start (${badStarts.join(',')})`, badStarts.length === 0);
    const dlgBox = await p.locator('#dlg').boundingBox();
    ok(`${name}: review sheet fits viewport`, dlgBox.y >= 0 && dlgBox.y + dlgBox.height <= (await p.evaluate(() => innerHeight)) + 1);
    ok(`${name}: page scroll locked while sheet open`, (await p.evaluate(() => getComputedStyle(document.documentElement).overflow)) === 'hidden');
    const slug = name.replace(/\s+/g, '_');
    await p.screenshot({ path: SHOTS + `/30_${slug}_review.png` });
    await p.tap('#dlg [data-place]'); await p.waitForTimeout(400);
    ok(`${name}: completion reachable`, (await p.textContent('#dlg')).includes('デモ注文が完了しました'));
    await ctx.close();
  }
  ok('no JS errors', errors.length === 0); if (errors.length) console.log(errors);
  ok('no external network requests', reqs.length === 0); if (reqs.length) console.log(reqs);
  await b.close();
  console.log(results.join('\n'));
  console.log(results.filter(r=>r.startsWith('FAIL')).length + ' failed / ' + results.length);
})();
