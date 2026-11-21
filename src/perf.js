import { Vector2 } from 'three';

// Frame-time monitor, graphics presets, and automatic quality scaling.
// The renderer scale and shadows are the two big GPU costs in this game, so
// those are the knobs. Physics and game logic cost well under a millisecond.

const PRESETS = {
  high: { label: 'High', scale: 2, flashShadow: true, moonShadow: 2048 },
  medium: { label: 'Medium', scale: 1.25, flashShadow: false, moonShadow: 1024 },
  low: { label: 'Low', scale: 0.8, flashShadow: false, moonShadow: 0 },
};
const ORDER = ['high', 'medium', 'low'];
const STORE_KEY = 'hwc.graphics';

function load() {
  try {
    return localStorage.getItem(STORE_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}
function save(v) {
  try {
    localStorage.setItem(STORE_KEY, v);
  } catch {
    /* private window: fine, just don't remember */
  }
}

/** Which GPU the browser is really drawing with (often the integrated one on laptops). */
export function gpuName(renderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  // "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x...) Direct3D11 vs_5_0 ps_5_0, D3D11)" -> "NVIDIA GeForce RTX 3060"
  const m = /ANGLE \([^,]*,\s*([^,(]+)/.exec(raw);
  const short = isSoftwareGpu(raw) ? 'Software renderer (no graphics card!)' : (m ? m[1] : raw).trim();
  return { raw, short };
}

export function isSoftwareGpu(name) {
  return /swiftshader|llvmpipe|softpipe|basic render|microsoft basic/i.test(name);
}

export class Perf {
  constructor(renderer, lights, { moonShadows = true } = {}) {
    this.renderer = renderer;
    this.moonShadows = moonShadows;
    this.lights = lights; // { flashlight, moon }
    this.choice = load(); // 'auto' | 'high' | 'medium' | 'low'
    this.tier = this.choice === 'auto' ? 'high' : this.choice;
    this.scale = 1;
    this.ema = 16.7;
    this.window = [];
    this.lastAdjust = 0;
    this.gpu = gpuName(renderer);
    this.onChange = null;

    this.el = document.createElement('div');
    this.el.id = 'perf';
    this.el.hidden = true;
    document.body.appendChild(this.el);
    if (/[?&]fps\b/.test(location.search)) this.el.hidden = false;
    addEventListener('keydown', (e) => {
      if (e.code === 'F3' || e.code === 'Backquote') {
        e.preventDefault();
        this.el.hidden = !this.el.hidden;
      }
    });
    this.apply();
  }

  maxScale() {
    return Math.min(devicePixelRatio || 1, PRESETS[this.tier].scale);
  }

  apply() {
    const p = PRESETS[this.tier];
    this.scale = this.maxScale();
    this.renderer.setPixelRatio(this.scale);
    this.renderer.setSize(innerWidth, innerHeight);

    const { flashlight, moon } = this.lights;
    flashlight.castShadow = p.flashShadow;
    moon.castShadow = this.moonShadows && p.moonShadow > 0;
    if (p.moonShadow && moon.shadow.mapSize.x !== p.moonShadow) {
      moon.shadow.mapSize.set(p.moonShadow, p.moonShadow);
      moon.shadow.map?.dispose();
      moon.shadow.map = null;
    }
    this.renderer.shadowMap.enabled = p.flashShadow || moon.castShadow;
    this.renderer.shadowMap.needsUpdate = true;
    this.onChange?.(this);
  }

  set(choice) {
    this.choice = choice;
    save(choice);
    this.tier = choice === 'auto' ? 'high' : choice;
    this.window = [];
    this.apply();
  }

  /** Feed every frame's delta (ms). Only adapts while actually playing. */
  frame(ms, playing, now) {
    if (!this.el.hidden && now - (this.lastDraw ?? 0) > 250) {
      this.lastDraw = now;
      this.draw();
    }
    if (ms > 1500) return; // tab was hidden or the window was dragged
    this.ema += (ms - this.ema) * 0.1;
    if (!playing || this.choice !== 'auto') return;

    this.window.push(ms);
    if (now - this.lastAdjust < 1500 || this.window.length < 8) return;
    const sorted = [...this.window].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    this.window = [];
    this.lastAdjust = now;

    if (p75 > 21) {
      // under ~48 fps: shed resolution first, then shadows
      if (this.scale > 0.65) {
        this.scale = Math.max(0.6, this.scale - 0.2);
        this.renderer.setPixelRatio(this.scale);
        this.renderer.setSize(innerWidth, innerHeight);
      } else if (this.tier !== 'low') {
        const keep = this.scale;
        this.tier = ORDER[ORDER.indexOf(this.tier) + 1];
        this.apply();
        this.scale = Math.min(this.maxScale(), keep);
        this.renderer.setPixelRatio(this.scale);
        this.renderer.setSize(innerWidth, innerHeight);
      }
      this.onChange?.(this);
    } else if (p75 < 11 && this.scale < this.maxScale()) {
      this.scale = Math.min(this.maxScale(), this.scale + 0.1);
      this.renderer.setPixelRatio(this.scale);
      this.renderer.setSize(innerWidth, innerHeight);
      this.onChange?.(this);
    }
  }

  /** Call right after renderer.render so the overlay reports a whole frame. */
  afterRender() {
    const r = this.renderer.info.render;
    (this.lastInfo ??= {}).calls = r.calls;
    this.lastInfo.triangles = r.triangles;
  }

  get label() {
    return (this.choice === 'auto' ? 'Auto · ' : '') + PRESETS[this.tier].label;
  }

  draw() {
    const fps = 1000 / this.ema;
    const c = this.renderer.getDrawingBufferSize(this.size ??= new Vector2());
    const info = this.lastInfo ?? this.renderer.info.render;
    this.el.textContent =
      `${fps.toFixed(0)} fps · ${this.ema.toFixed(1)} ms\n` +
      `${c.x}×${c.y} @ ${this.scale.toFixed(2)}x · ${this.label}\n` +
      `${info.calls} draws · ${(info.triangles / 1000).toFixed(1)}k tris\n` +
      `GPU: ${this.gpu.short}`;
    this.el.classList.toggle('bad', fps < 45);
  }
}
