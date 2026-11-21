import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Input, withoutEdges } from './input.js';
import { buildTextures } from './textures.js';
import { buildLevel } from './level.js';
import { PropManager } from './props.js';
import { Player, lookDir } from './player.js';
import { Glove } from './glove.js';
import { Hud, money } from './hud.js';
import { initAudio, sfx } from './audio.js';

const DT = 1 / 60;
const SHIFT_SECONDS = 6 * 60;
const QUOTA = 20000;

const SMASH_LINES = [
  'That was an heirloom.',
  "Insurance won't cover that.",
  'The ghosts saw that.',
  'Coming out of your paycheck.',
  "We'll tell them it was like that.",
  'Somewhere, a grandmother weeps.',
  'Bold strategy.',
  'Handle. With. Care.',
];
const FISH_LINE = 'Gerald is fine. Gerald is on the floor, but fine.';

const $ = (id) => document.getElementById(id);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

await RAPIER.init();
const R = RAPIER;

// ---------- renderer / scene ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1020');
scene.fog = new THREE.FogExp2('#0b1020', 0.028);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 250);
camera.rotation.order = 'YXZ';
scene.add(camera);

const flashlight = new THREE.SpotLight('#fff3dd', 22, 18, 0.5, 0.45, 2);
flashlight.position.set(0.25, -0.15, 0);
flashlight.target.position.set(0, -0.1, -1);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.bias = -0.0008;
camera.add(flashlight, flashlight.target);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- world ----------
buildTextures();
const world = new R.World({ x: 0, y: -9.81, z: 0 });
world.timestep = DT;
const events = new R.EventQueue(true);

const grabbables = new Map();
const level = buildLevel(scene, world, R);
const props = new PropManager(scene, world, R, grabbables);
const doorSync = props.addSynced(level.door.body, level.door.mesh);
grabbables.set(level.door.body.handle, {
  body: level.door.body,
  mesh: level.door.mesh,
  prop: null,
  colliderHandles: new Set([level.door.body.collider(0).handle]),
});

const player = new Player(world, R);
props.playerCollider = player.collider.handle;
const glove = new Glove(world, R, camera, scene, grabbables, player.body);
const hud = new Hud(camera);
const input = new Input(canvas);

// ---------- game state ----------
let state = 'loading';
const shift = { time: SHIFT_SECONDS, loaded: 0, destroyed: 0, smashed: [], loadedCount: 0 };

props.onThud = (i) => sfx.thud(i);
props.onDamage = (prop, lost, smashed, at) => {
  shift.destroyed += lost;
  const pos = at ?? prop.body.worldCom();
  if (smashed) {
    sfx.shatter();
    shift.smashed.push(prop.def.name);
    hud.popup(pos, `SMASHED ${money(-lost)}`, 'smash');
    hud.toast(prop.type === 'fishbowl' ? FISH_LINE : `${prop.def.name}: ${pick(SMASH_LINES)}`);
  } else if (lost >= 5) {
    sfx.crack(Math.min(1, lost / 800));
    hud.popup(pos, money(-lost), 'loss');
    if (lost > 1000) hud.toast(`Ouch. ${money(lost)} off the ${prop.def.name}.`);
  }
};

function resetShift() {
  glove.release(true);
  props.clear();
  props.spawnAll(level.spawns);
  level.door.body.setTranslation({ x: 0, y: 1.2, z: 8 }, true);
  level.door.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  level.door.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  level.door.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  props.readBody(doorSync);
  level.door.reset();
  player.reset(level.playerSpawn);
  input.reset(0, -0.05);
  Object.assign(shift, { time: SHIFT_SECONDS, loaded: 0, destroyed: 0, smashed: [], loadedCount: 0 });
  hud.clearTransient();
  hud.setLoaded(0, QUOTA);
  hud.setTimer(shift.time);
}

function showScreen(name) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== 'screen-' + name);
  $('overlay').classList.toggle('hidden', !name);
}

async function lockPointer() {
  try {
    await canvas.requestPointerLock();
  } catch {
    // Some embeds forbid pointer lock; mouse look still works while the cursor is over the page.
  }
}

function play() {
  initAudio();
  state = 'playing';
  input.active = true;
  showScreen(null);
  hud.show(true);
  lockPointer();
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  input.active = false;
  glove.release(true);
  showScreen('pause');
}

function endShift(reason) {
  if (state !== 'playing') return;
  state = 'results';
  input.active = false;
  glove.release(true);
  if (document.pointerLockElement) document.exitPointerLock();
  hud.show(false);

  const met = shift.loaded >= QUOTA;
  met ? sfx.fanfare() : sfx.buzzer();
  const pay = Math.round(shift.loaded * 0.1 - shift.destroyed * 0.05);
  const destroyedRatio = shift.destroyed / Math.max(1, shift.loaded + shift.destroyed);
  const row = (a, b, cls = '') => `<div class="row ${cls}"><span>${a}</span><span>${b}</span></div>`;
  $('report').innerHTML = [
    row(reason === 'time' ? 'Ended by' : 'Clocked out', reason === 'time' ? "the clock (you're late)" : 'pressing the big red button'),
    row('Value in the truck', `<span class="${met ? 'pos' : 'neg'}">${money(shift.loaded)}</span> / ${money(QUOTA)}`),
    row('Items loaded', `${shift.loadedCount} of ${props.props.length}`),
    row('Damage caused', `<span class="neg">${money(-shift.destroyed)}</span>`),
    shift.smashed.length ? `<div class="row small"><span>Casualties</span><span>${shift.smashed.join(', ')}</span></div>` : '',
    row(pay >= 0 ? 'Your paycheck' : 'You owe the company', `<span class="${pay >= 0 ? 'pos' : 'neg'}">${money(Math.abs(pay))}</span>`, 'total'),
  ].join('');

  const rating = $('rating');
  if (met && destroyedRatio < 0.15) rating.textContent = 'EMPLOYEE OF THE MONTH';
  else if (met) rating.textContent = 'ADEQUATE. BARELY.';
  else if (shift.loaded >= QUOTA / 2) rating.textContent = 'PAY DOCKED';
  else rating.textContent = 'FIRED (AGAIN)';
  rating.classList.toggle('good', met);
  // restart the stamp animation
  rating.style.animation = 'none';
  void rating.offsetWidth;
  rating.style.animation = '';
  showScreen('results');
}

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing') pause();
});
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && state === 'playing' && !document.pointerLockElement) pause();
});
$('btn-start').onclick = () => {
  resetShift();
  play();
  hud.toast('Shift started. The truck is right behind you.', true);
};
$('btn-resume').onclick = play;
$('btn-restart-pause').onclick = () => {
  resetShift();
  play();
};
$('btn-restart').onclick = () => {
  resetShift();
  play();
};
$('brief-quota').textContent = money(QUOTA);

// ---------- truck bookkeeping ----------
function inZone(p, z) {
  return p.x > z.min[0] && p.x < z.max[0] && p.y > z.min[1] && p.y < z.max[1] && p.z > z.min[2] && p.z < z.max[2];
}

function updateTruck() {
  let total = 0;
  let count = 0;
  for (const p of props.props) {
    if (p.dead) {
      p.inTruck = false;
      continue;
    }
    const c = p.body.worldCom();
    const inside = inZone(c, level.truckZone);
    if (inside && !p.inTruck) {
      sfx.ding();
      hud.popup(c, `+${money(p.value)}`, 'gain');
    }
    p.inTruck = inside;
    if (inside) {
      total += p.value;
      count++;
    }
  }
  if (shift.loaded < QUOTA && total >= QUOTA) hud.toast('Quota met! Hit F in the truck to go home… or get greedy.', true);
  shift.loaded = total;
  shift.loadedCount = count;
}

// ---------- main loop ----------
const eye = new THREE.Vector3();
const dir = new THREE.Vector3();
const camEye = new THREE.Vector3();
let acc = 0;
let last = performance.now();
let time = 0;

function simulate(frameDt) {
  acc += frameDt;
  let cmd = input.sample();
  let steps = 0;
  while (acc >= DT && steps < 5) {
    props.preStep();
    player.preStep();
    player.ignoreCollider = glove.heldColliderHandles;
    player.step(cmd, DT, glove.heldMass);
    player.eye(eye);
    lookDir(cmd.yaw, cmd.pitch, dir);
    glove.step(cmd, DT, eye, dir, player.velocity);
    level.door.step();
    world.step(events);
    props.postStep(events, DT);
    player.postStep();
    updateTruck();

    if (cmd.interact && player.isInside(level.truckZone)) endShift('button');
    shift.time -= DT;
    if (shift.time <= 0) endShift('time');
    if (state !== 'playing') break;

    cmd = withoutEdges(cmd);
    acc -= DT;
    steps++;
  }
  if (steps > 0) input.consumeEdges();
  if (acc > DT * 5) acc = 0; // way behind (tab was hidden): don't spiral
}

function updateHud(alpha) {
  hud.setLoaded(shift.loaded, QUOTA);
  hud.setTimer(shift.time);
  const looked = glove.holding ? glove.entry : glove.peek(player.eye(eye), lookDir(input.yaw, input.pitch, dir));
  hud.setCrosshair(glove.holding ? 'holding' : looked ? 'can' : 'none');
  hud.setTooltip(looked?.prop ?? null);
  hud.setStrain(glove.holding ? glove.strain : null);

  if (player.isInside(level.truckZone)) {
    hud.hint(shift.loaded >= QUOTA ? 'Press F to drive home. Quota met!' : `Press F to end the shift early (${money(QUOTA - shift.loaded)} short…)`);
  } else if (glove.holding && glove.strain > 1.05) {
    hud.hint('Too heavy to lift. Drag it! (or bring friends, eventually)');
  } else {
    hud.hint(null);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += frameDt;

  let alpha = 1;
  if (state === 'playing') {
    simulate(frameDt);
    alpha = acc / DT;
    updateHud(alpha);
  }

  player.renderEye(alpha, camEye);
  camera.position.copy(camEye);
  camera.rotation.set(input.pitch, input.yaw, 0);
  props.render(alpha, frameDt);
  level.update(time);
  glove.render(time);
  hud.update(frameDt);
  renderer.render(scene, camera);
}

resetShift();
state = 'title';
showScreen('title');
requestAnimationFrame(frame);

// handy for poking at things from the devtools console
window.hwc = { world, props, player, glove, shift, level, scene, camera, renderer, input };
