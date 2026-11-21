// Tiny procedural sound kit: no audio files, everything synthesized with WebAudio.

let ctx = null;
let master = null;
let noise = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  noise = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(gainNode, t, attack, decay, peak) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function noiseBurst({ freq = 800, q = 1, type = 'lowpass', decay = 0.15, peak = 0.5, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.004, decay, peak);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + decay + 0.05);
}

function tone({ freq = 440, to = freq, type = 'sine', decay = 0.2, peak = 0.3, delay = 0 }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + decay);
  const g = ctx.createGain();
  env(g, t, 0.006, decay, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + decay + 0.05);
}

let lastThud = 0;
export const sfx = {
  thud(intensity = 0.5) {
    if (!ctx || ctx.currentTime - lastThud < 0.03) return;
    lastThud = ctx.currentTime;
    const i = Math.min(1, intensity);
    noiseBurst({ freq: 180 + 300 * i, decay: 0.08 + 0.12 * i, peak: 0.15 + 0.5 * i });
    tone({ freq: 90 + 40 * i, to: 45, decay: 0.12, peak: 0.2 * i });
  },
  crack(intensity = 0.5) {
    noiseBurst({ freq: 2500 + 2500 * intensity, type: 'bandpass', q: 3, decay: 0.07, peak: 0.35 });
    tone({ freq: 1800 + Math.random() * 800, to: 900, type: 'triangle', decay: 0.08, peak: 0.08 });
  },
  shatter() {
    noiseBurst({ freq: 300, decay: 0.25, peak: 0.6 });
    for (let k = 0; k < 7; k++) {
      noiseBurst({ freq: 3000 + Math.random() * 4000, type: 'bandpass', q: 6, decay: 0.05 + Math.random() * 0.1, peak: 0.25, delay: k * 0.03 + Math.random() * 0.03 });
      tone({ freq: 2000 + Math.random() * 3000, to: 1500, type: 'triangle', decay: 0.1, peak: 0.05, delay: k * 0.04 });
    }
  },
  ding() {
    tone({ freq: 988, type: 'triangle', decay: 0.18, peak: 0.25 });
    tone({ freq: 1319, type: 'triangle', decay: 0.35, peak: 0.25, delay: 0.09 });
  },
  grab() {
    tone({ freq: 300, to: 620, type: 'square', decay: 0.07, peak: 0.06 });
  },
  release() {
    tone({ freq: 520, to: 260, type: 'square', decay: 0.07, peak: 0.05 });
  },
  snap() {
    tone({ freq: 900, to: 120, type: 'sawtooth', decay: 0.18, peak: 0.12 });
  },
  whoosh() {
    noiseBurst({ freq: 900, type: 'bandpass', q: 0.8, decay: 0.25, peak: 0.25 });
  },
  buzzer() {
    tone({ freq: 140, to: 120, type: 'sawtooth', decay: 0.9, peak: 0.25 });
    tone({ freq: 147, to: 125, type: 'square', decay: 0.9, peak: 0.12 });
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, k) => tone({ freq: f, type: 'triangle', decay: 0.3, peak: 0.2, delay: k * 0.12 }));
  },
};
