// Loads the Blender-built models and lightmaps (public/models, made by `npm run art`).
// Everything is optional: if a file is missing the game falls back to primitives.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { textures } from './textures.js';

const BASE = 'models/';
const ENCODE_SCALE = 4; // must match art/build_mansion.py
export const LIGHTMAP_INTENSITY = Math.PI * ENCODE_SCALE;

// Materials that really use the per-vertex colours painted in Blender.
const VERTEX_COLORED = new Set(['books', 'porcelain', 'globe', 'teapot']);

// Textures applied by material name. Blender writes UVs in tiles for these.
const TEXTURED = {
  floor: 'wood', grass: 'grass', path: 'stone', 'truck-bed': 'wood',
  'truck-side': 'truckSide', cardboard: 'cardboard', portrait: 'portrait',
};

// ---- baked material: lightmap for lamps/moon/sky, but still lit by the flashlight
function stripBlock(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) return src;
  const re = /#(if|ifdef|ifndef|endif)\b/g;
  re.lastIndex = start + marker.length;
  let depth = 1;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] === 'endif') {
      if (--depth === 0) return src.slice(0, start) + src.slice(m.index + m[0].length);
    } else depth++;
  }
  return src;
}

let bakedLightsChunk = null;
function bakedLights() {
  if (bakedLightsChunk) return bakedLightsChunk;
  let s = THREE.ShaderChunk.lights_fragment_begin;
  for (const marker of [
    '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )',
    '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )',
    '#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )',
    '#if ( NUM_HEMI_LIGHTS > 0 )',
  ]) s = stripBlock(s, marker);
  bakedLightsChunk = s;
  return s;
}

export const flickerUniform = { value: 0 };

export function makeBaked(mat, lightMap, flickerMap) {
  mat.lightMap = lightMap;
  mat.lightMapIntensity = LIGHTMAP_INTENSITY;
  mat.userData.baked = true;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', bakedLights());
    if (flickerMap) {
      shader.uniforms.flickerMap = { value: flickerMap };
      shader.uniforms.flickerIntensity = flickerUniform;
      shader.fragmentShader = 'uniform sampler2D flickerMap;\nuniform float flickerIntensity;\n' + shader.fragmentShader.replace(
        '#include <lights_fragment_maps>',
        '#include <lights_fragment_maps>\n#ifdef USE_LIGHTMAP\n\tirradiance += texture2D( flickerMap, vLightMapUv ).rgb * flickerIntensity;\n#endif',
      );
    }
  };
  mat.customProgramCacheKey = () => 'baked' + (flickerMap ? '+flicker' : '');
  mat.needsUpdate = true;
  return mat;
}

function untiled(name) {
  const t = textures[name].clone();
  t.flipY = false; // glTF UV convention
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Fix up a material from Blender: textures by name, vertex colours only where meant. */
export function prepareMaterial(mat) {
  const name = mat.name;
  if (!VERTEX_COLORED.has(name)) mat.vertexColors = false;
  const texName = TEXTURED[name] ?? (name.startsWith('wall-') ? 'wallpaper' : null);
  if (texName) {
    mat.map = untiled(texName);
    if (texName !== 'wallpaper') mat.color.set(name === 'truck-bed' ? '#b0a090' : '#ffffff');
  }
  if (mat.transparent) mat.depthWrite = false;
  return mat;
}

/** Blender's exporter puts painted colours in COLOR_1 and a white COLOR_0; keep the real ones only where used. */
function fixVertexColors(mesh) {
  const g = mesh.geometry;
  if (VERTEX_COLORED.has(mesh.material.name) && g.attributes.color_1) g.setAttribute('color', g.attributes.color_1);
  else if (!VERTEX_COLORED.has(mesh.material.name)) g.deleteAttribute('color');
  g.deleteAttribute('color_1');
}

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();

function loadGltf(file) {
  return new Promise((resolve) => loader.load(BASE + file, resolve, undefined, () => resolve(null)));
}
function loadLightmap(file) {
  return new Promise((resolve) => texLoader.load(BASE + file, (t) => {
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.channel = 1;
    resolve(t);
  }, undefined, () => resolve(null)));
}

export async function loadAssets() {
  if (/[?&]classic\b/.test(location.search)) return { mansion: null, props: new Map() }; // the old blocky look
  const [mansion, props] = await Promise.all([loadGltf('mansion.glb'), loadGltf('props.glb')]);
  const out = { mansion: null, props: new Map() };

  if (props) {
    for (const child of props.scene.children) {
      child.traverse((o) => {
        if (!o.isMesh) return;
        fixVertexColors(o);
        o.material = prepareMaterial(o.material);
        o.castShadow = !o.material.transparent;
        o.receiveShadow = true;
      });
      out.props.set(child.name, child);
    }
  }

  if (mansion) {
    const jobs = [];
    mansion.scene.traverse((o) => {
      if (!o.isMesh && !o.isGroup && !o.isObject3D) return;
      const extras = o.userData ?? {};
      if (!extras.group) return;
      jobs.push(
        Promise.all([
          extras.lightmap ? loadLightmap(extras.lightmap) : null,
          extras.lightmapFlicker ? loadLightmap(extras.lightmapFlicker) : null,
        ]).then(([lm, flicker]) => {
          o.traverse((m) => {
            if (!m.isMesh) return;
            fixVertexColors(m);
            m.material = prepareMaterial(m.material.clone());
            if (lm && !m.material.transparent && !m.material.emissive?.getHex()) makeBaked(m.material, lm, flicker);
            m.castShadow = extras.group !== 'yard';
            m.receiveShadow = true;
            m.matrixAutoUpdate = false;
            m.updateMatrix();
          });
        }),
      );
    });
    await Promise.all(jobs);
    out.mansion = mansion.scene;
  }
  return out;
}
