# Handle With Care

A silly physics moving game. You're an underpaid mover clearing out a haunted
mansion at night. Grab the valuables with your tractor glove, haul them into the
truck, and hit the quota before the shift ends. Every bump knocks money off.

**Play it:** https://braveottoman.github.io/handle-with-care/ (desktop, keyboard and mouse)

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Clock in**.

`npm run build` creates a static build in `dist/` that you can host anywhere.
Every push to `main` or `initial-prototype` deploys to GitHub Pages through
`.github/workflows/deploy.yml`.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrows | Move |
| `Shift` | Run |
| `Space` | Jump |
| Hold left mouse | Grab with the glove |
| Mouse wheel | Reel the held item in or out |
| `Q` / `E` | Twist the held item |
| Right mouse | Throw (not recommended) |
| `F` (inside the truck) | End the shift |
| `Esc` | Pause |

## How it works

- **Physics:** [Rapier](https://rapier.rs) (WASM) at a fixed 60 Hz step. Rendering interpolates between steps.
- **Rendering:** [Three.js](https://threejs.org). All art is primitives plus procedural canvas textures, and all sound is synthesized with WebAudio, so the game has no asset files.
- **Damage:** props listen for Rapier contact-force events. Force × dt / mass gives the sudden change in velocity. Anything over about 2.5 m/s costs value, scaled by each item's fragility. Bumping into things with your own body has extra tolerance.
- **The glove:** a capped, slightly under-damped spring applied at the exact point you grabbed. Light things wobble. Heavy things (the piano) are too heavy to lift alone and can only be dragged.

### Layout

```
src/
  main.js      boot, fixed-step loop, shift rules, screens
  input.js     keyboard/mouse → plain "command" objects
  player.js    kinematic character controller + camera
  glove.js     grab beam
  props.js     item catalog, spawning, damage, smashing
  level.js     mansion, yard, truck, lights, spawn list
  hud.js       DOM HUD, popups, toasts
  audio.js     procedural sound effects
  textures.js  procedural canvas textures
```

### Ready for multiplayer

The simulation only reads `Input.sample()` commands (plain JSON). A networked
version can feed remote players' commands into the same `Player` and `Glove`
steps on a host that runs the physics.

## Roadmap

- [ ] Ghost butler who hunts the loudest mover
- [ ] Multiplayer (host-authoritative over WebSockets; test with two tabs)
- [ ] More gloves on one item = team lifts for the piano
- [ ] Ragdoll knockouts and "carry your teammate out in a box" revives
- [ ] More rooms, an upstairs, and more haunted hazards (slamming doors, falling chandelier)
