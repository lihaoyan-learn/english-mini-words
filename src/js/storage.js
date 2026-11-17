// 本地存储模块：进度、自评、设置用 localStorage；录音 Blob 用 IndexedDB

const LS_PREFIX = 'sct_'; // 少词多用

export const store = {
  // ---- 设置 ----
  getSetting(key, def) {
    try {
      const v = localStorage.getItem(LS_PREFIX + 'set_' + key);
      return v === null ? def : JSON.parse(v);
    } catch { return def; }
  },
  setSetting(key, val) {
    localStorage.setItem(LS_PREFIX + 'set_' + key, JSON.stringify(val));
  },

  // ---- 学习进度 ----
  // 结构: { [sceneId]: { learned: [turnIndex...], ratings: {turnIndex:{p,f,i}} } }
  getProgress() {
    try {
      return JSON.parse(localStorage.getItem(LS_PREFIX + 'progress') || '{}');
    } catch { return {}; }
  },
  saveProgress(progress) {
    localStorage.setItem(LS_PREFIX + 'progress', JSON.stringify(progress));
  },
  markLearned(sceneId, turnIndex) {
    const p = this.getProgress();
    if (!p[sceneId]) p[sceneId] = { learned: [], ratings: {} };
    if (!p[sceneId].learned.includes(turnIndex)) {
      p[sceneId].learned.push(turnIndex);
    }
    this.saveProgress(p);
  },
  saveRating(sceneId, turnIndex, rating) {
    const p = this.getProgress();
    if (!p[sceneId]) p[sceneId] = { learned: [], ratings: {} };
    p[sceneId].ratings[turnIndex] = rating;
    if (!p[sceneId].learned.includes(turnIndex)) p[sceneId].learned.push(turnIndex);
    this.saveProgress(p);
  },
  getSceneProgress(sceneId) {
    const p = this.getProgress();
    return p[sceneId] || { learned: [], ratings: {} };
  },
  totalLearned() {
    const p = this.getProgress();
    let n = 0;
    for (const k in p) n += (p[k].learned || []).length;
    return n;
  }
};

// ---- IndexedDB：录音 Blob ----
const DB_NAME = 'sct_recordings';
const STORE = 'clips';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const recordings = {
  async put(key, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
};
