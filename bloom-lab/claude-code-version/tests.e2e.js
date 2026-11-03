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

  ok('no JS errors', errors.length === 0); if (errors.length) console.log(errors);
  ok('no external network requests', reqs.length === 0); if (reqs.length) console.log(reqs);
  await b.close();
  console.log(results.join('\n'));
  console.log(results.filter(r=>r.startsWith('FAIL')).length + ' failed / ' + results.length);
})();
