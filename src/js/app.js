// 主应用逻辑
import { store, recordings } from './storage.js';
import { Recorder, drawWaveform } from './recorder.js';

const AUDIO_BASE = './assets/';
let DATA = null;
let WORDS_DATA = null;
let VOCAB_DATA = null;
let currentScene = null;
let currentTurn = 0;
let currentSpeed = 'normal';
let currentTab = 'patterns';
let currentFilter = 'all';
let audioEl = null;
let recorder = null;
let clipBlob = null;
let clipKey = '';

// ============ DOM helpers ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showToast(msg, ms = 1800) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), ms);
}

// ============ 初始化 ============
async function init() {
  try {
    const resp = await fetch('./data/scenes.json');
    DATA = await resp.json();
  } catch (e) {
    document.body.innerHTML = '<p style="padding:40px;text-align:center">数据加载失败，请刷新重试</p>';
    return;
  }
  // 高频词库 / 场景词库是可选模块，加载失败不影响主功能
  try {
    const wresp = await fetch('./data/highfreq.json');
    if (wresp.ok) WORDS_DATA = await wresp.json();
  } catch (e) { WORDS_DATA = null; }
  try {
    const vresp = await fetch('./data/scene-vocab.json');
    if (vresp.ok) VOCAB_DATA = await vresp.json();
  } catch (e) { VOCAB_DATA = null; }

  recorder = new Recorder();
  audioEl = new Audio();
  audioEl.preload = 'auto';

  $('#statScenes').textContent = DATA.scenes.length;
  const total = DATA.scenes.reduce((s, sc) => s + sc.dialogue.length, 0);
  $('#statSentences').textContent = total;
  updateLearnedStat();

  bindGlobalEvents();
  renderHome();
  showHome();
}

function updateLearnedStat() {
  $('#statLearned').textContent = store.totalLearned();
}

function bindGlobalEvents() {
  $('#backBtn').addEventListener('click', showHome);
  $$('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderHome();
    });
  });
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  $$('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = btn.dataset.speed;
      showToast(currentSpeed === 'slow' ? '慢速朗读' : '正常语速');
    });
  });
  $('#prevTurn').addEventListener('click', () => gotoTurn(currentTurn - 1));
  $('#nextTurn').addEventListener('click', () => gotoTurn(currentTurn + 1));

  // 高频词入口
  const entry = $('#wordEntry');
  if (entry) entry.addEventListener('click', showWords);
  const search = $('#wordSearch');
  if (search) search.addEventListener('input', () => renderWordGroups(search.value.trim()));
  const vsearch = $('#vocabSearch');
  if (vsearch) vsearch.addEventListener('input', () => renderVocab(vsearch.value.trim()));
}

// ============ 首页 ============
function renderHome() {
  const grid = $('#sceneGrid');
  grid.innerHTML = '';
  let scenes = DATA.scenes;
  if (currentFilter === 'travel') scenes = scenes.filter(s => s.category === 'travel');
  else if (currentFilter === 'daily') scenes = scenes.filter(s => s.category === 'daily');

  if (scenes.length === 0) {
    grid.innerHTML = '<p class="panel-hint" style="text-align:center;padding:40px 0">这个分类的场景还在制作中，敬请期待。</p>';
    return;
  }

  scenes.forEach(sc => {
    const prog = store.getSceneProgress(sc.id);
    const total = sc.dialogue.length;
    const pct = Math.round((prog.learned.length / total) * 100);
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.innerHTML = `
      <div class="scene-icon">${sc.icon || '📘'}</div>
      <div class="scene-body">
        <div class="scene-title">${sc.title}<span class="level-tag">${sc.level}</span></div>
        <div class="scene-desc">${sc.description}</div>
        <div class="scene-progress"><div class="scene-progress-fill" style="width:${pct}%"></div></div>
        <span class="scene-pct">已练 ${prog.learned.length}/${total} 句</span>
      </div>
      <svg class="scene-arrow" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;
    card.addEventListener('click', () => openScene(sc));
    grid.appendChild(card);
  });
}

function showHome() {
  $('#homePage').classList.remove('hidden');
  $('#scenePage').classList.add('hidden');
  $('#wordsPage').classList.add('hidden');
  $('#brand').classList.remove('hidden');
  $('#backBtn').classList.add('hidden');
  $('#topTitle').classList.add('hidden');
  stopAudio();
  renderHome();
  updateLearnedStat();
}

// ============ 高频词页 ============
let currentWordGroup = 'all';

function showWords() {
  $('#homePage').classList.add('hidden');
  $('#scenePage').classList.add('hidden');
  $('#wordsPage').classList.remove('hidden');
  $('#brand').classList.add('hidden');
  $('#backBtn').classList.remove('hidden');
  $('#topTitle').classList.remove('hidden');
  $('#topTitle').textContent = '高频词速查';
  currentWordGroup = 'all';
  const search = $('#wordSearch');
  if (search) search.value = '';
  renderWordGroupTabs();
  renderWordGroups('');
  window.scrollTo(0, 0);
}

function renderWordGroupTabs() {
  const tabs = $('#wordGroupTabs');
  tabs.innerHTML = '';
  if (!WORDS_DATA) return;
  const all = document.createElement('button');
  all.className = 'word-group-tab active';
  all.textContent = '全部';
  all.dataset.g = 'all';
  tabs.appendChild(all);
  WORDS_DATA.groups.forEach(g => {
    const b = document.createElement('button');
    b.className = 'word-group-tab';
    b.textContent = g.title;
    b.dataset.g = g.id;
    tabs.appendChild(b);
  });
  tabs.querySelectorAll('.word-group-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('.word-group-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentWordGroup = btn.dataset.g;
      const q = ($('#wordSearch')?.value || '').trim();
      renderWordGroups(q);
    });
  });
}

function renderWordGroups(query) {
  const box = $('#wordGroups');
  box.innerHTML = '';
  if (!WORDS_DATA) {
    box.innerHTML = '<p class="panel-hint">高频词库暂未加载。</p>';
    return;
  }
  const q = query.toLowerCase();
  let totalShown = 0;
  WORDS_DATA.groups.forEach(g => {
    if (currentWordGroup !== 'all' && g.id !== currentWordGroup) return;
    let words = g.words;
    if (q) {
      words = words.filter(w => w.w.toLowerCase().includes(q) || (w.zh || '').includes(query));
    }
    if (!words.length) return;
    totalShown += words.length;
    const section = document.createElement('div');
    section.className = 'word-group';
    const cards = words.map((w, i) => {
      const realIdx = g.words.indexOf(w);
      const hasAudio = !!w.audio;
      return `<div class="word-card" data-audio="${w.audio || ''}">
        <div class="word-card-main">
          <div class="word-en">${w.w}</div>
          <div class="word-ipa">${w.ipa}</div>
        </div>
        <div class="word-zh">${w.zh}</div>
        ${hasAudio ? `<button class="word-play" title="听发音"><svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9z" fill="currentColor" stroke="none"/></svg></button>` : ''}
      </div>`;
    }).join('');
    section.innerHTML = `
      <div class="word-group-head"><span class="word-group-icon">${g.icon || '📖'}</span>${g.title}<span class="word-count">${words.length}</span></div>
      <div class="word-list">${cards}</div>`;
    box.appendChild(section);
  });

  box.querySelectorAll('.word-card').forEach(card => {
    const btn = card.querySelector('.word-play');
    if (btn) btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playAudio('./' + card.dataset.audio, null);
      btn.classList.add('playing');
      audioEl.onended = () => btn.classList.remove('playing');
    });
  });

  if (totalShown === 0) {
    box.innerHTML = '<p class="panel-hint" style="text-align:center;padding:40px 0">没有找到相关单词。</p>';
  }
}

// ============ 场景专属词 ============
function renderVocab(query) {
  const box = $('#vocabGroups');
  if (!box) return;
  box.innerHTML = '';
  const groups = VOCAB_DATA?.scenes?.[currentScene?.id];
  if (!groups || !groups.length) {
    box.innerHTML = '<p class="panel-hint" style="text-align:center;padding:40px 0">本场景词库正在制作中。</p>';
    return;
  }
  const q = (query || '').toLowerCase();
  let total = 0;
  groups.forEach(g => {
    let words = g.words;
    if (q) words = words.filter(w => w.w.toLowerCase().includes(q) || (w.zh || '').includes(query));
    if (!words.length) return;
    total += words.length;
    const cards = words.map(w => `
      <div class="vocab-card" data-audio="${w.audio || ''}">
        <button class="vocab-play" title="听发音"><svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9z" fill="currentColor" stroke="none"/></svg></button>
        <div class="vocab-en">${w.w}</div>
        <div class="vocab-ipa">${w.ipa}</div>
        <div class="vocab-zh">${w.zh}</div>
      </div>`).join('');
    const sec = document.createElement('div');
    sec.className = 'word-group';
    sec.innerHTML = `
      <div class="word-group-head"><span class="word-group-icon">${g.icon || '📖'}</span>${g.title}<span class="word-count">${words.length}</span></div>
      <div class="vocab-grid">${cards}</div>`;
    box.appendChild(sec);
  });
  box.querySelectorAll('.vocab-card').forEach(card => {
    const btn = card.querySelector('.vocab-play');
    if (btn && card.dataset.audio) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playAudio('./' + card.dataset.audio, null);
        btn.classList.add('playing');
        audioEl.onended = () => btn.classList.remove('playing');
      });
    }
  });
  if (total === 0) {
    box.innerHTML = '<p class="panel-hint" style="text-align:center;padding:40px 0">没有找到相关单词。</p>';
  }
}

// ============ 场景页 ============
function openScene(sc) {
  currentScene = sc;
  currentTurn = 0;
  currentTab = 'patterns';
  $('#homePage').classList.add('hidden');
  $('#scenePage').classList.remove('hidden');
  $('#brand').classList.add('hidden');
  $('#backBtn').classList.remove('hidden');
  $('#topTitle').classList.remove('hidden');
  $('#topTitle').textContent = sc.title;
  $('#sceneHead').innerHTML = `<h2>${sc.icon || ''} ${sc.title}</h2><p>${sc.description}</p>`;
  switchTab('patterns');
  window.scrollTo(0, 0);
}

function switchTab(tab) {
  currentTab = tab;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('#panel-patterns').classList.toggle('hidden', tab !== 'patterns');
  $('#panel-dialogue').classList.toggle('hidden', tab !== 'dialogue');
  $('#panel-vocab').classList.toggle('hidden', tab !== 'vocab');
  $('#panel-exercise').classList.toggle('hidden', tab !== 'exercise');
  stopAudio();
  if (tab === 'patterns') renderPatterns();
  else if (tab === 'dialogue') renderTurn();
  else if (tab === 'vocab') {
    const s = $('#vocabSearch'); if (s) s.value = '';
    renderVocab('');
  }
  else renderExercises();
}

// ============ 万能句 ============
function renderPatterns() {
  const box = $('#patternList');
  box.innerHTML = '';
  currentScene.patterns.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'pattern-card';
    const slotsHtml = p.slots.map((s, i) => `<button class="slot-btn" data-p="${idx}" data-i="${i}">${s}</button>`).join('');
    card.innerHTML = `
      <div class="pattern-sentence">${p.sentence}</div>
      <div class="pattern-meaning">${p.meaning}</div>
      <div class="pattern-note">${p.note || ''}</div>
      <div class="slot-label">点一个词填进去 ↓</div>
      <div class="slot-list">${slotsHtml}</div>
      <div class="pattern-live hidden" id="live-${idx}">
        <span class="live-text"></span>
        <button class="play-mini" title="朗读">
          <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9z" fill="currentColor" stroke="none"/></svg>
        </button>
      </div>`;
    box.appendChild(card);
  });

  box.querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = currentScene.patterns[+btn.dataset.p];
      const slot = p.slots[+btn.dataset.i];
      const sentence = p.sentence.replace('___', slot).replace(/__/g, slot);
      const parent = btn.closest('.pattern-card');
      parent.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const live = parent.querySelector('.pattern-live');
      live.classList.remove('hidden');
      live.querySelector('.live-text').textContent = sentence;
      live.querySelector('.play-mini').onclick = () => speakText(sentence);
      speakText(sentence);
    });
  });
}

// 用系统语音朗读取词（仅作为万能句拼句的即时反馈；核心听力仍用预置音频）
function speakText(text) {
  if (!('speechSynthesis' in window)) { showToast('此设备暂不支持朗读'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// ============ 逐句练 ============
function gotoTurn(i) {
  if (i < 0 || i >= currentScene.dialogue.length) return;
  stopAudio();
  currentTurn = i;
  renderTurn();
}

function renderTurn() {
  const turn = currentScene.dialogue[currentTurn];
  const total = currentScene.dialogue.length;
  $('#dlgProgress').textContent = `${currentTurn + 1} / ${total}`;
  $('#dlgProgressFill').style.width = `${((currentTurn + 1) / total) * 100}%`;
  $('#prevTurn').disabled = currentTurn === 0;
  $('#nextTurn').disabled = currentTurn === total - 1;

  // 高亮重点词
  let enHtml = turn.text;
  const keyWords = (turn.words || []).filter(w => w.key).map(w => w.word);
  keyWords.sort((a, b) => b.length - a.length);
  keyWords.forEach(w => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    enHtml = enHtml.replace(new RegExp(`\\b${escaped}\\b`, 'ig'), m => `<span class="key-word">${m}</span>`);
  });

  const wordChips = (turn.words || []).map(w =>
    `<span class="word-chip"><b>${w.word}</b> <span class="ipa">${w.ipa || ''}</span> ${w.meaning}</span>`
  ).join('');
  const alts = (turn.alternatives || []).map(a =>
    `<div class="alt-item"><b>${a.text}</b> <span>· ${a.meaning}</span></div>`
  ).join('');

  const card = $('#dialogueCard');
  card.innerHTML = `
    <div class="turn-card">
      <div class="turn-speaker">
        <div class="speaker-avatar ${turn.speaker.toLowerCase()}">${turn.speaker}</div>
        <span class="speaker-name">${turn.speaker === 'A' ? '你（学习者）' : '对方'}</span>
        <span class="turn-number">第 ${turn.turn} 句</span>
      </div>
      <div class="turn-en">${enHtml}</div>
      <div class="turn-zh">${turn.translation}</div>
      <div class="turn-audio-row">
        <button class="play-btn" id="playOrig">
          <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9z" fill="currentColor" stroke="none"/></svg>
          听原音
        </button>
      </div>
      ${wordChips ? `<div class="word-chips">${wordChips}</div>` : ''}
      ${turn.tip ? `<div class="tip-box">${turn.tip}</div>` : ''}
      ${alts ? `<div class="alt-box"><div class="alt-label">换个说法</div>${alts}</div>` : ''}

      <div class="record-section">
        <div class="record-title">🎤 跟读这一句</div>
        <div class="record-controls">
          <button class="record-btn" id="recBtn" aria-label="录音">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>
          </button>
          <span class="record-status" id="recStatus">点红色按钮开始录音</span>
          <button class="play-mine-btn" id="playMine" disabled>听我的</button>
        </div>
        <div class="waveform-box hidden" id="waveBox">
          <div class="waveform-label">原音波形</div>
          <canvas id="waveOrig"></canvas>
          <div class="waveform-label" style="margin-top:6px">我的波形</div>
          <canvas id="waveMine"></canvas>
        </div>
        <div class="rate-title">给自己打个分</div>
        <div class="rate-row" data-dim="p"><span class="rate-label">发音</span><div class="stars">${starHtml()}</div></div>
        <div class="rate-row" data-dim="f"><span class="rate-label">流利</span><div class="stars">${starHtml()}</div></div>
        <div class="rate-row" data-dim="i"><span class="rate-label">语调</span><div class="stars">${starHtml()}</div></div>
        <div class="rate-saved hidden" id="rateSaved">✓ 已保存</div>
      </div>
    </div>`;

  // 绑定播放
  $('#playOrig').addEventListener('click', (e) => {
    const field = currentSpeed === 'slow' ? 'audioSlow' : 'audio';
    playAudio(AUDIO_BASE + turn[field], e.currentTarget);
  });

  // 重点词点击发音
  card.querySelectorAll('.key-word').forEach(el => {
    el.addEventListener('click', () => speakText(el.textContent));
  });

  // 录音
  setupRecorder(turn);
  // 自评
  setupRating(turn);
  // 载入已有录音
  loadClip(turn);
}

function starHtml() {
  return [1,2,3,4,5].map(n => `<span class="star" data-n="${n}">★</span>`).join('');
}

// ============ 播放器 ============
function playAudio(src, btn) {
  audioEl.src = src;
  audioEl.currentTime = 0;
  audioEl.play().catch(() => showToast('音频播放失败'));
  if (btn) {
    btn.classList.add('playing');
    const orig = btn.innerHTML;
    audioEl.onended = () => { btn.classList.remove('playing'); };
  }
}
function stopAudio() {
  if (audioEl) { audioEl.pause(); }
}

// ============ 录音交互 ============
function setupRecorder(turn) {
  const btn = $('#recBtn');
  const status = $('#recStatus');
  const playMine = $('#playMine');
  clipKey = `${currentScene.id}_${turn.turn}`;

  if (!recorder.supported()) {
    status.textContent = '设备不支持录音，可听原音并自评';
    btn.disabled = true;
  }

  btn.addEventListener('click', async () => {
    if (recorder.isRecording()) {
      recorder.stop();
      btn.classList.remove('recording');
      btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>';
      status.textContent = '录好了，点"听我的"对比';
    } else {
      try {
        await recorder.start();
        btn.classList.add('recording');
        btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';
        status.textContent = '正在录音…再点一次结束';
      } catch (e) {
        showToast('无法使用麦克风，可听原音并自评');
        status.textContent = '未获得录音权限，可听原音并自评';
      }
    }
  });

  recorder.onStop = async (blob) => {
    clipBlob = blob;
    playMine.disabled = false;
    try { await recordings.put(clipKey, blob); } catch {}
    // 画波形
    $('#waveBox').classList.remove('hidden');
    const field = 'audio';
    drawWaveform($('#waveOrig'), AUDIO_BASE + turn[field], '#0d9488');
    drawWaveform($('#waveMine'), blob, '#f59e0b');
    store.markLearned(currentScene.id, currentTurn - 1);
    updateLearnedStat();
  };

  playMine.addEventListener('click', () => {
    if (!clipBlob) return;
    audioEl.src = URL.createObjectURL(clipBlob);
    audioEl.currentTime = 0;
    audioEl.play().catch(() => showToast('播放失败'));
  });
}

async function loadClip(turn) {
  clipKey = `${currentScene.id}_${turn.turn}`;
  try {
    const blob = await recordings.get(clipKey);
    if (blob) {
      clipBlob = blob;
      $('#playMine').disabled = false;
      $('#recStatus').textContent = '已有录音，可重录或播放';
      $('#waveBox').classList.remove('hidden');
      drawWaveform($('#waveOrig'), AUDIO_BASE + turn.audio, '#0d9488');
      drawWaveform($('#waveMine'), blob, '#f59e0b');
    } else {
      clipBlob = null;
    }
  } catch { clipBlob = null; }
  // 恢复自评
  const prog = store.getSceneProgress(currentScene.id);
  const rating = prog.ratings[currentTurn - 1];
  if (rating) {
    $$('.rate-row').forEach(row => {
      const dim = row.dataset.dim;
      const n = rating[dim] || 0;
      row.querySelectorAll('.star').forEach(s => s.classList.toggle('filled', +s.dataset.n <= n));
    });
    $('#rateSaved').classList.remove('hidden');
  }
}

function setupRating(turn) {
  $$('.rate-row').forEach(row => {
    const dim = row.dataset.dim;
    row.querySelectorAll('.star').forEach(star => {
      star.addEventListener('click', () => {
        const n = +star.dataset.n;
        row.querySelectorAll('.star').forEach(s => s.classList.toggle('filled', +s.dataset.n <= n));
        const prog = store.getSceneProgress(currentScene.id);
        const rating = Object.assign({}, prog.ratings[currentTurn - 1] || {}, { [dim]: n });
        store.saveRating(currentScene.id, currentTurn - 1, rating);
        $('#rateSaved').classList.remove('hidden');
        updateLearnedStat();
      });
    });
  });
}

// ============ 练习题 ============
function renderExercises() {
  const box = $('#exerciseList');
  box.innerHTML = '';
  (currentScene.exercises || []).forEach((ex, i) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    const opts = ex.options.map((o, j) =>
      `<div class="option" data-j="${j}"><span class="option-key">${String.fromCharCode(65+j)}</span><span>${o}</span></div>`
    ).join('');
    card.innerHTML = `
      <div class="exercise-q">${i+1}. ${ex.question}</div>
      ${opts}
      <div class="explanation">${ex.explanation || ''}</div>`;
    card.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        const j = +opt.dataset.j;
        const correct = j === ex.answer;
        card.querySelectorAll('.option').forEach((o, k) => {
          o.classList.remove('correct', 'wrong');
          if (k === ex.answer) o.classList.add('correct');
          else if (k === j && !correct) o.classList.add('wrong');
        });
        card.querySelector('.explanation').classList.add('show');
      });
    });
    box.appendChild(card);
  });
  if (!(currentScene.exercises || []).length) {
    box.innerHTML = '<p class="panel-hint">本场景暂无练习题。</p>';
  }
}

init();
