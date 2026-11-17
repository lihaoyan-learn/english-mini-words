// 录音 + 波形模块

export class Recorder {
  constructor() {
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.onStop = null;
    this.startTime = 0;
    this.timer = null;
  }

  supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  async start() {
    if (!this.supported()) throw new Error('unsupported');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    // 选一个可用的 mime
    let mime = '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) { mime = c; break; }
    }
    this.recorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' });
      this.stopStream();
      if (this.onStop) this.onStop(blob);
    };
    this.recorder.start();
    this.startTime = Date.now();
  }

  stop() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  isRecording() {
    return this.recorder && this.recorder.state === 'recording';
  }
}

// 从音频 URL / Blob 解码并画波形到 canvas
export async function drawWaveform(canvas, source, color) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 40;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    let arrayBuffer;
    if (source instanceof Blob) {
      arrayBuffer = await source.arrayBuffer();
    } else {
      const resp = await fetch(source);
      arrayBuffer = await resp.arrayBuffer();
    }
    const audioBuf = await ac.decodeAudioData(arrayBuffer);
    const data = audioBuf.getChannelData(0);

    const bars = 60;
    const step = Math.floor(data.length / bars);
    const mid = h / 2;
    ctx.fillStyle = color;
    for (let i = 0; i < bars; i++) {
      let max = 0;
      const start = i * step;
      for (let j = 0; j < step; j += Math.max(1, Math.floor(step / 20))) {
        const v = Math.abs(data[start + j] || 0);
        if (v > max) max = v;
      }
      const barH = Math.max(2, max * h * 0.9);
      const bw = (w / bars) * 0.6;
      const x = (w / bars) * i + (w / bars) * 0.2;
      ctx.fillRect(x, mid - barH / 2, bw, barH);
    }
    await ac.close();
  } catch (e) {
    // 解码失败时画一条占位线
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(0, h / 2 - 1, w, 2);
  }
}
