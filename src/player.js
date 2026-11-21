// First-person mover driven by a Rapier kinematic character controller.
import * as THREE from 'three';

const HALF_HEIGHT = 0.5;
const RADIUS = 0.35;
const CENTER_TO_EYE = 0.7; // eye sits ~1.55 m above the feet
const GRAVITY = 20;
const JUMP_SPEED = 6.2;
const WALK = 3.6;
const RUN = 6.2;

export class Player {
  constructor(world, R) {
    this.world = world;
    this.R = R;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 0));
    this.collider = world.createCollider(R.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0), this.body);

    const cc = world.createCharacterController(0.02);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.setApplyImpulsesToDynamicBodies(true);
    cc.setCharacterMass(70);
    cc.enableAutostep(0.35, 0.15, false);
    cc.enableSnapToGround(0.3);
    cc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    cc.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    this.cc = cc;

    this.pos = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.hVel = new THREE.Vector3();
    this.vy = 0;
    this.grounded = false;
    this.velocity = new THREE.Vector3(); // actual velocity last step, for the glove
    this.bobPhase = 0;
    this.ignoreCollider = null; // the thing we're carrying: don't stand on it
  }

  reset(spawn) {
    this.body.setTranslation({ x: spawn[0], y: spawn[1] + HALF_HEIGHT + RADIUS, z: spawn[2] }, true);
    this.body.setNextKinematicTranslation(this.body.translation());
    this.pos.copy(this.body.translation());
    this.prevPos.copy(this.pos);
    this.hVel.set(0, 0, 0);
    this.vy = 0;
  }

  preStep() {
    this.prevPos.copy(this.pos);
  }

  /** @param heldMass mass hanging off the glove: heavy loot slows you down */
  step(cmd, dt, heldMass = 0) {
    const sin = Math.sin(cmd.yaw);
    const cos = Math.cos(cmd.yaw);
    const wish = new THREE.Vector3(
      -sin * cmd.forward + cos * cmd.strafe,
      0,
      -cos * cmd.forward - sin * cmd.strafe,
    );
    if (wish.lengthSq() > 1) wish.normalize();
    const encumbrance = 1 / (1 + heldMass / 80);
    wish.multiplyScalar((cmd.sprint ? RUN : WALK) * encumbrance);

    const accel = this.grounded ? 14 : 3;
    this.hVel.lerp(wish, Math.min(1, accel * dt));

    if (this.grounded && cmd.jump) this.vy = JUMP_SPEED * (0.6 + 0.4 * encumbrance);
    this.vy -= GRAVITY * dt;

    const desired = { x: this.hVel.x * dt, y: this.vy * dt, z: this.hVel.z * dt };
    const skip = this.ignoreCollider;
    this.cc.computeColliderMovement(
      this.collider,
      desired,
      this.R.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      skip ? (c) => !skip.has(c.handle) : undefined,
    );
    const mv = this.cc.computedMovement();
    this.grounded = this.cc.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;
    if (this.vy > 0 && mv.y < desired.y * 0.5) this.vy = 0; // bonked head

    const t = this.body.translation();
    const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    if (next.y < -15) {
      next.x = 0; next.y = 2; next.z = 10; // fell out of the world, try again
      this.vy = 0;
    }
    this.body.setNextKinematicTranslation(next);
    this.velocity.set(mv.x / dt, mv.y / dt, mv.z / dt);

    if (this.grounded) this.bobPhase += this.hVel.length() * dt * 2.2;
  }

  postStep() {
    this.pos.copy(this.body.translation());
  }

  /** Eye position at the end of the latest sim step (used by the glove). */
  eye(out = new THREE.Vector3()) {
    return out.copy(this.body.translation()).add({ x: 0, y: CENTER_TO_EYE, z: 0 });
  }

  /** Smoothed eye position for rendering. */
  renderEye(alpha, out = new THREE.Vector3()) {
    out.lerpVectors(this.prevPos, this.pos, alpha);
    out.y += CENTER_TO_EYE + Math.sin(this.bobPhase * 2) * 0.035 * Math.min(1, this.hVel.length() / WALK);
    return out;
  }

  isInside(zone) {
    const p = this.pos;
    return p.x > zone.min[0] && p.x < zone.max[0] && p.y > zone.min[1] && p.y < zone.max[1] + 1 && p.z > zone.min[2] && p.z < zone.max[2];
  }
}

export function lookDir(yaw, pitch, out = new THREE.Vector3()) {
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}
