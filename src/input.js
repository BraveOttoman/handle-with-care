// Collects raw keyboard/mouse state and turns it into a plain "command" object.
// The simulation only ever sees commands, so a network peer can send the same
// shape later and drive a remote player with no changes to the game code.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared once a sim step consumes them
    this.mouse = [false, false, false];
    this.wheel = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 0.0022;
    this.active = false; // true while playing; gates mouse look and clicks

    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.active && (e.code === 'Space' || e.code === 'Tab')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.fill(false);
    });
    addEventListener('mousedown', (e) => {
      if (!this.active || e.button > 2) return;
      this.mouse[e.button] = true;
      this.pressed.add('Mouse' + e.button);
    });
    addEventListener('mouseup', (e) => {
      if (e.button <= 2) this.mouse[e.button] = false;
    });
    addEventListener('mousemove', (e) => {
      if (!this.active) return;
      // Chrome occasionally reports a huge bogus delta when pointer lock engages; ignore spikes.
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch = clamp(this.pitch - e.movementY * this.sensitivity, -1.45, 1.45);
    });
    addEventListener('wheel', (e) => {
      if (this.active) this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Snapshot of intent for one frame. Plain data: safe to serialize. */
  sample() {
    const k = (c) => this.keys.has(c);
    return {
      forward: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0),
      strafe: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0),
      sprint: k('ShiftLeft') || k('ShiftRight'),
      jump: this.pressed.has('Space'),
      grab: this.mouse[0],
      throw: this.pressed.has('Mouse2'),
      twist: (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0),
      reel: this.wheel,
      interact: this.pressed.has('KeyF'),
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  /** Call after at least one simulation step has used the sampled command. */
  consumeEdges() {
    this.pressed.clear();
    this.wheel = 0;
  }

  reset(yaw = 0, pitch = 0) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.keys.clear();
    this.pressed.clear();
    this.mouse.fill(false);
    this.wheel = 0;
  }
}

/** Strip one-shot fields so extra sim steps in the same frame don't repeat them. */
export function withoutEdges(cmd) {
  return { ...cmd, jump: false, throw: false, interact: false, reel: 0 };
}
