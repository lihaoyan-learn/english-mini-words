// 严格浏览器验证：实际点击发音按钮，检查 audio.src 与加载状态
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });

// helper：点击播放后读取 <audio> 的 src（app 用单例 audio 元素）
async function clickAndGetSrc(selector) {
  await page.locator(selector).first().click();
  await page.waitForTimeout(150);
  return await page.evaluate(() => {
    const a = document.querySelector('audio') || (window.__audio);
    return a ? a.src : 'NO_AUDIO_ELEMENT';
  });
}

// 首页 -> 高频词页，点发音
await page.locator('#wordEntry').click();
await page.waitForTimeout(200);
console.log('高频词组:', await page.locator('.word-group').count(), '词:', await page.locator('.word-card').count());
// 监听 audio 元素创建：patch
await page.evaluate(() => {
  window.__audioSrc = '';
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { window.__audioSrc = this.src; return Promise.resolve(); };
});
await page.locator('.word-play').first().click();
await page.waitForTimeout(150);
console.log('高频词发音src:', await page.evaluate(() => window.__audioSrc));

// 返回 -> 场景 -> 场景词，点发音
await page.locator('#backBtn').click();
await page.waitForTimeout(150);
await page.locator('.scene-card').first().click();
await page.waitForTimeout(150);
await page.locator('.tab[data-tab="vocab"]').click();
await page.waitForTimeout(200);
console.log('场景词组:', await page.locator('#vocabGroups .word-group').count(), '词:', await page.locator('.vocab-card').count());
await page.evaluate(() => { window.__audioSrc = ''; });
await page.locator('.vocab-play').first().click();
await page.waitForTimeout(150);
console.log('场景词发音src:', await page.evaluate(() => window.__audioSrc));

// 逐句练，点原音
await page.locator('.tab[data-tab="dialogue"]').click();
await page.waitForTimeout(200);
console.log('对话进度:', await page.locator('#dlgProgress').innerText());
console.log('难度标注首句:', await page.locator('.turn-en').innerText());
await page.evaluate(() => { window.__audioSrc = ''; });
await page.locator('#playOrig').click();
await page.waitForTimeout(150);
console.log('对话原音src:', await page.evaluate(() => window.__audioSrc));

// 验证 src 都能 fetch 到
const srcs = await page.evaluate(async () => {
  const results = [];
  const check = async (url) => { try { const r = await fetch(url); return r.status; } catch(e){ return 'ERR'; } };
  results.push(['词音频', await check('assets/words/polite_00_please.mp3')]);
  results.push(['场景词音频', await check('assets/vocab/supermarket_areas_00_entrance.mp3')]);
  results.push(['对话音频', await check('assets/audio/supermarket-01.mp3')]);
  return results;
});
console.log('资源HTTP:', JSON.stringify(srcs));

console.log('=== 运行时错误 ===');
console.log(errors.length ? errors.join('\n') : '无');
await browser.close();
