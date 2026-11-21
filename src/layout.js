// The mansion as plain data. No three.js, no DOM: the game builds colliders and
// fallback meshes from this, and `npm run art` hands it to Blender, which builds
// the detailed, light-baked version of the same house. Change the house here.

export const H = 3.2; // wall height
export const T = 0.25; // wall thickness
export const DOOR_H = 2.4;
export const BED_Y = 0.9; // truck bed height

/**
 * box: { p: [x,y,z] centre, s: [w,h,d] full size, mat, rotX?, collide?, cast?, wall? }
 * mat keys: floor grass path ceiling rug-red rug-blue roof wall siding shelf brick hedge
 *           truck-bed truck-side truck-white truck-red glass ramp
 */
export function buildLayout() {
  const boxes = [];
  const walls = []; // full wall runs, for baseboards and crown molding
  const doorways = [];
  const box = (p, s, mat, o = {}) => boxes.push({ p, s, mat, rotX: 0, collide: true, cast: true, ...o });

  const ROOM = { foyer: '#c6d2bf', study: '#b8c7d9', living: '#e3b7a8', dining: '#e6d9a4', outer: '#cfc4ad' };

  /** Wall along X at depth z. `outer` = +1/-1: which side faces outdoors (gets siding). */
  function wallX(z, x1, x2, gaps, room, { outer = 0, rooms = [room, room] } = {}) {
    walls.push({ axis: 'x', at: z, from: x1, to: x2, gaps, rooms, outer });
    let cur = x1;
    const seg = (a, b, y0, y1) => {
      const len = b - a;
      const p = [(a + b) / 2, (y0 + y1) / 2, z];
      if (outer) {
        const dz = outer * T * 0.25;
        box([p[0], p[1], z - dz], [len, y1 - y0, T / 2], 'wall', { wall: { room, len } });
        box([p[0], p[1], z + dz], [len, y1 - y0, T / 2], 'siding');
      } else {
        box(p, [len, y1 - y0, T], 'wall', { wall: { room, len } });
      }
    };
    for (const [a, b] of gaps) {
      if (a > cur) seg(cur, a, 0, H);
      seg(a, b, DOOR_H, H);
      doorways.push({ axis: 'x', at: z, a, b });
      cur = b;
    }
    if (cur < x2) seg(cur, x2, 0, H);
  }

  /** Wall along Z at x. */
  function wallZ(x, z1, z2, gaps, room, { rooms = [room, room] } = {}) {
    walls.push({ axis: 'z', at: x, from: z1, to: z2, gaps, rooms, outer: 0 });
    let cur = z1;
    const seg = (a, b, y0, y1) => box([x, (y0 + y1) / 2, (a + b) / 2], [T, y1 - y0, b - a], 'wall', { wall: { room, len: b - a } });
    for (const [a, b] of gaps) {
      if (a > cur) seg(cur, a, 0, H);
      seg(a, b, DOOR_H, H);
      doorways.push({ axis: 'z', at: x, a, b });
      cur = b;
    }
    if (cur < z2) seg(cur, z2, 0, H);
  }

  // ground & shell
  box([0, -0.1, -2], [24, 0.2, 20], 'floor');
  box([0, -0.1, 24], [60, 0.2, 32], 'grass', { cast: false });
  box([0, 0.005, 10], [2.2, 0.01, 4], 'path', { collide: false, cast: false });
  box([0, H + 0.1, -2], [24.6, 0.2, 20.6], 'ceiling');
  box([-6, 0.006, -6], [6, 0.01, 4], 'rug-red', { collide: false, cast: false });
  box([6, 0.006, -6], [4.5, 0.01, 3], 'rug-blue', { collide: false, cast: false });
  box([0, H + 1.6, 3.4], [25.5, 0.25, 7.4], 'roof', { collide: false, rotX: -0.42 });
  box([0, H + 1.6, -7.4], [25.5, 0.25, 7.4], 'roof', { collide: false, rotX: 0.42 });

  wallX(-12, -12.125, 12.125, [], 'outer', { rooms: ['outdoors', 'living'] });
  wallZ(-12, -12, 8, [], 'outer', { rooms: ['outdoors', 'study'] });
  wallZ(12, -12, 8, [], 'outer', { rooms: ['foyer', 'outdoors'] });
  wallX(8, -12.125, 12.125, [[-1, 1]], 'foyer', { outer: 1, rooms: ['foyer', 'outdoors'] });
  wallX(0, -12, 12, [[-4, -1.5], [1.5, 4]], 'foyer', { rooms: ['living', 'foyer'] });
  wallZ(0, -12, 0, [[-7, -4.5]], 'living', { rooms: ['living', 'dining'] });
  wallZ(-5, 0, 8, [[3, 5.5]], 'study', { rooms: ['study', 'foyer'] });

  // front porch: two columns and a little roof
  box([-1.9, 1.375, 9.25], [0.22, 2.75, 0.22], 'column');
  box([1.9, 1.375, 9.25], [0.22, 2.75, 0.22], 'column');
  box([0, 2.81, 8.8], [4.6, 0.12, 1.36], 'porch-roof', { collide: false });

  // study: shelves + desk
  const shelves = [1.5, 3.6, 6.6];
  for (const z of shelves) box([-11.7, 1.3, z], [0.4, 2.6, 1.6], 'shelf');
  box([-8.5, 0.75, 1.2], [2.2, 0.08, 1.0], 'shelf', { desk: true });
  for (const [x, z] of [[-9.5, 0.8], [-7.5, 0.8], [-9.5, 1.6], [-7.5, 1.6]]) box([x, 0.355, z], [0.08, 0.71, 0.08], 'shelf', { deskLeg: true });

  // living: fireplace and mantel
  box([-6, 0.7, -11.6], [2.6, 1.4, 0.6], 'brick', { fireplace: true });
  box([-6, 1.45, -11.55], [3.0, 0.1, 0.75], 'shelf', { mantel: true });

  // dining: sideboard
  box([6, 0.45, -11.6], [3, 0.9, 0.5], 'shelf', { sideboard: true });

  // yard hedges
  box([-13.2, 1, 17], [1.2, 2, 18], 'hedge');
  box([13.2, 1, 17], [1.2, 2, 18], 'hedge');
  box([0, 1, 26.5], [27.6, 2, 1.2], 'hedge');

  // truck
  box([0, BED_Y - 0.15, 18], [2.9, 0.3, 6], 'truck-bed');
  box([-1.5, BED_Y + 1.25, 18], [0.1, 2.5, 6], 'truck-side');
  box([1.5, BED_Y + 1.25, 18], [0.1, 2.5, 6], 'truck-side');
  box([0, BED_Y + 1.25, 21.05], [3.1, 2.5, 0.1], 'truck-white');
  box([0, BED_Y + 2.55, 18], [3.1, 0.1, 6.2], 'truck-white');
  box([0, 1.55, 22.4], [2.9, 2.1, 2.4], 'truck-red', { cab: true });
  box([0, 2.0, 23.62], [2.6, 0.9, 0.05], 'glass', { collide: false });
  const rampLen = Math.hypot(3, BED_Y);
  const rampAngle = Math.atan2(BED_Y, 3);
  box([0, BED_Y / 2 - 0.05 * Math.cos(rampAngle), 13.5 + 0.05 * Math.sin(rampAngle)], [2.4, 0.1, rampLen], 'ramp', { rotX: -rampAngle });

  // lights. `bake`: 'main' goes into the lightmap, 'flicker' gets its own map so it can stutter.
  const lamps = [
    { p: [-8.5, 2.7, 4.5], color: '#cfe6ff', intensity: 18, distance: 11, bake: 'main', fixture: 'pendant' },
    { p: [3.5, 2.85, 4], color: '#ffd9a0', intensity: 30, distance: 14, bake: 'main', fixture: 'chandelier' },
    { p: [-6, 0.9, -10.9], color: '#ff8a3a', intensity: 14, distance: 9, flicker: 0.35, bake: 'main', fixture: 'fire' },
    { p: [-5, 2.85, -5], color: '#ffd0a0', intensity: 10, distance: 11, bake: 'main', fixture: 'pendant' },
    { p: [6, 2.85, -6], color: '#ffe2b0', intensity: 24, distance: 12, flicker: 1, bake: 'flicker', fixture: 'pendant' },
    { p: [1.6, 2.6, 8.45], color: '#ffc070', intensity: 8, distance: 8, flicker: 0.15, bake: 'main', fixture: 'sconce' },
    { p: [0, BED_Y + 2.3, 18], color: '#fff0d0', intensity: 14, distance: 7, bake: 'main', fixture: 'truck' },
  ];

  return {
    H, T, DOOR_H, BED_Y,
    boxes, walls, doorways, lamps, roomColors: ROOM,
    moon: { dir: [-20, 30, 40], target: [0, 0, 10], color: '#a9bbff', intensity: 2.0 },
    sky: { top: '#4a5a85', bottom: '#1a140e', intensity: 1.0 },
    pedestal: { p: [3, 0, 5], r: 0.25, h: 1 },
    shelves: shelves.map((z) => [-11.7, z]),
    wheels: [16, 20, 22.6].flatMap((z) => [[-1.45, 0.45, z], [1.45, 0.45, z]]),
    door: { hinge: [-0.97, 1.2, 8], center: [0, 1.2, 8], size: [1.9, 2.34, 0.08] },
    truckZone: { min: [-1.45, BED_Y - 0.1, 15], max: [1.45, BED_Y + 2.5, 21] },
    playerSpawn: [0, 0.01, 10.6],
    spawns: [
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
    ],
  };
}
