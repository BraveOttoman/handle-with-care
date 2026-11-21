// The haunted mansion, the yard, and the moving truck.
// Geometry comes from layout.js. Colliders are always built from it; visuals come from
// the Blender-baked mansion.glb when it's available, or simple primitives otherwise.
import * as THREE from 'three';
import { textures, tiled } from './textures.js';
import { buildLayout } from './layout.js';
import { flickerUniform, LIGHTMAP_INTENSITY } from './assets.js';

export function buildLevel(scene, world, R, assets = {}) {
  const L = buildLayout();
  const { H, BED_Y } = L;
  const baked = !!assets.mansion;
  const fixed = world.createRigidBody(R.RigidBodyDesc.fixed());
  const flickers = [];

  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...opts });

  // ---------- colliders (always) + primitive visuals (fallback) ----------
  const shelfMat = std({ color: '#3d2617' });
  const flat = {
    ceiling: std({ color: '#d9d0bd' }), 'rug-red': std({ color: '#6e1e24' }), 'rug-blue': std({ color: '#2c3d5c' }),
    roof: std({ color: '#2a2230' }), 'porch-roof': std({ color: '#2a2230' }), siding: std({ color: '#3b2f2a' }),
    shelf: shelfMat, brick: std({ color: '#6b3a2e' }), hedge: std({ color: '#1f3a1f', roughness: 1 }),
    column: std({ color: '#e9dfc8' }), 'truck-white': std({ color: '#f2efe6', roughness: 0.5 }),
    'truck-red': std({ color: '#d8392f', roughness: 0.4 }), glass: std({ color: '#1d2a3a', roughness: 0.1, metalness: 0.5 }),
    ramp: std({ color: '#8a8f96', metalness: 0.6, roughness: 0.4 }), 'truck-side': std({ map: textures.truckSide, roughness: 0.5 }),
  };
  const matFor = (b) => {
    const [w, , d] = b.s;
    switch (b.mat) {
      case 'floor': return std({ map: tiled(textures.wood, w / 2.4, d / 2.5), roughness: 0.6 });
      case 'grass': return std({ map: tiled(textures.grass, w / 3, d / 2.7), roughness: 1 });
      case 'path': return std({ map: tiled(textures.stone, 1, 2) });
      case 'truck-bed': return std({ map: tiled(textures.wood, 2, 4), color: '#b0a090' });
      case 'wall': return std({ map: tiled(textures.wallpaper, Math.max(1, b.wall.len / 2), H / 2), color: L.roomColors[b.wall.room] });
      default: return flat[b.mat];
    }
  };

  for (const b of L.boxes) {
    const rot = new THREE.Euler(b.rotX ?? 0, 0, 0);
    if (b.collide) {
      const q = new THREE.Quaternion().setFromEuler(rot);
      world.createCollider(
        R.ColliderDesc.cuboid(b.s[0] / 2, b.s[1] / 2, b.s[2] / 2)
          .setTranslation(...b.p)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setFriction(0.7),
        fixed,
      );
    }
    if (!baked) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.s), matFor(b));
      mesh.position.set(...b.p);
      mesh.rotation.copy(rot);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  const ped = L.pedestal;
  world.createCollider(R.ColliderDesc.cylinder(ped.h / 2, ped.r).setTranslation(ped.p[0], ped.h / 2, ped.p[2]), fixed);

  if (baked) {
    scene.add(assets.mansion);
  } else {
    // fallback dressing
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.32, 0.26), std({ roughness: 0.7 }), L.shelves.length * 64);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    let bi = 0;
    for (const [x, z] of L.shelves) {
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 16; k++) {
          const h = 0.24 + Math.random() * 0.1;
          m4.makeScale(1, h / 0.32, 1).setPosition(x + 0.25, 0.3 + row * 0.62 + h / 2, z - 0.7 + k * 0.09);
          books.setMatrixAt(bi, m4);
          books.setColorAt(bi++, col.setHSL(Math.random(), 0.45, 0.3 + Math.random() * 0.2));
        }
      }
    }
    books.castShadow = true;
    scene.add(books);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1, 16), std({ color: '#e8e2d6', roughness: 0.4 }));
    pedestal.position.set(ped.p[0], 0.5, ped.p[2]);
    pedestal.castShadow = pedestal.receiveShadow = true;
    scene.add(pedestal);
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 18);
    const wheelMat = std({ color: '#151515' });
    for (const [x, y, z] of L.wheels) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      w.castShadow = true;
      scene.add(w);
    }
  }

  // ---------- lamps: real-time for props and people; walls use the bake ----------
  let flickerLamp = null;
  for (const l of L.lamps) {
    const light = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    light.position.set(...l.p);
    scene.add(light);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: l.color }));
    bulb.position.copy(light.position);
    if (l.fixture !== 'fire' && l.fixture !== 'chandelier') scene.add(bulb);
    const f = { light, bulb, base: l.intensity, amount: l.flicker ?? 0, phase: Math.random() * 100, k: 1 };
    if (l.flicker) flickers.push(f);
    if (l.bake === 'flicker') flickerLamp = f;
  }
  if (!baked) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), std({ color: '#fff4dc', emissive: '#ffcf80', emissiveIntensity: 0.6 }));
      c.position.set(3.5 + Math.cos(a) * 0.35, 2.7, 4 + Math.sin(a) * 0.35);
      scene.add(c);
    }
  }

  // ---------- front door (springs shut behind you, of course) ----------
  const dl = L.door;
  let doorMesh;
  const doorModel = assets.props?.get('door');
  if (doorModel) {
    doorMesh = doorModel.clone(true);
  } else {
    doorMesh = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(...dl.size), std({ color: '#5a2f1f', roughness: 0.5 }));
    panel.castShadow = panel.receiveShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std({ color: '#d4a83a', metalness: 0.9, roughness: 0.3 }));
    knob.position.set(0.75, -0.1, 0.07);
    const knob2 = knob.clone();
    knob2.position.z = -0.07;
    doorMesh.add(panel, knob, knob2);
  }
  scene.add(doorMesh);
  const doorBody = world.createRigidBody(
    R.RigidBodyDesc.dynamic().setTranslation(...dl.center).setAngularDamping(1.5).setLinearDamping(0.5),
  );
  world.createCollider(R.ColliderDesc.cuboid(0.94, 1.17, 0.04).setMass(25), doorBody);
  const hinge = R.JointData.revolute(
    { x: dl.hinge[0], y: dl.hinge[1], z: dl.hinge[2] },
    { x: dl.hinge[0] - dl.center[0], y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  );
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

  // ---------- animated bits that stay in code ----------
  const fireMat = new THREE.MeshBasicMaterial({
    map: textures.flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const fire = new THREE.Group();
  for (const [dx, w] of [[-0.12, 0.7], [0.14, 0.6], [0, 0.85]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.62), fireMat);
    f.position.set(dx, 0.31, 0);
    fire.add(f);
  }
  fire.position.set(-6, 0.12, baked ? -11.55 : -11.28);
  scene.add(fire);

  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshBasicMaterial({ color: '#f1f4ff', fog: false }));
  moonDisc.position.set(-60, 55, 90);
  scene.add(moonDisc);

  const zoneDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 5.8),
    new THREE.MeshBasicMaterial({ map: textures.dropZone, transparent: true, depthWrite: false }),
  );
  zoneDecal.rotation.x = -Math.PI / 2;
  zoneDecal.position.set(0, BED_Y + 0.012, 18);
  scene.add(zoneDecal);
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.12, 20),
    new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 0.6 }),
  );
  button.rotation.x = Math.PI / 2;
  button.position.set(0.9, BED_Y + 1.3, 20.95);
  scene.add(button);

  // ---------- sky ----------
  scene.add(new THREE.HemisphereLight(L.sky.top, L.sky.bottom, L.sky.intensity));
  const moonLight = new THREE.DirectionalLight(L.moon.color, L.moon.intensity);
  moonLight.position.set(...L.moon.dir);
  moonLight.target.position.set(...L.moon.target);
  moonLight.castShadow = !baked; // baked ground already has the moon's shadows
  moonLight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonLight.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
  moonLight.shadow.bias = -0.0005;
  scene.add(moonLight, moonLight.target);

  function update(time) {
    for (const f of flickers) {
      const n = Math.sin(time * 13 + f.phase) * Math.sin(time * 7.3 + f.phase * 2);
      let k = 1 + n * 0.25 * f.amount;
      if (f.amount >= 1) k = Math.sin(time * 0.7 + f.phase) > 0.93 ? (Math.random() > 0.5 ? 0.05 : 1) : 1; // spooky blackout stutter
      f.k = k;
      f.light.intensity = f.base * k;
      f.bulb.visible = k > 0.3;
    }
    if (flickerLamp) flickerUniform.value = LIGHTMAP_INTENSITY * flickerLamp.k;
    fire.children.forEach((f, i) => {
      f.scale.y = 0.85 + Math.sin(time * (8 + i * 3) + i) * 0.12 + Math.sin(time * 23 + i * 2) * 0.05;
      f.scale.x = 1 + Math.sin(time * (5 + i) + i * 4) * 0.06;
    });
  }

  return {
    baked,
    spawns: L.spawns,
    truckZone: L.truckZone,
    playerSpawn: L.playerSpawn,
    door: { body: doorBody, mesh: doorMesh, step: stepDoor, reset: resetDoor },
    moon: moonLight,
    update,
  };
}
