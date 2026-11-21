// Writes art/layout.json from src/layout.js so Blender builds the same house the game collides with.
import { writeFileSync } from 'node:fs';
import { buildLayout } from '../src/layout.js';

const out = new URL('./layout.json', import.meta.url);
writeFileSync(out, JSON.stringify(buildLayout(), null, 1));
console.log('wrote', out.pathname);
