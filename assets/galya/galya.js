/**
 * galya.js — Галя, стеклянная бабочка (3D-маскот).
 *
 * ES-модуль на three.js r165. Зависимости (bare imports):
 *   'three'       → three@0.165.0/build/three.module.js
 *   'delaunator'  → delaunator@5.0.1 (ESM)
 *
 * Использование:
 *   import { createGalya } from './galya.js';
 *   const galya = createGalya(document.querySelector('#galya'), { background: '#171717' });
 *   galya.setState('sleep');          // базовое состояние
 *   galya.react('happy', 1500);       // короткая реакция поверх базового
 *   galya.hitTest(e.clientX, e.clientY)  // 'head' | 'body' | 'wing' | null
 *   galya.screenPoint('top')          // {x, y} в CSS-пикселях окна — якорь для пузыря реплики
 *
 * Состояния: 'idle' | 'happy' | 'eat' | 'sleep' | 'hungry' | 'buzzed'
 * Внешний вид настраивается на странице-настройщике и переносится JSON-ом в DEFAULT_PARAMS.
 */
import * as THREE from 'three';
import Delaunator from 'delaunator';

/* Значения, подобранные в настройщике (размеры тела — доли размаха крыльев S). */
export const DEFAULT_PARAMS = {
  material: { iridescence: 0, iridescenceIOR: 1.65, filmMin: 1000, filmMax: 1400, transmission: 0.92, metalness: 0, roughness: 0.3, dispersion: 1, envMapIntensity: 5 },
  light:    { key: 14, topStrip: 10.2, magenta: 9.4, violet: 14, amberL: 2.9, amberR: 3.5, backCyan: 2.2, exposure: 0.92, innerGlow: 1.07 },
  face:     { eyeSize: 0.385, eyeGap: 0.2, gazeX: 0.09, gazeY: -0.04, catchlight: 0.32, smileWidth: 0.1, smileOpen: 0.074, cheeks: 1 },
  antennae: { height: 0.25, angle: 21, thickness: 0.045, hookRadius: 0.02, drop: 0.1 },
  abdomen:  { length: 0.525, width: 0.245, core: 0.56 }
};

/* Целевые значения анимации для каждого состояния. */
const STATES = {
  idle:   { flapSpeed: 2.4, flapAmp: 0.30, fold: 0,    bob: 0.06,  pitch: 0,     cheeks: 1,   shake: 0, nod: 0, hop: 0, exposure: 1,    eyes: 'open',   look: 1 },
  happy:  { flapSpeed: 6.5, flapAmp: 0.42, fold: 0,    bob: 0.05,  pitch: -0.05, cheeks: 1.8, shake: 0, nod: 0, hop: 1, exposure: 1.08, eyes: 'happy',  look: 0.4 },
  eat:    { flapSpeed: 3.5, flapAmp: 0.22, fold: 0.1,  bob: 0.03,  pitch: 0.08,  cheeks: 1.4, shake: 0, nod: 1, hop: 0, exposure: 1,    eyes: 'happy',  look: 0 },
  sleep:  { flapSpeed: 0.7, flapAmp: 0.04, fold: 1,    bob: 0.025, pitch: 0.12,  cheeks: 0.6, shake: 0, nod: 0, hop: 0, exposure: 0.62, eyes: 'closed', look: 0 },
  hungry: { flapSpeed: 1.3, flapAmp: 0.14, fold: 0.25, bob: 0.03,  pitch: 0.14,  cheeks: 0.5, shake: 0, nod: 0, hop: 0, exposure: 0.92, eyes: 'open',   look: 0.6 },
  buzzed: { flapSpeed: 16,  flapAmp: 0.20, fold: 0,    bob: 0.02,  pitch: 0,     cheeks: 1.2, shake: 1, nod: 0, hop: 0, exposure: 1.05, eyes: 'open',   look: 1 }
};
export const GALYA_STATES = Object.keys(STATES);

const merge = (a, b) => {
  const out = JSON.parse(JSON.stringify(a));
  for (const k in b || {}) out[k] = (typeof b[k] === 'object' && b[k] && !Array.isArray(b[k])) ? Object.assign(out[k] || {}, b[k]) : b[k];
  return out;
};

export function createGalya(container, options = {}) {
  const P = merge(DEFAULT_PARAMS, options.params);
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quality = options.quality || ((window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'low' : 'high');
  const followPointer = options.followPointer !== false;

  /* ---------- renderer ---------- */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
  const setBackground = c => { scene.background = c ? new THREE.Color(c) : null; };
  setBackground(options.background ?? '#171717');

  /* ---------- studio environment: softboxes on pure black ---------- */
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x000000);
  const SOFTBOXES = [
    ['key',      0xffffff, 3.0, 2.0,  [-1.5, 2.5,  3.0]],
    ['topStrip', 0xfff4ff, 4.0, 0.35, [ 0.0, 3.5,  1.5]],
    ['magenta',  0xff3fd0, 0.5, 4.0,  [-3.5, 0.0,  1.5]],
    ['violet',   0x8a4bff, 0.6, 4.0,  [ 3.5, 0.5,  1.0]],
    ['amberL',   0xffa030, 0.3, 2.5,  [-2.5,-2.5,  1.0]],
    ['amberR',   0xffa030, 0.3, 2.5,  [ 2.5,-2.5,  1.0]],
    ['backCyan', 0x3d8bff, 4.0, 4.0,  [ 0.0, 0.0, -3.0]]
  ];
  for (const [name, col, w, h, pos] of SOFTBOXES) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(P.light[name]), side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); envScene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0.03);
  scene.environment = envRT.texture;
  pmrem.dispose();
  envScene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });

  /* ---------- procedural textures ---------- */
  const hash = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
  const vnoise = (x, y, s) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const blurred = (src, px) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.filter = `blur(${px}px)`; g.drawImage(src, 0, 0); return c; };
  function grayTexture(W, H, fn, blur) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = Math.round(Math.min(1, Math.max(0, fn(x / W, y / H))) * 255), k = (y * W + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(blurred(c, blur)); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const petrol = seed => grayTexture(256, 256, (u, v) => {
    let s = 0, a = 1, f = 4.5, n = 0;
    for (let o = 0; o < 3; o++) { s += a * vnoise(u * f, v * f, seed + o * 13); n += a; a *= 0.5; f *= 2.1; }
    return (s / n - 0.22) / 0.56;
  }, 4);
  const filmWing = petrol(3), filmBody = petrol(11);
  const filmAnt = grayTexture(256, 64, (u, v) => 0.5 + 0.45 * Math.cos(v * Math.PI * 2) + 0.12 * (vnoise(u * 6, v * 2, 7) - 0.5) + 0.08 * Math.sin(u * 9), 2);
  const glowTex = (() => {
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    const gr = g.createRadialGradient(0, N / 2, 0, 0, N / 2, N * 0.4);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N); return new THREE.CanvasTexture(c);
  })();
  const cheekTex = (() => {
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  /* ---------- materials ---------- */
  const m = P.material, L = P.light, c01 = v => Math.min(1, Math.max(0, v));
  const phys = o => new THREE.MeshPhysicalMaterial(Object.assign({
    ior: 1.5, thickness: 1.2, attenuationColor: new THREE.Color(0x2b1fd1), attenuationDistance: 0.35,
    clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, specularColor: new THREE.Color(0xffffff),
    metalness: m.metalness, roughness: m.roughness, dispersion: m.dispersion,
    iridescenceIOR: m.iridescenceIOR, iridescenceThicknessRange: [m.filmMin, Math.max(m.filmMin + 1, m.filmMax)],
    envMapIntensity: m.envMapIntensity
  }, o));
  const M = {
    rim:      phys({ color: 0x2a2ae0, iridescenceThicknessMap: filmWing, transmission: c01(m.transmission - 0.15), iridescence: m.iridescence }),
    panel:    phys({ color: 0x141070, iridescenceThicknessMap: filmWing, transmission: c01(m.transmission + 0.10), iridescence: m.iridescence * 0.55,
                     emissive: new THREE.Color(0x1e3cff), emissiveMap: glowTex, emissiveIntensity: 0.45 * L.innerGlow }),
    crescent: phys({ color: 0x4a2ae8, iridescenceThicknessMap: filmWing, transmission: c01(m.transmission), iridescence: m.iridescence * 0.85 }),
    bead:     phys({ color: 0x5a4bff, thickness: 0.6, attenuationColor: new THREE.Color(0x1e1490), attenuationDistance: 0.25, metalness: 0,
                     transmission: 1, iridescence: m.iridescence * 0.4, emissive: new THREE.Color(0x2e3dff), emissiveIntensity: 0.22 * L.innerGlow }),
    glass:    phys({ color: 0x2a2ae0, iridescenceThicknessMap: filmBody, transmission: c01(m.transmission), iridescence: m.iridescence,
                     emissive: new THREE.Color(0x1b1a8c), emissiveIntensity: 0.3 * L.innerGlow }),
    shell:    phys({ color: 0x2a2ae0, iridescenceThicknessMap: filmBody, transmission: c01(m.transmission + 0.05), iridescence: m.iridescence,
                     emissive: new THREE.Color(0x1b1a8c), emissiveIntensity: 0.3 * L.innerGlow }),
    antenna:  phys({ color: 0x2a2ae0, iridescenceThicknessMap: filmAnt, transmission: c01(m.transmission), iridescence: m.iridescence }),
    eyeRim:   phys({ color: 0x8a4bff, iridescenceThicknessMap: filmBody, transmission: c01(m.transmission - 0.15), iridescence: m.iridescence }),
    core:     new THREE.MeshPhysicalMaterial({ color: 0x120c5a, emissive: new THREE.Color(0x0e0a52), emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.03,
                     clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: m.envMapIntensity * 0.8 }),
    eye:      new THREE.MeshPhysicalMaterial({ color: 0x05040f, metalness: 0, roughness: 0.01, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: m.envMapIntensity * 0.7 }),
    catch:    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    cheek:    new THREE.MeshBasicMaterial({ color: 0xff5fd8, map: cheekTex, transparent: true, depthWrite: false, toneMapped: false, opacity: P.face.cheeks }),
    proxy:    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  };

  /* =====================================================================
     WINGS — traced from the reference; relief built as a height field
     ===================================================================== */
  const SPX = 0.0034, JX = 822, JY = 748;
  const toL = p => new THREE.Vector3((JX - p[0]) * SPX, (JY - p[1]) * SPX, 0);
  const curveOf = px => new THREE.CatmullRomCurve3(px.map(toL), true, 'centripetal');
  const FORE = {
    outline: [[812,752],[700,775],[550,788],[400,790],[260,782],[180,750],[130,680],[108,560],[108,440],[125,320],
              [170,200],[240,110],[320,64],[390,72],[480,130],[590,250],[700,390],[790,520],[845,610],[852,660],[835,720]],
    loop:    [[766,700],[747,559],[657,429],[547,289],[437,169],[382,144],[317,171],[290,236],[317,301],[366,327],
              [460,420],[580,530],[690,628],[740,676]],
    beads:   [[382,236],[309,562]]
  };
  const HIND = {
    outline: [[812,768],[700,800],[560,815],[420,825],[330,860],[290,950],[295,1060],[340,1170],[420,1255],[520,1290],
              [610,1275],[700,1210],[770,1110],[805,990],[810,880],[813,805]],
    loop:    [[764,806],[720,830],[600,868],[480,880],[440,878],[389,899],[368,950],[389,1001],[440,1022],[520,1022],
              [620,985],[700,915],[742,846]],
    beads:   [[578,1127]]
  };
  const RR = 0.064, RRZ = 0.12, B0 = 0.085, DD = 0.065, WD = 0.22, PP = 0.03, WP = 0.15, RL = 0.038;
  const RD = 0.208, RTT = 0.061, RT = 0.292 - RTT, K = 0.02;
  const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
  const tube = (dist, r, zc) => dist < r ? zc + Math.sqrt(r * r - dist * dist) : zc - (dist - r) * 4;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const polyArrays = pts => ({ x: pts.map(p => p.x), y: pts.map(p => p.y) });
  function segDist(Pp, x, y) {
    let best = 1e9; const X = Pp.x, Y = Pp.y, n = X.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = X[i], ay = Y[i], bx = X[j] - ax, by = Y[j] - ay;
      let t = ((x - ax) * bx + (y - ay) * by) / (bx * bx + by * by); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = ax + bx * t - x, dy = ay + by * t - y, d = dx * dx + dy * dy; if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  function inside(Pp, x, y) {
    let c = false; const X = Pp.x, Y = Pp.y, n = X.length;
    for (let i = 0, j = n - 1; i < n; j = i++) if (((Y[i] > y) !== (Y[j] > y)) && (x < (X[j] - X[i]) * (y - Y[i]) / (Y[j] - Y[i]) + X[i])) c = !c;
    return c;
  }
  function makeField(spec) {
    let O = curveOf(spec.outline).getSpacedPoints(quality === 'low' ? 420 : 560).slice(0, -1);
    let area = 0; for (let i = 0; i < O.length; i++) { const a = O[i], b = O[(i + 1) % O.length]; area += a.x * b.y - b.x * a.y; }
    if (area < 0) O = O.reverse();
    const Lp = curveOf(spec.loop).getSpacedPoints(300).slice(0, -1);
    const OP = polyArrays(O), LP = polyArrays(Lp), beads = spec.beads.map(toL);
    const f = { outline: O, loopPts: Lp, OP, LP, beads, cls: 0 };
    f.height = (x, y) => {
      const d = segDist(OP, x, y), dl = segDist(LP, x, y), inLoop = inside(LP, x, y);
      const rim = Math.abs(d - RR) < RR ? RRZ * Math.sqrt(1 - ((d - RR) / RR) ** 2) : -(Math.abs(d - RR) - RR) * 4;
      let base;
      if (inLoop) base = B0 - DD * (1 - Math.exp(-dl / WD));
      else { const u = Math.max(0, Math.min(d - 2 * RR, dl - RL)); base = B0 + PP * (1 - Math.exp(-u / WP)); }
      const t = sstep(0.8 * RR, 1.7 * RR, d); base = -0.3 * (1 - t) + base * t;
      let z = smax(rim, base, K);
      z = smax(z, tube(dl, RL, B0 - 0.005), K);
      let nearRing = false;
      for (const b of beads) { const q = Math.hypot(x - b.x, y - b.y); z = smax(z, tube(Math.abs(q - RT), RTT, B0 - 0.012), K); if (Math.abs(q - RT) < RTT * 1.3) nearRing = true; }
      z *= 0.2 + 0.8 * sstep(0.05, 0.45, Math.hypot(x, y));
      f.cls = (d < 2 * RR * 1.05 || dl < RL * 1.35 || nearRing) ? 0 : (inLoop ? 1 : 2);
      return z;
    };
    return f;
  }
  function reliefGeo(field) {
    const O = field.outline, n = O.length, PX = [], PY = [];
    const add = (x, y) => { PX.push(x); PY.push(y); };
    for (const p of O) add(p.x, p.y);
    const nb = n, step = quality === 'low' ? 0.02 : 0.014;
    const ok = (x, y, minD) => inside(field.OP, x, y) && segDist(field.OP, x, y) > minD;
    for (let i = 0; i < n; i++) {
      const a = O[(i - 1 + n) % n], b = O[(i + 1) % n]; let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      for (const d of [0.0012, 0.004, 0.009, 0.016, 0.025, 0.035, 0.046, 0.057, 0.066, 0.076, 0.088, 0.101, 0.115]) {
        const x = O[i].x - ty * d, y = O[i].y + tx * d; if (ok(x, y, d * 0.7)) add(x, y);
      }
    }
    const Lp = field.loopPts, mm = Lp.length;
    for (let i = 0; i < mm; i++) {
      const a = Lp[(i - 1 + mm) % mm], b = Lp[(i + 1) % mm]; let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      for (const d of [0, 0.005, -0.005, 0.012, -0.012, 0.02, -0.02, 0.03, -0.03, 0.042, -0.042, 0.056, -0.056, 0.072, -0.072]) {
        const x = Lp[i].x - ty * d, y = Lp[i].y + tx * d; if (ok(x, y, 0.12)) add(x, y);
      }
    }
    for (const bd of field.beads) {
      for (const d of [-0.1, -0.085, -0.072, -0.06, -0.048, -0.036, -0.024, -0.012, 0, 0.012, 0.024, 0.036, 0.048, 0.06, 0.072, 0.085, 0.1]) {
        const r = RT + d, k = Math.ceil(2 * Math.PI * r / (step * 0.5));
        for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2, x = bd.x + Math.cos(a) * r, y = bd.y + Math.sin(a) * r; if (ok(x, y, 0.12)) add(x, y); }
      }
      for (const r of [0.04, 0.08]) { const k = Math.ceil(2 * Math.PI * r / step); for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; add(bd.x + Math.cos(a) * r, bd.y + Math.sin(a) * r); } }
      add(bd.x, bd.y);
    }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of O) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    for (let r = 0, y = y0; y <= y1; y += step * 0.866, r++) {
      for (let x = x0 + (r % 2 ? step / 2 : 0); x <= x1; x += step) {
        if (!inside(field.OP, x, y) || segDist(field.OP, x, y) < 0.122 || segDist(field.LP, x, y) < 0.076) continue;
        let near = false; for (const bd of field.beads) { const q = Math.hypot(x - bd.x, y - bd.y); if (q < 0.1 || Math.abs(q - RT) < 0.105) { near = true; break; } }
        if (!near) add(x, y);
      }
    }
    const N = PX.length, coords = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) { coords[2 * i] = PX[i]; coords[2 * i + 1] = PY[i]; }
    const tri = new Delaunator(coords).triangles;
    const H = new Float32Array(N), C = new Uint8Array(N);
    for (let i = nb; i < N; i++) { H[i] = Math.max(0.004, field.height(PX[i], PY[i])); C[i] = field.cls; }
    const buckets = [[], [], []];
    for (let t = 0; t < tri.length; t += 3) {
      let a = tri[t], b = tri[t + 1], c = tri[t + 2];
      const e = Math.max(Math.hypot(PX[a] - PX[b], PY[a] - PY[b]), Math.hypot(PX[b] - PX[c], PY[b] - PY[c]), Math.hypot(PX[c] - PX[a], PY[c] - PY[a]));
      if ((a < nb && b < nb && c < nb) || e > 0.06) { if (!inside(field.OP, (PX[a] + PX[b] + PX[c]) / 3, (PY[a] + PY[b] + PY[c]) / 3)) continue; }
      if ((PX[b] - PX[a]) * (PY[c] - PY[a]) - (PY[b] - PY[a]) * (PX[c] - PX[a]) < 0) { const s = b; b = c; c = s; }
      buckets[Math.min(C[a], C[b], C[c])].push(a, b, c);
    }
    const NV = nb + 2 * (N - nb), pos = new Float32Array(NV * 3), uv = new Float32Array(NV * 2);
    const back = i => i < nb ? i : N + (i - nb);
    const put = (k, x, y, z) => { pos[3 * k] = x; pos[3 * k + 1] = y; pos[3 * k + 2] = z; uv[2 * k] = x / 4.8; uv[2 * k + 1] = (y + 2.4) / 4.8; };
    for (let i = 0; i < N; i++) { put(i, PX[i], PY[i], i < nb ? 0 : H[i]); if (i >= nb) put(back(i), PX[i], PY[i], -H[i]); }
    const idx = [], g = new THREE.BufferGeometry();
    buckets.forEach((bk, mat) => {
      const start = idx.length;
      for (let i = 0; i < bk.length; i += 3) { idx.push(bk[i], bk[i + 1], bk[i + 2]); idx.push(back(bk[i]), back(bk[i + 2]), back(bk[i + 1])); }
      g.addGroup(start, idx.length - start, mat);
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function buildWing(spec) {
    const field = makeField(spec), grp = new THREE.Group();
    grp.add(new THREE.Mesh(reliefGeo(field), [M.rim, M.panel, M.crescent]));
    const domeG = new THREE.SphereGeometry(RD, 48, 32);
    for (const b of field.beads) {
      const hz = field.height(b.x, b.y);
      for (const s of [1, -1]) { const d = new THREE.Mesh(domeG, M.bead); d.position.set(b.x, b.y, s * (hz - 0.03)); d.scale.z = 0.55; grp.add(d); }
    }
    // flat, invisible stand-in for hit testing (the real mesh is far too dense to raycast)
    const proxy = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(field.outline.map(p => new THREE.Vector2(p.x, p.y)))), M.proxy);
    proxy.userData.part = 'wing'; grp.add(proxy);
    return { grp, field };
  }
  const fore = buildWing(FORE), hind = buildWing(HIND);
  const S = 2 * (0.12 + Math.max(...fore.field.outline.map(p => p.x)));   // wingspan

  /* ---------- assembly ---------- */
  const root = new THREE.Group(); scene.add(root);           // float / hop / shake
  const pivot = new THREE.Group(); root.add(pivot);          // look & nod rotations
  const butterfly = new THREE.Group(); pivot.add(butterfly); // centred by `offset`
  const bodyGroup = new THREE.Group(); butterfly.add(bodyGroup);
  const JOINT = new THREE.Vector3(0.12, 0.02, -0.17);
  const pivots = [], proxies = [];
  for (const sign of [1, -1]) {
    const side = new THREE.Group(); side.scale.x = sign;
    const up = new THREE.Group(); up.position.copy(JOINT); up.add(sign === 1 ? fore.grp : fore.grp.clone());
    const lo = new THREE.Group(); lo.position.copy(JOINT).add(new THREE.Vector3(0, 0, -0.012)); lo.add(sign === 1 ? hind.grp : hind.grp.clone());
    side.add(up, lo); butterfly.add(side); pivots.push({ up, lo });
  }
  butterfly.traverse(o => { if (o.userData.part === 'wing') proxies.push(o); });
  const innerLight = new THREE.PointLight(0x3d7bff, 0.8 * L.innerGlow, 0.8 * S, 2);
  innerLight.position.set(0, 0.25, -0.15 * S); butterfly.add(innerLight);

  /* ---------- body ---------- */
  const HY = 1.75, HZ = 0.05, HR = 0.12 * S, HC = new THREE.Vector3(0, HY, HZ);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function taperTube(curve, rFn, segs, radial) {
    const g = new THREE.TubeGeometry(curve, segs, 1, radial, false), pos = g.attributes.position;
    for (let i = 0; i <= segs; i++) {
      const Pt = curve.getPointAt(i / segs), r = rFn(i / segs);
      for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; pos.setXYZ(k, Pt.x + (pos.getX(k) - Pt.x) * r, Pt.y + (pos.getY(k) - Pt.y) * r, Pt.z + (pos.getZ(k) - Pt.z) * r); }
    }
    pos.needsUpdate = true; return g;
  }
  const lathe = (pts, n, seg = 72) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1]))).getPoints(n), seg);
  const tangentFrame = n => { const u = new THREE.Vector3(0, 1, 0).cross(n).normalize(); const v = n.clone().cross(u).normalize(); return { u, v }; };
  function spherePatch(n, w, h, shapeFn, lift, nx = 28, ny = 14) {
    const { u, v } = tangentFrame(n), pos = [], uvs = [], idx = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const [sx, sy] = shapeFn(i / nx, j / ny);
      const d = n.clone().multiplyScalar(HR).addScaledVector(u, sx * w).addScaledVector(v, sy * h).normalize();
      const p = HC.clone().addScaledVector(d, HR + lift); pos.push(p.x, p.y, p.z); uvs.push(i / nx, j / ny);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const mid = 3 * Math.floor((nx + 1) * (ny + 1) / 2);
    const p0 = new THREE.Vector3().fromArray(pos, mid), nrm = new THREE.Vector3().fromArray(g.attributes.normal.array, mid);
    if (nrm.dot(p0.sub(HC)) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    return g;
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(HR, 80, 56), M.glass); head.position.copy(HC); bodyGroup.add(head);
  const headCore = new THREE.Mesh(new THREE.SphereGeometry(HR * 0.9, 48, 32), M.core); headCore.position.copy(HC); bodyGroup.add(headCore);
  const headProxy = new THREE.Mesh(new THREE.SphereGeometry(HR, 16, 12), M.proxy); headProxy.position.copy(HC); headProxy.userData.part = 'head'; bodyGroup.add(headProxy); proxies.push(headProxy);

  // face lives on a pivot at the head centre, so turning it slides the whole face over the sphere (= "looking")
  const facePivot = new THREE.Group(); facePivot.position.copy(HC); bodyGroup.add(facePivot);
  const face = new THREE.Group(); face.position.copy(HC).negate(); facePivot.add(face);
  const eyeParts = { open: [], closed: [], happy: [] };
  (function buildFace() {
    const F = P.face, D = 2 * HR, re = F.eyeSize * D / 2, gap = F.eyeGap * D, ex = re + gap / 2, ey = 0.04 * D;
    const arc = (n, bend, list) => {   // closed / happy eye: a curved glass-black stroke on the head
      const { u, v } = tangentFrame(n), pts = [];
      for (let i = 0; i <= 24; i++) { const x = -1 + 2 * i / 24; const d = n.clone().multiplyScalar(HR).addScaledVector(u, x * re * 0.78).addScaledVector(v, bend * re * 0.32 * (1 - x * x) - bend * re * 0.08).normalize(); pts.push(HC.clone().addScaledVector(d, HR + 0.012)); }
      const mesh = new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(pts), t => re * 0.12 * (0.55 + 0.45 * Math.sin(Math.PI * t)), 48, 12), M.eye);
      mesh.visible = false; face.add(mesh); list.push(mesh);
    };
    for (const s of [-1, 1]) {
      const n = V(s * ex, ey, Math.sqrt(Math.max(0.01, HR * HR - ex * ex - ey * ey))).normalize();
      const { u, v } = tangentFrame(n);
      const ringR = re * 1.12, tubeR = Math.max(0.012, re * 0.07);
      const a = Math.asin(Math.min(0.99, (ringR - tubeR) / HR)), rp = [];
      for (let i = 0; i < 96; i++) { const th = i / 96 * Math.PI * 2; const d = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, Math.cos(th) * Math.sin(a)).addScaledVector(v, Math.sin(th) * Math.sin(a)); rp.push(HC.clone().addScaledVector(d, HR + tubeR * 0.25)); }
      face.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp, true), 140, tubeR, 20, true), M.eyeRim));
      const np = n.clone().multiplyScalar(HR).addScaledVector(u, -s * F.gazeX * 2 * re).addScaledVector(v, F.gazeY * 2 * re).normalize();
      const rho = re * 1.3; let lo = HR - rho, hi = HR;
      for (let it = 0; it < 40; it++) { const c = (lo + hi) / 2, x = (HR * HR - rho * rho + c * c) / (2 * c), r = Math.sqrt(Math.max(0, HR * HR - x * x)); if (r < re * 0.98) lo = c; else hi = c; }
      const DC = HC.clone().addScaledVector(np, (lo + hi) / 2);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(rho, 56, 40), M.eye); dome.position.copy(DC); face.add(dome); eyeParts.open.push(dome);
      const f2 = tangentFrame(np);
      const spot = (ox, oy, r) => {
        const dir = np.clone().multiplyScalar(Math.sqrt(Math.max(0, rho * rho - ox * ox - oy * oy))).addScaledVector(f2.u, ox).addScaledVector(f2.v, oy).normalize();
        const p = DC.clone().addScaledVector(dir, rho + 0.002), mm = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), M.catch);
        mm.position.copy(p); mm.lookAt(p.clone().add(dir)); mm.scale.set(r, r, r * 0.12); face.add(mm); eyeParts.open.push(mm);
      };
      spot(-s * 0.2 * re, 0.32 * re, F.catchlight * re);
      spot(s * 0.34 * re, -0.4 * re, 0.14 * re);
      // closed-eye cover: a dark cap over the pupil, plus the stroke
      arc(n, -1, eyeParts.closed);   // ‿  sleeping
      arc(n, 1, eyeParts.happy);     // ^  joyful
      const cn = V(s * (ex + re * 0.55), ey - re, 0); cn.z = Math.sqrt(Math.max(0.01, HR * HR - cn.x * cn.x - cn.y * cn.y)); cn.normalize();
      face.add(new THREE.Mesh(spherePatch(cn, 0.09 * D, 0.09 * D, (i, j) => [i * 2 - 1, j * 2 - 1], 0.006, 16, 16), M.cheek));
    }
    const w = F.smileWidth * D, hgt = F.smileOpen * D, my = -0.2 * D;
    const mn = V(0, my, Math.sqrt(Math.max(0.01, HR * HR - my * my))).normalize();
    face.add(new THREE.Mesh(spherePatch(mn, w, hgt, (i, j) => { const x = i * 2 - 1; return [x * 0.5, -Math.sqrt(Math.max(0, 1 - x * x)) * j]; }, 0.002, 40, 10), M.eye));
    const { u: mu, v: mv } = tangentFrame(mn), lipR = 0.012 * D, lip = [];
    const onHead = (sx, sy) => HC.clone().addScaledVector(mn.clone().multiplyScalar(HR).addScaledVector(mu, sx).addScaledVector(mv, sy).normalize(), HR + lipR * 0.35);
    for (let i = 0; i <= 40; i++) { const x = 1 - 2 * i / 40; lip.push(onHead(x * w / 2, -Math.sqrt(Math.max(0, 1 - x * x)) * hgt)); }
    for (let i = 1; i < 12; i++) { const x = -1 + 2 * i / 12; lip.push(onHead(x * w / 2, 0)); }
    face.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip, true, 'centripetal'), 160, lipR, 14, true), M.glass));
  })();

  (function buildAntennae() {
    const A = P.antennae, th = THREE.MathUtils.degToRad(A.angle);
    const rMid = A.thickness * S / 2, rBase = rMid * 0.8125, rPre = rMid * 1.1875, rh = A.hookRadius * S, rBall = A.drop * S / 2;
    for (const s of [-1, 1]) {
      const bx = s * 0.05 * S, by = HY + Math.sqrt(HR * HR - bx * bx);
      const Bp = V(bx, by, HZ), dir0 = Bp.clone().sub(HC).normalize();
      const topY = HY + HR + A.height * S - rh;
      const Ap = V(bx + s * Math.tan(th) * (topY - by), topY, HZ + 0.03), Cp = V(bx + s * 0.02 * S, by + 0.6 * (topY - by), HZ + 0.06);
      const pts = [HC.clone().addScaledVector(dir0, HR * 0.8), Bp.clone()];
      for (let i = 1; i <= 14; i++) { const t = i / 14; pts.push(Bp.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(Cp, 2 * t * (1 - t)).addScaledVector(Ap, t * t)); }
      const tA = Ap.clone().sub(Cp).normalize(), nA = V(s * tA.y, -s * tA.x, 0), Hc = Ap.clone().addScaledVector(nA, rh), r0 = nA.clone().multiplyScalar(-rh);
      for (let i = 1; i <= 10; i++) { const ph = -s * (i / 10) * THREE.MathUtils.degToRad(115), c = Math.cos(ph), sn = Math.sin(ph); pts.push(V(Hc.x + r0.x * c - r0.y * sn, Hc.y + r0.x * sn + r0.y * c, Ap.z)); }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const rFn = t => t < 0.06 ? rBase : t < 0.55 ? THREE.MathUtils.lerp(rBase, rMid, (t - 0.06) / 0.49)
        : t < 0.8 ? THREE.MathUtils.lerp(rMid, rPre, (t - 0.55) / 0.25) : THREE.MathUtils.lerp(rPre, rBall * 0.82, (t - 0.8) / 0.2);
      bodyGroup.add(new THREE.Mesh(taperTube(curve, rFn, 160, 28), M.antenna));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(rBall, 40, 28), M.antenna); ball.position.copy(curve.getPointAt(1)); bodyGroup.add(ball);
      const d = curve.getTangentAt(0.07).normalize(), R1 = 0.0225 * S, Hf = 0.02 * S;
      const flare = new THREE.Mesh(lathe([[R1, -Hf * 0.6], [R1, 0], [R1 * 0.86, Hf * 0.35], [rBase * 1.1, Hf * 0.75], [rBase, Hf]], 24, 40), M.glass);
      flare.quaternion.setFromUnitVectors(V(0, 1, 0), d); flare.position.copy(Bp); bodyGroup.add(flare);
    }
  })();

  const neckY = HY - HR * 0.985;
  (function buildAbdomen() {
    const Lb = P.abdomen.length * S, Wr = P.abdomen.width * S / 2, rb = 0.025 * S, top = neckY - 0.01;
    const taper = sN => rb + (0.965 * Wr - rb) * Math.pow(1 - (sN - 0.32) / 0.61, 1.15);
    const prof = [[0, 0.001], [0.012, 0.42 * Wr], [0.04, 0.7 * Wr], [0.09, 0.9 * Wr], [0.2, Wr], [0.32, 0.965 * Wr], [0.5, taper(0.5)], [0.68, taper(0.68)], [0.84, taper(0.84)], [0.93, rb], [0.965, rb * 0.86], [0.99, rb * 0.5], [1, 0.001]];
    const toPts = (wk, lk, off) => prof.map(([sN, r]) => [Math.max(0.001, r * wk), top - off - sN * Lb * lk]);
    const shell = new THREE.Mesh(lathe(toPts(1, 1, 0), 100, 80), M.shell); shell.position.z = HZ; bodyGroup.add(shell);
    const core = new THREE.Mesh(lathe(toPts(P.abdomen.core, 0.9, 0.05 * Lb), 100, 56), M.core); core.position.z = HZ; bodyGroup.add(core);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(rb * 0.62, 28, 20), M.glass); drop.position.set(0, top - Lb + rb * 0.25, HZ); drop.scale.y = 1.2; bodyGroup.add(drop);
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), M.proxy);
    proxy.position.set(0, top - Lb * 0.45, HZ); proxy.scale.set(Wr, Lb * 0.52, Wr); proxy.userData.part = 'body'; bodyGroup.add(proxy); proxies.push(proxy);
  })();
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.067 * S, 0.018 * S, 24, 80), M.glass);
  neck.rotation.x = Math.PI / 2; neck.scale.z = 0.6; neck.position.set(0, neckY, HZ); bodyGroup.add(neck);

  /* ---------- framing ---------- */
  butterfly.updateMatrixWorld(true);
  const box = new THREE.Box3();
  butterfly.traverse(o => { if (o.isMesh && o.material !== M.proxy) box.expandByObject(o); });
  const fitC = box.getCenter(new THREE.Vector3()), fitS = box.getSize(new THREE.Vector3());
  butterfly.position.copy(fitC).negate();
  const margin = options.margin ?? 0.86;

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, Math.max((fitS.y / margin) / 2 / tanH, (fitS.x / margin) / 2 / (tanH * camera.aspect)) + fitS.z / 2);
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  /* ---------- state machine ---------- */
  let baseState = 'idle', overlay = null, overlayUntil = 0;
  const anim = Object.assign({}, STATES.idle);
  const NUM_KEYS = ['flapSpeed', 'flapAmp', 'fold', 'bob', 'pitch', 'cheeks', 'shake', 'nod', 'hop', 'exposure', 'look'];
  const current = () => STATES[overlay && performance.now() < overlayUntil ? overlay : baseState];
  function setState(name) { if (!STATES[name]) throw new Error('Unknown Galya state: ' + name); baseState = name; }
  function react(name, ms = 1500) { if (!STATES[name]) throw new Error('Unknown Galya state: ' + name); overlay = name; overlayUntil = performance.now() + ms; }

  /* ---------- pointer following ---------- */
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  function lookAt(clientX, clientY) {
    const r = container.getBoundingClientRect();
    look.tx = Math.max(-1.5, Math.min(1.5, ((clientX - r.left) / r.width) * 2 - 1));
    look.ty = Math.max(-1.5, Math.min(1.5, -(((clientY - r.top) / r.height) * 2 - 1)));
  }
  const onMove = e => lookAt(e.clientX, e.clientY);
  if (followPointer) window.addEventListener('pointermove', onMove, { passive: true });

  /* ---------- hit testing & anchors ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitTest(clientX, clientY) {
    const r = container.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    root.updateMatrixWorld(true);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(proxies, false)[0];
    return hit ? hit.object.userData.part : null;
  }
  function screenPoint(where = 'top') {
    root.updateMatrixWorld(true);
    const p = where === 'face' ? HC.clone() : HC.clone().add(new THREE.Vector3(0, HR * 1.05, 0));
    bodyGroup.localToWorld(p); p.project(camera);
    const r = container.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }

  /* ---------- loop ---------- */
  let raf = 0, running = true, visible = true, flapPhase = 0, last = performance.now(), nextBlink = 2500, blinkUntil = 0, t = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; schedule(); });
  io.observe(container);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);
  function schedule() { if (running && visible && !document.hidden && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function setEyes(mode) { for (const k in eyeParts) for (const o of eyeParts[k]) o.visible = (k === mode); }
  let eyeMode = '';
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const tgt = current(), k = 1 - Math.exp(-dt * 5);
    for (const key of NUM_KEYS) anim[key] += (tgt[key] - anim[key]) * k;
    if (reduceMotion) { anim.hop = 0; anim.shake = 0; }

    // eyes + blinking
    let eyes = tgt.eyes;
    if (eyes === 'open') { if (now > nextBlink) { blinkUntil = now + 120; nextBlink = now + 2500 + Math.random() * 3500; } if (now < blinkUntil) eyes = 'closed'; }
    if (eyes !== eyeMode) { setEyes(eyes); eyeMode = eyes; }

    // look at the pointer
    look.x += (look.tx * anim.look - look.x) * k; look.y += (look.ty * anim.look - look.y) * k;
    pivot.rotation.set(-look.y * 0.18 + anim.pitch + Math.sin(t * 9) * 0.12 * anim.nod, look.x * 0.35, 0);
    facePivot.rotation.set(-look.y * 0.15, look.x * 0.22, 0);

    // float, hop, coffee jitter
    const motion = reduceMotion ? 0.3 : 1;
    root.position.set(
      anim.shake * (Math.random() - 0.5) * 0.05,
      Math.sin(t * 1.1) * anim.bob * motion + Math.abs(Math.sin(t * 7)) * 0.18 * anim.hop,
      0);

    // wings: flap + fold back when sleeping
    flapPhase += dt * anim.flapSpeed;
    const amp = anim.flapAmp * motion;
    for (const p of pivots) {
      p.up.rotation.y = 0.16 + anim.fold * 1.15 + amp * Math.sin(flapPhase);
      p.lo.rotation.y = 0.12 + anim.fold * 1.05 + amp * 0.85 * Math.sin(flapPhase - 0.35);
    }
    M.cheek.opacity = Math.min(1, P.face.cheeks * anim.cheeks);
    renderer.toneMappingExposure = P.light.exposure * anim.exposure;
    renderer.render(scene, camera);
    schedule();
  }
  setEyes('open'); eyeMode = 'open';
  schedule();

  /* ---------- public API ---------- */
  return {
    setState, react, lookAt, hitTest, screenPoint, setBackground,
    get state() { return baseState; },
    get reaction() { return overlay && performance.now() < overlayUntil ? overlay : null; },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resume() { running = true; schedule(); },
    dispose() {
      running = false; if (raf) cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      Object.values(M).forEach(mat => mat.dispose());
      [filmWing, filmBody, filmAnt, glowTex, cheekTex].forEach(tx => tx.dispose());
      envRT.dispose(); renderer.dispose(); canvas.remove();
    }
  };
}
