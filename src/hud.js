// DOM overlay: shift card, crosshair, tooltips, floating money popups, toasts.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
export const money = (v) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');

export class Hud {
  constructor(camera) {
    this.camera = camera;
    this.root = $('hud');
    this.el = {
      loaded: $('loaded'), quota: $('quota'), fill: $('quota-fill'), timer: $('timer'),
      cross: $('crosshair'), tip: $('tooltip'), tipName: $('tt-name'), tipValue: $('tt-value'), tipFill: $('tt-fill'),
      strain: $('strain'), strainFill: $('strain-fill'), hint: $('hint'), toasts: $('toasts'), popups: $('popups'),
    };
    this.popups = [];
    this.lastTip = null;
    this.lastHint = null;
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
  }

  setLoaded(v, quota) {
    this.el.loaded.textContent = money(v);
    this.el.quota.textContent = money(quota);
    const f = Math.min(1, v / quota);
    this.el.fill.style.width = (f * 100).toFixed(1) + '%';
    this.el.fill.classList.toggle('met', v >= quota);
  }

  setTimer(sec) {
    const s = Math.max(0, Math.ceil(sec));
    this.el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el.timer.classList.toggle('urgent', s <= 30);
  }

  setCrosshair(state) {
    this.el.cross.classList.toggle('can-grab', state === 'can');
    this.el.cross.classList.toggle('holding', state === 'holding');
  }

  setTooltip(prop) {
    if (!prop) {
      this.el.tip.classList.add('hidden');
      this.lastTip = null;
      return;
    }
    const key = prop.def.name + prop.value + prop.inTruck;
    if (key === this.lastTip) return;
    this.lastTip = key;
    const pct = Math.round(prop.health * 100);
    this.el.tip.classList.remove('hidden');
    this.el.tipName.textContent = prop.def.name;
    const extra = prop.def.note ? ` · ${prop.def.note}` : prop.def.mass > 60 ? ' · heavy: drag it' : '';
    this.el.tipValue.textContent = `${money(prop.value)} · ${pct}% intact${extra}${prop.inTruck ? ' · loaded ✓' : ''}`;
    this.el.tipFill.style.width = pct + '%';
    this.el.tipFill.style.background = pct > 66 ? 'var(--good)' : pct > 33 ? 'var(--warn)' : 'var(--fragile)';
  }

  setStrain(s) {
    if (s == null) {
      this.el.strain.classList.add('hidden');
      return;
    }
    this.el.strain.classList.remove('hidden');
    this.el.strainFill.style.width = Math.min(100, s * 100) + '%';
    this.el.strainFill.style.background = s > 1 ? 'var(--fragile)' : s > 0.7 ? 'var(--warn)' : 'var(--good)';
  }

  hint(text) {
    if (text === this.lastHint) return;
    this.lastHint = text;
    if (text) this.el.hint.textContent = text;
    this.el.hint.classList.toggle('show', !!text);
  }

  toast(text, good = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (good ? ' good' : '');
    t.textContent = text;
    this.el.toasts.prepend(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.lastChild.remove();
    setTimeout(() => t.remove(), 4200);
  }

  popup(worldPos, text, kind = 'loss') {
    const el = document.createElement('div');
    el.className = 'popup ' + kind;
    el.textContent = text;
    this.el.popups.appendChild(el);
    this.popups.push({ el, pos: new THREE.Vector3().copy(worldPos), life: 0, max: kind === 'smash' ? 1.8 : 1.3 });
  }

  update(dt) {
    const w = innerWidth;
    const h = innerHeight;
    const v = new THREE.Vector3();
    this.popups = this.popups.filter((p) => {
      p.life += dt;
      if (p.life >= p.max) {
        p.el.remove();
        return false;
      }
      v.copy(p.pos);
      v.y += p.life * 0.6;
      v.project(this.camera);
      if (v.z > 1) {
        p.el.style.opacity = 0;
        return true;
      }
      const k = p.life / p.max;
      p.el.style.opacity = String(1 - k * k);
      p.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%) scale(${1 + (1 - k) * 0.25})`;
      return true;
    });
  }

  clearTransient() {
    for (const p of this.popups) p.el.remove();
    this.popups = [];
    this.el.toasts.innerHTML = '';
    this.hint(null);
    this.setTooltip(null);
    this.setStrain(null);
  }
}
