// 浏览器端验证脚本（Playwright）
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });

// 首页
console.log('场景卡片数:', await page.locator('.scene-card').count());
console.log('高频词入口存在:', await page.locator('#wordEntry').count());

// 高频词页
await page.locator('#wordEntry').click();
await page.waitForTimeout(300);
console.log('高频词分组数:', await page.locator('.word-group').count());
console.log('高频词卡片数:', await page.locator('.word-card').count());
console.log('首词:', await page.locator('.word-en').first().innerText(), await page.locator('.word-ipa').first().innerText());
await page.screenshot({ path: 'tools/shot-words.png' });

// 搜索
await page.locator('#wordSearch').fill('water');
await page.waitForTimeout(200);
console.log('搜索water结果数:', await page.locator('.word-card').count());
await page.locator('#wordSearch').fill('');

// 返回首页 -> 场景
await page.locator('#backBtn').click();
await page.waitForTimeout(200);
await page.locator('.scene-card').first().click();
await page.waitForTimeout(300);
// 场景词 tab
await page.locator('.tab[data-tab="vocab"]').click();
await page.waitForTimeout(300);
console.log('场景词组数:', await page.locator('#vocabGroups .word-group').count());
console.log('场景词卡片数:', await page.locator('.vocab-card').count());
console.log('场景词示例:', await page.locator('.vocab-en').first().innerText(), await page.locator('.vocab-ipa').first().innerText());
await page.screenshot({ path: 'tools/shot-vocab.png' });
await page.locator('#vocabSearch').fill('trolley');
await page.waitForTimeout(200);
console.log('场景词搜索trolley:', await page.locator('.vocab-card').count());
await page.locator('#vocabSearch').fill('');

await page.locator('.tab[data-tab="dialogue"]').click();
await page.waitForTimeout(200);
const chips = await page.locator('.word-chip').allInnerTexts();
console.log('音标词条示例:', chips.slice(0, 3).join(' | '));
console.log('进度:', await page.locator('#dlgProgress').innerText());

// 音频
const audioStatus = await page.evaluate(async () => {
  const r = await fetch('./assets/audio/supermarket-01.mp3');
  return r.ok ? 'OK ' + r.headers.get('content-length') : 'FAIL';
});
console.log('对话音频:', audioStatus);
const wordAudio = await page.evaluate(async () => {
  const r = await fetch('./data/highfreq.json');
  const d = await r.json();
  const a = d.groups[0].words[0].audio;
  const r2 = await fetch('./' + a);
  return a + ' -> ' + (r2.ok ? 'OK' : 'FAIL');
});
console.log('高频词音频:', wordAudio);

console.log('=== 运行时错误 ===');
console.log(errors.length ? errors.join('\n') : '无');
await browser.close();
