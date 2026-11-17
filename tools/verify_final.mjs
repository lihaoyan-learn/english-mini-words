// 最终完整验证：11 场景逐一渲染、四标签页、发音路径、筛选、零运行时错误
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE_URL = process.env.URL || 'http://127.0.0.1:4173/';
import { fileURLToPath } from 'url';
const data = JSON.parse(readFileSync(fileURLToPath(new URL('../public/data/scenes.json', import.meta.url)), 'utf-8'));
const sceneIds = data.scenes.map(s => s.id);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(BASE_URL, { waitUntil: 'networkidle' });

// 拦截 play() 记录真实 src
await page.evaluate(() => {
  window.__audioSrc = '';
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__audioSrc = this.src; return Promise.resolve(); };
});

console.log('场景卡片数:', await page.locator('.scene-card').count(), '(应为', sceneIds.length, ')');
console.log('统计-场景数:', await page.locator('#statScenes').innerText());

// 筛选
await page.locator('.filter-chip[data-filter="daily"]').click();
await page.waitForTimeout(100);
console.log('日常筛选后:', await page.locator('.scene-card').count());
await page.locator('.filter-chip[data-filter="travel"]').click();
await page.waitForTimeout(100);
console.log('出行筛选后:', await page.locator('.scene-card').count());
await page.locator('.filter-chip[data-filter="all"]').click();
await page.waitForTimeout(100);

// 逐个场景验证
const results = [];
for (const sid of sceneIds) {
  // 通过标题找卡片（用 id 无法直接定位，改用遍历匹配标题）
  const scene = data.scenes.find(s => s.id === sid);
  const idx = data.scenes.indexOf(scene);
  await page.locator('.scene-card').nth(idx).click();
  await page.waitForTimeout(80);
  // 万能句
  await page.locator('.tab[data-tab="patterns"]').click();
  await page.waitForTimeout(60);
  const patCount = await page.locator('.pattern-card').count();
  // 逐句练
  await page.locator('.tab[data-tab="dialogue"]').click();
  await page.waitForTimeout(60);
  const turnText = await page.locator('.turn-en').innerText();
  await page.evaluate(() => { window.__audioSrc = ''; });
  await page.locator('#playOrig').click();
  await page.waitForTimeout(80);
  const dlgSrc = await page.evaluate(() => window.__audioSrc);
  // 场景词
  await page.locator('.tab[data-tab="vocab"]').click();
  await page.waitForTimeout(60);
  const vocabCount = await page.locator('.vocab-card').count();
  // 练习
  await page.locator('.tab[data-tab="exercise"]').click();
  await page.waitForTimeout(60);
  const exCount = await page.locator('.exercise-card').count();
  results.push({ sid, pat: patCount, vocab: vocabCount, ex: exCount, dlgSrcOk: dlgSrc.includes(`/audio/${sid}-01.mp3`), firstTurn: turnText.slice(0, 40) });
  await page.locator('#backBtn').click();
  await page.waitForTimeout(60);
}

console.log('\n=== 逐场景结果 ===');
for (const r of results) {
  console.log(`${r.sid.padEnd(12)} 万能句${r.pat} 场景词${r.vocab} 练习${r.ex} 对话音频路径:${r.dlgSrcOk ? 'OK' : 'X'}`);
}

// 抽样 fetch 音频资源
const http = await page.evaluate(async () => {
  const check = async u => { try { return (await fetch(u)).status; } catch { return 'ERR'; } };
  return {
    dialogue: await check('assets/audio/computer-01.mp3'),
    vocab: await check('assets/vocab/computer_website-navigation_00_homepage.mp3').catch(() => 'skip'),
  };
});
console.log('\n资源HTTP抽样:', JSON.stringify(http));
console.log('\n=== 运行时错误 ===');
console.log(errors.length ? errors.join('\n') : '无');
await browser.close();
