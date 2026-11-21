// Procedural canvas textures, so the game ships with zero image assets.
import * as THREE from 'three';

function canvasTex(size, draw, { repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const rand = (a, b) => a + Math.random() * (b - a);

export const textures = {};

export function buildTextures() {
  textures.wood = canvasTex(256, (g, s) => {
    const planks = 4;
    for (let i = 0; i < planks; i++) {
      const l = rand(28, 38);
      g.fillStyle = `hsl(25, 42%, ${l}%)`;
      g.fillRect(0, (i * s) / planks, s, s / planks);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `hsla(25, 40%, ${l - rand(4, 10)}%, 0.35)`;
        g.beginPath();
        const y = (i * s) / planks + rand(2, s / planks - 2);
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + rand(-3, 3), s * 0.6, y + rand(-3, 3), s, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, (i * s) / planks, s, 2);
      g.fillRect(rand(0, s), (i * s) / planks, 2, s / planks);
    }
  });

  textures.wallpaper = canvasTex(256, (g, s) => {
    g.fillStyle = '#e8dcc0';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 32) {
      g.fillStyle = 'rgba(120, 90, 60, 0.18)';
      g.fillRect(x, 0, 12, s);
    }
    g.fillStyle = 'rgba(120, 90, 60, 0.25)';
    for (let y = 16; y < s; y += 64) {
      for (let x = 22; x < s; x += 64) {
        g.beginPath();
        g.ellipse(x, y, 6, 10, 0, 0, Math.PI * 2);
        g.ellipse(x + 32, y + 32, 6, 10, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

  textures.grass = canvasTex(256, (g, s) => {
    g.fillStyle = '#2f4a2b';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `hsla(${rand(90, 120)}, 35%, ${rand(14, 30)}%, 0.7)`;
      g.fillRect(rand(0, s), rand(0, s), 2, rand(2, 6));
    }
  });

  textures.stone = canvasTex(256, (g, s) => {
    g.fillStyle = '#5c5a55';
    g.fillRect(0, 0, s, s);
    const n = 4;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = `hsl(40, 5%, ${rand(36, 48)}%)`;
        g.fillRect(x * (s / n) + 3, y * (s / n) + 3, s / n - 6, s / n - 6);
      }
    }
  });

  textures.cardboard = canvasTex(256, (g, s) => {
    g.fillStyle = '#c9a26b';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(230, 220, 200, 0.55)';
    g.fillRect(0, s * 0.44, s, s * 0.12); // packing tape
    g.fillStyle = '#d8392f';
    g.font = 'bold 40px Bungee, Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText('FRAGILE', s / 2, s * 0.3);
    g.font = 'bold 34px sans-serif';
    g.fillText('⬆ ⬆', s / 2, s * 0.8);
  }, { repeat: false });

  textures.truckSide = canvasTex(512, (g, s) => {
    g.fillStyle = '#f2efe6';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#d8392f';
    g.fillRect(0, s * 0.62, s, s * 0.08);
    g.font = '64px Bungee, Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText('HANDLE', s / 2, s * 0.3);
    g.fillText('WITH CARE', s / 2, s * 0.45);
    g.fillStyle = '#4a3a2c';
    g.font = 'italic 26px Rubik, sans-serif';
    g.fillText('We break it, you bought it.', s / 2, s * 0.56);
  }, { repeat: false });

  textures.dropZone = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255, 201, 77, 0.9)';
    g.lineWidth = 10;
    g.setLineDash([24, 16]);
    g.strokeRect(10, 10, s - 20, s - 20);
    g.fillStyle = 'rgba(255, 201, 77, 0.85)';
    g.font = '30px Bungee, Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText('LOAD', s / 2, s / 2 - 4);
    g.fillText('HERE', s / 2, s / 2 + 30);
  }, { repeat: false });

  textures.flame = canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (const [cx, w, h, col] of [[0.5, 0.42, 0.95, 'rgba(255,90,20,0.9)'], [0.32, 0.22, 0.6, 'rgba(255,120,30,0.8)'],
      [0.68, 0.22, 0.65, 'rgba(255,120,30,0.8)'], [0.5, 0.22, 0.55, 'rgba(255,220,120,0.95)']]) {
      const grd = g.createRadialGradient(cx * s, s * 0.95, 2, cx * s, s * (1 - h * 0.5), s * h * 0.6);
      grd.addColorStop(0, col);
      grd.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo((cx - w / 2) * s, s);
      g.quadraticCurveTo((cx - w / 2) * s, s * (1 - h * 0.5), cx * s, s * (1 - h));
      g.quadraticCurveTo((cx + w / 2) * s, s * (1 - h * 0.5), (cx + w / 2) * s, s);
      g.fill();
    }
  }, { repeat: false });

  textures.portrait = canvasTex(128, (g, s) => {
    g.fillStyle = '#2b2236';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#d9c3a0';
    g.beginPath();
    g.ellipse(s / 2, s * 0.42, s * 0.18, s * 0.23, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3d2a1c';
    g.fillRect(s * 0.25, s * 0.68, s * 0.5, s * 0.4);
    g.fillStyle = '#111';
    // the eyes follow you, obviously
    g.fillRect(s * 0.41, s * 0.38, 6, 4);
    g.fillRect(s * 0.55, s * 0.38, 6, 4);
    g.fillRect(s * 0.42, s * 0.52, s * 0.16, 3);
  }, { repeat: false });
}

/** Clone a repeating texture with its own repeat factors (clones share the image). */
export function tiled(tex, u, v) {
  const t = tex.clone();
  t.repeat.set(u, v);
  t.needsUpdate = true;
  return t;
}
