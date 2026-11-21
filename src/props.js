// Valuables: catalog, spawning, impact damage, smashing, and render interpolation.
import * as THREE from 'three';
import { textures } from './textures.js';

// Shapes: box size [w,h,d] · cyl [rTop, rBottom, h] · ball r. Positions are from the item's bottom-centre.
// `parts` are visuals, `cols` are physics colliders.
export const CATALOG = {
  vase: {
    name: 'Ming-ish Vase', value: 3200, mass: 4, fragility: 0.35,
    parts: [
      { s: 'cyl', d: [0.13, 0.1, 0.1], p: [0, 0.05, 0], c: '#f3f5f9' },
      { s: 'ball', d: 0.19, p: [0, 0.27, 0], c: '#f3f5f9' },
      { s: 'cyl', d: [0.195, 0.195, 0.06], p: [0, 0.27, 0], c: '#2d4fa3' },
      { s: 'cyl', d: [0.075, 0.1, 0.2], p: [0, 0.5, 0], c: '#f3f5f9' },
      { s: 'cyl', d: [0.1, 0.08, 0.04], p: [0, 0.61, 0], c: '#2d4fa3' },
    ],
    cols: [{ s: 'cyl', d: [0.17, 0.17, 0.63], p: [0, 0.315, 0] }],
  },
  plates: {
    name: "Grandma's Good Plates", value: 900, mass: 8, fragility: 0.3,
    parts: [{ s: 'box', d: [0.6, 0.4, 0.45], p: [0, 0.2, 0], tex: 'cardboard' }],
    cols: [{ s: 'box', d: [0.6, 0.4, 0.45], p: [0, 0.2, 0] }],
  },
  portrait: {
    name: 'Haunted Portrait', value: 2400, mass: 6, fragility: 0.18,
    parts: [
      { s: 'box', d: [1.0, 1.3, 0.08], p: [0, 0.65, 0], c: '#b8892f', metal: 0.6 },
      { s: 'box', d: [0.84, 1.12, 0.09], p: [0, 0.65, 0], tex: 'portrait' },
    ],
    cols: [{ s: 'box', d: [1.0, 1.3, 0.09], p: [0, 0.65, 0] }],
  },
  clock: {
    name: 'Grandfather Clock', value: 5500, mass: 45, fragility: 0.14,
    parts: [
      { s: 'box', d: [0.6, 2.1, 0.45], p: [0, 1.05, 0], c: '#4a2c1a' },
      { s: 'cyl', d: [0.2, 0.2, 0.03], p: [0, 1.75, 0.23], rx: Math.PI / 2, c: '#f1e6c8' },
      { s: 'box', d: [0.04, 0.6, 0.02], p: [0, 1.1, 0.23], c: '#d4a83a', metal: 0.8 },
      { s: 'cyl', d: [0.08, 0.08, 0.02], p: [0, 0.8, 0.235], rx: Math.PI / 2, c: '#d4a83a', metal: 0.8 },
    ],
    cols: [{ s: 'box', d: [0.6, 2.1, 0.45], p: [0, 1.05, 0] }],
  },
  piano: {
    name: 'Upright Piano', value: 12000, mass: 180, fragility: 0.06, friction: 0.35,
    parts: [
      { s: 'box', d: [1.5, 1.25, 0.6], p: [0, 0.625, 0], c: '#151515', rough: 0.25 },
      { s: 'box', d: [1.44, 0.08, 0.28], p: [0, 0.74, 0.42], c: '#151515', rough: 0.25 },
      { s: 'box', d: [1.36, 0.03, 0.22], p: [0, 0.795, 0.43], c: '#f6f2e8' },
    ],
    cols: [
      { s: 'box', d: [1.5, 1.25, 0.6], p: [0, 0.625, 0] },
      { s: 'box', d: [1.44, 0.12, 0.28], p: [0, 0.76, 0.42] },
    ],
  },
  globe: {
    name: 'Crystal Globe', value: 2000, mass: 5, fragility: 0.3,
    parts: [
      { s: 'cyl', d: [0.08, 0.14, 0.1], p: [0, 0.05, 0], c: '#b8892f', metal: 0.7 },
      { s: 'ball', d: 0.22, p: [0, 0.32, 0], c: '#6fb7ff', opacity: 0.75, rough: 0.05, emissive: '#16324d' },
    ],
    cols: [
      { s: 'ball', d: 0.22, p: [0, 0.32, 0] },
      { s: 'cyl', d: [0.14, 0.14, 0.1], p: [0, 0.05, 0] },
    ],
  },
  lava: {
    name: 'Lava Lamp (Vintage)', value: 350, mass: 2, fragility: 0.4,
    parts: [
      { s: 'cyl', d: [0.06, 0.1, 0.12], p: [0, 0.06, 0], c: '#9aa3ad', metal: 0.8 },
      { s: 'cyl', d: [0.07, 0.06, 0.25], p: [0, 0.245, 0], c: '#ff3fa4', emissive: '#ff2f8f', opacity: 0.85 },
      { s: 'cyl', d: [0.035, 0.07, 0.08], p: [0, 0.41, 0], c: '#9aa3ad', metal: 0.8 },
    ],
    cols: [{ s: 'cyl', d: [0.09, 0.09, 0.45], p: [0, 0.225, 0] }],
  },
  duck: {
    name: 'Golden Duck (Solid-ish)', value: 1800, mass: 14, fragility: 0.04,
    parts: [
      { s: 'ball', d: 0.28, p: [0, 0.3, 0], c: '#e8b931', metal: 0.9, rough: 0.25 },
      { s: 'ball', d: 0.16, p: [0, 0.66, 0.16], c: '#e8b931', metal: 0.9, rough: 0.25 },
      { s: 'cyl', d: [0.0, 0.06, 0.14], p: [0, 0.64, 0.33], rx: Math.PI / 2, c: '#ff8a1f' },
    ],
    cols: [
      { s: 'ball', d: 0.28, p: [0, 0.3, 0] },
      { s: 'ball', d: 0.16, p: [0, 0.66, 0.16] },
    ],
  },
  tv: {
    name: 'Cursed CRT TV', value: 600, mass: 18, fragility: 0.16,
    parts: [
      { s: 'box', d: [0.6, 0.5, 0.5], p: [0, 0.25, 0], c: '#5b5e63' },
      { s: 'box', d: [0.48, 0.36, 0.02], p: [0, 0.27, 0.255], c: '#203040', emissive: '#3a6a8a' },
      { s: 'cyl', d: [0.008, 0.008, 0.5], p: [-0.12, 0.68, 0], rz: 0.5, c: '#aaa', metal: 1 },
      { s: 'cyl', d: [0.008, 0.008, 0.5], p: [0.12, 0.68, 0], rz: -0.5, c: '#aaa', metal: 1 },
    ],
    cols: [{ s: 'box', d: [0.6, 0.5, 0.5], p: [0, 0.25, 0] }],
  },
  armchair: {
    name: 'Velvet Armchair', value: 1100, mass: 22, fragility: 0.05,
    parts: [
      { s: 'box', d: [0.9, 0.45, 0.85], p: [0, 0.225, 0], c: '#7a1f2b' },
      { s: 'box', d: [0.9, 0.6, 0.2], p: [0, 0.75, -0.33], c: '#7a1f2b' },
      { s: 'box', d: [0.15, 0.25, 0.85], p: [-0.375, 0.575, 0], c: '#651a24' },
      { s: 'box', d: [0.15, 0.25, 0.85], p: [0.375, 0.575, 0], c: '#651a24' },
    ],
    cols: [
      { s: 'box', d: [0.9, 0.45, 0.85], p: [0, 0.225, 0] },
      { s: 'box', d: [0.9, 0.6, 0.2], p: [0, 0.75, -0.33] },
      { s: 'box', d: [0.15, 0.25, 0.85], p: [-0.375, 0.575, 0] },
      { s: 'box', d: [0.15, 0.25, 0.85], p: [0.375, 0.575, 0] },
    ],
  },
  teapot: {
    name: "Great-Aunt's Teapot", value: 750, mass: 1.5, fragility: 0.45,
    parts: [
      { s: 'ball', d: 0.14, p: [0, 0.14, 0], c: '#e7f0ea' },
      { s: 'cyl', d: [0.02, 0.035, 0.18], p: [0.16, 0.18, 0], rz: -0.9, c: '#e7f0ea' },
      { s: 'torus', d: [0.07, 0.018], p: [-0.15, 0.16, 0], c: '#e7f0ea' },
      { s: 'ball', d: 0.05, p: [0, 0.28, 0], c: '#c7564a' },
    ],
    cols: [{ s: 'ball', d: 0.15, p: [0, 0.15, 0] }],
  },
  table: {
    name: 'Mahogany Table', value: 1600, mass: 35, fragility: 0.06,
    parts: [
      { s: 'box', d: [2.0, 0.08, 1.0], p: [0, 0.76, 0], c: '#5a2a1a', rough: 0.4 },
      ...[[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]].map(([x, z]) => ({ s: 'box', d: [0.08, 0.72, 0.08], p: [x, 0.36, z], c: '#4a2214' })),
    ],
    cols: [
      { s: 'box', d: [2.0, 0.08, 1.0], p: [0, 0.76, 0] },
      ...[[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]].map(([x, z]) => ({ s: 'box', d: [0.08, 0.72, 0.08], p: [x, 0.36, z] })),
    ],
  },
  fishbowl: {
    name: "Gerald's Fishbowl", value: 50, mass: 3, fragility: 0.6, note: 'priceless to Gerald',
    parts: [
      { s: 'ball', d: 0.2, p: [0, 0.2, 0], c: '#cfefff', opacity: 0.35, rough: 0.05 },
      { s: 'ball', d: 0.165, p: [0, 0.18, 0], c: '#3fa7ff', opacity: 0.45 },
      { s: 'box', d: [0.07, 0.04, 0.02], p: [0.03, 0.2, 0], c: '#ff8a1f', emissive: '#7a3000' },
    ],
    cols: [{ s: 'ball', d: 0.2, p: [0, 0.2, 0] }],
  },
};

const DAMAGE_DV = 2.5; // m/s of sudden velocity change before anything gets hurt
const PLAYER_GRACE = 2.5; // extra tolerance for bumping into things with your own body
const THUD_DV = 1.0;
const DAMAGE_SCALE = 0.35;
const SPAWN_GRACE = 1.5; // seconds: let things settle before they count

function geometryFor(part) {
  switch (part.s) {
    case 'box': return new THREE.BoxGeometry(...part.d);
    case 'cyl': return new THREE.CylinderGeometry(part.d[0], part.d[1], part.d[2], 20);
    case 'ball': return new THREE.SphereGeometry(part.d, 20, 14);
    case 'torus': return new THREE.TorusGeometry(part.d[0], part.d[1], 8, 16);
  }
  throw new Error('unknown shape ' + part.s);
}

function materialFor(part) {
  const m = new THREE.MeshStandardMaterial({
    color: part.tex ? '#ffffff' : part.c,
    map: part.tex ? textures[part.tex] : null,
    roughness: part.rough ?? 0.6,
    metalness: part.metal ?? 0,
  });
  if (part.opacity) {
    m.transparent = true;
    m.opacity = part.opacity;
    m.depthWrite = false;
  }
  if (part.emissive) {
    m.emissive.set(part.emissive);
    m.emissiveIntensity = 0.8;
  }
  return rememberBase(m);
}

function rememberBase(m) {
  m.userData.baseEmissive = m.emissive.clone();
  m.userData.baseIntensity = m.emissiveIntensity;
  m.userData.baseColor = m.color.clone();
  return m;
}

function colliderVolume(c) {
  if (c.s === 'box') return c.d[0] * c.d[1] * c.d[2];
  if (c.s === 'cyl') return Math.PI * c.d[0] * c.d[0] * c.d[2];
  return (4 / 3) * Math.PI * c.d ** 3;
}

const HIT_RED = new THREE.Color('#ff2a1a');
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

export class PropManager {
  constructor(scene, world, R, grabbables) {
    this.scene = scene;
    this.world = world;
    this.R = R;
    this.grabbables = grabbables;
    this.props = [];
    this.byCollider = new Map();
    this.synced = []; // {body, mesh, prevP, prevQ, currP, currQ}
    this.debris = [];
    this.playerCollider = null;
    this.time = 0;
    this.onDamage = null; // (prop, lostValue, smashed, cause) => void
    this.onThud = null; // (intensity) => void
  }

  get totalValue() {
    return this.props.reduce((s, p) => s + p.def.value, 0);
  }

  /** Track any dynamic body/mesh pair so it renders smoothly (doors etc). */
  addSynced(body, mesh) {
    const s = {
      body, mesh,
      prevP: new THREE.Vector3(), prevQ: new THREE.Quaternion(),
      currP: new THREE.Vector3(), currQ: new THREE.Quaternion(),
    };
    this.readBody(s);
    s.prevP.copy(s.currP);
    s.prevQ.copy(s.currQ);
    this.synced.push(s);
    return s;
  }

  readBody(s) {
    const t = s.body.translation();
    const q = s.body.rotation();
    s.currP.set(t.x, t.y, t.z);
    s.currQ.set(q.x, q.y, q.z, q.w);
  }

  spawn(type, pos, rotY = 0) {
    const def = CATALOG[type];
    const R = this.R;
    const model = this.models?.get(type);
    const mesh = model ? model.clone(true) : new THREE.Group();
    const materials = [];
    if (model) {
      mesh.position.set(0, 0, 0);
      mesh.quaternion.identity();
      mesh.traverse((o) => {
        if (!o.isMesh) return;
        o.material = rememberBase(o.material.clone()); // each item scuffs and flashes on its own
        o.material.envMap = this.envMap ?? null;
        o.material.envMapIntensity = 0.6;
        materials.push(o.material);
      });
    }
    for (const part of model ? [] : def.parts) {
      const mat = materialFor(part);
      materials.push(mat);
      const m = new THREE.Mesh(geometryFor(part), mat);
      m.position.set(...part.p);
      m.rotation.set(part.rx ?? 0, 0, part.rz ?? 0);
      m.castShadow = !part.opacity;
      m.receiveShadow = true;
      mesh.add(m);
    }
    this.scene.add(mesh);

    tmpQ.setFromEuler(tmpE.set(0, rotY, 0));
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(pos[0], pos[1] + 0.02, pos[2])
        .setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w })
        .setCcdEnabled(def.mass < 10)
        .setLinearDamping(0.05)
        .setAngularDamping(0.3),
    );
    const totalVol = def.cols.reduce((s, c) => s + colliderVolume(c), 0);
    const colliderHandles = new Set();
    const prop = {
      type, def, body, mesh, materials, colliderHandles,
      health: 1, hits: 0, inTruck: false, dead: false,
      spawnedAt: this.time, flash: 0,
      get value() { return Math.round(def.value * this.health); },
    };
    for (const c of def.cols) {
      let desc;
      if (c.s === 'box') desc = R.ColliderDesc.cuboid(c.d[0] / 2, c.d[1] / 2, c.d[2] / 2);
      else if (c.s === 'cyl') desc = R.ColliderDesc.cylinder(c.d[2] / 2, c.d[0]);
      else desc = R.ColliderDesc.ball(c.d);
      desc.setTranslation(...c.p)
        .setMass((def.mass * colliderVolume(c)) / totalVol)
        .setFriction(def.friction ?? 0.6)
        .setRestitution(0.15)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(def.mass * THUD_DV * 60);
      const col = this.world.createCollider(desc, body);
      colliderHandles.add(col.handle);
      this.byCollider.set(col.handle, prop);
    }
    prop.sync = this.addSynced(body, mesh);
    this.props.push(prop);
    this.grabbables.set(body.handle, { body, mesh, prop, colliderHandles });
    return prop;
  }

  spawnAll(spawns) {
    for (const s of spawns) this.spawn(s.type, s.pos, s.rotY ?? 0);
  }

  removeBody(body, mesh) {
    this.grabbables.delete(body.handle);
    this.synced = this.synced.filter((s) => s.body !== body);
    this.world.removeRigidBody(body);
    this.scene.remove(mesh);
    mesh.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (o.material !== this.debrisMat) o.material.dispose?.();
      }
    });
  }

  clear() {
    for (const p of this.props) if (!p.dead) this.removeBody(p.body, p.mesh);
    for (const d of this.debris) this.removeBody(d.body, d.mesh);
    this.props = [];
    this.debris = [];
    this.byCollider.clear();
  }

  preStep() {
    for (const s of this.synced) {
      s.prevP.copy(s.currP);
      s.prevQ.copy(s.currQ);
    }
  }

  postStep(eventQueue, dt) {
    this.time += dt;
    const worst = new Map(); // prop -> {dv, damageDv}
    const player = this.playerCollider;

    eventQueue.drainContactForceEvents((e) => {
      const h1 = e.collider1();
      const h2 = e.collider2();
      const force = e.totalForceMagnitude();
      const playerInvolved = h1 === player || h2 === player;
      for (const h of [h1, h2]) {
        const prop = this.byCollider.get(h);
        if (!prop || prop.dead) continue;
        const dv = (force * dt) / prop.def.mass;
        const dmgDv = dv - (playerInvolved ? PLAYER_GRACE : 0);
        const w = worst.get(prop) ?? { dv: 0, dmgDv: 0 };
        w.dv = Math.max(w.dv, dv);
        w.dmgDv = Math.max(w.dmgDv, dmgDv);
        worst.set(prop, w);
      }
    });

    for (const [prop, w] of worst) {
      if (w.dv > THUD_DV) this.onThud?.(Math.min(1, w.dv / 8) * Math.min(1, 0.4 + prop.def.mass / 30));
      if (this.time - prop.spawnedAt < SPAWN_GRACE) continue;
      const excess = w.dmgDv - DAMAGE_DV;
      if (excess <= 0) continue;
      const dmg = excess * prop.def.fragility * DAMAGE_SCALE;
      if (dmg < 0.015) continue;
      this.damage(prop, dmg);
    }

    for (const s of this.synced) this.readBody(s);
    for (const d of this.debris) d.life -= dt;
    const expired = this.debris.filter((d) => d.life <= 0);
    if (expired.length) {
      for (const d of expired) this.removeBody(d.body, d.mesh);
      this.debris = this.debris.filter((d) => d.life > 0);
    }
  }

  damage(prop, amount) {
    const before = prop.value;
    prop.health = Math.max(0, prop.health - amount);
    prop.hits++;
    prop.flash = 1;
    // permanent scuffing: things get a little darker each hit
    for (const m of prop.materials) m.color.copy(m.userData.baseColor).multiplyScalar(0.55 + 0.45 * prop.health);
    if (prop.health <= 0.05) {
      this.smash(prop, before);
    } else {
      this.onDamage?.(prop, before - prop.value, false);
    }
  }

  smash(prop, lost) {
    prop.dead = true;
    prop.health = 0;
    const center = prop.body.worldCom();
    const vel = prop.body.linvel();
    const colors = prop.def.parts.map((p) => p.c ?? '#c9a26b');
    for (const h of prop.colliderHandles) this.byCollider.delete(h);
    this.removeBody(prop.body, prop.mesh);
    this.onDamage?.(prop, lost, true, center);

    // confetti of regret
    const n = Math.min(14, 6 + Math.round(prop.def.mass / 3));
    const R = this.R;
    for (let i = 0; i < n; i++) {
      const size = 0.05 + Math.random() * 0.1 * Math.min(2, 1 + prop.def.mass / 40);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size * (0.4 + Math.random()), size),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.6 }),
      );
      mesh.castShadow = true;
      this.scene.add(mesh);
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(center.x + (Math.random() - 0.5) * 0.3, center.y + Math.random() * 0.3, center.z + (Math.random() - 0.5) * 0.3)
          .setLinvel(vel.x + (Math.random() - 0.5) * 4, vel.y + Math.random() * 3, vel.z + (Math.random() - 0.5) * 4)
          .setAngvel({ x: Math.random() * 10, y: Math.random() * 10, z: Math.random() * 10 }),
      );
      this.world.createCollider(R.ColliderDesc.cuboid(size / 2, size / 4, size / 2).setDensity(400), body);
      const d = { body, mesh, life: 4 + Math.random() * 2 };
      this.addSynced(body, mesh);
      this.debris.push(d);
    }
  }

  render(alpha, dt) {
    for (const s of this.synced) {
      s.mesh.position.lerpVectors(s.prevP, s.currP, alpha);
      s.mesh.quaternion.slerpQuaternions(s.prevQ, s.currQ, alpha);
    }
    for (const d of this.debris) if (d.life < 1) d.mesh.scale.setScalar(Math.max(0.01, d.life));
    for (const p of this.props) {
      if (p.flash <= 0 || p.dead) continue;
      p.flash = Math.max(0, p.flash - dt * 4);
      for (const m of p.materials) {
        m.emissive.copy(m.userData.baseEmissive).lerp(HIT_RED, p.flash);
        m.emissiveIntensity = Math.max(m.userData.baseIntensity, p.flash * 1.5);
      }
    }
  }

  live() {
    return this.props.filter((p) => !p.dead);
  }
}
