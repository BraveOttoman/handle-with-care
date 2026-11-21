// The haunted mansion, the yard, and the moving truck.
import * as THREE from 'three';
import { textures, tiled } from './textures.js';

const H = 3.2; // wall height
const T = 0.25; // wall thickness
const DOOR_H = 2.4;

export function buildLevel(scene, world, R) {
  const fixed = world.createRigidBody(R.RigidBodyDesc.fixed());
  const flickers = [];

  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...opts });
  const wallpaper = (len, color) => std({ map: tiled(textures.wallpaper, Math.max(1, len / 2), H / 2), color });

  function box(x, y, z, sx, sy, sz, mat, { collide = true, cast = true, rotX = 0, rotY = 0, friction = 0.7 } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotX, rotY, 0);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collide) {
      const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
      world.createCollider(
        R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2)
          .setTranslation(x, y, z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setFriction(friction),
        fixed,
      );
    }
    return mesh;
  }

  /** Wall along X at depth z, from x1 to x2, with doorway gaps [[a,b], ...]. */
  function wallX(z, x1, x2, gaps, color, outer = null) {
    let cursor = x1;
    const seg = (a, b, y0, y1) => {
      const len = b - a;
      if (outer) {
        // two skins: wallpaper inside, siding outside
        const dz = outer * T * 0.25;
        box((a + b) / 2, (y0 + y1) / 2, z - dz, len, y1 - y0, T / 2, wallpaper(len, color));
        box((a + b) / 2, (y0 + y1) / 2, z + dz, len, y1 - y0, T / 2, std({ color: '#3b2f2a' }));
      } else {
        box((a + b) / 2, (y0 + y1) / 2, z, len, y1 - y0, T, wallpaper(len, color));
      }
    };
    for (const [a, b] of gaps) {
      if (a > cursor) seg(cursor, a, 0, H);
      seg(a, b, DOOR_H, H);
      cursor = b;
    }
    if (cursor < x2) seg(cursor, x2, 0, H);
  }

  /** Wall along Z at x, from z1 to z2, with doorway gaps. */
  function wallZ(x, z1, z2, gaps, color) {
    let cursor = z1;
    const seg = (a, b, y0, y1) => box(x, (y0 + y1) / 2, (a + b) / 2, T, y1 - y0, b - a, wallpaper(b - a, color));
    for (const [a, b] of gaps) {
      if (a > cursor) seg(cursor, a, 0, H);
      seg(a, b, DOOR_H, H);
      cursor = b;
    }
    if (cursor < z2) seg(cursor, z2, 0, H);
  }

  function lamp(x, y, z, color, intensity, distance, flicker = 0) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    scene.add(light);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color }));
    bulb.position.copy(light.position);
    scene.add(bulb);
    if (flicker) flickers.push({ light, bulb, base: intensity, amount: flicker, phase: Math.random() * 100 });
    return light;
  }

  // ---------- Ground & house shell ----------
  box(0, -0.1, -2, 24, 0.2, 20, std({ map: tiled(textures.wood, 10, 8), roughness: 0.6 }));
  box(0, -0.1, 24, 60, 0.2, 32, std({ map: tiled(textures.grass, 20, 12), roughness: 1 }), { cast: false });
  box(0, 0.005, 10, 2.2, 0.01, 4, std({ map: tiled(textures.stone, 1, 2) }), { collide: false, cast: false });
  box(0, H + 0.1, -2, 24.6, 0.2, 20.6, std({ color: '#d9d0bd' }));

  // rugs
  box(-6, 0.006, -6, 6, 0.01, 4, std({ color: '#6e1e24' }), { collide: false, cast: false });
  box(6, 0.006, -6, 4.5, 0.01, 3, std({ color: '#2c3d5c' }), { collide: false, cast: false });

  // roof (purely for looks from the yard)
  const roofMat = std({ color: '#2a2230' });
  box(0, H + 1.6, 3.4, 25.5, 0.25, 7.4, roofMat, { collide: false, rotX: -0.42 });
  box(0, H + 1.6, -7.4, 25.5, 0.25, 7.4, roofMat, { collide: false, rotX: 0.42 });

  const C = { foyer: '#c6d2bf', study: '#b8c7d9', living: '#e3b7a8', dining: '#e6d9a4', outer: '#cfc4ad' };
  wallX(-12, -12.125, 12.125, [], C.outer);
  wallZ(-12, -12, 8, [], C.outer);
  wallZ(12, -12, 8, [], C.outer);
  wallX(8, -12.125, 12.125, [[-1, 1]], C.foyer, 1);
  wallX(0, -12, 12, [[-4, -1.5], [1.5, 4]], C.foyer);
  wallZ(0, -12, 0, [[-7, -4.5]], C.living);
  wallZ(-5, 0, 8, [[3, 5.5]], C.study);

  // ---------- Front door (springs shut behind you, of course) ----------
  const doorMesh = new THREE.Group();
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.34, 0.08), std({ color: '#5a2f1f', roughness: 0.5 }));
  doorPanel.castShadow = doorPanel.receiveShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std({ color: '#d4a83a', metalness: 0.9, roughness: 0.3 }));
  knob.position.set(0.75, -0.1, 0.07);
  const knob2 = knob.clone();
  knob2.position.z = -0.07;
  doorMesh.add(doorPanel, knob, knob2);
  scene.add(doorMesh);
  const doorBody = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(0, 1.2, 8).setAngularDamping(1.5).setLinearDamping(0.5),
  );
  world.createCollider(R.ColliderDesc.cuboid(0.94, 1.17, 0.04).setMass(25), doorBody);
  const hinge = R.JointData.revolute({ x: -0.97, y: 1.2, z: 8 }, { x: -0.97, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  hinge.limitsEnabled = true;
  hinge.limits = [-1.9, 1.9];
  const joint = world.createImpulseJoint(hinge, fixed, doorBody, true);
  joint.configureMotorPosition(0, 25, 8);
  let doorMode = 'closing';
  /** Doors swing shut on their own, unless you shove them wide open: then they latch on a doorstop. */
  function stepDoor() {
    const q = doorBody.rotation();
    const angle = 2 * Math.atan2(q.y, q.w);
    if (doorMode === 'closing' && Math.abs(angle) > 1.15) {
      doorMode = 'latched';
      joint.configureMotorPosition(Math.sign(angle) * 1.8, 60, 10);
    } else if (doorMode === 'latched' && Math.abs(angle) < 0.9) {
      doorMode = 'closing'; // someone pulled it back: let it swing shut again
      joint.configureMotorPosition(0, 25, 8);
    }
  }
  function resetDoor() {
    doorMode = 'closing';
    joint.configureMotorPosition(0, 25, 8);
  }

  // ---------- Study ----------
  const shelfMat = std({ color: '#3d2617' });
  const bookGeo = new THREE.BoxGeometry(0.08, 0.32, 0.26);
  const bookMat = std({ roughness: 0.7 });
  const books = new THREE.InstancedMesh(bookGeo, bookMat, 3 * 4 * 16);
  let bi = 0;
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  for (const z of [1.5, 3.6, 6.6]) {
    box(-11.7, 1.3, z, 0.4, 2.6, 1.6, shelfMat);
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 16; k++) {
        const h = 0.24 + Math.random() * 0.1;
        m4.makeScale(1, h / 0.32, 1).setPosition(-11.45, 0.3 + row * 0.62 + h / 2, z - 0.7 + k * 0.09);
        books.setMatrixAt(bi, m4);
        books.setColorAt(bi++, col.setHSL(Math.random(), 0.45, 0.3 + Math.random() * 0.2));
      }
    }
  }
  books.castShadow = true;
  scene.add(books);
  // desk
  box(-8.5, 0.75, 1.2, 2.2, 0.08, 1.0, shelfMat);
  for (const [x, z] of [[-9.5, 0.8], [-7.5, 0.8], [-9.5, 1.6], [-7.5, 1.6]]) box(x, 0.355, z, 0.08, 0.71, 0.08, shelfMat);
  lamp(-8.5, 2.7, 4.5, '#cfe6ff', 18, 11);

  // ---------- Foyer ----------
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1, 16), std({ color: '#e8e2d6', roughness: 0.4 }));
  pedestal.position.set(3, 0.5, 5);
  pedestal.castShadow = pedestal.receiveShadow = true;
  scene.add(pedestal);
  world.createCollider(R.ColliderDesc.cylinder(0.5, 0.25).setTranslation(3, 0.5, 5), fixed);
  lamp(3.5, 2.85, 4, '#ffd9a0', 30, 14);
  // chandelier crystals
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), std({ color: '#fff4dc', emissive: '#ffcf80', emissiveIntensity: 0.6 }));
    c.position.set(3.5 + Math.cos(a) * 0.35, 2.7, 4 + Math.sin(a) * 0.35);
    scene.add(c);
  }

  // ---------- Living room ----------
  const brick = std({ color: '#6b3a2e' });
  box(-6, 0.7, -11.6, 2.6, 1.4, 0.6, brick);
  box(-6, 1.45, -11.55, 3.0, 0.1, 0.75, shelfMat);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshBasicMaterial({ color: '#ff7a1a' }));
  fire.position.set(-6, 0.45, -11.29);
  scene.add(fire);
  lamp(-6, 0.9, -10.9, '#ff8a3a', 14, 9, 0.35);
  lamp(-5, 2.85, -5, '#ffd0a0', 10, 11);

  // ---------- Dining room ----------
  box(6, 0.45, -11.6, 3, 0.9, 0.5, shelfMat);
  lamp(6, 2.85, -6, '#ffe2b0', 24, 12, 1); // this one is... unwell

  // ---------- Yard & hedges ----------
  const hedge = std({ color: '#1f3a1f', roughness: 1 });
  box(-13.2, 1, 17, 1.2, 2, 18, hedge);
  box(13.2, 1, 17, 1.2, 2, 18, hedge);
  box(0, 1, 26.5, 27.6, 2, 1.2, hedge);
  lamp(1.6, 2.6, 8.45, '#ffc070', 8, 8, 0.15);

  // moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshBasicMaterial({ color: '#f1f4ff', fog: false }));
  moon.position.set(-60, 55, 90);
  scene.add(moon);

  // ---------- The truck ----------
  const truckWhite = std({ color: '#f2efe6', roughness: 0.5 });
  const sideMat = std({ map: textures.truckSide, roughness: 0.5 });
  const BED_Y = 0.9;
  box(0, BED_Y - 0.15, 18, 2.9, 0.3, 6, std({ map: tiled(textures.wood, 2, 4), color: '#b0a090' }));
  box(-1.5, BED_Y + 1.25, 18, 0.1, 2.5, 6, sideMat);
  box(1.5, BED_Y + 1.25, 18, 0.1, 2.5, 6, sideMat);
  box(0, BED_Y + 1.25, 21.05, 3.1, 2.5, 0.1, truckWhite);
  box(0, BED_Y + 2.55, 18, 3.1, 0.1, 6.2, truckWhite);
  // cab
  box(0, 1.55, 22.4, 2.9, 2.1, 2.4, std({ color: '#d8392f', roughness: 0.4 }));
  box(0, 2.0, 23.62, 2.6, 0.9, 0.05, std({ color: '#1d2a3a', roughness: 0.1, metalness: 0.5 }), { collide: false });
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 18);
  const wheelMat = std({ color: '#151515' });
  for (const z of [16, 20, 22.6]) {
    for (const x of [-1.45, 1.45]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.45, z);
      w.castShadow = true;
      scene.add(w);
    }
  }
  // ramp from the yard up into the bed
  const rampLen = Math.hypot(3, BED_Y);
  const rampAngle = Math.atan2(BED_Y, 3);
  box(0, BED_Y / 2 - 0.05 * Math.cos(rampAngle), 13.5 + 0.05 * Math.sin(rampAngle), 2.4, 0.1, rampLen, std({ color: '#8a8f96', metalness: 0.6, roughness: 0.4 }), { rotX: -rampAngle });
  // drop zone decal
  const zoneDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 5.8),
    new THREE.MeshBasicMaterial({ map: textures.dropZone, transparent: true, depthWrite: false }),
  );
  zoneDecal.rotation.x = -Math.PI / 2;
  zoneDecal.position.set(0, BED_Y + 0.01, 18);
  scene.add(zoneDecal);
  // the "go home" button
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 20), new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 0.6 }));
  button.rotation.x = Math.PI / 2;
  button.position.set(0.9, BED_Y + 1.3, 20.95);
  scene.add(button);
  lamp(0, BED_Y + 2.3, 18, '#fff0d0', 14, 7);

  // ---------- Sky lights ----------
  scene.add(new THREE.HemisphereLight('#4a5a85', '#1a140e', 0.8));
  const moonLight = new THREE.DirectionalLight('#a9bbff', 1.4);
  moonLight.position.set(-20, 30, 40);
  moonLight.target.position.set(0, 0, 10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonLight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
  moonLight.shadow.bias = -0.0005;
  scene.add(moonLight, moonLight.target);

  const truckZone = { min: [-1.45, BED_Y - 0.1, 15], max: [1.45, BED_Y + 2.5, 21] };

  // ---------- Where the valuables start ----------
  const spawns = [
    // foyer
    { type: 'vase', pos: [3, 1.0, 5] },
    { type: 'armchair', pos: [8, 0, 6.5], rotY: Math.PI },
    { type: 'clock', pos: [11.5, 0, 1.5], rotY: -Math.PI / 2 },
    { type: 'plates', pos: [-3, 0, 6.5], rotY: 0.3 },
    // study
    { type: 'globe', pos: [-9.1, 0.79, 1.2] },
    { type: 'tv', pos: [-8.2, 0.79, 1.15], rotY: 0.2 },
    { type: 'lava', pos: [-7.6, 0.79, 1.3] },
    { type: 'portrait', pos: [-6, 0, 7.5], rotY: Math.PI },
    { type: 'duck', pos: [-10.3, 0, 4.6], rotY: Math.PI / 2 },
    // living room
    { type: 'piano', pos: [-9.5, 0, -11.4] },
    { type: 'armchair', pos: [-4, 0, -4], rotY: 2.4 },
    { type: 'vase', pos: [-6.9, 1.5, -11.6] },
    { type: 'lava', pos: [-5.1, 1.5, -11.6] },
    { type: 'portrait', pos: [-2, 0, -11.75] },
    // dining room
    { type: 'table', pos: [6, 0, -6] },
    { type: 'vase', pos: [5.2, 0.8, -6] },
    { type: 'teapot', pos: [6.8, 0.8, -5.8] },
    { type: 'fishbowl', pos: [6.2, 0.8, -6.3] },
    { type: 'teapot', pos: [5, 0.9, -11.6] },
    { type: 'plates', pos: [10.5, 0, -10.5], rotY: -0.4 },
  ];

  function update(time) {
    for (const f of flickers) {
      const n = Math.sin(time * 13 + f.phase) * Math.sin(time * 7.3 + f.phase * 2);
      let k = 1 + n * 0.25 * f.amount;
      if (f.amount >= 1) k = Math.sin(time * 0.7 + f.phase) > 0.93 ? (Math.random() > 0.5 ? 0.05 : 1) : 1; // spooky blackout stutter
      f.light.intensity = f.base * k;
      f.bulb.visible = k > 0.3;
    }
    fire.scale.y = 0.9 + Math.sin(time * 9) * 0.08 + Math.sin(time * 23) * 0.04;
  }

  return {
    spawns,
    truckZone,
    playerSpawn: [0, 0.01, 10.6],
    door: { body: doorBody, mesh: doorMesh, step: stepDoor, reset: resetDoor },
    update,
  };
}
