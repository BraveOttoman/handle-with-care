// The Grab-O-Matic 3000: a spring "tractor glove" that pulls the grabbed point
// of a body toward a spot in front of the camera. Force is capped, so heavy
// furniture can only be dragged (until your friends show up with more gloves).
import * as THREE from 'three';
import { sfx } from './audio.js';

const RANGE = 4.5;
const SPRING = 85; // 1/s² — stiffness of the hold
const DAMP = 9; // 1/s — under-damped on purpose: things wobble
const MAX_FORCE = 950; // N — piano weighs ~1760 N, so: drag it
const MAX_ACCEL = 70; // m/s² — stops light things from being flung at mach 1
const SNAP_DIST = 2.6;

const v3 = () => new THREE.Vector3();

function rotate(v, q) {
  return new THREE.Vector3(v.x, v.y, v.z).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
}

export class Glove {
  constructor(world, R, camera, scene, grabbables, playerBody) {
    this.world = world;
    this.R = R;
    this.grabbables = grabbables;
    this.playerBody = playerBody;
    this.entry = null;
    this.localPoint = v3();
    this.dist = 2;
    this.strain = 0;
    this.savedDamping = 0;
    this.onRelease = null;
    this.stuckTime = 0;
    this.needsRepress = false; // after losing grip, don't auto-grab whatever is behind it

    // chunky orange glove in the corner of the screen
    const glove = new THREE.Group();
    // Unlit + inked outline: the flashlight sits right next to it and would blow out lit materials.
    const mat = new THREE.MeshBasicMaterial({ color: '#e07a1c' });
    const ink = new THREE.MeshBasicMaterial({ color: '#1a0f08', side: THREE.BackSide });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), mat);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 12), new THREE.MeshBasicMaterial({ color: '#3a3f47' }));
    for (const m of [palm, cuff]) {
      const o = new THREE.Mesh(m.geometry, ink);
      o.scale.setScalar(1.12);
      m.add(o);
    }
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.12;
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: '#7fffd4' }));
    emitter.position.z = -0.09;
    glove.add(palm, cuff, emitter);
    glove.position.set(0.3, -0.26, -0.55);
    glove.scale.setScalar(0.8);
    camera.add(glove);
    this.gloveMesh = glove;
    this.emitter = emitter;

    this.beamMat = new THREE.MeshBasicMaterial({ color: '#7fffd4', transparent: true, opacity: 0.85 });
    this.beam = new THREE.Mesh(new THREE.BufferGeometry(), this.beamMat);
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    scene.add(this.beam);
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), this.beamMat);
    this.tip.visible = false;
    scene.add(this.tip);
  }

  get holding() {
    return this.entry !== null;
  }

  get heldMass() {
    return this.entry ? Math.min(this.entry.body.mass(), 200) : 0;
  }

  get heldColliderHandles() {
    return this.entry ? this.entry.colliderHandles : null;
  }

  /** What's under the crosshair (for tooltips), or null. */
  peek(eye, dir) {
    const hit = this.world.castRay(new this.R.Ray(eye, dir), RANGE, true, undefined, undefined, undefined, this.playerBody);
    if (!hit) return null;
    const body = hit.collider.parent();
    return body ? this.grabbables.get(body.handle) ?? null : null;
  }

  tryGrab(eye, dir) {
    const hit = this.world.castRay(new this.R.Ray(eye, dir), RANGE, true, undefined, undefined, undefined, this.playerBody);
    if (!hit) return;
    const body = hit.collider.parent();
    const entry = body && this.grabbables.get(body.handle);
    if (!entry) return;

    const point = v3().copy(eye).addScaledVector(dir, hit.timeOfImpact);
    const t = body.translation();
    const q = body.rotation();
    const inv = new THREE.Quaternion(q.x, q.y, q.z, q.w).invert();
    this.localPoint.copy(point).sub(t).applyQuaternion(inv);
    this.dist = THREE.MathUtils.clamp(hit.timeOfImpact, 1.1, 3.5);
    this.entry = entry;
    this.stuckTime = 0;
    this.savedDamping = body.angularDamping();
    body.setAngularDamping(3.5);
    body.wakeUp();
    sfx.grab();
  }

  release(quiet = false) {
    if (!this.entry) return;
    const body = this.entry.body;
    if (this.grabbables.has(body.handle)) body.setAngularDamping(this.savedDamping);
    const e = this.entry;
    this.entry = null;
    this.strain = 0;
    if (!quiet) sfx.release();
    this.onRelease?.(e);
  }

  step(cmd, dt, eye, dir, playerVel) {
    if (this.entry && !this.grabbables.has(this.entry.body.handle)) {
      this.release(true); // it got smashed
      this.needsRepress = true;
    }
    if (!cmd.grab) {
      this.release();
      this.needsRepress = false;
      return;
    }
    if (!this.entry) {
      if (this.needsRepress) return;
      this.tryGrab(eye, dir);
      if (!this.entry) return;
    }

    const body = this.entry.body;
    if (cmd.reel) this.dist = THREE.MathUtils.clamp(this.dist - cmd.reel * 0.25, 0.9, 4);

    const target = v3().copy(eye).addScaledVector(dir, this.dist);
    const t = body.translation();
    const p = rotate(this.localPoint, body.rotation()).add(t);
    const com = body.worldCom();
    const lv = body.linvel();
    const av = body.angvel();
    const r = v3().set(p.x - com.x, p.y - com.y, p.z - com.z);
    const vp = v3().set(av.x, av.y, av.z).cross(r).add(lv);

    const err = v3().subVectors(target, p);
    this.stuckTime = err.length() > SNAP_DIST ? this.stuckTime + dt : 0;
    if (this.stuckTime > 0.3 || err.length() > SNAP_DIST * 2) {
      sfx.snap();
      this.release(true);
      this.needsRepress = true;
      return;
    }

    const mass = body.mass();
    const accel = err.multiplyScalar(SPRING).addScaledVector(vp.sub(playerVel), -DAMP);
    accel.y += 9.81; // hold it up against gravity
    const force = accel.multiplyScalar(mass);
    const cap = Math.min(MAX_FORCE, mass * MAX_ACCEL);
    const fLen = force.length();
    this.strain = fLen / cap;
    if (fLen > cap) force.multiplyScalar(cap / fLen);
    body.applyImpulseAtPoint({ x: force.x * dt, y: force.y * dt, z: force.z * dt }, p, true);

    if (cmd.twist) {
      const a = body.angvel();
      body.setAngvel({ x: a.x * 0.9, y: cmd.twist * 2.5, z: a.z * 0.9 }, true);
    }

    if (cmd.throw) {
      const j = Math.min(mass * 11, 90);
      body.applyImpulse({ x: dir.x * j, y: dir.y * j + j * 0.15, z: dir.z * j }, true);
      sfx.whoosh();
      this.release(true);
      this.needsRepress = true;
    }
  }

  render(time) {
    this.gloveMesh.position.y = -0.26 + Math.sin(time * 2) * 0.006 - (this.entry ? 0.01 : 0);
    this.gloveMesh.rotation.x = this.entry ? -0.15 - Math.min(this.strain, 1.5) * 0.08 : 0;

    if (!this.entry) {
      this.beam.visible = this.tip.visible = false;
      this.emitter.material.color.set('#7fffd4');
      return;
    }
    const mesh = this.entry.mesh;
    mesh.updateMatrixWorld();
    const end = mesh.localToWorld(v3().copy(this.localPoint));
    const start = this.emitter.getWorldPosition(v3());
    // bend the beam toward the aim line so it visibly lags behind heavy stuff
    const cam = this.gloveMesh.parent;
    const fwd = cam.getWorldDirection(v3());
    const mid = v3().copy(start).addScaledVector(fwd, start.distanceTo(end) * 0.6);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    this.beam.geometry.dispose();
    this.beam.geometry = new THREE.TubeGeometry(curve, 20, 0.012 + Math.min(this.strain, 1.5) * 0.008, 6, false);
    const s = Math.min(this.strain, 1.2) / 1.2;
    const color = new THREE.Color('#7fffd4').lerp(new THREE.Color(this.strain > 1 ? '#ff4d3d' : '#ffd84d'), s);
    this.beamMat.color.copy(color);
    this.emitter.material.color.copy(color);
    this.tip.position.copy(end);
    this.beam.visible = this.tip.visible = true;
  }
}
