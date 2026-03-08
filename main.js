import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { Sky } from "https://unpkg.com/three@0.160.0/examples/jsm/objects/Sky.js";
import { RoundedBoxGeometry } from "https://unpkg.com/three@0.160.0/examples/jsm/geometries/RoundedBoxGeometry.js";

// ===== Scene / Renderer =====
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8bbde8, 60, 220);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ===== Sky =====
const sky = new Sky();
sky.scale.setScalar(1400);
scene.add(sky);
const skyUni = sky.material.uniforms;
skyUni["turbidity"].value       = 2.5;
skyUni["rayleigh"].value        = 3.0;
skyUni["mieCoefficient"].value  = 0.003;
skyUni["mieDirectionalG"].value = 0.86;
const sunVec = new THREE.Vector3();
sunVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(185));
skyUni["sunPosition"].value.copy(sunVec);

// ===== Lights =====
const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff8e0, 1.6);
sunLight.position.set(sunVec.x * 100, sunVec.y * 100, sunVec.z * 100);
scene.add(sunLight);
const skyFill = new THREE.DirectionalLight(0x9cc8f0, 0.4);
skyFill.position.set(0, 20, -60);
scene.add(skyFill);

// ===== Clouds =====
const cloudMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 1.0, transparent: true, opacity: 0.86, depthWrite: false,
});
const clouds = [];

function makeCloud(x, y, z, scale = 1) {
  const group = new THREE.Group();
  const lumps = [
    { s: [4.5, 2.2, 3.2], p: [0,    0,    0]    },
    { s: [3.2, 1.8, 2.5], p: [-3.2, -0.4, 0.6]  },
    { s: [3.8, 2.0, 2.8], p: [ 3.0, -0.3,-0.4]  },
    { s: [2.5, 1.6, 2.0], p: [-1.5,  0.9,-1.2]  },
    { s: [2.2, 1.5, 2.0], p: [ 1.8,  0.8, 1.0]  },
    { s: [2.0, 1.3, 1.8], p: [ 0,    1.2,-0.5]  },
  ];
  for (const lump of lumps) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), cloudMat);
    m.scale.set(...lump.s);
    m.position.set(...lump.p);
    group.add(m);
  }
  group.scale.setScalar(scale);
  group.position.set(x, y, z);
  scene.add(group);
  clouds.push(group);
}

const cloudSeeds = [
  [-55, -12,  -55,  2.4], [ 45, -16, -105,  2.6], [-25, -10, -155,  2.3],
  [ 85, -14,  -38,  2.2], [-75,  -8, -200,  2.5], [  5, -18,  -90,  2.0],
  [-38,  10,  -30,  1.9], [ 58,   7,  -68,  1.8], [-82,  14, -112,  2.0],
  [ 28,   9, -158,  1.9], [-18,  12,  -82,  1.7], [ 78,   6,  -22,  1.9],
  [-48,  15, -192,  1.8], [ 12,   8, -125,  1.7], [-62,  11,   18,  1.8],
  [ 38,  28, -118,  1.4], [-65,  32,  -18,  1.3], [ 92,  26, -162,  1.5],
  [-42,  30, -248,  1.6], [ 18,  24,   28,  1.4],
];
for (const [x, y, z, s] of cloudSeeds) makeCloud(x, y, z, s);

// ===== World collections =====
const solids    = [];
const movers       = [];
const ramps        = [];
const pendulums    = [];
const decorations  = [];
let ring      = null;
let ringBaseY = 0;
let levelEndZ = -149;   // set per level, used for progress bar
let burst       = null;
let starGroup   = null;
let planetGroup = null;
let forestGroup = null;
let birdData    = [];
let meteors     = [];
let meteorTimer = 3.0;
let spaceDying      = false;
let spaceDyingTimer = 0;
let caveGroup    = null;
let caveDropData = [];
let caveDropGeo  = null;
let volcanoGroup = null;
let emberData    = [];
let candyGroup   = null;
let parkGroup    = null;
let cityGroup    = null;
let iceGroup       = null;
let iceBgCloudMat  = null; // cloud floor layer 1 — UV scroll in updateIce
let iceBgCloudMat2 = null; // cloud floor layer 2
let iceBgCloudMat3 = null; // cloud floor layer 3
let iceFillLight   = null; // Level 8 fill PointLight — added/removed per level switch
let auroraMats     = [];   // { mat, speed } — animated each frame in updateIce
let snowMesh       = null;
let iceFogLayers   = [];    // rolling cloud sea [{mesh, mat, baseX, baseZ, oscSpeed, uvSpeed}]
let snowPositions = null;   // kept for compat; not used by instanced system
const SNOW_COUNT = 400;
let snowData     = [];      // per-flake state for InstancedMesh
const snowDummy  = new THREE.Object3D();
let droneData    = [];
let carData      = [];
let rainMesh     = null;
let rainPositions = null;
let windForceX   = 0;
let windActive   = false;
let windTimer    = 0;
let windGustDur  = 0;
let nextGust     = 5.0;
let emberGeo     = null;
let lavaGlowMesh = null;
let geysers      = [];

// Level 9 — Storm Realm
let stormGroup       = null;
let stormRainMesh    = null;
let stormRainData    = [];
let stormLightning   = [];
let stormFlashLight  = null;
let stormFlashTimer  = 0;
let stormPhasePlats  = [];
let stormElecPlats   = [];
let stormWindStreaks  = null;
let stormWindData    = [];
let stormBoltTimer   = 3.0;
let stormCloudPlanes   = [];   // rolling storm cloud layers [{mesh,mat,baseX,baseZ,oscSpeed,uvSpeed}]
let stormFogLayers     = [];   // rolling fog floor layers
let stormCeilingLayers = [];   // overhead cloud ceiling layers
let stormWallClouds    = [];   // distant storm wall masses
let stormBaseBackground = null; // scene.background clone for flash lerp
const STORM_RAIN_COUNT  = 800;
const STORM_WIND_COUNT  = 100;
const stormRainDummy = new THREE.Object3D();
let stormDistantClouds  = [];   // distant storm silhouettes with silent lightning
let stormWindWisps      = [];   // wind gust wisp particles
let stormWispGeo        = null;
let stormWispTexture    = null;
let stormSparkPool      = [];   // electric spark particle pool
let stormSparkGeo       = null;
const STORM_SPARK_COUNT = 30;
let stormRainIntensity  = 0;    // 0=normal, 1=heavy burst
let stormRainCycleTimer = 0;    // 10s cycle timer
let stormRainPhase      = "normal";
let stormHazePlanes     = [];   // atmospheric haze planes
let stormDebrisData     = [];   // enhanced debris tracking

// Per-level platform material personality — set in loadLevel before building
let levelMat = { roughness: 0.55, metalness: 0.05, emissive: 0x000000, emissiveInt: 0.0, edgeColor: 0x000000, edgeOpacity: 0.20 };
let neonUnderglow = false; // true only during Level 5 (Crystal Cave) build

// Lighten a hex color by amt (0–1)
function lightenHex(hex, amt) {
  const r = Math.min(255, ((hex >> 16) & 0xFF) + Math.round((255 - ((hex >> 16) & 0xFF)) * amt));
  const g = Math.min(255, ((hex >>  8) & 0xFF) + Math.round((255 - ((hex >>  8) & 0xFF)) * amt));
  const b = Math.min(255, ( hex        & 0xFF)  + Math.round((255 - ( hex        & 0xFF)) * amt));
  return (r << 16) | (g << 8) | b;
}

// ===== Platform builder =====
function buildBrightVisual(w, h, d, color) {
  const group = new THREE.Group();
  // Apply color tint if levelMat specifies one (e.g. Level 8 ice shifts near-white toward teal)
  let bodyColor = color;
  if (levelMat.colorTint != null && levelMat.tintStrength > 0) {
    const s  = levelMat.tintStrength;
    const tr = (levelMat.colorTint >> 16) & 0xFF, tg = (levelMat.colorTint >> 8) & 0xFF, tb = levelMat.colorTint & 0xFF;
    const cr = (color >> 16) & 0xFF,               cg = (color >> 8) & 0xFF,               cb = color & 0xFF;
    bodyColor = (Math.round(cr + (tr - cr) * s) << 16) | (Math.round(cg + (tg - cg) * s) << 8) | Math.round(cb + (tb - cb) * s);
  }
  // Main body — per-level material personality
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness:         levelMat.roughness,
      metalness:         levelMat.metalness,
      emissive:          new THREE.Color(levelMat.emissive),
      emissiveIntensity: levelMat.emissiveInt,
      transparent:       levelMat.transparent || false,
      opacity:           levelMat.opacity != null ? levelMat.opacity : 1.0,
    })
  ));
  // Edge lines — geometry expanded +0.01 on each axis so edge lines sit just outside body faces (prevents z-fighting)
  group.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.01, h + 0.01, d + 0.01)),
    new THREE.LineBasicMaterial({ color: levelMat.edgeColor, transparent: true, opacity: levelMat.edgeOpacity, depthWrite: false })
  ));
  // Cap slab — thin lighter top surface, slightly smoother than the body
  const capH = Math.max(0.06, h * 0.12);
  const cap  = new THREE.Mesh(
    new THREE.BoxGeometry(w, capH, d),
    new THREE.MeshStandardMaterial({
      color:       lightenHex(bodyColor, 0.30),
      roughness:   Math.max(0.08, levelMat.roughness - 0.22),
      metalness:   levelMat.metalness,
      transparent: levelMat.transparent || false,
      opacity:     levelMat.opacity != null ? Math.min(1, levelMat.opacity + 0.08) : 1.0,
    })
  );
  cap.position.y = h * 0.5 + capH * 0.5 + 0.001; // +0.001 so cap bottom face clears body top face (prevents coplanar z-fighting)
  group.add(cap);
  return group;
}

function buildNeonVisual(w, h, d, color) {
  const group = new THREE.Group();
  // Emissive surface
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.1 })
  ));
  // Bright white edge lines — geometry expanded +0.01 on each axis (prevents z-fighting with body faces)
  group.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.01, h + 0.01, d + 0.01)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90, depthWrite: false })
  ));
  // BackSide glow halo
  const s = 1.22;
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(w * s, h * s, d * s),
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.28, depthWrite: false })
  ));
  // Cap slab — slightly lighter, more emissive top surface
  const capH   = Math.max(0.06, h * 0.12);
  const capCol = lightenHex(color, 0.22);
  const cap    = new THREE.Mesh(
    new THREE.BoxGeometry(w, capH, d),
    new THREE.MeshStandardMaterial({ color: capCol, emissive: capCol, emissiveIntensity: 0.80, roughness: 0.18, metalness: 0.1 })
  );
  cap.position.y = h * 0.5 + capH * 0.5 + 0.001; // +0.001 so cap bottom clears body top face
  group.add(cap);

  // Underglow point light — Level 5 Crystal Cave only
  // Casts the platform's color downward onto cave floor and crystals below
  if (neonUnderglow) {
    const light = new THREE.PointLight(color, 2.2, 24, 1.8);
    light.position.y = -h * 0.5 - 0.5;
    group.add(light);
  }

  return group;
}

// ===== Level 8 platform visuals — three distinct types =====
// Shared helper: crisp cold-blue edge outline on the base body (12 lines, very cheap)
// iceEdgeGlow removed — Level 8 visuals no longer use layered edge lines

// ===== Level 9 platform visuals — Storm Realm =====
function stormEdgeGlow(w, h, d) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.80, depthWrite: false })
  );
}

function buildStormPlatformVisual(w, h, d, emissive, accent, platType = "standard") {
  if (platType === "electric") return buildElectricPlatformVisual(w, h, d);
  if (platType === "phase")    return buildPhasePlatformVisual(w, h, d);
  return buildStormBaseVisual(w, h, d);
}

function buildStormBaseVisual(w, h, d) {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x2a3444, emissive: 0x3a5070, emissiveIntensity: 0.7,
    roughness: 0.65, metalness: 0.30, flatShading: true
  });
  const base = new THREE.Mesh(new RoundedBoxGeometry(w, h * 0.92, d, 2, 0.08), baseMat);
  base.position.y = -h * 0.04;
  g.add(base);
  const glow = stormEdgeGlow(w, h * 0.92, d);
  glow.position.y = base.position.y;
  g.add(glow);
  // Cap slab — lighter steel top with visible glow
  const capH = Math.max(0.08, h * 0.14);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x3a4a5e, emissive: 0x506888, emissiveIntensity: 0.5,
    roughness: 0.50, metalness: 0.25
  });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, capH, d * 0.96), topMat);
  cap.position.y = h * 0.38;
  g.add(cap);
  return { group: g, topMat };
}

function buildElectricPlatformVisual(w, h, d) {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x222e40, emissive: 0x223366, emissiveIntensity: 0.7,
    roughness: 0.60, metalness: 0.30, flatShading: true
  });
  const base = new THREE.Mesh(new RoundedBoxGeometry(w, h * 0.92, d, 2, 0.08), baseMat);
  base.position.y = -h * 0.04;
  g.add(base);
  // Bright electric edge glow
  const glow = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h * 0.92, d)),
    new THREE.LineBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.85, depthWrite: false })
  );
  glow.position.y = base.position.y;
  g.add(glow);
  // Electric top plate — strong cyan glow
  const capH = Math.max(0.10, h * 0.18);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x2a3855, emissive: 0x5fd0ff, emissiveIntensity: 1.3,
    roughness: 0.25, metalness: 0.15
  });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, capH, d * 0.94), topMat);
  cap.position.y = h * 0.38;
  g.add(cap);
  // BackSide glow halo
  const haloScale = 1.22;
  g.add(new THREE.Mesh(
    new THREE.BoxGeometry(w * haloScale, h * haloScale, d * haloScale),
    new THREE.MeshBasicMaterial({ color: 0x5fd0ff, side: THREE.BackSide, transparent: true, opacity: 0.26, depthWrite: false })
  ));
  return { group: g, topMat };
}

function buildPhasePlatformVisual(w, h, d) {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x223355, emissive: 0x4488cc, emissiveIntensity: 0.8,
    roughness: 0.45, metalness: 0.20, transparent: true, opacity: 0.85
  });
  const base = new THREE.Mesh(new RoundedBoxGeometry(w, h * 0.92, d, 2, 0.08), baseMat);
  base.position.y = -h * 0.04;
  g.add(base);
  // Flickering edge lines
  const glow = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h * 0.92, d)),
    new THREE.LineBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.75, depthWrite: false })
  );
  glow.position.y = base.position.y;
  g.add(glow);
  // Translucent glowing top
  const capH = Math.max(0.08, h * 0.14);
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x2a3a55, emissive: 0x5599dd, emissiveIntensity: 0.9,
    roughness: 0.35, metalness: 0.10, transparent: true, opacity: 0.80
  });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, capH, d * 0.94), topMat);
  cap.position.y = h * 0.38;
  g.add(cap);
  return { group: g, topMat };
}

function buildSlipperyIceVisual(w, h, d) {
  const g = new THREE.Group();
  const vh = h * 2.5;
  // Seeded random per-platform so each glacier looks different
  const seed = (w * 7.31 + d * 13.17 + vh * 3.79) % 1.0;
  const rand = (() => { let s = seed * 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

  // Irregular glacier geometry: start from a box, distort vertices
  const geo = new THREE.BoxGeometry(w, vh, d, 4, 3, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const nyNorm = (y / (vh * 0.5) + 1.0) * 0.5;  // 0=bottom, 1=top
    // Top surface: minimal distortion (playable); sides/bottom: more jagged
    const topDamp = Math.pow(1.0 - nyNorm, 0.5);  // 0 at top, 1 at bottom
    const xJitter = (rand() - 0.5) * 0.30 * (0.15 + 0.85 * topDamp);
    const yJitter = (rand() - 0.5) * 0.16 * topDamp;
    const zJitter = (rand() - 0.5) * 0.30 * (0.15 + 0.85 * topDamp);
    pos.setXYZ(i, pos.getX(i) + xJitter, y + yJitter, pos.getZ(i) + zJitter);
  }
  geo.computeVertexNormals();

  // Ice depth gradient: frosty white top → medium blue sides → deeper blue underside
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const topC    = new THREE.Color(0xeaf9ff);
  const midC    = new THREE.Color(0x9ed6ff);
  const bottomC = new THREE.Color(0x6bbcff);
  const tmp     = new THREE.Color();
  const boost   = 2.8;
  for (let i = 0; i < pos.count; i++) {
    const nyNorm = (pos.getY(i) / (vh * 0.5) + 1.0) * 0.5;
    // Two-stop gradient: bottom→mid at ny<0.5, mid→top at ny>=0.5
    if (nyNorm < 0.5) {
      const t = nyNorm * 2.0;
      tmp.copy(bottomC).lerp(midC, t);
    } else {
      const t = (nyNorm - 0.5) * 2.0;
      tmp.copy(midC).lerp(topC, t);
    }
    const shade = (0.70 + 0.30 * Math.max(0, nrm.getY(i))) * boost;
    tmp.r *= shade;  tmp.g *= shade;  tmp.b *= shade;
    colors[i * 3] = tmp.r;  colors[i * 3 + 1] = tmp.g;  colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const topMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const body = new THREE.Mesh(geo, topMat);
  body.position.y = -(vh - h) * 0.5;
  // Small random rotation for variation
  body.rotation.y = (rand() - 0.5) * 0.08;
  g.add(body);
  return { group: g, topMat };
}

function buildFallingIceVisual(w, h, d) {
  const g = new THREE.Group();
  const vh = h * 2.5;
  const r = Math.min(w, vh, d) * 0.5;
  const geo = new RoundedBoxGeometry(w, vh, d, 5, r);
  // Snow top wrapping to cool blue underside/lower sides — steeper blend
  _iceVertexColors(geo, vh, new THREE.Color(0xeef4f8), new THREE.Color(0x4488bb), 1.8, 1.5);
  const topMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const body = new THREE.Mesh(geo, topMat);
  body.position.y = -(vh - h) * 0.5;
  g.add(body);
  return { group: g, topMat };
}

// Bake vertex colors with position gradient + normal-based shading for Level 8 platforms.
// Uses MeshBasicMaterial so colors render regardless of dim scene lighting.
// Boost >1 compensates for renderer ACES tone mapping that compresses 1.0 → ~0.8.
function _iceVertexColors(geo, vh, topCol, bottomCol, blendPow, wrapMul) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  const boost = 2.8;
  for (let i = 0; i < pos.count; i++) {
    const ny = (pos.getY(i) / (vh * 0.5) + 1.0) * 0.5;
    const t = Math.pow(Math.min(1.0, ny * wrapMul), blendPow);
    tmp.copy(bottomCol).lerp(topCol, t);
    const shade = 0.68 + 0.32 * Math.max(0, nrm.getY(i));
    tmp.r *= shade * boost;  tmp.g *= shade * boost;  tmp.b *= shade * boost;
    colors[i * 3] = tmp.r;  colors[i * 3 + 1] = tmp.g;  colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function buildSnowIceVisual(w, h, d) {
  const g = new THREE.Group();
  const vh = h * 2.5;
  const r = Math.min(w, vh, d) * 0.5;
  const geo = new RoundedBoxGeometry(w, vh, d, 5, r);
  _iceVertexColors(geo, vh, new THREE.Color(0xffffff), new THREE.Color(0xc4dfe8), 0.6, 1.3);
  const topMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const body = new THREE.Mesh(geo, topMat);
  body.position.y = -(vh - h) * 0.5;
  g.add(body);
  return { group: g, topMat };
}

function buildIcePlatformVisual(w, h, d, emissive, accent, platType = "snow") {
  if (platType === "falling") return buildFallingIceVisual(w, h, d);
  if (platType === "snow")    return buildSnowIceVisual(w, h, d);
  return buildSlipperyIceVisual(w, h, d);
}

function boxPlatform({ x, y, z, w, h, d, color = 0xFFDD00, neon = false, emissive, accent, platType = "snow" }) {
  const col = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    // depthWrite: false — collision box is invisible (opacity:0) so must not write depth;
    // without this, on Level 8 (all-transparent visuals) the collision box top face
    // z-fights with the top plate surface (both at y=h/2) in the transparent render pass
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  col.position.set(x, y, z);
  scene.add(col);
  let topMat = null;
  // vtop = how far the visible top surface extends above the collision box top.
  // Standard bright/neon levels have a cap slab above the collision top;
  // ice and storm visuals align the visual top with the collision top.
  let vtop = 0;
  if (levelMat.iceVisual) {
    const result = buildIcePlatformVisual(w, h, d, emissive, accent, platType);
    col.add(result.group);
    topMat = result.topMat;
  } else if (levelMat.stormVisual) {
    const result = buildStormPlatformVisual(w, h, d, emissive, accent, platType);
    col.add(result.group);
    topMat = result.topMat;
  } else {
    col.add(neon ? buildNeonVisual(w, h, d, color) : buildBrightVisual(w, h, d, color));
    const capH = Math.max(0.06, h * 0.12);
    vtop = capH + 0.001;
  }
  solids.push({ type: "box", mesh: col, w, h, d, vtop, topMat, baseEI: topMat ? topMat.emissiveIntensity : 0 });
  return col;
}

function movingPlatform({ x, y, z, w, h, d, axis = "x", amplitude = 2.5, speed = 1, phase = 0, color = 0xFF8833, neon = false, emissive, accent, platType = "snow" }) {
  const col = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  col.position.set(x, y, z);
  scene.add(col);
  let moverTopMat = null;
  let vtop = 0;
  if (levelMat.iceVisual) {
    const result = buildIcePlatformVisual(w, h, d, emissive, accent, platType);
    col.add(result.group);
    moverTopMat = result.topMat;
  } else if (levelMat.stormVisual) {
    const result = buildStormPlatformVisual(w, h, d, emissive, accent, platType);
    col.add(result.group);
    moverTopMat = result.topMat;
  } else {
    col.add(neon ? buildNeonVisual(w, h, d, color) : buildBrightVisual(w, h, d, color));
    const capH = Math.max(0.06, h * 0.12);
    vtop = capH + 0.001;
  }
  movers.push({
    type: "mover", mesh: col, w, h, d, vtop,
    basePos: col.position.clone(),
    axis, amplitude, speed, phase,
    prevPos: col.position.clone(),
    delta: new THREE.Vector3(),
    topMat: moverTopMat, baseEI: moverTopMat ? moverTopMat.emissiveIntensity : 0,
  });
  return col;
}

function rampPlatform({ x, y, z, w, d, angleDeg = 18, yawDeg = 0, thickness = 0.5, color = 0x88CC44, neon = false }) {
  const col = new THREE.Mesh(
    new THREE.BoxGeometry(w, thickness, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  col.position.set(x, y, z);
  col.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  col.rotation.x = -THREE.MathUtils.degToRad(angleDeg);
  scene.add(col);
  const vt = Math.max(thickness, 0.7);
  const vis = neon ? buildNeonVisual(w, vt, d, color) : buildBrightVisual(w, vt, d, color);
  vis.position.y += (vt - thickness) * 0.5;
  col.add(vis);
  col.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(col.quaternion).normalize();
  const point  = col.position.clone();
  ramps.push({ type: "ramp", mesh: col, w, d, thickness, normal, point, topMat: null, baseEI: 0 });
  return col;
}

// ===== Pendulum obstacle =====
function pendulumObstacle({ x, y, z, armLength = 4.5, boxW = 3.5, boxH = 2.0, boxD = 1.2, speed = 1.5, amplitude = 1.05, color = 0xFF3333, neon = false, sphere = false, sphereRadius = 1.8, fire = false }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    neon  ? new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.3 })
    : fire ? new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xFF4400, emissiveIntensity: 0.5, roughness: 0.8 })
           : new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 })
  ));
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, armLength, 0.2),
    neon  ? new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.4 })
    : fire ? new THREE.MeshStandardMaterial({ color: 0x221100, emissive: 0x661100, emissiveIntensity: 0.35, roughness: 0.9 })
           : new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.7 })
  );
  arm.position.y = -armLength / 2;
  group.add(arm);

  if (neon && sphere) {
    // Neon orb: emissive sphere + icosahedron wireframe + glow shell
    const blockGroup = new THREE.Group();
    blockGroup.position.y = -armLength;
    const r = sphereRadius;
    blockGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.70, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.88 })
    ));
    blockGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r, 1)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    ));
    blockGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.28, 14, 10),
      new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.25, depthWrite: false })
    ));
    group.add(blockGroup);
    const colSize = r * 2;
    pendulums.push({ group, block: blockGroup, boxW: colSize, boxH: colSize, boxD: colSize, speed, amplitude, worldPos: new THREE.Vector3() });
  } else if (neon) {
    // Neon block: emissive + glow shell
    const blockGroup = new THREE.Group();
    blockGroup.position.y = -armLength;
    blockGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry(boxW, boxH, boxD),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.1 })
    ));
    blockGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(boxW, boxH, boxD)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90 })
    ));
    const s = 1.22;
    blockGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry(boxW * s, boxH * s, boxD * s),
      new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.28, depthWrite: false })
    ));
    group.add(blockGroup);
    const block = blockGroup.children[0];
    block.position.set(0, 0, 0);
    pendulums.push({ group, block: blockGroup, boxW, boxH, boxD, speed, amplitude, worldPos: new THREE.Vector3() });
  } else if (fire) {
    // Scorched block with animated flame cones and flickering light
    const blockGroup = new THREE.Group();
    blockGroup.position.y = -armLength;
    // Scorched block body
    blockGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry(boxW, boxH, boxD),
      new THREE.MeshStandardMaterial({ color: 0x1A0800, emissive: 0xCC2200, emissiveIntensity: 0.65, roughness: 0.95, metalness: 0.05 })
    ));
    // Glowing edges
    blockGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(boxW, boxH, boxD)),
      new THREE.LineBasicMaterial({ color: 0xFF6600, transparent: true, opacity: 0.85 })
    ));
    // Outer heat glow
    const gs = 1.20;
    blockGroup.add(new THREE.Mesh(
      new THREE.BoxGeometry(boxW * gs, boxH * gs, boxD * gs),
      new THREE.MeshBasicMaterial({ color: 0xFF3300, side: THREE.BackSide, transparent: true, opacity: 0.20, depthWrite: false })
    ));
    // Flame cones — layered from large/dark-red at base to small/yellow at tip
    const flameDefs = [
      { h: 2.0, r: 0.60, col: 0xFF1100, op: 0.88, ox:  0.00, oz:  0.00 },
      { h: 1.5, r: 0.45, col: 0xFF5500, op: 0.80, ox:  0.12, oz:  0.08 },
      { h: 1.0, r: 0.30, col: 0xFF9900, op: 0.75, ox: -0.10, oz:  0.06 },
      { h: 0.6, r: 0.16, col: 0xFFDD00, op: 0.65, ox:  0.05, oz: -0.09 },
    ];
    const flames = [];
    for (const fd of flameDefs) {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(fd.r, fd.h, 7),
        new THREE.MeshBasicMaterial({ color: fd.col, transparent: true, opacity: fd.op, depthWrite: false })
      );
      f.position.set(fd.ox, boxH * 0.5 + fd.h * 0.5, fd.oz);
      blockGroup.add(f);
      flames.push(f);
    }
    // Flickering point light
    const fireLight = new THREE.PointLight(0xFF5500, 3.2, 16);
    fireLight.position.y = boxH * 0.5 + 1.8;
    blockGroup.add(fireLight);
    group.add(blockGroup);
    pendulums.push({ group, block: blockGroup, boxW, boxH, boxD, speed, amplitude, worldPos: new THREE.Vector3(), fire: true, flames, fireLight, phase: Math.random() * Math.PI * 2 });
  } else {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(boxW, boxH, boxD),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 })
    );
    block.position.y = -armLength;
    group.add(block);
    pendulums.push({ group, block, boxW, boxH, boxD, speed, amplitude, worldPos: new THREE.Vector3() });
  }
}

// ===== Crystal stalactite pendulum (Level 4) =====
function stalactitePendulum({ x, y, z, armLength = 7, tipRadius = 0.9, tipHeight = 3.5, speed = 1.8, amplitude = 1.05, color = 0x00CCDD }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);
  // Ceiling anchor
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.7 })
  ));
  // Thin dark arm
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, armLength, 6),
    new THREE.MeshStandardMaterial({ color: 0x111222, roughness: 0.8 })
  );
  arm.position.y = -armLength * 0.5;
  group.add(arm);
  // Crystal tip — tapered, pointing down
  const tipGeo = new THREE.CylinderGeometry(tipRadius * 0.06, tipRadius, tipHeight, 6);
  const tip = new THREE.Mesh(
    tipGeo,
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.88 })
  );
  tip.rotation.x = Math.PI;
  tip.position.y = -armLength - tipHeight * 0.5;
  group.add(tip);
  tip.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(tipGeo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 })
  ));
  const boxW = tipRadius * 2, boxH = tipHeight, boxD = tipRadius * 2;
  pendulums.push({ group, block: tip, boxW, boxH, boxD, speed, amplitude, worldPos: new THREE.Vector3() });
}

// ===== Fire-ball pendulum (Level 4) =====
function firePendulum({ x, y, z, armLength = 7, ballRadius = 1.1, speed = 1.8, amplitude = 1.0 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  // Anchor — glowing ember rivet
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xFF5500 })
  ));

  // Red-hot cable core
  const cableCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, armLength, 6),
    new THREE.MeshBasicMaterial({ color: 0xFF4400 })
  );
  cableCore.position.y = -armLength * 0.5;
  group.add(cableCore);

  // Cable heat-glow tube (soft outer halo)
  const cableGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, armLength, 8),
    new THREE.MeshBasicMaterial({ color: 0xFF2200, transparent: true, opacity: 0.13, depthWrite: false })
  );
  cableGlow.position.y = -armLength * 0.5;
  group.add(cableGlow);

  // Fire-ball group
  const ballGroup = new THREE.Group();
  ballGroup.position.y = -armLength;

  // Layer 1 — white-hot magma core
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 0.38, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xFFFFBB })
  ));

  // Layer 2 — bright orange inner lava
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 0.70, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.90, depthWrite: false })
  ));

  // Layer 3 — deep red mid-flame
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 0.96, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xFF3300, transparent: true, opacity: 0.60, depthWrite: false })
  ));

  // Flame licks — 6 cones fanning outward, animated by updatePendulums
  const flames = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const fCone = new THREE.Mesh(
      new THREE.ConeGeometry(ballRadius * 0.28, ballRadius * 1.15, 5),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xFF5500 : 0xFF8800,
        transparent: true, opacity: 0.78, depthWrite: false
      })
    );
    const spread = ballRadius * 0.72;
    fCone.position.set(
      Math.cos(angle) * spread,
      Math.abs(Math.sin(angle)) * spread * 0.35 + ballRadius * 0.45,
      Math.sin(angle) * spread
    );
    fCone.rotation.z =  Math.cos(angle) * 0.9;
    fCone.rotation.x = -Math.sin(angle) * 0.9;
    ballGroup.add(fCone);
    flames.push(fCone);
  }

  // Outer ember aura
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 1.55, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xFF2200, side: THREE.BackSide, transparent: true, opacity: 0.09, depthWrite: false })
  ));

  // Fire light — strong, flickering (intensity driven by updatePendulums)
  const fireLight = new THREE.PointLight(0xFF5500, 3.5, 14);
  fireLight.position.set(0, 0, 0);
  ballGroup.add(fireLight);

  // Wide ambient fill — casts orange glow on surrounding platforms
  const fillLight = new THREE.PointLight(0xFF3300, 0.75, 36);
  fillLight.position.set(0, 0, 0);
  ballGroup.add(fillLight);

  group.add(ballGroup);

  const colSize = ballRadius * 2;
  pendulums.push({
    group, block: ballGroup,
    boxW: colSize, boxH: colSize, boxD: colSize,
    speed, amplitude, worldPos: new THREE.Vector3(),
    fire: true, flames, fireLight, phase: Math.random() * Math.PI * 2,
  });
}

// ===== Icicle cluster pendulum (Level 8) =====
function iciclePendulum({ x, y, z, armLength = 9, speed = 2.0, amplitude = 0.85, color = 0x88CCFF }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  // Anchor — faceted ice crystal
  group.add(new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({ color: 0xCCEEFF, emissive: 0x44AACC, emissiveIntensity: 0.7, roughness: 0.08, metalness: 0.4 })
  ));

  // Thin icy cord — semi-transparent
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, armLength, 6),
    new THREE.MeshStandardMaterial({ color: 0xBBDDFF, roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.55 })
  );
  cord.position.y = -armLength * 0.5;
  group.add(cord);

  // Icicle cluster group — hangs at tip of cord
  const clusterGroup = new THREE.Group();
  clusterGroup.position.y = -armLength;

  const spikeDefs = [
    { ox: 0.00, oz: 0.00, r: 0.28, h: 2.6 },   // center — tallest
    { ox: 0.48, oz: 0.18, r: 0.20, h: 1.9 },
    { ox:-0.40, oz: 0.30, r: 0.18, h: 1.7 },
    { ox: 0.22, oz:-0.48, r: 0.16, h: 1.5 },
    { ox:-0.48, oz:-0.22, r: 0.14, h: 1.4 },
  ];
  for (const sp of spikeDefs) {
    // CylinderGeometry(topR, bottomR) → small end at tip (bottom). Flip so big end is UP.
    const spikeGeo = new THREE.CylinderGeometry(sp.r * 0.04, sp.r, sp.h, 6);
    const spike = new THREE.Mesh(
      spikeGeo,
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.30,
        roughness: 0.06, metalness: 0.45, transparent: true, opacity: 0.82
      })
    );
    spike.position.set(sp.ox, -sp.h * 0.5, sp.oz);
    spike.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(spikeGeo),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
    ));
    clusterGroup.add(spike);
  }

  // Soft outer glow shell
  clusterGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 10, 8),
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.14, depthWrite: false })
  ));

  // Cold blue point light
  const coldLight = new THREE.PointLight(color, 2.2, 20);
  clusterGroup.add(coldLight);

  group.add(clusterGroup);

  // Collision: 2.6 wide, 2.6 tall, 2.6 deep — generous for the cluster
  pendulums.push({
    group, block: clusterGroup,
    boxW: 2.6, boxH: 2.6, boxD: 2.6,
    speed, amplitude, worldPos: new THREE.Vector3(),
  });
}

// ===== Ring spawner =====
function spawnRing(x, y, z) {
  ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.25, 14, 40),
    new THREE.MeshStandardMaterial({
      color: 0xFFDD00, emissive: 0xFF9900, emissiveIntensity: 0.55,
      roughness: 0.2, metalness: 0.75,
    })
  );
  ring.position.set(x, y, z);
  ringBaseY = y;
  scene.add(ring);
}

// ===== Ice platform helpers (Level 8) =====
// Wraps boxPlatform and stamps icy / collapse flags onto the solid entry.
function icePlatform({ x, y, z, w, h = 0.6, d, color, icy = true, collapse = false, collapseDelay = 1.3, emissive, accent }) {
  const platType = collapse ? "falling" : (icy ? "slippery" : "snow");
  boxPlatform({ x, y, z, w, h, d, color, emissive, accent, platType });
  const entry = solids[solids.length - 1];
  if (icy) entry.icy = true;
  if (collapse) {
    entry.collapse      = true;
    entry.collapseTimer = null;   // null = not yet triggered
    entry.collapseDelay = collapseDelay;
    entry.falling       = false;
    entry.fallVel       = 0;
    entry.baseX         = x;
    entry.baseY         = y;
    entry.baseZ         = z;
  }
}

function iceMovingPlatform(opts) {
  movingPlatform({ ...opts, platType: "snow" });
  movers[movers.length - 1].icy = true;
}

// ===== Level 9 storm platform wrapper =====
function stormPlatform({ x, y, z, w, h = 0.6, d, color, platType = "standard" }) {
  boxPlatform({ x, y, z, w, h, d, color, platType });
  const entry = solids[solids.length - 1];
  entry.stormType = platType;
  if (platType === "electric") {
    entry.electrified = false;
    entry.elecTimer   = 0;
    stormElecPlats.push(entry);
  }
  if (platType === "phase") {
    entry.phaseVisible = true;
    entry.phaseTimer   = Math.random() * 3; // stagger start
    entry.phaseCycle   = 5;     // total cycle: 3s visible + 2s invisible
    entry.phaseVisDur  = 3;     // visible portion
    entry.allMats      = [];
    entry.mesh.traverse(obj => {
      if ((obj.isMesh || obj.isLineSegments) && obj.material) {
        obj.material.transparent = true;
        obj.material._baseOpacity = obj.material.opacity;
        entry.allMats.push(obj.material);
      }
    });
    stormPhasePlats.push(entry);
  }
}

// ===== Colour palette =====
const C = {
  yellow: 0xFFDD00, red:    0xFF3333, orange: 0xFF8833,
  green:  0x33CC44, blue:   0x3388FF, purple: 0xAA44FF,
  cyan:   0x00BBCC, pink:   0xFF44AA, teal:   0x00AA88,
  lime:   0x88DD00, gold:   0xFFCC00,
};

// ===== Space background (Level 3 only) =====
function buildSpaceBackground() {
  // Stars — 4 size tiers, group follows camera so they appear at infinity
  starGroup = new THREE.Group();
  starGroup.frustumCulled = false;
  scene.add(starGroup);

  const tiers = [
    { n: 800, size: 0.22, color: 0xffffff  },
    { n: 220, size: 0.50, color: 0xCCDDFF  },
    { n:  55, size: 1.05, color: 0xFFF5DD  },
    { n:  14, size: 2.20, color: 0xffffff  },
  ];
  for (const t of tiers) {
    const arr = new Float32Array(t.n * 3);
    for (let i = 0; i < t.n; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.PI * 2 * Math.random();
      arr[i*3]   = 170 * Math.sin(phi) * Math.cos(theta);
      arr[i*3+1] = 170 * Math.sin(phi) * Math.sin(theta);
      arr[i*3+2] = 170 * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: t.color, size: t.size, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    }));
    pts.frustumCulled = false;
    starGroup.add(pts);
  }

  // --- Planets (world space — parallax as camera moves) ---
  planetGroup = new THREE.Group();
  scene.add(planetGroup);

  // Helper: vertex-colored sphere — colorFn(nx, ny, nz) returns [r, g, b]
  function colorSphere(radius, segs, colorFn) {
    const geo = new THREE.SphereGeometry(radius, segs, segs);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / radius;
      const ny = pos.getY(i) / radius;
      const nz = pos.getZ(i) / radius;
      const c = colorFn(nx, ny, nz);
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }

  // Helper: atmosphere glow shell
  function atmoShell(radius, color, opacity) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.BackSide, depthWrite: false })
    );
  }

  // 1. Gas giant — amber/orange horizontal bands with turbulence
  const g1geo = colorSphere(16, 48, (x, y, z) => {
    const warp = Math.sin(x * 3.2 + z * 1.8) * 0.6;
    const band = Math.sin(y * 14 + warp) * 0.5 + 0.5;
    const fine = Math.sin(y * 42 + x * 6) * 0.035;
    return [
      0.48 + band * 0.38 + fine,
      0.20 + band * 0.24 + fine,
      0.03 + band * 0.12 + fine,
    ];
  });
  const g1 = new THREE.Mesh(g1geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.55, emissive: 0x180800, emissiveIntensity: 0.30,
  }));
  const g1grp = new THREE.Group();
  g1grp.add(g1);
  g1grp.add(atmoShell(17.0, 0xDD8830, 0.10));
  g1grp.position.set(88, 12, -85);
  planetGroup.add(g1grp);

  // 2. Ice/ocean planet — blue gradient with white polar caps
  const g2geo = colorSphere(9, 36, (x, y, z) => {
    const pole = Math.pow(Math.abs(y), 3.5);
    const swirl = Math.sin(x * 7 + z * 5 + y * 2) * 0.05;
    const cloud = Math.max(0, Math.sin(x * 4 + z * 3) * Math.cos(y * 6)) * 0.12;
    return [
      0.15 + pole * 0.75 + cloud + swirl,
      0.40 + pole * 0.52 + cloud * 0.8 + swirl,
      0.72 + pole * 0.22 + cloud * 0.3 + swirl,
    ];
  });
  const g2 = new THREE.Mesh(g2geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.28, metalness: 0.10, emissive: 0x040810, emissiveIntensity: 0.40,
  }));
  const g2grp = new THREE.Group();
  g2grp.add(g2);
  g2grp.add(atmoShell(9.6, 0x5588DD, 0.13));
  g2grp.position.set(-96, -8, -42);
  planetGroup.add(g2grp);

  // 3. Rocky red planet — patchy terrain, craters, no atmosphere
  const g3geo = colorSphere(7, 28, (x, y, z) => {
    const terrain = (Math.sin(x * 5 + y * 3.5) * Math.cos(z * 6.5 + x * 2) + 1) * 0.5;
    const crater = Math.sin(x * 14 + z * 12) * Math.cos(y * 10) * 0.07;
    const dust = Math.pow(Math.max(0, Math.cos(y * 3.14)), 2) * 0.10;
    return [
      0.45 + terrain * 0.32 + crater + dust,
      0.12 + terrain * 0.14 + crater * 0.5,
      0.04 + terrain * 0.06 + crater * 0.3,
    ];
  });
  const g3 = new THREE.Mesh(g3geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, emissive: 0x0C0200, emissiveIntensity: 0.18,
  }));
  g3.position.set(70, 10, -160);
  planetGroup.add(g3);

  // 4. Ringed planet — golden/tan bands, multi-colored ring
  const g4geo = colorSphere(11, 36, (x, y, z) => {
    const warp = Math.sin(x * 2.5 + z * 1.5) * 0.4;
    const band = Math.sin(y * 10 + warp) * 0.5 + 0.5;
    const fine = Math.sin(y * 30) * 0.025;
    return [
      0.52 + band * 0.28 + fine,
      0.40 + band * 0.20 + fine,
      0.25 + band * 0.14 + fine,
    ];
  });
  const g4body = new THREE.Mesh(g4geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, emissive: 0x060404, emissiveIntensity: 0.28,
  }));

  // Ring — flat RingGeometry with radial color bands
  const ringGeo = new THREE.RingGeometry(15, 24, 80, 6);
  const rPos = ringGeo.attributes.position;
  const rCol = new Float32Array(rPos.count * 3);
  for (let i = 0; i < rPos.count; i++) {
    const rx = rPos.getX(i), ry = rPos.getY(i);
    const dist = Math.sqrt(rx * rx + ry * ry);
    const t = Math.max(0, Math.min(1, (dist - 15) / 9));
    const band = Math.sin(t * 22) * 0.5 + 0.5;
    const gap  = (t > 0.42 && t < 0.50) ? 0.4 : 1.0;   // dark Cassini-style gap
    rCol[i * 3]     = (0.55 + band * 0.30 + t * 0.08) * gap;
    rCol[i * 3 + 1] = (0.45 + band * 0.22 + t * 0.04) * gap;
    rCol[i * 3 + 2] = (0.28 + band * 0.12 - t * 0.06) * gap;
  }
  ringGeo.setAttribute("color", new THREE.BufferAttribute(rCol, 3));
  const g4ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.60, transparent: true, opacity: 0.58,
    side: THREE.DoubleSide, depthWrite: false,
  }));
  g4ring.rotation.x = -Math.PI * 0.5;

  const g4grp = new THREE.Group();
  g4grp.add(g4body);
  g4grp.add(g4ring);
  g4grp.add(atmoShell(11.8, 0xA09060, 0.08));
  g4grp.rotation.x = Math.PI * 0.18;
  g4grp.position.set(-78, 18, -128);
  planetGroup.add(g4grp);
}

function clearSpaceBackground() {
  if (starGroup)   { scene.remove(starGroup);   disposeTree(starGroup);   starGroup   = null; }
  if (planetGroup) { scene.remove(planetGroup); disposeTree(planetGroup); planetGroup = null; }
}

// ===== Forest background (Level 2) =====
function buildForestBackground() {
  forestGroup = new THREE.Group();
  scene.add(forestGroup);

  // Seeded LCG for deterministic placement
  let _s = 1337;
  function rng() { _s = (_s * 1664525 + 1013904223) & 0xFFFFFFFF; return (_s >>> 0) / 0xFFFFFFFF; }

  const floorY = -22;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A2E10, roughness: 0.95 });
  const greenPalette = [0x1A5C2A, 0x226B30, 0x1E6633, 0x2D7A38, 0x184D22, 0x20602C];

  function makeTree(x, z, s) {
    const g = new THREE.Group();
    const trunkH = (3.5 + rng() * 3.5) * s;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.52 * s, trunkH, 7), trunkMat);
    trunk.position.y = trunkH * 0.5;
    g.add(trunk);

    // 3 stacked foliage cones
    const tiers = [
      { r: 3.0 * s, h: 5.0 * s, dy: trunkH + 1.2 * s },
      { r: 2.2 * s, h: 4.2 * s, dy: trunkH + 4.0 * s },
      { r: 1.4 * s, h: 3.2 * s, dy: trunkH + 6.4 * s },
    ];
    for (const t of tiers) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(t.r, t.h, 7),
        new THREE.MeshStandardMaterial({ color: greenPalette[Math.floor(rng() * greenPalette.length)], roughness: 0.85 })
      );
      cone.position.y = t.dy;
      g.add(cone);
    }
    g.position.set(x, floorY, z);
    g.rotation.y = rng() * Math.PI * 2;
    forestGroup.add(g);
  }

  // Scatter trees — tall enough to tower above platforms (y=14–37),
  // avoiding cabin footprints and the central route corridor so visibility is clear.
  const cabinExclude = [{ x: -38, z: -48, r: 14 }, { x: 42, z: -112, r: 14 }];
  let treesPlaced = 0;
  for (let attempt = 0; attempt < 130 && treesPlaced < 58; attempt++) {
    const x = (rng() - 0.5) * 170;
    const z = rng() * -220 + 18;
    const s = 2.4 + rng() * 2.0;
    // Skip if overlapping a cabin
    if (cabinExclude.some(c => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
    // Skip if inside the route corridor — keeps the jumping path visible
    if (Math.abs(x) < 25 && z < -5 && z > -175) continue;
    makeTree(x, z, s);
    treesPlaced++;
  }

  function makeCabin(x, z, rotY) {
    const g    = new THREE.Group();
    const bw = 9, bh = 5, bd = 12;
    // Log body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bw, bh, bd),
      new THREE.MeshStandardMaterial({ color: 0x7B4A20, roughness: 0.95 })
    );
    g.add(body);
    // Roof (4-sided pyramid)
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(0, (bw + 1.5) * 0.64, 4.0, 4),
      new THREE.MeshStandardMaterial({ color: 0x3E2408, roughness: 0.95 })
    );
    roof.position.y = bh * 0.5 + 2.0;
    roof.rotation.y = Math.PI * 0.25;
    g.add(roof);
    // Chimney
    const chim = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 4.0, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x888070, roughness: 1.0 })
    );
    chim.position.set(2.5, bh * 0.5 + 4.2, 2.0);
    g.add(chim);
    // Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 3.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3A1E08, roughness: 0.9 })
    );
    door.position.set(0, -bh * 0.5 + 1.6, bd * 0.5 + 0.05);
    g.add(door);

    g.position.set(x, floorY + bh * 0.5, z);
    g.rotation.y = rotY;
    forestGroup.add(g);
  }

  makeCabin(-38, -48,  0.5);
  makeCabin( 42, -112, -0.3);

  // Grass ground plane
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x3A8C3A, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = floorY;
  forestGroup.add(ground);

  // Ground mist — two stacked semi-transparent planes
  const mistMat = new THREE.MeshBasicMaterial({ color: 0xDDEEFF, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  for (const dy of [1.5, 3.8]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mistMat);
    m.rotation.x = -Math.PI * 0.5;
    m.position.y = floorY + dy;
    forestGroup.add(m);
  }

  // Birds — V-shaped line meshes drifting across the sky
  function makeBird(x, y, z, speed, scale = 1.0) {
    const s     = 1.3 * scale;
    const verts = new Float32Array([-s, 0.5 * scale, 0,   0, 0, 0,   s, 0.5 * scale, 0]);
    const geo   = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.attributes.position.usage = THREE.DynamicDrawUsage;
    const mesh  = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x111122 }));
    mesh.position.set(x, y, z);
    forestGroup.add(mesh);
    birdData.push({ mesh, geo, speed, scale, flapPhase: rng() * Math.PI * 2, flapSpeed: 1.0 + rng() * 0.8 });
  }
  // High sky birds
  makeBird( 55,  23, -50,  2.4);
  makeBird(-35,  28, -108, 1.7);
  makeBird( 80,  20, -145, 2.1);
  // Mid-height — between platforms and canopy
  makeBird(-60,  11, -72,  1.9, 0.8);
  makeBird( 30,   8, -130, 2.6, 0.8);
  // Low — skimming tree tops / near platform level
  makeBird(-20,  -2, -55,  2.0, 0.65);
  makeBird( 65,  -5, -100, 1.6, 0.65);
  makeBird(-50,   1, -160, 2.3, 0.7);
}

function clearForestBackground() {
  if (forestGroup) { scene.remove(forestGroup); disposeTree(forestGroup); forestGroup = null; }
  birdData.length = 0;
}

function updateBirds(dt) {
  for (const b of birdData) {
    b.flapPhase += b.flapSpeed * dt;
    const flap = Math.sin(b.flapPhase) * 0.45 * b.scale;
    const pos  = b.geo.attributes.position;
    pos.setY(0, 0.5 * b.scale + flap);
    pos.setY(2, 0.5 * b.scale + flap);
    pos.needsUpdate = true;
    b.mesh.position.x -= b.speed * dt;
    if (b.mesh.position.x < -130) b.mesh.position.x = 130;
  }
}

// ===== Crystal Cave background (Level 4) =====
function buildCaveBackground() {
  caveGroup = new THREE.Group();
  scene.add(caveGroup);

  let _s = 7331;
  function rng() { _s = (_s * 1664525 + 1013904223) & 0xFFFFFFFF; return (_s >>> 0) / 0xFFFFFFFF; }

  const ceilY  =  22;
  const floorY = -18;

  // Floor
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 360),
    new THREE.MeshStandardMaterial({ color: 0x080810, roughness: 1.0 })
  );
  floorMesh.rotation.x = -Math.PI * 0.5;
  floorMesh.position.set(0, floorY, -112);
  caveGroup.add(floorMesh);

  // Ceiling
  const ceilMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 360),
    new THREE.MeshStandardMaterial({ color: 0x060608, roughness: 1.0 })
  );
  ceilMesh.rotation.x = Math.PI * 0.5;
  ceilMesh.position.set(0, ceilY, -112);
  caveGroup.add(ceilMesh);

  // Crystal formations rising from floor
  const crystalColors = [0x00CCDD, 0x8844FF, 0x00BBAA, 0x2266FF, 0xCC00FF, 0x00FF88, 0x4466FF, 0x00DDCC];
  function makeCrystalCluster(cx, cz, scale) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const col = crystalColors[Math.floor(rng() * crystalColors.length)];
      const h   = (3 + rng() * 9) * scale;
      const r   = (0.25 + rng() * 0.55) * scale;
      const c   = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.07, r, h, 5),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.82 })
      );
      c.position.set((rng() - 0.5) * 4 * scale, h * 0.5, (rng() - 0.5) * 4 * scale);
      c.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI * 2, (rng() - 0.5) * 0.35);
      g.add(c);
    }
    g.position.set(cx, floorY, cz);
    caveGroup.add(g);
  }
  for (let i = 0; i < 42; i++) makeCrystalCluster((rng() - 0.5) * 140, rng() * -248 + 15, 0.5 + rng() * 1.6);

  // Visual stalactites from ceiling
  for (let i = 0; i < 32; i++) {
    const col = crystalColors[Math.floor(rng() * crystalColors.length)];
    const len = 2 + rng() * 9;
    const rad = 0.2 + rng() * 0.85;
    const s = new THREE.Mesh(
      new THREE.CylinderGeometry(rad, rad * 0.06, len, 5),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.28, roughness: 0.2, transparent: true, opacity: 0.72 })
    );
    s.position.set((rng() - 0.5) * 120, ceilY - len * 0.5, rng() * -248 + 15);
    caveGroup.add(s);
  }

  // Coloured point lights — crystal glow
  const plCols = [0x00AAFF, 0x8800FF, 0x00FFAA, 0xFF00AA, 0x0088FF, 0xAA00FF, 0x00FFDD];
  [[-22,-8,-40],[25,-8,-85],[-18,-8,-130],[22,-8,-175],[-15,-8,-215]].forEach(([px,py,pz], i) => {
    const pl = new THREE.PointLight(plCols[i % plCols.length], 2.2, 55);
    pl.position.set(px, py, pz);
    caveGroup.add(pl);
  });

  // Dripping water drops (Points)
  const N = 72;
  const dropPos = new Float32Array(N * 3);
  caveDropData = [];
  for (let i = 0; i < N; i++) {
    const x = (rng() - 0.5) * 120;
    const z = rng() * -248 + 15;
    const startY = ceilY - 1 - rng() * 7;
    const y = floorY + rng() * (ceilY - floorY);
    caveDropData.push({ x, z, y, startY, speed: 2.5 + rng() * 2.5 });
    dropPos[i * 3] = x; dropPos[i * 3 + 1] = y; dropPos[i * 3 + 2] = z;
  }
  caveDropGeo = new THREE.BufferGeometry();
  caveDropGeo.setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  caveGroup.add(new THREE.Points(caveDropGeo, new THREE.PointsMaterial({
    color: 0x88CCFF, size: 0.15, transparent: true, opacity: 0.65, depthWrite: false,
  })));
}

function clearCaveBackground() {
  if (caveGroup) { scene.remove(caveGroup); disposeTree(caveGroup); caveGroup = null; }
  caveDropData = [];
  caveDropGeo  = null;
}

function updateCave(dt) {
  if (!caveDropGeo || !caveDropData.length) return;
  const pos = caveDropGeo.attributes.position.array;
  for (let i = 0; i < caveDropData.length; i++) {
    caveDropData[i].y -= caveDropData[i].speed * dt;
    if (caveDropData[i].y < -18) caveDropData[i].y = caveDropData[i].startY;
    pos[i * 3 + 1] = caveDropData[i].y;
  }
  caveDropGeo.attributes.position.needsUpdate = true;
}

// ===== Volcanic Lava background (Level 5) =====
function buildVolcanoBackground() {
  volcanoGroup = new THREE.Group();
  scene.add(volcanoGroup);

  let _s = 9137;
  function rng() { _s = (_s * 1664525 + 1013904223) & 0xFFFFFFFF; return (_s >>> 0) / 0xFFFFFFFF; }

  const lavaY = -15;

  // Lava sea base
  const lavaMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ color: 0x220500, emissive: 0xCC3300, emissiveIntensity: 0.85, roughness: 0.9 })
  );
  lavaMesh.rotation.x = -Math.PI * 0.5;
  lavaMesh.position.set(0, lavaY, -127);
  volcanoGroup.add(lavaMesh);

  // Animated glow layer just above lava surface
  lavaGlowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshBasicMaterial({ color: 0xFF5500, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
  );
  lavaGlowMesh.rotation.x = -Math.PI * 0.5;
  lavaGlowMesh.position.set(0, lavaY + 0.6, -127);
  volcanoGroup.add(lavaGlowMesh);

  // Warm point lights below platforms — orange glow from beneath
  const lCols = [0xFF5500, 0xFF3300, 0xFF8800, 0xFF4400, 0xFF6600, 0xFF2200];
  [[-20,-12,-40],[25,-12,-90],[-15,-12,-145],[22,-12,-195],[-18,-12,-245],[5,-12,-200]].forEach(([px,py,pz], i) => {
    const pl = new THREE.PointLight(lCols[i % lCols.length], 3.8, 75);
    pl.position.set(px, py, pz);
    volcanoGroup.add(pl);
  });

  // Volcanic rock spires rising from lava sea
  const spireColors = [0x2A0500, 0x1A0300, 0x3A1000, 0x200600, 0x280800];
  for (let i = 0; i < 44; i++) {
    const x = (rng() - 0.5) * 200;
    const z = rng() * -300 + 22;
    const h = 6 + rng() * 22;
    const r = 1.5 + rng() * 4.0;
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.05, r, h, 6),
      new THREE.MeshStandardMaterial({ color: spireColors[Math.floor(rng() * spireColors.length)], roughness: 1.0 })
    );
    spire.position.set(x, lavaY + h * 0.5, z);
    spire.rotation.y = rng() * Math.PI * 2;
    volcanoGroup.add(spire);
  }

  // Ember particles rising from the lava
  const N = 120;
  const ePos = new Float32Array(N * 3);
  emberData = [];
  for (let i = 0; i < N; i++) {
    const x = (rng() - 0.5) * 220;
    const z = rng() * -300 + 22;
    const y = lavaY + rng() * 38;
    ePos[i * 3] = x; ePos[i * 3 + 1] = y; ePos[i * 3 + 2] = z;
    emberData.push({ x, z, y, speed: 2.5 + rng() * 5.0, drift: (rng() - 0.5) * 1.0 });
  }
  emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
  volcanoGroup.add(new THREE.Points(emberGeo, new THREE.PointsMaterial({
    color: 0xFF6600, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false,
  })));
}

function clearVolcanoBackground() {
  if (volcanoGroup) { scene.remove(volcanoGroup); disposeTree(volcanoGroup); volcanoGroup = null; }
  lavaGlowMesh = null;
  emberData    = [];
  emberGeo     = null;
}

function clearCandyBackground() {
  if (candyGroup) { scene.remove(candyGroup); disposeTree(candyGroup); candyGroup = null; }
}

function clearParkBackground() {
  if (parkGroup) { scene.remove(parkGroup); disposeTree(parkGroup); parkGroup = null; }
}

function clearCityBackground() {
  if (cityGroup) { scene.remove(cityGroup); disposeTree(cityGroup); cityGroup = null; }
  if (rainMesh)  { scene.remove(rainMesh);  disposeTree(rainMesh);  rainMesh = null; rainPositions = null; }
  droneData = [];
  windActive = false; windForceX = 0; windTimer = 0; windGustDur = 0; nextGust = 5.0;
  carData = [];
}

function clearIceBackground() {
  if (iceGroup)  { scene.remove(iceGroup);  disposeTree(iceGroup);  iceGroup  = null; }
  if (snowMesh)  { scene.remove(snowMesh);  disposeTree(snowMesh);  snowMesh  = null; snowPositions = null; snowData = []; }
  auroraMats     = [];
  iceBgCloudMat  = null;
  iceBgCloudMat2 = null;
  iceBgCloudMat3 = null;
  iceFogLayers   = [];
}

function clearStormBackground() {
  if (stormGroup)      { scene.remove(stormGroup);      disposeTree(stormGroup);      stormGroup      = null; }
  if (stormRainMesh)   { scene.remove(stormRainMesh);   disposeTree(stormRainMesh);   stormRainMesh   = null; stormRainData = []; }
  if (stormWindStreaks) { scene.remove(stormWindStreaks); disposeTree(stormWindStreaks); stormWindStreaks = null; stormWindData = []; }
  if (stormFlashLight) { scene.remove(stormFlashLight);  stormFlashLight = null; }
  for (const lb of stormLightning) {
    scene.remove(lb.mesh);
    lb.mesh.geometry.dispose();
    lb.mesh.material.dispose();
  }
  stormLightning  = [];
  stormFlashTimer = 0;
  stormBoltTimer  = 3.0;
  stormPhasePlats = [];
  stormElecPlats  = [];
  stormCloudPlanes   = [];
  stormFogLayers     = [];
  stormCeilingLayers = [];
  stormWallClouds    = [];
  stormBaseBackground = null;
  stormDistantClouds = [];
  stormHazePlanes    = [];
  stormDebrisData    = [];
  for (const w of stormWindWisps) { scene.remove(w.mesh); w.mat.dispose(); }
  stormWindWisps = [];
  if (stormWispGeo) { stormWispGeo.dispose(); stormWispGeo = null; }
  if (stormWispTexture) { stormWispTexture.dispose(); stormWispTexture = null; }
  for (const sp of stormSparkPool) { scene.remove(sp.mesh); sp.mat.dispose(); }
  stormSparkPool = [];
  if (stormSparkGeo) { stormSparkGeo.dispose(); stormSparkGeo = null; }
  stormRainIntensity = 0; stormRainCycleTimer = 0; stormRainPhase = "normal";
  windActive = false; windForceX = 0; windTimer = 0; windGustDur = 0; nextGust = 5.0;
}

function buildStormBackground() {
  stormGroup = new THREE.Group();
  scene.add(stormGroup);

  // ── Rolling storm cloud helper (storm-palette version of Level 8's makeRollingCloud) ──
  function makeStormCloud(cfg) {
    const { blobCount, blobMaxR, baseColor, blobColor, colorHex, opacity,
            yPos, zOffset, size, segs, waveAmp, seed, repeatS } = cfg;
    let _cs = seed;
    function cr() { _cs = (_cs * 16807) % 2147483647; return (_cs - 1) / 2147483646; }

    const cc = document.createElement("canvas"); cc.width = 512; cc.height = 512;
    const cctx = cc.getContext("2d");
    // Dark base fill
    const br = (baseColor >> 16) & 0xff, bg = (baseColor >> 8) & 0xff, bb = baseColor & 0xff;
    cctx.fillStyle = `rgba(${br},${bg},${bb},0.3)`;
    cctx.fillRect(0, 0, 512, 512);
    // Storm cloud blobs
    for (let i = 0; i < blobCount; i++) {
      const bx = cr() * 512, by = cr() * 512;
      const blobR = (blobMaxR * 0.35) + cr() * (blobMaxR * 0.65);
      const grad = cctx.createRadialGradient(bx, by, 0, bx, by, blobR);
      const cr2 = (blobColor >> 16) & 0xff, cg2 = (blobColor >> 8) & 0xff, cb2 = blobColor & 0xff;
      grad.addColorStop(0,   `rgba(${cr2},${cg2},${cb2},0.55)`);
      grad.addColorStop(0.4, `rgba(${cr2},${cg2},${cb2},0.25)`);
      grad.addColorStop(1,   `rgba(${cr2},${cg2},${cb2},0)`);
      cctx.fillStyle = grad;
      cctx.fillRect(bx - blobR, by - blobR, blobR * 2, blobR * 2);
    }
    const tex = new THREE.CanvasTexture(cc);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatS, repeatS);

    const mat = new THREE.MeshBasicMaterial({
      map: tex, color: colorHex, transparent: true, opacity,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });

    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), ly = pos.getY(i);
      const d = Math.sin(lx * 0.014 + seed * 2.7) * Math.cos(ly * 0.011 + seed * 1.3) * waveAmp
              + Math.sin(lx * 0.027 + ly * 0.019 + seed * 4.1) * waveAmp * 0.35
              + (cr() - 0.5) * waveAmp * 0.12;
      pos.setZ(i, d);
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, yPos, zOffset);
    mesh.renderOrder = 1;
    stormGroup.add(mesh);
    return { mesh, mat };
  }

  // ── Rolling storm cloud layers — surround the player at visible heights ──
  // Platforms at y=0-7, camera at ~y=6-13. Clouds at y=8-32 are visible.
  const sc1 = makeStormCloud({ blobCount: 50, blobMaxR: 140, baseColor: 0x111c2f, blobColor: 0x1b2b47,
    colorHex: 0x111c2f, opacity: 0.35, yPos: 12, zOffset: -85, size: 800, segs: 36, waveAmp: 3.0, seed: 8317, repeatS: 3 });
  const sc2 = makeStormCloud({ blobCount: 60, blobMaxR: 120, baseColor: 0x0e1828, blobColor: 0x1a2840,
    colorHex: 0x0e1828, opacity: 0.30, yPos: 18, zOffset: -85, size: 900, segs: 32, waveAmp: 2.5, seed: 4421, repeatS: 4 });
  const sc3 = makeStormCloud({ blobCount: 45, blobMaxR: 150, baseColor: 0x152538, blobColor: 0x1f3350,
    colorHex: 0x152538, opacity: 0.22, yPos: 25, zOffset: -85, size: 1000, segs: 28, waveAmp: 2.0, seed: 6103, repeatS: 5 });
  const sc4 = makeStormCloud({ blobCount: 55, blobMaxR: 130, baseColor: 0x0d1a2e, blobColor: 0x162840,
    colorHex: 0x0d1a2e, opacity: 0.28, yPos: 8, zOffset: -85, size: 850, segs: 30, waveAmp: 3.5, seed: 7209, repeatS: 3 });
  const sc5 = makeStormCloud({ blobCount: 35, blobMaxR: 160, baseColor: 0x0a1322, blobColor: 0x14243a,
    colorHex: 0x0a1322, opacity: 0.15, yPos: 32, zOffset: -85, size: 1100, segs: 24, waveAmp: 1.5, seed: 5517, repeatS: 6 });

  stormCloudPlanes = [
    { ...sc1, baseX: 0, baseZ: -85, oscSpeed: 0.12, uvSpeed: 0.004 },
    { ...sc2, baseX: 0, baseZ: -85, oscSpeed: 0.08, uvSpeed: 0.003 },
    { ...sc3, baseX: 0, baseZ: -85, oscSpeed: 0.05, uvSpeed: 0.002 },
    { ...sc4, baseX: 0, baseZ: -85, oscSpeed: 0.10, uvSpeed: 0.0035 },
    { ...sc5, baseX: 0, baseZ: -85, oscSpeed: 0.035, uvSpeed: 0.0015 },
  ];

  // ── Overhead cloud ceiling — dense, dark, oppressive ──
  const ceil1 = makeStormCloud({ blobCount: 70, blobMaxR: 120, baseColor: 0x0a1020, blobColor: 0x152030,
    colorHex: 0x0a1020, opacity: 0.50, yPos: 35, zOffset: -85, size: 600, segs: 32, waveAmp: 1.5, seed: 9901, repeatS: 3 });
  const ceil2 = makeStormCloud({ blobCount: 80, blobMaxR: 100, baseColor: 0x080e1a, blobColor: 0x101e30,
    colorHex: 0x080e1a, opacity: 0.40, yPos: 42, zOffset: -85, size: 700, segs: 28, waveAmp: 1.0, seed: 1133, repeatS: 4 });

  stormCeilingLayers = [
    { ...ceil1, baseX: 0, baseZ: -85, oscSpeed: 0.04, uvSpeed: 0.002 },
    { ...ceil2, baseX: 0, baseZ: -85, oscSpeed: 0.025, uvSpeed: 0.0012 },
  ];

  // ── Storm cloud masses — individual dark cloud bodies below platforms ──
  // Instead of flat fog sheets, scatter many individual cloud mass meshes
  // at varied positions/heights/tilts for an organic storm sky below.
  // NO flat planes, NO visible horizon line, NO fog.
  const stormCloudPalette = [0x0d1b2f, 0x162943, 0x2b4a70, 0x3a5f90];

  function makeCloudMass(cfg) {
    const { x, y, z, w, h, opacity, tiltX, tiltZ, seed, blobCount } = cfg;
    let _s = seed;
    function rng() { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; }

    const cSize = 256;
    const cv = document.createElement("canvas"); cv.width = cSize; cv.height = cSize;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cSize, cSize); // transparent background

    // Draw cloud body — concentrated blobs creating a soft cloud shape
    for (let i = 0; i < blobCount; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * rng() * cSize * 0.3; // quadratic = more centered
      const bx = cSize / 2 + Math.cos(angle) * dist;
      const by = cSize / 2 + Math.sin(angle) * dist * 0.6; // flattened vertically
      const blobR = cSize * (0.12 + rng() * 0.22);

      // Pick from palette — bias toward brighter tones for visibility
      const pIdx = Math.min(3, Math.floor(rng() * 3 + 0.5));
      const pc = stormCloudPalette[pIdx];
      const pr = (pc >> 16) & 0xff, pg = (pc >> 8) & 0xff, pb = pc & 0xff;
      const alpha = 0.55 + rng() * 0.40;

      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, blobR);
      grad.addColorStop(0,    `rgba(${pr},${pg},${pb},${alpha.toFixed(2)})`);
      grad.addColorStop(0.35, `rgba(${pr},${pg},${pb},${(alpha * 0.6).toFixed(2)})`);
      grad.addColorStop(0.65, `rgba(${pr},${pg},${pb},${(alpha * 0.2).toFixed(2)})`);
      grad.addColorStop(1,    `rgba(${pr},${pg},${pb},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cSize, cSize);
    }

    const tex = new THREE.CanvasTexture(cv);
    // color: 0xffffff — NO multiplication, palette colors show at full brightness
    const mat = new THREE.MeshBasicMaterial({
      map: tex, color: 0xffffff, transparent: true, opacity,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const geo = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2 + tiltX;
    mesh.rotation.z = tiltZ;
    mesh.position.set(x, y, z);
    mesh.renderOrder = 1;
    stormGroup.add(mesh);
    return { mesh, mat };
  }

  // Seeded PRNG for deterministic cloud placement
  let _cloudRng = 50001;
  function cloudRng() { _cloudRng = (_cloudRng * 16807) % 2147483647; return (_cloudRng - 1) / 2147483646; }

  stormFogLayers = [];
  let cloudSeed = 60000;

  // Tier 1: Near clouds — just below platforms, smaller, denser, higher opacity
  for (let i = 0; i < 14; i++) {
    cloudSeed += 137;
    const x = (cloudRng() - 0.5) * 180;
    const y = -3 - cloudRng() * 5;
    const z = -10 - cloudRng() * 170;
    const w = 40 + cloudRng() * 60;
    const h = 30 + cloudRng() * 50;
    const layer = makeCloudMass({
      x, y, z, w, h,
      opacity: 0.65 + cloudRng() * 0.25,
      tiltX: (cloudRng() - 0.5) * 0.2,
      tiltZ: (cloudRng() - 0.5) * 0.25,
      seed: cloudSeed,
      blobCount: 14 + Math.floor(cloudRng() * 8)
    });
    stormFogLayers.push({
      ...layer, baseX: x, baseY: y, baseZ: z,
      oscSpeedX: 0.03 + cloudRng() * 0.04,
      oscSpeedZ: 0.02 + cloudRng() * 0.03,
      oscAmpX: 1.5 + cloudRng() * 2.5,
      oscAmpZ: 1.0 + cloudRng() * 2.0,
      windMult: 0.15 + cloudRng() * 0.15,
      phase: cloudRng() * Math.PI * 2,
    });
  }

  // Tier 2: Mid clouds — larger, more spread out, medium opacity
  for (let i = 0; i < 12; i++) {
    cloudSeed += 251;
    const x = (cloudRng() - 0.5) * 200;
    const y = -10 - cloudRng() * 8;
    const z = -10 - cloudRng() * 170;
    const w = 80 + cloudRng() * 80;
    const h = 60 + cloudRng() * 60;
    const layer = makeCloudMass({
      x, y, z, w, h,
      opacity: 0.50 + cloudRng() * 0.20,
      tiltX: (cloudRng() - 0.5) * 0.15,
      tiltZ: (cloudRng() - 0.5) * 0.2,
      seed: cloudSeed,
      blobCount: 16 + Math.floor(cloudRng() * 8)
    });
    stormFogLayers.push({
      ...layer, baseX: x, baseY: y, baseZ: z,
      oscSpeedX: 0.02 + cloudRng() * 0.03,
      oscSpeedZ: 0.015 + cloudRng() * 0.025,
      oscAmpX: 2.0 + cloudRng() * 3.0,
      oscAmpZ: 1.5 + cloudRng() * 2.5,
      windMult: 0.20 + cloudRng() * 0.15,
      phase: cloudRng() * Math.PI * 2,
    });
  }

  // Tier 3: Deep clouds — largest, faintest, slowest for depth
  for (let i = 0; i < 10; i++) {
    cloudSeed += 373;
    const x = (cloudRng() - 0.5) * 240;
    const y = -20 - cloudRng() * 12;
    const z = -20 - cloudRng() * 170;
    const w = 120 + cloudRng() * 130;
    const h = 90 + cloudRng() * 100;
    const layer = makeCloudMass({
      x, y, z, w, h,
      opacity: 0.35 + cloudRng() * 0.15,
      tiltX: (cloudRng() - 0.5) * 0.12,
      tiltZ: (cloudRng() - 0.5) * 0.15,
      seed: cloudSeed,
      blobCount: 18 + Math.floor(cloudRng() * 10)
    });
    stormFogLayers.push({
      ...layer, baseX: x, baseY: y, baseZ: z,
      oscSpeedX: 0.01 + cloudRng() * 0.02,
      oscSpeedZ: 0.008 + cloudRng() * 0.015,
      oscAmpX: 3.0 + cloudRng() * 4.0,
      oscAmpZ: 2.0 + cloudRng() * 3.0,
      windMult: 0.10 + cloudRng() * 0.10,
      phase: cloudRng() * Math.PI * 2,
    });
  }

  // ── Heavy rain system (InstancedMesh) — 800 drops ──
  {
    const rainGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.0, 3, 1);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xbbccee, transparent: true, opacity: 0.65, depthWrite: false, fog: false
    });
    stormRainMesh = new THREE.InstancedMesh(rainGeo, rainMat, STORM_RAIN_COUNT);
    stormRainMesh.frustumCulled = false;
    scene.add(stormRainMesh);
    stormRainData = [];
    for (let i = 0; i < STORM_RAIN_COUNT; i++) {
      stormRainData.push({
        x: (Math.random() - 0.5) * 140,
        y: Math.random() * 50 - 10,
        z: -Math.random() * 200,
        speed: 30 + Math.random() * 20,
        drift: (Math.random() - 0.5) * 3.0,
        phase: Math.random() * Math.PI * 2,
      });
      stormRainDummy.position.set(stormRainData[i].x, stormRainData[i].y, stormRainData[i].z);
      stormRainDummy.updateMatrix();
      stormRainMesh.setMatrixAt(i, stormRainDummy.matrix);
    }
    stormRainMesh.instanceMatrix.needsUpdate = true;
  }

  // ── Wind streaks (BufferGeometry lines) — 100 longer, brighter ──
  {
    const positions = new Float32Array(STORM_WIND_COUNT * 6);
    stormWindData = [];
    for (let i = 0; i < STORM_WIND_COUNT; i++) {
      const x = (Math.random() - 0.5) * 160;
      const y = Math.random() * 35 - 5;
      const z = -Math.random() * 180;
      const len = 2.0 + Math.random() * 3.0;
      positions[i * 6]     = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x + len;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z;
      stormWindData.push({ x, y, z, len, speed: 18 + Math.random() * 14 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    stormWindStreaks = new THREE.LineSegments(geo,
      new THREE.LineBasicMaterial({ color: 0x88aacc, transparent: true, opacity: 0.55, depthWrite: false, fog: false })
    );
    scene.add(stormWindStreaks);
  }

  // ── Wind wisp particles (visible during gusts) ──
  {
    const wc = document.createElement("canvas"); wc.width = 128; wc.height = 32;
    const wctx = wc.getContext("2d");
    const wGrad = wctx.createLinearGradient(0, 16, 128, 16);
    wGrad.addColorStop(0,   "rgba(136,170,204,0)");
    wGrad.addColorStop(0.15,"rgba(160,190,215,0.35)");
    wGrad.addColorStop(0.5, "rgba(180,200,220,0.55)");
    wGrad.addColorStop(0.85,"rgba(160,190,215,0.35)");
    wGrad.addColorStop(1,   "rgba(136,170,204,0)");
    wctx.fillStyle = wGrad;
    wctx.fillRect(0, 0, 128, 32);
    stormWispTexture = new THREE.CanvasTexture(wc);
    stormWispGeo = new THREE.PlaneGeometry(4.0, 0.3);
    stormWindWisps = [];
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: stormWispTexture, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      });
      const mesh = new THREE.Mesh(stormWispGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      stormWindWisps.push({
        mesh, mat, x: 0, y: 0, z: 0,
        speed: 25 + Math.random() * 20,
        life: 0, maxLife: 1.5 + Math.random() * 1.5,
        active: false, scale: 0.7 + Math.random() * 0.8
      });
    }
  }

  // ── Electric spark particle pool ──
  {
    stormSparkGeo = new THREE.SphereGeometry(0.06, 4, 3);
    stormSparkPool = [];
    for (let i = 0; i < STORM_SPARK_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xddf0ff, transparent: true, opacity: 0, depthWrite: false
      });
      const mesh = new THREE.Mesh(stormSparkGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      stormSparkPool.push({ mesh, mat, life: 0, maxLife: 0.3, vx: 0, vy: 0, vz: 0, active: false });
    }
  }

  // ── Storm flash light (reusable, starts at 0 intensity) ──
  stormFlashLight = new THREE.DirectionalLight(0x9fd8ff, 0);
  stormFlashLight.position.set(0, 60, -40);
  scene.add(stormFlashLight);

  // ── Enhanced storm debris — wind-responsive, varied sizes ──
  stormDebrisData = [];
  for (let i = 0; i < 18; i++) {
    const isFlying = i < 3;
    const sizeMult = isFlying ? 0.4 + Math.random() * 0.4 : 0.5 + Math.random() * 1.5;
    const dw = (0.5 + Math.random() * 0.8) * sizeMult;
    const dh = (0.2 + Math.random() * 0.3) * sizeMult;
    const dd = (0.5 + Math.random() * 0.7) * sizeMult;
    const debris = new THREE.Mesh(
      new THREE.BoxGeometry(dw, dh, dd),
      new THREE.MeshStandardMaterial({
        color: 0x2a3a50, emissive: 0x334466, emissiveIntensity: 0.5,
        roughness: 0.7, metalness: 0.3
      })
    );
    const baseY = isFlying ? (5 + Math.random() * 15) : (-8 + Math.random() * 5);
    debris.position.set((Math.random() - 0.5) * 120, baseY, -20 - Math.random() * 150);
    debris.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    stormGroup.add(debris);
    stormDebrisData.push({
      mesh: debris, baseY,
      spinSpeed: 0.3 + Math.random() * 0.7,
      driftSpeed: isFlying ? (15 + Math.random() * 10) : (0.5 + Math.random() * 1.0),
      isFlying, phase: Math.random() * Math.PI * 2
    });
  }

  // ── Distant storm wall masses — fill the periphery ──
  function addStormWall(xPos, zPos, yPos, rotY, width, height, opacity, seed) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
    const ctx = cv.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0,   "rgba(17,28,47,0.0)");
    grad.addColorStop(0.2, "rgba(17,28,47," + (opacity * 0.8) + ")");
    grad.addColorStop(0.5, "rgba(14,24,40," + opacity + ")");
    grad.addColorStop(0.8, "rgba(17,28,47," + (opacity * 0.8) + ")");
    grad.addColorStop(1,   "rgba(10,19,34,0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    let _s = seed;
    function sr() { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; }
    for (let i = 0; i < 50; i++) {
      const cx = sr() * 512, cy = sr() * 256;
      const r = 30 + sr() * 80;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, "rgba(27,43,71," + (0.3 + sr() * 0.25) + ")");
      rg.addColorStop(1, "rgba(17,28,47,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    plane.position.set(xPos, yPos, zPos);
    plane.rotation.y = rotY;
    stormGroup.add(plane);
    stormWallClouds.push({ mesh: plane, mat, uvSpeed: 0.001 + sr() * 0.001 });
  }
  addStormWall(-80, -85, 15, Math.PI * 0.15, 300, 70, 0.55, 1117);
  addStormWall( 80, -85, 15, -Math.PI * 0.15, 300, 70, 0.55, 2233);
  addStormWall(  0, -250, 15, 0, 350, 80, 0.45, 3349);
  addStormWall(  0,  40, 15, Math.PI, 300, 60, 0.40, 4461);

  // ── Distant storm silhouettes — extreme depth beyond walls ──
  {
    const distCfgs = [
      { x: -150, z: -420, y: 20, rotY:  0.15, w: 650, h: 140, op: 0.14, seed: 11001, flash: true  },
      { x:  130, z: -480, y: 25, rotY: -0.10, w: 750, h: 120, op: 0.12, seed: 12002, flash: true  },
      { x:    0, z: -500, y: 18, rotY:  0,    w: 800, h: 150, op: 0.16, seed: 13003, flash: true  },
      { x:  -80, z: -350, y: 30, rotY:  0.08, w: 550, h: 110, op: 0.18, seed: 14004, flash: false },
    ];
    for (const cfg of distCfgs) {
      const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
      const ctx = cv.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0,   "rgba(8,14,24,0.0)");
      grad.addColorStop(0.15,"rgba(10,18,30,0.6)");
      grad.addColorStop(0.5, "rgba(12,20,35,0.8)");
      grad.addColorStop(0.85,"rgba(10,18,30,0.6)");
      grad.addColorStop(1,   "rgba(8,14,24,0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);
      let _s = cfg.seed;
      const dr = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };
      for (let i = 0; i < 35; i++) {
        const cx = dr() * 512, cy = dr() * 256, r = 40 + dr() * 100;
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, `rgba(18,30,50,${(0.3 + dr() * 0.2).toFixed(2)})`);
        rg.addColorStop(1, "rgba(10,18,30,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 1);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: cfg.op,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), mat);
      plane.position.set(cfg.x, cfg.y, cfg.z);
      plane.rotation.y = cfg.rotY;
      stormGroup.add(plane);
      stormDistantClouds.push({
        mesh: plane, mat, baseOpacity: cfg.op,
        hasFlash: cfg.flash, flashDur: 0,
        nextFlash: 5 + Math.random() * 10
      });
    }
  }

  // ── Store base state for lightning flash lerp ──
  stormBaseBackground = scene.background.clone();
  for (const cp of stormCloudPlanes)   cp.mat._baseOpacity = cp.mat.opacity;
  for (const cl of stormCeilingLayers) cl.mat._baseOpacity = cl.mat.opacity;
  for (const fl of stormFogLayers)     fl.mat._baseOpacity = fl.mat.opacity;
}

function updateVolcano(dt) {
  // Pulse glow layer
  if (lavaGlowMesh) {
    lavaGlowMesh.material.opacity = 0.12 + Math.sin(time * 1.6) * 0.07;
  }
  // Rise embers, reset when too high
  if (!emberGeo || !emberData.length) return;
  const pos = emberGeo.attributes.position.array;
  for (let i = 0; i < emberData.length; i++) {
    emberData[i].y += emberData[i].speed * dt;
    emberData[i].x += emberData[i].drift * dt;
    if (emberData[i].y > -15 + 40) {
      emberData[i].y = -15;
      emberData[i].x = (Math.random() - 0.5) * 220;
    }
    pos[i * 3]     = emberData[i].x;
    pos[i * 3 + 1] = emberData[i].y;
  }
  emberGeo.attributes.position.needsUpdate = true;
}

// ===== City updater (Level 7) =====
function updateCity(dt, countdown) {
  // Animate rain streaks — fall down, wrap back to top
  if (rainPositions && rainMesh) {
    const fallSpeed = 28;
    const RAIN_COUNT = rainPositions.length / 6;
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPositions[i * 6 + 1] -= fallSpeed * dt;
      rainPositions[i * 6 + 4] -= fallSpeed * dt;
      if (rainPositions[i * 6 + 1] < -20) {
        const topY = 50 + Math.random() * 10;
        rainPositions[i * 6 + 1] = topY;
        rainPositions[i * 6 + 4] = topY - 1.2 - Math.random() * 0.8;
      }
    }
    rainMesh.geometry.attributes.position.needsUpdate = true;
  }

  // Bob drones
  for (let i = 0; i < droneData.length; i++) {
    const d = droneData[i];
    d.group.position.y = d.baseY + Math.sin(time * d.bobSpeed + d.phase) * d.bobAmp;
    d.group.rotation.y += dt * 0.6;
  }

  // Drive cars
  for (let i = 0; i < carData.length; i++) {
    const c = carData[i];
    c.group.position.z += c.dir * c.speed * dt;
    if (c.dir < 0 && c.group.position.z < c.wrapMin) c.group.position.z = c.wrapMax;
    if (c.dir > 0 && c.group.position.z > c.wrapMax) c.group.position.z = c.wrapMin;
  }

  // Wind gust timer — frozen during countdown
  if (!countdown) {
    windTimer -= dt;
    if (!windActive) {
      if (windTimer <= 0) {
        // Start a new gust
        windActive  = true;
        windForceX  = (Math.random() < 0.5 ? 1 : -1) * (4.0 + Math.random() * 3.0);
        windGustDur = 1.8 + Math.random() * 1.4;
        windTimer   = windGustDur;
      }
    } else {
      if (windTimer <= 0) {
        // Gust ends, pause before next
        windActive = false;
        windForceX = 0;
        windTimer  = nextGust + Math.random() * 3.0;
      }
    }
  }
}

// ===== Lava geysers (Level 5) =====
function spawnGeyser(x, z, period, phaseOffset) {
  const lavaY = -15;
  const colH  = 44;
  const botR  = 1.1;
  const topR  = 0.45;

  // Base glow disc — always visible, pulses during warning
  const baseMesh = new THREE.Mesh(
    new THREE.CircleGeometry(botR * 2.4, 10),
    new THREE.MeshBasicMaterial({ color: 0xFF5500, transparent: true, opacity: 0.3, depthWrite: false })
  );
  baseMesh.rotation.x = -Math.PI * 0.5;
  baseMesh.position.set(x, lavaY + 0.1, z);
  scene.add(baseMesh);

  // Rising lava column — tapered upward, starts invisible
  const colMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(topR, botR, colH, 8),
    new THREE.MeshStandardMaterial({
      color: 0xFF4400, emissive: 0xFF2200, emissiveIntensity: 1.0,
      transparent: true, opacity: 0.0, roughness: 0.9,
    })
  );
  colMesh.position.set(x, lavaY + colH * 0.5, z);
  scene.add(colMesh);

  // Orange point light riding the column base
  const light = new THREE.PointLight(0xFF6600, 0, 30);
  light.position.set(x, lavaY + 6, z);
  scene.add(light);

  geysers.push({
    x, z, period, phaseOffset,
    baseMesh, colMesh, light,
    colR: botR + 0.7,   // collision radius
    active: false,
  });
}

function clearGeysers() {
  for (const g of geysers) {
    scene.remove(g.baseMesh); g.baseMesh.geometry.dispose(); g.baseMesh.material.dispose();
    scene.remove(g.colMesh);  g.colMesh.geometry.dispose();  g.colMesh.material.dispose();
    scene.remove(g.light);
  }
  geysers.length = 0;
}

function updateGeysers() {
  const warmup = 1.1;   // warning phase (base pulses)
  const burstD = 1.8;   // column up + lethal

  for (const g of geysers) {
    const t = (time + g.phaseOffset) % g.period;

    if (t < warmup) {
      // Warning: base flickers brighter, faint column pre-glow
      g.active = false;
      const wt = t / warmup;
      g.baseMesh.material.opacity = 0.35 + Math.sin(wt * Math.PI * 5) * 0.28;
      g.colMesh.material.opacity  = wt * 0.12;
      g.light.intensity           = wt * 2.0;
    } else if (t < warmup + burstD) {
      // Burst: column shoots up, lethal to player
      g.active = true;
      const bt = (t - warmup) / burstD;
      const op = bt < 0.18 ? bt / 0.18 : bt > 0.78 ? (1.0 - bt) / 0.22 : 1.0;
      g.colMesh.material.opacity  = op * 0.90;
      g.baseMesh.material.opacity = 0.85;
      g.light.intensity           = op * 5.5;
    } else {
      // Dormant
      g.active = false;
      g.colMesh.material.opacity  = 0.0;
      g.baseMesh.material.opacity = 0.20;
      g.light.intensity           = 0;
    }
  }
}

// ===== Level definitions =====
function disposeTree(obj) {
  obj.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (m.map)         m.map.dispose();
        if (m.emissiveMap) m.emissiveMap.dispose();
        m.dispose();
      }
    }
  });
}

function clearLevel() {
  clearGeysers();
  clearIceBackground();
  for (const p of solids)      { scene.remove(p.mesh);  disposeTree(p.mesh);  }
  for (const m of movers)      { scene.remove(m.mesh);  disposeTree(m.mesh);  }
  for (const r of ramps)       { scene.remove(r.mesh);  disposeTree(r.mesh);  }
  for (const p of pendulums)   { scene.remove(p.group); disposeTree(p.group); }
  for (const d of decorations) { scene.remove(d);       disposeTree(d);       }
  solids.length = 0; movers.length = 0; ramps.length = 0; pendulums.length = 0; decorations.length = 0;
  if (ring)  { scene.remove(ring);  disposeTree(ring); ring  = null; }
  if (burst) { scene.remove(burst.mesh); burst.geo.dispose(); burst.mat.dispose(); burst = null; }
}

// ===== Saw blade pendulum (Level 2) =====
function sawBladePendulum({ x, y, z, armLength = 4.5, bladeRadius = 2.0, speed = 1.5, amplitude = 1.05, color = 0xFF3333, spinSpeed = 4.5 }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  // Anchor bolt
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.8 })
  ));

  // Arm
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, armLength, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.55, metalness: 0.7 })
  );
  arm.position.y = -armLength / 2;
  group.add(arm);

  // Blade group — sits at tip of arm, spins on its own Z each frame
  const bladeGroup = new THREE.Group();
  bladeGroup.position.y = -armLength;
  group.add(bladeGroup);

  const r = bladeRadius;
  const metalMat  = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, roughness: 0.15, metalness: 0.96 });
  const bodyMat   = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.28, metalness: 0.92 });
  const toothMat  = new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.85 });

  // Outer torus ring (naturally in XY plane — faces Z, player sees the full circle)
  bladeGroup.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.13, 6, 40), metalMat));

  // Disc body (CylinderGeometry axis = Y; rotate X PI/2 to face Z)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.74, r * 0.74, 0.17, 36), bodyMat);
  disc.rotation.x = Math.PI / 2;
  bladeGroup.add(disc);

  // Center hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.32, 10), metalMat);
  hub.rotation.x = Math.PI / 2;
  bladeGroup.add(hub);

  // Spokes (3)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.11, r * 0.68, 0.11), bodyMat);
    spoke.position.set(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, 0);
    spoke.rotation.z = a - Math.PI / 2;
    bladeGroup.add(spoke);
  }

  // Teeth (triangular, colored for danger)
  const numTeeth = 18;
  for (let i = 0; i < numTeeth; i++) {
    const a = (i / numTeeth) * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.50, 3), toothMat);
    tooth.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    tooth.rotation.z = a - Math.PI / 2;
    bladeGroup.add(tooth);
  }

  const colSize = r * 2;
  pendulums.push({
    group, block: bladeGroup,
    boxW: colSize, boxH: colSize, boxD: 0.5,
    speed, amplitude, worldPos: new THREE.Vector3(),
    saw: true, blade: bladeGroup, spinSpeed,
  });
}

// ===== Bounce pad =====
function bouncePad({ x, y, z, w = 4, d = 4, bounceSpeed = 20 }) {
  const h     = 0.6;
  const color = 0x00FF88;

  // Collision box — top at y + 0.3, matches visual launch surface
  const col = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  col.position.set(x, y, z);
  scene.add(col);
  solids.push({ mesh: col, w, h, d, type: "bounce", bounceSpeed });

  // Parent grp to col so clearLevel()'s scene.remove(p.mesh) cleans up the visual too
  const grp = new THREE.Group();
  col.add(grp);

  // === Mushroom visual (bioluminescent cave theme) ===
  const capR     = Math.min(w, d) * 0.50;   // cap radius matches platform half-width
  const capColor = 0x55FFAA;                 // bioluminescent green — stands out vs cave blues
  const stemCol  = 0xDDCCAA;                 // earthy cream stem
  const spotCol  = 0xFFFFBB;                 // pale yellow-white spots
  const glowCol  = 0x33FF99;                 // green underglow

  const capMat  = new THREE.MeshStandardMaterial({ color: capColor, emissive: capColor, emissiveIntensity: 0.60, roughness: 0.55, metalness: 0.0 });
  const stemMat = new THREE.MeshStandardMaterial({ color: stemCol,  emissive: stemCol,  emissiveIntensity: 0.15, roughness: 0.80, metalness: 0.0 });
  const spotMat = new THREE.MeshStandardMaterial({ color: spotCol,  emissive: spotCol,  emissiveIntensity: 0.80, roughness: 0.30 });

  // Stem — tapered trunk, top meets dome equator at y+0.10, bottom hangs to y−1.70
  const stemH = 1.80;
  const stem  = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.72, stemH, 12),
    stemMat
  );
  stem.position.y = 0.10 - stemH * 0.5;   // center = −0.35
  grp.add(stem);

  // Cap dome — upper hemisphere, equator at y+0.10 (stem top), apex at y+0.10+capR*0.55
  // SphereGeometry(r, wSegs, hSegs, phiStart, phiLen, thetaStart, thetaLen)
  // thetaStart=0, thetaLen=PI/2 gives the top hemisphere
  const domeR  = capR;
  const domeScaleY = 0.55;   // flatten so dome height = capR*0.55 instead of capR
  const domeBaseY  = 0.10;   // equator sits at top of stem
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(domeR, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    capMat
  );
  dome.scale.y = domeScaleY;
  dome.position.y = domeBaseY;
  grp.add(dome);

  // Cap rim — torus curl at the equator edge (mushroom skirt)
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(domeR * 0.90, 0.10, 7, 24),
    capMat
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = domeBaseY;
  grp.add(rim);

  // Glow shell (sphere shell mirroring dome shape)
  const glowDome = new THREE.Mesh(
    new THREE.SphereGeometry(domeR * 1.15, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshBasicMaterial({ color: capColor, side: THREE.BackSide, transparent: true, opacity: 0.28, depthWrite: false })
  );
  glowDome.scale.y = domeScaleY;
  glowDome.position.y = domeBaseY;
  grp.add(glowDome);

  // Spots sitting on the curved dome surface
  // For each (sx,sz), dome surface y = domeBaseY + domeScaleY * sqrt(max(0, domeR^2 - sx^2 - sz^2))
  const spotOffsets = [
    [0, 0], [domeR*0.42, 0], [-domeR*0.42, 0], [0, domeR*0.42], [0, -domeR*0.42],
    [domeR*0.30, domeR*0.30], [-domeR*0.30, domeR*0.30],
  ];
  for (const [sx, sz] of spotOffsets) {
    const r2   = sx * sx + sz * sz;
    const surfY = domeBaseY + domeScaleY * Math.sqrt(Math.max(0, domeR * domeR - r2));
    const spot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.04, 8),
      spotMat
    );
    spot.position.set(sx, surfY + 0.02, sz);
    grp.add(spot);
  }

  // Underglow point light
  const lt = new THREE.PointLight(glowCol, 2.0, 16);
  lt.position.y = -0.5;
  grp.add(lt);
}

function gumDropPad({ x, y, z, w = 3, d = 3, bounceSpeed = 20, color = 0xFF2233 }) {
  const h = 0.6;

  // Invisible collision box — top surface at y + 0.3
  const col = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  col.position.set(x, y, z);
  scene.add(col);
  solids.push({ mesh: col, w, h, d, type: "bounce", bounceSpeed });

  const grp = new THREE.Group();
  col.add(grp);

  // === Gumdrop visual (DOTS candy theme) ===
  const bodyR = Math.min(w, d) * 0.38;  // radius at widest point
  const bodyH = bodyR * 0.75;            // height of tapered trunk
  const topR  = bodyR * 0.78;            // narrower at the top shoulder
  const baseY = 0.30;                    // gumdrop sits on box surface

  const candyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.06,
    metalness: 0.12,
    emissive: color,
    emissiveIntensity: 0.14,
  });

  // Tapered trunk — wider at base, narrower at shoulder
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(topR, bodyR, bodyH, 22),
    candyMat
  );
  trunk.position.y = baseY + bodyH * 0.5;
  grp.add(trunk);

  // Dome cap — upper hemisphere sitting on top of trunk
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(topR, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    candyMat
  );
  dome.position.y = baseY + bodyH;
  grp.add(dome);

  // Candy shine highlight — offset white specular blob
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.50, depthWrite: false });
  const hl = new THREE.Mesh(
    new THREE.SphereGeometry(topR * 0.30, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
    hlMat
  );
  hl.position.set(topR * 0.30, baseY + bodyH + topR * 0.62, -topR * 0.10);
  grp.add(hl);

  // Soft glow halo
  const glowMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(topR * 1.24, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    glowMat
  );
  glow.position.y = baseY + bodyH;
  grp.add(glow);

  // Point light in matching color
  const lt = new THREE.PointLight(color, 1.6, 14);
  lt.position.y = baseY + bodyH;
  grp.add(lt);
}

// ===== Level 0: Childrens Park =====

function buildParkBackground() {
  parkGroup = new THREE.Group();
  scene.add(parkGroup);

  const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x7A5230, roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x3DB347, roughness: 0.75 });
  const benchMat   = new THREE.MeshStandardMaterial({ color: 0xA08050, roughness: 0.85 });

  function addTree(x, y, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.40, 3.0, 8), trunkMat);
    trunk.position.set(x, y + 1.5, z);
    parkGroup.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.0, 10, 8), foliageMat);
    leaves.position.set(x, y + 4.2, z);
    parkGroup.add(leaves);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), foliageMat);
    top.position.set(x, y + 5.8, z);
    parkGroup.add(top);
  }

  function addBench(x, y, z, rotY) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.52), benchMat);
    seat.position.set(x, y + 0.70, z); seat.rotation.y = rotY;
    parkGroup.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.50, 0.10), benchMat);
    back.position.set(x, y + 1.02, z + Math.cos(rotY) * 0.20); back.rotation.y = rotY;
    parkGroup.add(back);
    const legFL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.68, 0.10), benchMat);
    legFL.position.set(x + 0.85, y + 0.34, z + 0.18); legFL.rotation.y = rotY;
    parkGroup.add(legFL);
    const legFR = legFL.clone(); legFR.position.set(x - 0.85, y + 0.34, z + 0.18);
    parkGroup.add(legFR);
    const legBL = legFL.clone(); legBL.position.set(x + 0.85, y + 0.34, z - 0.18);
    parkGroup.add(legBL);
    const legBR = legFL.clone(); legBR.position.set(x - 0.85, y + 0.34, z - 0.18);
    parkGroup.add(legBR);
  }

  // Trees along both sides of the level path
  addTree(-12, 0,   -4); addTree( 11, 0,  -10);
  addTree(-13, 0,  -22); addTree( 12, 0,  -34);
  addTree(-11, 0,  -46); addTree( 13, 0,  -58);
  addTree(-12, 0,  -70); addTree( 11, 0,  -78);

  // Benches
  addBench(-8, 0, -16,  0.3);
  addBench( 8, 0, -40, -0.2);
  addBench(-7, 0, -64,  0.1);
}

function makeParkDog(x, y, z, rotY, bodyColor) {
  const mat  = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x221100, roughness: 0.8 });
  const grp  = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  scene.add(grp);
  decorations.push(grp);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.40, 1.18), mat);
  body.position.y = 0.50; grp.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 0.50), mat);
  head.position.set(0, 0.76, 0.60); grp.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.24), mat);
  snout.position.set(0, 0.66, 0.88); grp.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.06), dark);
  nose.position.set(0, 0.72, 1.01); grp.add(nose);

  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.16), mat);
  earL.position.set( 0.24, 1.02, 0.56); earL.rotation.z =  0.30; grp.add(earL);
  const earR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.16), mat);
  earR.position.set(-0.24, 1.02, 0.56); earR.rotation.z = -0.30; grp.add(earR);

  for (const [lx, lz] of [[0.24, 0.36], [-0.24, 0.36], [0.24, -0.36], [-0.24, -0.36]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.46, 0.16), mat);
    leg.position.set(lx, 0.23, lz); grp.add(leg);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.38), mat);
  tail.position.set(0, 0.68, -0.66); tail.rotation.x = -0.5; grp.add(tail);
}

function makeParkKid(x, y, z, rotY, shirtColor, pantsColor) {
  const skinMat  = new THREE.MeshStandardMaterial({ color: 0xFFCFAA, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
  const hairMat  = new THREE.MeshStandardMaterial({ color: 0x3A2000, roughness: 0.9 });
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  scene.add(grp);
  decorations.push(grp);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skinMat);
  head.position.y = 1.38; grp.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.48), hairMat);
  hair.position.y = 1.50; grp.add(hair);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.28), shirtMat);
  torso.position.y = 0.92; grp.add(torso);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), shirtMat);
  armL.position.set( 0.26, 0.90, 0); armL.rotation.z =  0.22; grp.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), shirtMat);
  armR.position.set(-0.26, 0.90, 0); armR.rotation.z = -0.22; grp.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.15), pantsMat);
  legL.position.set( 0.11, 0.30, 0); grp.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 0.15), pantsMat);
  legR.position.set(-0.11, 0.30, 0); grp.add(legR);
}

function buildLevel0() {
  const PK = {
    grass:  0x5DBB5D,
    yellow: 0xFFE055,
    sky:    0x88CCFF,
    pink:   0xFFAACC,
    mint:   0xAAEECC,
    sandy:  0xF5DF88,
  };

  // === Short easy path ===
  boxPlatform({ x: 0,  y:0,   z:  0,  w:12, h:0.6, d:12, color:PK.grass  });
  boxPlatform({ x: 0,  y:0,   z:-13,  w:8,  h:0.6, d:8,  color:PK.yellow });
  boxPlatform({ x: 2,  y:0.3, z:-24,  w:7,  h:0.6, d:6,  color:PK.sky    });
  boxPlatform({ x:-1,  y:0.5, z:-34,  w:6,  h:0.6, d:6,  color:PK.grass  });
  boxPlatform({ x: 1,  y:0.7, z:-44,  w:6,  h:0.6, d:6,  color:PK.yellow });
  movingPlatform({ x:-1, y:0.9, z:-53, w:5, h:0.6, d:5, axis:"x", amplitude:3.0, speed:0.55, color:PK.pink });
  boxPlatform({ x: 0,  y:1.1, z:-62,  w:5,  h:0.6, d:5,  color:PK.mint   });
  boxPlatform({ x: 0,  y:1.3, z:-73,  w:8,  h:0.6, d:8,  color:PK.grass  });

  levelEndZ = -73;
  spawnRing(0, 3.3, -73);

  // === Park decorations ===
  buildParkBackground();

  // Dogs near the path
  makeParkDog(-9, 0, -13,  2.0, 0xCC8844); // golden-ish — left side just before bench
  makeParkDog(-4, 0, -28,  2.5, 0xAA7755); // brown
  makeParkDog( 3, 0, -50, -0.4, 0xDDDDCC); // cream/white
  makeParkDog(-5, 0, -68,  1.2, 0x555555); // grey

  // Kids near the path
  makeParkKid( 4, 0,  -8,  1.0, 0xFF4444, 0x3355AA); // red shirt, blue pants
  makeParkKid(-3, 0, -38, -0.6, 0x44AAFF, 0x337722); // blue shirt, green pants
  makeParkKid( 3, 0, -60,  0.3, 0xFFAA22, 0x884422); // orange shirt, brown pants
}

function buildLevel1() {
  boxPlatform({ x: 0,   y: 0,   z: 0,    w: 12, h: 0.6, d: 12, color: C.yellow });
  boxPlatform({ x: 0,   y: 0,   z: -15,  w: 8,  h: 0.6, d: 8,  color: C.red    });
  boxPlatform({ x: 0,   y: 0.5, z: -26,  w: 7,  h: 0.6, d: 6,  color: C.orange });
  boxPlatform({ x: 0,   y: 1.0, z: -37,  w: 6,  h: 0.6, d: 6,  color: C.green  });
  boxPlatform({ x: -7,  y: 1.5, z: -47,  w: 5,  h: 0.6, d: 5,  color: C.blue   });
  boxPlatform({ x: -11, y: 2.0, z: -57,  w: 5,  h: 0.6, d: 5,  color: C.cyan   });
  boxPlatform({ x: -7,  y: 2.5, z: -67,  w: 4,  h: 0.6, d: 4,  color: C.teal   });
  boxPlatform({ x: 7,   y: 1.5, z: -47,  w: 5,  h: 0.6, d: 5,  color: C.purple });
  boxPlatform({ x: 11,  y: 2.0, z: -57,  w: 5,  h: 0.6, d: 5,  color: C.pink   });
  boxPlatform({ x: 7,   y: 2.5, z: -67,  w: 4,  h: 0.6, d: 4,  color: C.lime   });
  boxPlatform({ x: 0,   y: 3.0, z: -77,  w: 6,  h: 0.6, d: 6,  color: C.yellow });
  boxPlatform({ x: 0,   y: 3.5, z: -88,  w: 5,  h: 0.6, d: 5,  color: C.red    });
  boxPlatform({ x: 0,   y: 4.0, z: -99,  w: 5,  h: 0.6, d: 5,  color: C.orange });
  movingPlatform({ x: 0,  y: 4.5, z: -110, w: 4, h: 0.6, d: 4, axis: "x", amplitude: 5,   speed: 0.9,           color: C.blue   });
  boxPlatform({ x: 0,   y: 5.0, z: -121, w: 5,  h: 0.6, d: 5,  color: C.green  });
  boxPlatform({ x: 4,   y: 5.4, z: -130, w: 4,  h: 0.6, d: 4,  color: C.purple });
  movingPlatform({ x: 0,  y: 5.7, z: -139, w: 4, h: 0.6, d: 4, axis: "x", amplitude: 4,   speed: 1.2, phase: 0.8, color: C.pink   });
  boxPlatform({ x: 0,   y: 6.0, z: -149, w: 8,  h: 0.6, d: 8,  color: C.gold   });
  levelEndZ = -149;
  spawnRing(0, 8.0, -149);
}

function buildLevel2() {
  boxPlatform({ x: 0,   y: 0,   z: 0,    w: 10, h: 0.6, d: 10, color: 0x3D7A2A }); // forest green
  boxPlatform({ x: 0,   y: 0,   z: -14,  w: 5,  h: 0.6, d: 5,  color: 0x5D3A1A }); // dark wood
  boxPlatform({ x: 5,   y: 0.5, z: -23,  w: 5,  h: 0.6, d: 5,  color: 0x4E8F35 }); // bright green
  boxPlatform({ x: 10,  y: 1.0, z: -32,  w: 4,  h: 0.6, d: 4,  color: 0x7B4E2A }); // medium wood
  sawBladePendulum({ x: 7.5, y: 9, z: -27.5, armLength: 4.0, bladeRadius: 2.0, speed: 1.6, amplitude: 1.08, color: 0xFF3333, spinSpeed: 4.5 });
  boxPlatform({ x: 13,  y: 1.5, z: -41,  w: 4,  h: 0.6, d: 4,  color: 0x2D5A1B }); // deep forest
  movingPlatform({ x: 16, y: 2.5, z: -50, w: 5, h: 0.6, d: 5, axis: "y", amplitude: 2.0, speed: 0.9, color: 0x9B6E42 }); // light wood
  boxPlatform({ x: 16,  y: 4.2, z: -61,  w: 4,  h: 0.6, d: 4,  color: 0x5C6B2A }); // olive
  boxPlatform({ x: 11,  y: 4.8, z: -70,  w: 4,  h: 0.6, d: 4,  color: 0x6B4D2A }); // bark brown
  boxPlatform({ x: 6,   y: 5.2, z: -79,  w: 4,  h: 0.6, d: 4,  color: 0x4E8F35 }); // bright green
  sawBladePendulum({ x: 8.5, y: 13, z: -74.5, armLength: 5.0, bladeRadius: 2.2, speed: 1.85, amplitude: 1.1, color: 0xFF8800, spinSpeed: 5.5 });
  boxPlatform({ x: 1,   y: 5.8, z: -88,  w: 4,  h: 0.6, d: 4,  color: 0x7A9A3A }); // light olive
  boxPlatform({ x: -3,  y: 6.0, z: -97,  w: 4,  h: 0.6, d: 4,  color: 0x5D3A1A }); // dark wood
  movingPlatform({ x: 0, y: 6.0, z: -107, w: 5, h: 0.6, d: 5, axis: "x", amplitude: 5.5, speed: 1.3, color: 0x3D7A2A }); // forest green
  boxPlatform({ x: -5,  y: 6.5, z: -118, w: 4,  h: 0.6, d: 4,  color: 0x7B4E2A }); // medium wood
  boxPlatform({ x: -9,  y: 7.0, z: -127, w: 4,  h: 0.6, d: 4,  color: 0x2D5A1B }); // deep forest
  boxPlatform({ x: -5,  y: 7.5, z: -136, w: 4,  h: 0.6, d: 4,  color: 0x9B6E42 }); // light wood
  movingPlatform({ x: -1, y: 8.0, z: -145, w: 4, h: 0.6, d: 4, axis: "x", amplitude: 3.5, speed: 1.65, phase: 0.8, color: 0x4E8F35 }); // bright green
  boxPlatform({ x: 0,   y: 8.5, z: -155, w: 8,  h: 0.6, d: 8,  color: 0x4A2E10 }); // rich dark bark
  levelEndZ = -155;
  spawnRing(0, 10.5, -155);
}

function buildLevel3() {
  // === Section 1: Warmup ===
  boxPlatform({ x:0,   y:0,    z:0,    w:10, h:0.6, d:10, color:0x00FFEE, neon:true });
  boxPlatform({ x:0,   y:0,    z:-15,  w:6,  h:0.6, d:6,  color:0xFF00AA, neon:true });
  boxPlatform({ x:4,   y:0.6,  z:-25,  w:5,  h:0.6, d:5,  color:0xFF6600, neon:true });

  // === Section 2: Ramp 1 — long uphill climb ===
  // Flat approach (top = 1.5)
  boxPlatform({ x:6,   y:1.2,  z:-36,  w:6,  h:0.6, d:6,  color:0x00FF66, neon:true });
  // w=3.5 (half), 4-unit gap on each side
  // near edge (z=-43) height=1.5, far edge (z=-69) height=7.0
  rampPlatform({ x:6,  y:3.82, z:-56,  w:3.5, d:26, angleDeg:-12, color:0x44FFAA, neon:true });
  // Landing flat (top = 7.0), 4.5-unit gap from ramp far
  boxPlatform({ x:6,   y:6.7,  z:-77,  w:7,  h:0.6, d:7,  color:0x3399FF, neon:true });

  // === Section 3: Turn — layout shifts x from 6 to -7 while continuing -z ===
  boxPlatform({ x:3,   y:7.0,  z:-86,  w:5,  h:0.6, d:5,  color:0xCC00FF, neon:true });
  pendulumObstacle({ x:3, y:13.25, z:-86, armLength:5.0, speed:2.0, amplitude:1.1, color:0xFF1166, neon:true, sphere:true, sphereRadius:1.9 });
  boxPlatform({ x:-1,  y:7.3,  z:-95,  w:5,  h:0.6, d:5,  color:0x00EEFF, neon:true });
  movingPlatform({ x:-5, y:7.6, z:-104, w:5,  h:0.6, d:5, axis:"x", amplitude:4.5, speed:1.5,             color:0xFF6600, neon:true });
  boxPlatform({ x:-7,  y:7.9,  z:-113, w:4,  h:0.6, d:4,  color:0x00FFAA, neon:true });

  // === Section 4: Ramp 2 — second uphill climb ===
  // Flat approach (top = 8.5)
  boxPlatform({ x:-6,  y:8.2,  z:-122, w:6,  h:0.6, d:6,  color:0xFF2255, neon:true });
  // w=3.5 (half), 4-unit gap on each side
  // near edge (z=-129) height=8.5, far edge (z=-153) height=14.0
  rampPlatform({ x:-6, y:10.83,z:-141, w:3.5, d:24, angleDeg:-13, color:0xFF44CC, neon:true });
  // Landing flat (top = 14.0), 4.5-unit gap from ramp far
  boxPlatform({ x:-6,  y:13.7, z:-161, w:7,  h:0.6, d:7,  color:0xFFEE00, neon:true });

  // === Section 5: Final push ===
  boxPlatform({ x:-3,  y:13.8, z:-170, w:5,  h:0.6, d:5,  color:0x3399FF, neon:true });
  pendulumObstacle({ x:-3, y:21.0, z:-170, armLength:6.0, speed:2.2, amplitude:1.05, color:0xFF8800, neon:true, sphere:true, sphereRadius:1.9 });
  movingPlatform({ x:0,  y:14.1, z:-179, w:5,  h:0.6, d:5, axis:"x", amplitude:4.0, speed:2.0, phase:0.5, color:0xCC00FF, neon:true });
  boxPlatform({ x:0,   y:14.4, z:-188, w:8,  h:0.6, d:8,  color:0xFFEE00, neon:true });

  levelEndZ = -188;
  spawnRing(0, 16.4, -188);
}

// ===== Warning sign =====
function makeWarningSign({ x, y, z, rotY = 0 }) {
  const grp = new THREE.Group();

  // Post
  const postH = 2.8;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, postH, 6),
    new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.9 })
  );
  post.position.y = postH * 0.5;
  grp.add(post);

  // Canvas texture
  const cw = 512, ch = 220;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');

  // Red background
  ctx.fillStyle = '#BB1100';
  ctx.fillRect(0, 0, cw, ch);

  // Yellow border
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 10;
  ctx.strokeRect(7, 7, cw - 14, ch - 14);

  // Warning stripes at top and bottom
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(7, 7, cw - 14, 28);
  ctx.fillRect(7, ch - 35, cw - 14, 28);

  // Text — two lines, vertically centered in the stripe-free zone
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 72px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textAreaTop = 7 + 28;          // below top stripe
  const textAreaBot = ch - 35;         // above bottom stripe
  const midY = (textAreaTop + textAreaBot) / 2;
  const lineGap = 78;
  ctx.fillText('BEWARE',  cw / 2, midY - lineGap / 2);
  ctx.fillText('OF LAVA', cw / 2, midY + lineGap / 2);

  const tex = new THREE.CanvasTexture(cv);

  // Sign board — front face (+z) shows text, faces toward spawn camera
  const boardW = 2.8, boardH = 1.2;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(boardW, boardH, 0.09),
    [
      new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.8 }),
      new THREE.MeshBasicMaterial({ map: tex }),                        // front (+z) — unlit, always visible
      new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 0.8 }),
    ]
  );
  board.position.y = postH + boardH * 0.5 + 0.05;
  grp.add(board);

  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  scene.add(grp);
  decorations.push(grp);
}

function buildLevel4() {
  // === Section 1: Cave entry ===
  boxPlatform({ x:0,  y:0,    z:0,    w:12, h:0.7, d:12, color:0x1A1A2E });
  boxPlatform({ x:0,  y:0,    z:-17,  w:6,  h:0.7, d:6,  color:0x00CCBB, neon:true });
  boxPlatform({ x:3,  y:0.5,  z:-28,  w:5,  h:0.7, d:5,  color:0x8833FF, neon:true });

  // === Section 2: Descent into crystal forest ===
  boxPlatform({ x:6,  y:1,    z:-39,  w:5,  h:0.7, d:5,  color:0x00AAFF, neon:true });
  bouncePad({ x:8, y:0, z:-50, bounceSpeed:20 });           // === Bounce pad 1 (early) ===
  movingPlatform({ x:7,  y:4,    z:-62,  w:5,  h:0.7, d:4,  axis:"y", amplitude:2.0, speed:1.3,  color:0x00FF99, neon:true }); // raised — bounce target
  boxPlatform({ x:5,  y:0.5,  z:-73,  w:4,  h:0.7, d:4,  color:0x3366FF, neon:true });
  boxPlatform({ x:3,  y:1.5,  z:-84,  w:4,  h:0.7, d:4,  color:0x00DDCC, neon:true });
  stalactitePendulum({ x:5,  y:12, z:-78,  armLength:7.5, tipRadius:1.0, tipHeight:4.0, speed:1.8, amplitude:1.10, color:0x00CCDD });

  // === Section 3: Crystal formation crossing ===
  boxPlatform({ x:1,  y:2,    z:-95,  w:4,  h:0.7, d:4,  color:0xAA33FF, neon:true });
  boxPlatform({ x:-2, y:2.5,  z:-106, w:4,  h:0.7, d:4,  color:0x00BBAA, neon:true });
  movingPlatform({ x:-4, y:3,    z:-118, w:4,  h:0.7, d:4,  axis:"x", amplitude:5.5, speed:1.8,  color:0xFF00CC, neon:true });
  stalactitePendulum({ x:-3, y:14, z:-112, armLength:8.0, tipRadius:1.0, tipHeight:4.0, speed:2.0, amplitude:1.05, color:0x8844FF });
  bouncePad({ x:-3, y:3.5, z:-125, bounceSpeed:20 });       // === Bounce pad 2 (middle) ===
  boxPlatform({ x:-5, y:9,    z:-139, w:5,  h:0.7, d:5,  color:0x0088FF, neon:true }); // elevated bounce landing
  boxPlatform({ x:-3, y:4,    z:-140, w:4,  h:0.7, d:4,  color:0x00FFAA, neon:true });
  boxPlatform({ x:-2, y:4.5,  z:-151, w:5,  h:0.7, d:5,  color:0x6633FF, neon:true });

  // === Section 4: Crystal ramp ===
  // approach top = 4.5 + 0.35 = 4.85 → ramp y = 4.85 + tan(12°)*11 - 0.44 = 6.75
  rampPlatform({ x:-1, y:6.75, z:-166, w:3.5, d:22, angleDeg:-12, color:0x00CCFF, neon:true });
  // landing top ≈ 9.53 → center y = 9.53 - 0.35 = 9.18
  boxPlatform({ x:0,  y:9.2,  z:-183, w:6,  h:0.7, d:6,  color:0x8800FF, neon:true });
  movingPlatform({ x:2,  y:9.8,  z:-195, w:4,  h:0.7, d:4,  axis:"x", amplitude:4.0, speed:2.0,  color:0x00DDFF, neon:true });
  stalactitePendulum({ x:2,  y:21, z:-189, armLength:8.5, tipRadius:1.0, tipHeight:4.5, speed:2.2, amplitude:1.00, color:0xFF00BB });

  // === Section 5: Final gauntlet ===
  boxPlatform({ x:0,  y:10,   z:-206, w:4,  h:0.7, d:4,  color:0x00FFCC, neon:true });
  movingPlatform({ x:2,  y:10.5, z:-217, w:4,  h:0.7, d:4,  axis:"x", amplitude:3.5, speed:2.3,  color:0xAA00FF, neon:true });
  boxPlatform({ x:0,  y:11,   z:-228, w:8,  h:0.7, d:8,  color:0x00CCDD, neon:true });

  levelEndZ = -228;
  spawnRing(0, 13.5, -228);
}

function buildLevel5() {
  // All platforms are neon in volcanic red/orange palette

  // === Section 1: Warmup ===
  boxPlatform({ x:0,   y:0,   z:0,    w:12, h:0.6, d:12, color:0xCC2200, neon:true });
  makeWarningSign({ x:-5, y:0.3, z:-4.5 }); // front-left corner, face points +z toward player
  boxPlatform({ x:0,   y:0,   z:-15,  w:6,  h:0.6, d:6,  color:0xFF4400, neon:true });
  boxPlatform({ x:5,   y:0.5, z:-25,  w:5,  h:0.6, d:5,  color:0xFF6600, neon:true });
  boxPlatform({ x:9,   y:1.0, z:-35,  w:5,  h:0.6, d:5,  color:0xFF8800, neon:true });

  // === Section 2: First pendulum zone ===
  firePendulum({ x:7,  y:9,  z:-30,  armLength:4.0, ballRadius:1.1, speed:1.8, amplitude:1.08 });
  boxPlatform({ x:12,  y:1.5, z:-46,  w:4,  h:0.6, d:4,  color:0xFF3300, neon:true });
  movingPlatform({ x:10, y:2.5, z:-57, w:4, h:0.6, d:4, axis:"y", amplitude:2.0, speed:1.0,            color:0xFF5500, neon:true });
  boxPlatform({ x:6,   y:3.5, z:-68,  w:4,  h:0.6, d:4,  color:0xFF7700, neon:true });
  boxPlatform({ x:1,   y:4.0, z:-78,  w:4,  h:0.6, d:4,  color:0xFFAA00, neon:true });
  firePendulum({ x:4,  y:13, z:-73,  armLength:5.0, ballRadius:1.1, speed:2.0, amplitude:1.10 });

  // === Section 3: Ramp climb ===
  // approach top = 4.8; rampCenterY = 4.8 - 0.44 + sin(12°)*13 = 7.06
  boxPlatform({ x:0,   y:4.5, z:-89,  w:6,  h:0.6, d:6,  color:0xFF4400, neon:true });
  rampPlatform({ x:0,  y:7.06, z:-108, w:3.5, d:26, angleDeg:-12, color:0xFF5500, neon:true });
  // far edge top ≈ 7.06 + 2.70 + 0.44 = 10.2; landing center y = 9.9
  boxPlatform({ x:0,   y:9.9,  z:-128, w:6,  h:0.6, d:6,  color:0xFF6600, neon:true });

  // === Section 4: Moving platform crossing ===
  movingPlatform({ x:4, y:10.5, z:-139, w:4, h:0.6, d:4, axis:"x", amplitude:5.0, speed:1.5,            color:0xFF8800, neon:true });
  firePendulum({ x:3,  y:18, z:-134,  armLength:6.0, ballRadius:1.1, speed:2.1, amplitude:1.05 });
  boxPlatform({ x:0,   y:11.0, z:-150, w:4,  h:0.6, d:4,  color:0xFF3300, neon:true });
  boxPlatform({ x:-5,  y:11.5, z:-160, w:4,  h:0.6, d:4,  color:0xFFAA00, neon:true });
  movingPlatform({ x:-8, y:12.0, z:-171, w:4, h:0.6, d:4, axis:"x", amplitude:4.5, speed:1.8, phase:0.5, color:0xFF5500, neon:true });
  boxPlatform({ x:-4,  y:12.5, z:-182, w:4,  h:0.6, d:4,  color:0xFF4400, neon:true });
  firePendulum({ x:-5, y:20, z:-177,  armLength:6.5, ballRadius:1.2, speed:2.3, amplitude:1.05 });

  // === Section 5: Final gauntlet ===
  boxPlatform({ x:0,   y:13.0, z:-193, w:4,  h:0.6, d:4,  color:0xFF4400, neon:true });
  movingPlatform({ x:4, y:13.5, z:-204, w:4, h:0.6, d:4, axis:"x", amplitude:3.5, speed:2.1,            color:0xFFAA00, neon:true });
  boxPlatform({ x:0,   y:14.0, z:-215, w:5,  h:0.6, d:5,  color:0xFF6600, neon:true });
  boxPlatform({ x:0,   y:14.5, z:-225, w:4,  h:0.6, d:4,  color:0xFF8800, neon:true });
  boxPlatform({ x:0,   y:15.0, z:-235, w:4,  h:0.6, d:4,  color:0xFF3300, neon:true });
  boxPlatform({ x:0,   y:15.5, z:-245, w:4,  h:0.6, d:4,  color:0xFFAA00, neon:true });
  boxPlatform({ x:0,   y:16.0, z:-255, w:8,  h:0.6, d:8,  color:0xFF5500, neon:true });

  // Lava geysers — positioned in crossing gaps between platforms
  spawnGeyser( 11,  -51, 5.0, 0.0);  // between platform z=-46 and mover z=-57
  spawnGeyser(  8,  -63, 6.5, 2.3);  // between mover z=-57 and platform z=-68
  spawnGeyser(  2, -144, 5.5, 1.0);  // between landing z=-128 and mover z=-139 ... mover to z=-150
  spawnGeyser( -6, -165, 4.8, 3.5);  // between platform z=-160 and mover z=-171
  spawnGeyser( -2, -198, 6.0, 1.8);  // between platform z=-193 and mover z=-204

  levelEndZ = -255;
  spawnRing(0, 18.0, -255);
}

// ===== Lollipop pendulum (Level 6) =====
function lollipopPendulum({ x, y, z, armLength = 5.0, ballRadius = 1.8, speed = 2.0, amplitude = 1.05, stickColor = 0xFF2244, ballColor = 0xFF88BB }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  // Anchor bolt
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xDDAAAA, roughness: 0.4 })
  ));

  // Candy-cane striped stick — alternating stickColor / cream bands
  const segH = 1.1;
  const segs = Math.ceil(armLength / segH);
  for (let i = 0; i < segs; i++) {
    const col = (i % 2 === 0) ? stickColor : 0xFFEEEE;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, segH, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, emissive: col, emissiveIntensity: 0.10 })
    );
    seg.position.y = -(i * segH + segH * 0.5);
    group.add(seg);
  }

  // Ball group hanging at end of arm
  const ballGroup = new THREE.Group();
  ballGroup.position.y = -armLength;

  // Main candy ball
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 20, 14),
    new THREE.MeshStandardMaterial({ color: ballColor, roughness: 0.14, metalness: 0.05, emissive: ballColor, emissiveIntensity: 0.24 })
  ));

  // Gloss highlight cap (upper hemisphere, white, semi-transparent)
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 0.58, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.32, depthWrite: false })
  );
  cap.position.y = ballRadius * 0.42;
  ballGroup.add(cap);

  // Outer glow shell
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 1.22, 14, 10),
    new THREE.MeshBasicMaterial({ color: ballColor, side: THREE.BackSide, transparent: true, opacity: 0.20, depthWrite: false })
  ));

  group.add(ballGroup);

  const colSize = ballRadius * 2;
  pendulums.push({ group, block: ballGroup, boxW: colSize, boxH: colSize, boxD: colSize, speed, amplitude, worldPos: new THREE.Vector3() });
}

// ===== Neon Energy Orb pendulum (Level 7) =====
function cranePendulum({ x, y, z, armLength = 7, speed = 1.8, amplitude = 1.0, ballRadius = 1.1, color = 0x00FFEE }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  // Anchor node — glowing bead at pivot point
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color })
  ));

  // Energy tether — thin bright core strand
  const tetherCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, armLength, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  tetherCore.position.y = -armLength * 0.5;
  group.add(tetherCore);

  // Energy tether — soft outer glow tube
  const tetherGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, armLength, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.10, depthWrite: false })
  );
  tetherGlow.position.y = -armLength * 0.5;
  group.add(tetherGlow);

  // Orb group hanging at arm end
  const ballGroup = new THREE.Group();
  ballGroup.position.y = -armLength;

  // Layer 1 — white-hot core (solid, small)
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 0.42, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
  ));

  // Layer 2 — bright colored inner plasma
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 0.78, 20, 14),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.80, depthWrite: false })
  ));

  // Layer 3 — mid translucent shell
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 1.15, 16, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
  ));

  // Layer 4 — outer aura bubble (BackSide = hollow shell look)
  ballGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 1.65, 14, 10),
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.10, depthWrite: false })
  ));

  // Strong inner glow — tight hot core light
  const innerLight = new THREE.PointLight(color, 3.5, 10);
  innerLight.position.set(0, 0, 0);
  ballGroup.add(innerLight);

  // Wide soft fill — casts orb color onto nearby platforms
  const fillLight = new THREE.PointLight(color, 0.9, 38);
  fillLight.position.set(0, 0, 0);
  ballGroup.add(fillLight);

  group.add(ballGroup);

  const colSize = ballRadius * 2;
  pendulums.push({ group, block: ballGroup, boxW: colSize, boxH: colSize, boxD: colSize, speed, amplitude, worldPos: new THREE.Vector3() });
}

// ===== Candy background (Level 6) =====
function buildCandyBackground() {
  candyGroup = new THREE.Group();
  scene.add(candyGroup);

  let _s = 42069;
  function rng() { _s = (_s * 1664525 + 1013904223) & 0xFFFFFFFF; return (_s >>> 0) / 0xFFFFFFFF; }

  const floorY = -16;

  // Pastel ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 380),
    new THREE.MeshStandardMaterial({ color: 0xFFCCEE, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.set(0, floorY, -100);
  candyGroup.add(ground);

  // Cotton candy clouds
  const ccCols = [0xFFAACC, 0xCCAAFF, 0xAADDFF, 0xFFCCDD, 0xDDB3FF];
  function makeCottonCloud(cx, cy, cz, scale, col) {
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, emissive: col, emissiveIntensity: 0.10 });
    const lumps = [
      { s: [4.2, 2.4, 3.2], p: [0,    0,    0]   },
      { s: [2.8, 1.9, 2.4], p: [-3.2,-0.3, 0.7]  },
      { s: [3.5, 2.1, 2.8], p: [ 3.0,-0.2,-0.4]  },
      { s: [2.4, 1.7, 2.1], p: [-1.4, 0.9,-1.1]  },
      { s: [2.0, 1.5, 1.9], p: [ 1.7, 0.8, 1.0]  },
      { s: [1.8, 1.4, 1.7], p: [ 0,   1.3,-0.5]  },
    ];
    const g = new THREE.Group();
    for (const lump of lumps) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), mat);
      m.scale.set(...lump.s);
      m.position.set(...lump.p);
      g.add(m);
    }
    g.scale.setScalar(scale);
    g.position.set(cx, cy, cz);
    candyGroup.add(g);
  }
  [
    [-52, 14, -38,  1.9, 0xFFAACC], [ 50, 16, -80,  2.1, 0xCCAAFF],
    [-30, 11,-125,  1.8, 0xAADDFF], [ 72, 15, -60,  1.7, 0xFFCCDD],
    [-60, 18,-170,  2.2, 0xDDB3FF], [ 18, 12,-155,  1.9, 0xFFAACC],
    [-44, 20, -15,  1.6, 0xAADDFF], [ 88, 14,-140,  2.0, 0xCCAAFF],
  ].forEach(([cx, cy, cz, s, col]) => makeCottonCloud(cx, cy, cz, s, col));

  // Giant lollipops
  const lollyCols = [0xFF5599, 0xFFDD22, 0x99DDFF, 0xCC88FF, 0xFF88BB, 0xFFCC44, 0x88FFCC, 0xAA88FF];
  const stickCols = [0xEECCCC, 0xCCEECC, 0xCCCCEE, 0xEEEECC, 0xEECCEE];
  function makeLollipop(lx, lz, h, ballR, sc, bc) {
    const g = new THREE.Group();
    // Two-tone striped stick
    for (let i = 0; i < 2; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, h * 0.5, 8),
        new THREE.MeshStandardMaterial({ color: i === 0 ? sc : 0xFFFFFF, roughness: 0.45, emissive: i === 0 ? sc : 0xFFEEFF, emissiveIntensity: 0.08 })
      );
      seg.position.y = floorY + i * h * 0.5 + h * 0.25;
      g.add(seg);
    }
    // Ball
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballR, 16, 12),
      new THREE.MeshStandardMaterial({ color: bc, roughness: 0.18, metalness: 0.06, emissive: bc, emissiveIntensity: 0.18 })
    );
    ball.position.y = floorY + h + ballR * 0.55;
    g.add(ball);
    // Gloss highlight cap
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(ballR * 0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.28, roughness: 0.0, depthWrite: false })
    );
    cap.position.y = floorY + h + ballR * 0.9;
    g.add(cap);
    g.position.set(lx, 0, lz);
    candyGroup.add(g);
  }
  [
    [-22,-30, 14,3.2], [ 24,-65, 12,3.0], [-32,-100,16,4.0],
    [ 30,-140,11,2.8], [-26,-165,15,3.5], [ 36,-185,13,3.2],
    [-40, -48,10,2.6], [ 20, -90,18,4.2], [-28,-120,12,2.9],
    [ 26,-155,14,3.4],
  ].forEach(([lx, lz, h, r], i) => makeLollipop(lx, lz, h, r, stickCols[i % stickCols.length], lollyCols[i % lollyCols.length]));

  // Candy cane poles (alternating red/white bands)
  function makeCandyCane(cx, cz, h) {
    const g   = new THREE.Group();
    const segH = 1.4;
    const segs = Math.ceil(h / segH);
    for (let i = 0; i < segs; i++) {
      const col = (i % 2 === 0) ? 0xFF2244 : 0xFFEEEE;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, segH, 8),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, emissive: col, emissiveIntensity: 0.07 })
      );
      seg.position.y = floorY + i * segH + segH * 0.5;
      g.add(seg);
    }
    g.position.set(cx, 0, cz);
    candyGroup.add(g);
  }
  [
    [-14,-22],[16,-55],[-18,-88],[20,-118],[-16,-148],[18,-178],
    [-26,-40],[28,-72],[-22,-102],[24,-132],[-20,-162],
  ].forEach(([cx, cz]) => makeCandyCane(cx, cz, 18 + rng() * 10));

  // Cotton candy bushes (ground clusters)
  const bushCols = [0xFF99BB, 0xBB99FF, 0x99CCFF, 0xFFCC99, 0x99FFCC];
  for (let i = 0; i < 32; i++) {
    const bx  = (rng() - 0.5) * 130;
    const bz  = rng() * -220 + 10;
    const sc  = 0.8 + rng() * 1.8;
    const col = bushCols[Math.floor(rng() * bushCols.length)];
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 1.0, emissive: col, emissiveIntensity: 0.06 });
    const grp = new THREE.Group();
    const lumps = 4 + Math.floor(rng() * 4);
    for (let j = 0; j < lumps; j++) {
      const r = 1.0 + rng() * 1.6;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mat);
      m.position.set((rng() - 0.5) * 4 * sc, r * 0.6, (rng() - 0.5) * 3 * sc);
      grp.add(m);
    }
    grp.position.set(bx, floorY, bz);
    candyGroup.add(grp);
  }

  // Candy-colored point lights
  const plCols = [0xFF88BB, 0xFFCC44, 0xBB88FF, 0x88DDFF, 0xFF44BB, 0xFFEE88];
  [
    [-18,0,-40],[22,0,-85],[-15,0,-130],[20,0,-175],
    [-18,0,-50],[28,0,-110],[-22,0,-155],[24,0,-185],
  ].forEach(([lx, ly, lz], i) => {
    const pl = new THREE.PointLight(plCols[i % plCols.length], 2.8, 65);
    pl.position.set(lx, ly, lz);
    candyGroup.add(pl);
  });
}

// ===== Level 6: Candyland =====
function buildLevel6() {
  const CP = {
    white:   0xFFF0F5, // cream white
    pink:    0xFF99BB, // mid pink
    rose:    0xFF5577, // deep rose
    blush:   0xFFCCDD, // pale blush
    hotpink: 0xFF2255, // vivid red-pink
    red:     0xEE1133, // candy red
  };

  // === Section 1: Warmup — red gumdrop height gate ===
  boxPlatform({ x: 0,  y:0,   z:  0,  w:12, h:0.6, d:12, color:CP.blush  });
  boxPlatform({ x: 0,  y:0,   z:-15,  w:8,  h:0.6, d:8,  color:CP.white  });
  boxPlatform({ x: 3,  y:0.5, z:-27,  w:6,  h:0.6, d:6,  color:CP.pink   });
  gumDropPad({ x: 0,  y:0.6, z:-34,  w:3, d:3, bounceSpeed:20, color:0xFF2233 }); // RED — bounce required to reach next platform
  boxPlatform({ x:-2,  y:5.0, z:-39,  w:5,  h:0.6, d:5,  color:CP.blush  }); // raised height gate target

  // === Section 2: Pendulum + movers + yellow side shortcut ===
  boxPlatform({ x: 1,  y:5.4, z:-50,  w:5,  h:0.6, d:5,  color:CP.white  });
  lollipopPendulum({ x:2, y:13, z:-56, armLength:6.0, ballRadius:1.9, speed:2.1, amplitude:1.10, stickColor:0xFF2244, ballColor:0xFF44BB });
  movingPlatform({ x: 4,  y:5.8, z:-63,  w:4, h:0.6, d:4, axis:"x", amplitude:6.0, speed:1.3, color:CP.rose });
  boxPlatform({ x: 0,  y:6.2, z:-76,  w:5,  h:0.6, d:5,  color:CP.pink   });
  // Yellow side branch: jump left from z=-76 directly onto gumdrop (no entry ledge)
  gumDropPad({ x:-6,  y:6.2, z:-82,  w:3, d:3, bounceSpeed:20, color:0xFFCC00 }); // YELLOW — jump from z=-76 left edge
  boxPlatform({ x:-6,  y:9.0, z:-96,  w:4,  h:0.6, d:4,  color:CP.rose   }); // gumdrop path: elevated catch (rose)
  boxPlatform({ x:-4,  y:8.5, z:-105, w:4,  h:0.6, d:4,  color:CP.hotpink }); // gumdrop path: unique step into orange zone
  movingPlatform({ x:-3,  y:6.6, z:-89,  w:4, h:0.6, d:4, axis:"y", amplitude:2.5, speed:1.5, color:CP.white }); // main path
  boxPlatform({ x: 2,  y:7.0, z:-102, w:5,  h:0.6, d:4,  color:CP.white  }); // main path: own landing platform

  // === Section 3: Two-hop orange gumdrop sequence ===
  lollipopPendulum({ x:0, y:16, z:-108, armLength:7.5, ballRadius:1.9, speed:2.3, amplitude:1.10, stickColor:0xCCAAFF, ballColor:0x88DDFF });
  gumDropPad({ x:-3,  y:7.0, z:-110,  w:3, d:3, bounceSpeed:20, color:0xFF8800 }); // ORANGE #1 — first hop past pendulum
  gumDropPad({ x: 0,  y:7.4, z:-119,  w:3, d:3, bounceSpeed:20, color:0xFF8800 }); // ORANGE #2 — second hop, big bounce
  boxPlatform({ x: 2,  y:11.5, z:-131, w:5,  h:0.6, d:5,  color:CP.white  }); // elevated — requires bounce from orange #2

  // === Section 4: Descent + movers + third pendulum ===
  movingPlatform({ x:-2,  y:8.2, z:-141, w:3, h:0.6, d:3, axis:"x", amplitude:5.0, speed:2.1, phase:0.4, color:CP.pink });
  boxPlatform({ x: 3,  y:8.6, z:-154, w:5,  h:0.6, d:5,  color:CP.rose   });
  lollipopPendulum({ x:1, y:18, z:-148, armLength:8.5, ballRadius:2.0, speed:2.4, amplitude:1.05, stickColor:0xFF8833, ballColor:0xFFCC44 });
  movingPlatform({ x: 0,  y:9.0, z:-167, w:4, h:0.6, d:4, axis:"x", amplitude:7.0, speed:2.2, color:CP.hotpink });

  // === Section 5: Final gauntlet + green gumdrop climax ===
  boxPlatform({ x:-3,  y:9.4, z:-180, w:4,  h:0.6, d:4,  color:CP.pink   });
  lollipopPendulum({ x:0, y:20, z:-174, armLength:9.0, ballRadius:2.0, speed:2.6, amplitude:1.05, stickColor:0xFF2244, ballColor:0xCC88FF });
  gumDropPad({ x: 0,  y:9.2, z:-186,  w:3, d:3, bounceSpeed:20, color:0x33CC44 }); // GREEN — climax final bounce
  boxPlatform({ x: 0,  y:13.0, z:-200, w:8,  h:0.6, d:8,  color:CP.red    }); // raised finale

  levelEndZ = -200;
  spawnRing(0, 15.0, -200);
}

// ===== City background (Level 7) =====
function buildCityBackground() {
  cityGroup = new THREE.Group();
  scene.add(cityGroup);

  // City ambient glow — 3 large low-intensity lights spaced along the route.
  // Simulates cumulative bleed from all signs, windows and billboards.
  [
    { z:  -45, col: 0xFF2266, intensity: 0.55, dist: 95 },
    { z:  -95, col: 0x00CCFF, intensity: 0.50, dist: 95 },
    { z: -148, col: 0xAA44FF, intensity: 0.55, dist: 95 },
  ].forEach(({ z, col, intensity, dist }) => {
    const gl = new THREE.PointLight(col, intensity, dist);
    gl.position.set(0, 14, z);
    cityGroup.add(gl);
  });

  let _s = 77331;
  function rng() { _s = (_s * 1664525 + 1013904223) & 0xFFFFFFFF; return (_s >>> 0) / 0xFFFFFFFF; }

  const NC = { dark: 0x0A0F1E, slate: 0x101828, grey: 0x181E2C };

  // Helper: window grid texture — cell-based, with border gaps
  function makeWindowTex(cols, rows, litColor, wallHex) {
    const CELL = 16, GAP = 2;
    const W = cols * CELL, H = rows * CELL;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    // Fill with wall tint
    const wr = (wallHex >> 16) & 0xFF, wg = (wallHex >> 8) & 0xFF, wb = wallHex & 0xFF;
    ctx.fillStyle = `rgb(${wr},${wg},${wb})`;
    ctx.fillRect(0, 0, W, H);
    // Draw window panes
    const lr = (litColor >> 16) & 0xFF, lg = (litColor >> 8) & 0xFF, lb = litColor & 0xFF;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng() < 0.62;
        if (lit) {
          ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
        } else {
          // Dim unlit window — slightly lighter than wall so panes are visible
          ctx.fillStyle = `rgb(${Math.min(255, wr + 18)},${Math.min(255, wg + 18)},${Math.min(255, wb + 18)})`;
        }
        ctx.fillRect(c * CELL + GAP, r * CELL + GAP, CELL - GAP * 2, CELL - GAP * 2);
      }
    }
    return new THREE.CanvasTexture(canvas);
  }

  // Derive a dark-but-tinted wall color from a neon accent
  function accentToWall(accent) {
    const r = (accent >> 16) & 0xFF;
    const g = (accent >>  8) & 0xFF;
    const b =  accent        & 0xFF;
    return (Math.floor(r * 0.20) << 16) | (Math.floor(g * 0.20) << 8) | Math.floor(b * 0.20);
  }

  // Buildings along both sides of the path
  const buildings = [
    // left side (x < 0)
    { x:-18, z:-30,  bW:8, bH:34, bD:10 },
    { x:-20, z:-60,  bW:7, bH:44, bD:9  },
    { x:-19, z:-95,  bW:9, bH:28, bD:11 },
    { x:-21, z:-130, bW:7, bH:50, bD:9  },
    { x:-18, z:-160, bW:8, bH:38, bD:10 },
    // right side (x > 0)
    { x:18,  z:-20,  bW:8, bH:40, bD:10 },
    { x:20,  z:-55,  bW:9, bH:32, bD:10 },
    { x:19,  z:-90,  bW:7, bH:46, bD:8  },
    { x:21,  z:-125, bW:8, bH:36, bD:10 },
    { x:19,  z:-158, bW:9, bH:42, bD:10 },
  ];

  buildings.forEach(({ x, z, bW, bH, bD }) => {
    const baseY = -14 + bH * 0.5;

    // Pick accent first — everything derives from it
    const accentColor = [0xFF0066, 0x00FFCC, 0xFF6600, 0x9900FF][Math.floor(rng() * 4)];
    const wallHex     = accentToWall(accentColor);

    // Building body — tinted concrete (Lambert: no per-light PBR cost)
    const wallMat = new THREE.MeshLambertMaterial({
      color:             wallHex,
      emissive:          accentColor,
      emissiveIntensity: 0.14,
    });
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), wallMat);
    bldg.position.set(x, baseY, z);
    cityGroup.add(bldg);

    // Window grid — all 4 faces
    const litColor = [0xFFCC66, 0x88DDFF, 0xFFFFAA, 0xAAFFCC][Math.floor(rng() * 4)];
    const rowsW = Math.max(4, Math.floor(bH / 1.8));
    const colsX = Math.max(2, Math.floor(bD / 1.6)); // X-facing faces use bD as width
    const colsZ = Math.max(2, Math.floor(bW / 1.6)); // Z-facing faces use bW as width
    const EPS = 0.502;

    // +X face (DoubleSide — road-facing normal was inverted)
    const facePX = new THREE.Mesh(new THREE.PlaneGeometry(bD * 0.94, bH * 0.92),
      new THREE.MeshBasicMaterial({ map: makeWindowTex(colsX, rowsW, litColor, wallHex), side: THREE.DoubleSide }));
    facePX.position.set(x + bW * EPS, baseY, z);
    facePX.rotation.y = -Math.PI / 2;
    cityGroup.add(facePX);

    // -X face (DoubleSide — road-facing normal was inverted)
    const faceNX = new THREE.Mesh(new THREE.PlaneGeometry(bD * 0.94, bH * 0.92),
      new THREE.MeshBasicMaterial({ map: makeWindowTex(colsX, rowsW, litColor, wallHex), side: THREE.DoubleSide }));
    faceNX.position.set(x - bW * EPS, baseY, z);
    faceNX.rotation.y = Math.PI / 2;
    cityGroup.add(faceNX);

    // +Z face
    const facePZ = new THREE.Mesh(new THREE.PlaneGeometry(bW * 0.94, bH * 0.92),
      new THREE.MeshBasicMaterial({ map: makeWindowTex(colsZ, rowsW, litColor, wallHex) }));
    facePZ.position.set(x, baseY, z + bD * EPS);
    cityGroup.add(facePZ);

    // -Z face
    const faceNZ = new THREE.Mesh(new THREE.PlaneGeometry(bW * 0.94, bH * 0.92),
      new THREE.MeshBasicMaterial({ map: makeWindowTex(colsZ, rowsW, litColor, wallHex) }));
    faceNZ.position.set(x, baseY, z - bD * EPS);
    faceNZ.rotation.y = Math.PI;
    cityGroup.add(faceNZ);

    // Edge glow shell — BackSide slightly-larger box peeks around building edges
    const glowShell = new THREE.Mesh(
      new THREE.BoxGeometry(bW + 0.3, bH + 0.3, bD + 0.3),
      new THREE.MeshBasicMaterial({ color: accentColor, side: THREE.BackSide, transparent: true, opacity: 0.22, depthWrite: false })
    );
    glowShell.position.set(x, baseY, z);
    cityGroup.add(glowShell);

    // Rooftop accent strip (no per-building PointLight — kills performance)
    const roofY = baseY + bH * 0.5 + 0.18;
    const roofMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const roofBar = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.3, 0.35, bD + 0.3), roofMat);
    roofBar.position.set(x, roofY, z);
    cityGroup.add(roofBar);
  });

  // Helper: billboard frame (backing + neon edge bars + glow light)
  // Returns face position/rotation info; caller creates the face with correct texture
  function makeBBFrame(bx, by, bz, col, bW, bH) {
    const rotY = bx < 0 ? -0.22 : 0.22;
    const back = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x07070F }));
    back.position.set(bx, by, bz); back.rotation.y = rotY; cityGroup.add(back);
    const eM = new THREE.MeshBasicMaterial({ color: col });
    [by + bH * 0.5 + 0.1, by - bH * 0.5 - 0.1].forEach(ey => {
      const eb = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.3, 0.2, 0.46), eM);
      eb.position.set(bx, ey, bz); eb.rotation.y = rotY; cityGroup.add(eb);
    });
    const pl = new THREE.PointLight(col, 2.5, 26);
    pl.position.set(bx, by, bz); cityGroup.add(pl);
    // Offset face in the plane's normal direction (sin/cos of rotY) so it sits in front of the backing box
    const nd = 0.22;
    return { rotY, fx: bx + Math.sin(rotY) * nd, fy: by, fz: bz + Math.cos(rotY) * nd, fw: bW * 0.94, fh: bH * 0.92 };
  }

  function addBBFace(fi, tex) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(fi.fw, fi.fh),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    face.position.set(fi.fx, fi.fy, fi.fz);
    face.rotation.y = fi.rotY;
    cityGroup.add(face);
    return face;
  }

  // === Billboard 1: JUMP Logo (z=-45, hot pink, left side) ===
  {
    // Draw cream backing canvas first, then create face with it; update async when logo loads
    const lc = document.createElement("canvas"); lc.width = 512; lc.height = 268;
    const lctx = lc.getContext("2d");
    lctx.fillStyle = "#000000"; lctx.fillRect(0, 0, 512, 268);
    lctx.fillStyle = "#FF0066"; lctx.fillRect(0, 0, 512, 7); lctx.fillRect(0, 261, 512, 7);
    lctx.fillStyle = "#FF4488"; lctx.font = "bold 17px sans-serif"; lctx.textAlign = "center";
    lctx.fillText("THE ORIGINAL PLATFORM JUMPER", 256, 253);
    const logoTex = new THREE.CanvasTexture(lc);
    const fi1 = makeBBFrame(-14, 10.5, -45, 0xFF0066, 9.5, 5.2);
    addBBFace(fi1, logoTex);
    const logoImg = new Image();
    logoImg.onload = () => {
      lctx.fillStyle = "#000000"; lctx.fillRect(0, 7, 512, 248);
      const sc = Math.min(500 / logoImg.width, 222 / logoImg.height);
      lctx.drawImage(logoImg, (512 - logoImg.width * sc) / 2, 10 + (228 - logoImg.height * sc) / 2, logoImg.width * sc, logoImg.height * sc);
      logoTex.needsUpdate = true;
    };
    logoImg.src = "jump_logo2.png";
  }

  // === Billboard 2: CloudJump Shoes (z=-80, cyan, right side) ===
  {
    const sc = document.createElement("canvas"); sc.width = 512; sc.height = 268;
    const sctx = sc.getContext("2d");
    // Background
    const sg = sctx.createLinearGradient(0, 0, 0, 268);
    sg.addColorStop(0, "#010E14"); sg.addColorStop(1, "#020B10");
    sctx.fillStyle = sg; sctx.fillRect(0, 0, 512, 268);

    // Sneaker side-view (right half of canvas) — heel at left, toe at right
    const ox = 30, oy = 200; // origin of shoe
    // White rubber sole
    sctx.fillStyle = "#FFFFFF";
    sctx.beginPath(); sctx.moveTo(ox, oy); sctx.lineTo(ox + 200, oy);
    sctx.lineTo(ox + 210, oy - 14); sctx.lineTo(ox - 4, oy - 14); sctx.closePath(); sctx.fill();
    // Teal midsole stripe
    sctx.fillStyle = "#00DDBB";
    sctx.fillRect(ox, oy - 24, 205, 10);
    // Main upper body
    sctx.fillStyle = "#00BBAA";
    sctx.beginPath();
    sctx.moveTo(ox + 4, oy - 24);          // heel bottom
    sctx.lineTo(ox + 4, oy - 88);          // heel top
    sctx.lineTo(ox + 50, oy - 105);        // collar
    sctx.lineTo(ox + 120, oy - 88);        // midfoot top
    sctx.lineTo(ox + 195, oy - 50);        // toe top
    sctx.lineTo(ox + 210, oy - 24);        // toe bottom
    sctx.closePath(); sctx.fill();
    // Tongue tab
    sctx.fillStyle = "#00EEDD";
    sctx.beginPath();
    sctx.moveTo(ox + 52, oy - 88); sctx.lineTo(ox + 40, oy - 130);
    sctx.lineTo(ox + 95, oy - 140); sctx.lineTo(ox + 108, oy - 98);
    sctx.closePath(); sctx.fill();
    // Laces
    sctx.strokeStyle = "#FFFFFF"; sctx.lineWidth = 4;
    for (let li = 0; li < 4; li++) {
      const ly = oy - 94 + li * 15;
      sctx.beginPath(); sctx.moveTo(ox + 44, ly); sctx.lineTo(ox + 104, ly); sctx.stroke();
    }
    // Brand swoosh
    sctx.strokeStyle = "rgba(255,255,255,0.7)"; sctx.lineWidth = 6;
    sctx.beginPath();
    sctx.moveTo(ox + 20, oy - 40);
    sctx.quadraticCurveTo(ox + 100, oy - 22, ox + 185, oy - 36); sctx.stroke();
    // Toe cap highlight
    sctx.fillStyle = "rgba(0,255,220,0.35)";
    sctx.beginPath(); sctx.ellipse(ox + 185, oy - 42, 22, 14, -0.3, 0, Math.PI * 2); sctx.fill();

    // Text (right portion)
    sctx.textAlign = "center"; sctx.textBaseline = "alphabetic";
    const tcx = 370;
    sctx.fillStyle = "#00FFCC"; sctx.font = "bold 56px sans-serif"; sctx.fillText("Cloud", tcx, 90);
    sctx.fillStyle = "#FFFFFF"; sctx.font = "bold 56px sans-serif"; sctx.fillText("Jump", tcx, 148);
    sctx.fillStyle = "#00FFCC"; sctx.font = "22px monospace"; sctx.fillText("\u2122", tcx + 88, 100);
    sctx.strokeStyle = "#00FFCC"; sctx.lineWidth = 1.5;
    sctx.beginPath(); sctx.moveTo(260, 158); sctx.lineTo(490, 158); sctx.stroke();
    sctx.fillStyle = "#AAFFEE"; sctx.font = "bold 26px sans-serif"; sctx.fillText("SHOES", tcx, 192);
    sctx.fillStyle = "#44CCAA"; sctx.font = "italic 18px sans-serif"; sctx.fillText("Jump Higher. Look Cooler.", tcx, 226);
    sctx.fillStyle = "#226655"; sctx.font = "14px monospace"; sctx.fillText("cloudjump.net", tcx, 256);

    const fi2 = makeBBFrame(14, 12, -80, 0x00FFCC, 9.5, 5.2);
    addBBFace(fi2, new THREE.CanvasTexture(sc));
  }

  // === Billboard 3: Pixel Pizza (z=-115, orange, left side) ===
  {
    const pc = document.createElement("canvas"); pc.width = 512; pc.height = 268;
    const pctx = pc.getContext("2d");
    pctx.fillStyle = "#110600"; pctx.fillRect(0, 0, 512, 268);

    // Pizza top-down view (left side)
    const pcx = 140, pcy = 148, pr = 108;
    // Crust
    pctx.fillStyle = "#BB7733";
    pctx.beginPath(); pctx.arc(pcx, pcy, pr, 0, Math.PI * 2); pctx.fill();
    // Sauce
    pctx.fillStyle = "#CC3311";
    pctx.beginPath(); pctx.arc(pcx, pcy, pr * 0.84, 0, Math.PI * 2); pctx.fill();
    // Cheese
    pctx.fillStyle = "#FFCC44";
    pctx.beginPath(); pctx.arc(pcx, pcy, pr * 0.72, 0, Math.PI * 2); pctx.fill();
    // Pepperoni
    pctx.fillStyle = "#AA2200";
    [[0, 0], [0.38, -0.18], [-0.28, 0.30], [0.18, 0.42], [-0.22, -0.38], [0.40, 0.30], [-0.42, -0.10]].forEach(([dx, dy]) => {
      pctx.beginPath(); pctx.arc(pcx + dx * pr, pcy + dy * pr, pr * 0.10, 0, Math.PI * 2); pctx.fill();
      // Pepperoni shine
      pctx.fillStyle = "rgba(255,100,60,0.4)";
      pctx.beginPath(); pctx.arc(pcx + dx * pr - pr * 0.028, pcy + dy * pr - pr * 0.028, pr * 0.035, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = "#AA2200";
    });
    // Green bell pepper strips
    pctx.fillStyle = "#33AA22";
    [[0.20, 0.20], [-0.30, -0.12], [0.10, -0.38]].forEach(([dx, dy]) => {
      pctx.fillRect(pcx + dx * pr - 5, pcy + dy * pr - 14, 10, 28);
    });
    // Steam wisps
    pctx.strokeStyle = "rgba(255,210,160,0.45)"; pctx.lineWidth = 2.5;
    [-18, 0, 18].forEach(wx => {
      pctx.beginPath();
      pctx.moveTo(pcx + wx, pcy - pr - 4);
      pctx.quadraticCurveTo(pcx + wx + 9, pcy - pr - 18, pcx + wx - 2, pcy - pr - 32);
      pctx.stroke();
    });

    // Text (right side)
    pctx.textAlign = "center"; pctx.textBaseline = "alphabetic";
    const ptx = 358;
    pctx.fillStyle = "#FF6600"; pctx.font = "bold 68px sans-serif"; pctx.fillText("PIXEL", ptx, 85);
    pctx.fillStyle = "#FFAA22"; pctx.font = "bold 68px sans-serif"; pctx.fillText("PIZZA", ptx, 156);
    pctx.strokeStyle = "#FF6600"; pctx.lineWidth = 2;
    pctx.beginPath(); pctx.moveTo(228, 168); pctx.lineTo(492, 168); pctx.stroke();
    pctx.fillStyle = "#FFFFFF"; pctx.font = "bold 22px sans-serif"; pctx.fillText("Delivered by Drone", ptx, 200);
    pctx.fillStyle = "#FF8844"; pctx.font = "17px sans-serif"; pctx.fillText("Hot  |  Fresh  |  Airborne", ptx, 232);
    pctx.fillStyle = "#664422"; pctx.font = "14px monospace"; pctx.fillText("Order code: JUMP404", ptx, 260);

    const fi3 = makeBBFrame(-13, 11, -115, 0xFF6600, 10.5, 5.8);
    addBBFace(fi3, new THREE.CanvasTexture(pc));
  }

  // === Billboard 4: 404 PLATFORM NOT FOUND (z=-148, purple, right side) ===
  {
    const fc = document.createElement("canvas"); fc.width = 512; fc.height = 268;
    const fctx = fc.getContext("2d");
    fctx.fillStyle = "#04000C"; fctx.fillRect(0, 0, 512, 268);
    // Scanlines
    fctx.fillStyle = "rgba(80,0,120,0.18)";
    for (let sy = 0; sy < 268; sy += 4) { fctx.fillRect(0, sy, 512, 2); }
    // Top status bar
    fctx.fillStyle = "#5500AA"; fctx.fillRect(0, 0, 512, 30);
    fctx.fillStyle = "#DDBBFF"; fctx.font = "13px monospace"; fctx.textAlign = "left";
    fctx.fillText("  SYSTEM://CITY_NET/platform_registry.exe", 6, 20);
    fctx.textAlign = "right"; fctx.fillText("[ERR]  ", 512, 20);
    fctx.textAlign = "center";
    // Giant 404
    fctx.fillStyle = "#CC44FF"; fctx.font = "bold 108px monospace"; fctx.fillText("404", 256, 150);
    // Glitch offset duplicate
    fctx.fillStyle = "rgba(0,255,255,0.15)"; fctx.fillText("404", 259, 153);
    fctx.fillStyle = "rgba(255,0,100,0.12)"; fctx.fillText("404", 253, 147);
    // Error text
    fctx.fillStyle = "#FFFFFF"; fctx.font = "bold 26px monospace"; fctx.fillText("PLATFORM NOT FOUND", 256, 183);
    // Subline
    fctx.fillStyle = "#9933CC"; fctx.font = "15px monospace"; fctx.fillText("The platform has fallen off the edge.", 256, 218);
    // Blinking cursor block
    fctx.fillStyle = "#CC44FF"; fctx.fillRect(206, 234, 8, 18);
    fctx.fillStyle = "#778899"; fctx.font = "14px monospace"; fctx.fillText("Try jumping to a different platform.", 256, 248);
    // Bottom bar
    fctx.fillStyle = "#2A0044"; fctx.fillRect(0, 256, 512, 12);
    fctx.fillStyle = "#8833CC"; fctx.font = "11px monospace";
    fctx.fillText("JUMP_OS v3.14  |  Platforms Lost: 404  |  Uptime: Infinite", 256, 265);

    const fi4 = makeBBFrame(13, 13, -148, 0xCC00FF, 9.5, 5.2);
    addBBFace(fi4, new THREE.CanvasTexture(fc));
  }

  // Neon bar signs on buildings — each with a canvas shop sign face
  const bars = [
    { x:-12, y:2,  z:-25,  color:0xFF2244, hex:"#FF2244", textHex:"#FF6688", name:"PIXEL BAR",    tagline:"cocktails & code"    },
    { x: 12, y:3,  z:-68,  color:0x00FFAA, hex:"#00FFAA", textHex:"#00FFAA", name:"24HR ARCADE",  tagline:"insert coin to play" },
    { x:-11, y:4,  z:-102, color:0xFFAA00, hex:"#FFAA00", textHex:"#FFCC44", name:"BLOCK BURGER", tagline:"stacked to the sky"  },
    { x: 12, y:5,  z:-140, color:0x8800FF, hex:"#8800FF", textHex:"#BB55FF", name:"NEON NOODLES", tagline:"open all night"      },
  ];
  bars.forEach(({ x, y, z, color, hex, textHex, name, tagline }) => {
    // Horizontal top bar
    const bMat = new THREE.MeshBasicMaterial({ color });
    const barMesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.18, 0.18), bMat);
    barMesh.position.set(x, y, z);
    cityGroup.add(barMesh);
    // Vertical side legs
    const vMat = new THREE.MeshBasicMaterial({ color });
    const vLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), vMat);
    vLeft.position.set(x - 2.16, y - 0.69, z); cityGroup.add(vLeft);
    const vRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), vMat);
    vRight.position.set(x + 2.16, y - 0.69, z); cityGroup.add(vRight);
    // Glow light
    const pl = new THREE.PointLight(color, 0.9, 10);
    pl.position.set(x, y, z); cityGroup.add(pl);
    // Shop sign canvas — hangs between the legs, faces +Z toward approaching player
    const sc = document.createElement("canvas"); sc.width = 512; sc.height = 128;
    const ctx = sc.getContext("2d");
    ctx.fillStyle = "#060606"; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = textHex; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 508, 124);
    ctx.strokeStyle = hex + "55"; ctx.lineWidth = 1;
    ctx.strokeRect(7, 7, 498, 114);
    ctx.fillStyle = textHex; ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(name, 256, 74);
    ctx.fillStyle = "rgba(255,255,255,0.50)"; ctx.font = "17px monospace";
    ctx.fillText(tagline, 256, 106);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(4.1, 1.0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), side: THREE.DoubleSide })
    );
    face.position.set(x, y - 0.72, z + 0.12);
    cityGroup.add(face);
  });

  // Hovering drones (3)
  const droneConfigs = [
    { x:-6, y:14, z:-50,  bobAmp:0.6, bobSpeed:1.1, color:0x00FFDD },
    { x: 5, y:16, z:-100, bobAmp:0.8, bobSpeed:0.9, color:0xFF4400 },
    { x:-4, y:15, z:-145, bobAmp:0.5, bobSpeed:1.3, color:0xAA00FF },
  ];
  droneConfigs.forEach(({ x, y, z, bobAmp, bobSpeed, color }) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    cityGroup.add(grp);

    // Drone body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.8 });
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.8), bodyMat));

    // 4 arms + rotor discs
    const armMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.7 });
    const rotorMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
    [[-0.7,0.7],[-0.7,-0.7],[0.7,0.7],[0.7,-0.7]].forEach(([ax, az]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.12), armMat);
      arm.position.set(ax * 0.6, 0, az * 0.6); grp.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 8), rotorMat);
      rotor.position.set(ax * 0.6, 0.08, az * 0.6); grp.add(rotor);
    });

    // Underglow light
    const light = new THREE.PointLight(color, 1.0, 7);
    light.position.set(0, -0.4, 0); grp.add(light);

    droneData.push({ group: grp, baseY: y, bobAmp, bobSpeed, phase: rng() * Math.PI * 2 });
  });

  // ===== Street-level road =====
  const ROAD_Y    = -14.15;
  const ROAD_Z    =  -90;    // center of level length
  const ROAD_LEN  =  200;
  const ROAD_W    =   18;

  // Asphalt base
  const asphMat = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.98, metalness: 0.0 });
  const asphalt = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W, 0.28, ROAD_LEN), asphMat);
  asphalt.position.set(0, ROAD_Y, ROAD_Z);
  cityGroup.add(asphalt);

  // Road markings — canvas texture mapped onto a plane flush with asphalt top
  const mkCanvas = document.createElement("canvas");
  mkCanvas.width = 512; mkCanvas.height = 2048;
  const mkCtx = mkCanvas.getContext("2d");
  mkCtx.fillStyle = "#141418";
  mkCtx.fillRect(0, 0, 512, 2048);
  // Yellow double center line
  mkCtx.fillStyle = "#FFD600";
  mkCtx.fillRect(252, 0, 4, 2048);
  mkCtx.fillRect(256, 0, 4, 2048);
  // White dashed lane lines (outer lanes)
  mkCtx.fillStyle = "#DDDDDD";
  const dashH = 120, dashGap = 80;
  for (let dy = 0; dy < 2048; dy += dashH + dashGap) {
    mkCtx.fillRect(124, dy, 4, dashH); // left lane
    mkCtx.fillRect(384, dy, 4, dashH); // right lane
  }
  // Solid white edge lines
  mkCtx.fillStyle = "#CCCCCC";
  mkCtx.fillRect(20, 0, 3, 2048);
  mkCtx.fillRect(489, 0, 3, 2048);
  const mkTex = new THREE.CanvasTexture(mkCanvas);
  mkTex.wrapT = THREE.RepeatWrapping;
  mkTex.repeat.set(1, 1);
  const mkMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, ROAD_LEN),
    new THREE.MeshBasicMaterial({ map: mkTex, transparent: true, opacity: 0.9 })
  );
  mkMesh.rotation.x = -Math.PI / 2;
  mkMesh.position.set(0, ROAD_Y + 0.15, ROAD_Z);
  cityGroup.add(mkMesh);

  // Sidewalks — slightly raised concrete strips
  const swMat = new THREE.MeshStandardMaterial({ color: 0x252530, roughness: 0.92 });
  [-10.5, 10.5].forEach(sx => {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.42, ROAD_LEN), swMat);
    sw.position.set(sx, ROAD_Y + 0.08, ROAD_Z);
    cityGroup.add(sw);
  });

  // Street lights — both sides, every 28 units
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
  const lampColor = 0xFFEE88;

  // Shared ground pool texture — created once, reused per lamp
  const poolC = document.createElement("canvas"); poolC.width = poolC.height = 128;
  const pctx = poolC.getContext("2d");
  const poolGrad = pctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  poolGrad.addColorStop(0,   "rgba(255,238,136,0.50)");
  poolGrad.addColorStop(0.4, "rgba(255,238,136,0.18)");
  poolGrad.addColorStop(1,   "rgba(255,238,136,0.00)");
  pctx.fillStyle = poolGrad; pctx.fillRect(0, 0, 128, 128);
  const poolMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(poolC), transparent: true, depthWrite: false
  });

  for (let lz = -5; lz > -185; lz -= 28) {
    [-9, 9].forEach(lx => {
      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 8, 7), poleMat);
      pole.position.set(lx, ROAD_Y + 4.14, lz);
      cityGroup.add(pole);
      // Horizontal arm
      const armLen = 2.8;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, armLen, 6), poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(lx + (lx < 0 ? armLen * 0.5 : -armLen * 0.5), ROAD_Y + 8.1, lz);
      cityGroup.add(arm);
      // Globe
      const globeX = lx + (lx < 0 ? armLen : -armLen);
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshBasicMaterial({ color: lampColor })
      );
      globe.position.set(globeX, ROAD_Y + 8.1, lz);
      cityGroup.add(globe);
      // Point light
      const sl = new THREE.PointLight(lampColor, 0.7, 18);
      sl.position.copy(globe.position);
      cityGroup.add(sl);
      // Ground pool — soft radial disc directly beneath the globe
      const pool = new THREE.Mesh(new THREE.CircleGeometry(3.8, 20), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(globeX, ROAD_Y + 0.01, lz);
      cityGroup.add(pool);
    });
  }

  // ===== Cars =====
  const carColors = [0xFF2244, 0x4488FF, 0xFFCC00, 0x44FF88, 0xFF8800, 0xCC44FF, 0x00EEFF, 0xFF4400];
  const CAR_Y = ROAD_Y + 0.47; // sit on top of road

  function makeCitycar(startZ, laneX, dir, spd) {
    const bodyColor = carColors[Math.floor(rng() * carColors.length)];
    const grp = new THREE.Group();
    const bL = 3.6, bW = 1.85, bH = 0.62;

    // Body
    grp.add(new THREE.Mesh(
      new THREE.BoxGeometry(bW, bH, bL),
      new THREE.MeshLambertMaterial({ color: bodyColor })
    ));
    // Roof cab
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(bW * 0.72, bH * 0.72, bL * 0.52),
      new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    roof.position.y = bH * 0.86;
    grp.add(roof);
    // Windshields (dark glass)
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x112233, transparent: true, opacity: 0.75 });
    const wsFront = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.68, bH * 0.55, 0.08), glassMat);
    wsFront.position.set(0, bH * 0.82, -bL * 0.26 - 0.04);
    grp.add(wsFront);
    const wsRear = new THREE.Mesh(new THREE.BoxGeometry(bW * 0.68, bH * 0.55, 0.08), glassMat);
    wsRear.position.set(0, bH * 0.82, bL * 0.26 + 0.04);
    grp.add(wsRear);
    // Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xFFFFDD });
    [-0.6, 0.6].forEach(hx => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), hlMat);
      hl.position.set(hx, 0.05, -bL * 0.502);
      grp.add(hl);
    });
    // Taillights
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xFF1111 });
    [-0.6, 0.6].forEach(hx => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), tlMat);
      tl.position.set(hx, 0.05, bL * 0.502);
      grp.add(tl);
    });
    // Wheels (4)
    const whlMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [[-0.85, -bL * 0.32], [0.85, -bL * 0.32], [-0.85, bL * 0.32], [0.85, bL * 0.32]].forEach(([wx, wz]) => {
      const whl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.18, 10), whlMat);
      whl.rotation.z = Math.PI / 2;
      whl.position.set(wx, -bH * 0.38, wz);
      grp.add(whl);
    });

    // dir=-1 means heading toward -Z (same direction player goes)
    // dir=+1 means heading toward +Z (oncoming)
    if (dir > 0) grp.rotation.y = Math.PI;

    grp.position.set(laneX, CAR_Y, startZ);
    cityGroup.add(grp);
    carData.push({ group: grp, dir, speed: spd, wrapMin: -195, wrapMax: 10 });
  }

  // 5 cars per lane, evenly spaced and offset
  const LANE_L = -3.8; // heading -z (with player)
  const LANE_R =  3.8; // heading +z (oncoming)
  for (let i = 0; i < 5; i++) {
    makeCitycar(-i * 38 - 8,      LANE_L, -1, 14 + rng() * 8);
    makeCitycar(-190 + i * 38,    LANE_R,  1, 12 + rng() * 7);
  }

  // Rain — 180 vertical line streaks (LineSegments)
  const RAIN_COUNT = 180;
  const rainGeo = new THREE.BufferGeometry();
  const verts = new Float32Array(RAIN_COUNT * 6); // 2 points per streak, xyz each
  for (let i = 0; i < RAIN_COUNT; i++) {
    const rx = (rng() - 0.5) * 50;
    const ry = rng() * 60 - 5;
    const rz = rng() * -180;
    const len = 1.2 + rng() * 0.8;
    verts[i * 6 + 0] = rx;     verts[i * 6 + 1] = ry;       verts[i * 6 + 2] = rz;
    verts[i * 6 + 3] = rx;     verts[i * 6 + 4] = ry - len; verts[i * 6 + 5] = rz;
  }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  rainPositions = verts;
  const rainMat = new THREE.LineBasicMaterial({ color: 0x88BBFF, transparent: true, opacity: 0.32 });
  rainMesh = new THREE.LineSegments(rainGeo, rainMat);
  scene.add(rainMesh);
}

// ===== Level 7: Neon City Rooftops =====
function buildLevel7() {
  const NC = { dark: 0x0A0F1E, slate: 0x101828, grey: 0x181E2C, navy: 0x0A1A30, deep: 0x080C18 };

  // === Section 1: Entry rooftops ===
  boxPlatform({ x: 0,  y: 0,   z:   0, w:12, h:0.6, d:12, color: NC.slate });
  boxPlatform({ x: 0,  y: 0,   z: -14, w: 5, h:0.6, d: 4, color: NC.grey  });
  boxPlatform({ x: 0,  y: 2,   z: -23, w: 4, h:0.6, d: 4, color: NC.dark  });

  // === Section 2: Elevator shafts ===
  movingPlatform({ x: 0, y: 0, z: -32, w: 4, h:0.6, d: 4, axis:"y", amplitude: 3.5, speed: 1.1, color: NC.navy });
  boxPlatform({ x: 0,  y: 3.5, z: -43, w: 5, h:0.6, d: 4, color: NC.slate });
  cranePendulum({ x: 0, y: 14, z: -48, armLength: 6.5, speed: 2.0, amplitude: 0.95, ballRadius: 1.1, color: 0x00FFEE }); // cyan
  boxPlatform({ x: 0,  y: 3.5, z: -53, w: 3, h:0.6, d: 3, color: NC.dark  }); // narrow ledge
  movingPlatform({ x: 0, y: 3.5, z: -62, w: 4, h:0.6, d: 4, axis:"y", amplitude: 3.5, speed: 1.3, color: NC.navy });
  boxPlatform({ x: 0,  y: 0,   z: -73, w: 5, h:0.6, d: 5, color: NC.grey  });

  // === Section 3: Wind zone — narrow ledges + x-mover ===
  // Wind active between z=-82 and z=-116 (handled in updateCity)
  boxPlatform({ x: 0,  y: 1,   z: -83, w: 3, h:0.6, d: 3, color: NC.dark  }); // narrow
  boxPlatform({ x: 0,  y: 2,   z: -92, w: 3, h:0.6, d: 3, color: NC.navy  }); // narrow
  movingPlatform({ x: 0, y: 2, z:-101, w: 5, h:0.6, d: 4, axis:"x", amplitude: 4.0, speed: 1.4, color: NC.slate });
  boxPlatform({ x: 0,  y: 2,   z:-111, w: 4, h:0.6, d: 4, color: NC.dark  });

  // === Section 4: High-rise scramble + crane ===
  cranePendulum({ x: 0, y: 16, z:-118, armLength: 7.5, speed: 2.2, amplitude: 1.05, ballRadius: 1.2, color: 0xFF00CC }); // magenta
  movingPlatform({ x: 0, y: 2, z:-121, w: 4, h:0.6, d: 4, axis:"y", amplitude: 4.0, speed: 1.5, color: NC.navy });
  boxPlatform({ x: 0,  y: 6,   z:-133, w: 5, h:0.6, d: 5, color: NC.grey  });
  movingPlatform({ x: 0, y: 6, z:-143, w: 5, h:0.6, d: 4, axis:"x", amplitude: 3.5, speed: 1.2, color: NC.slate });
  boxPlatform({ x: 0,  y: 5,   z:-153, w: 5, h:0.6, d: 5, color: NC.dark  });

  // === Section 5: Final sprint ===
  boxPlatform({ x: 0,  y: 5,   z:-162, w: 3, h:0.6, d: 3, color: NC.navy  }); // narrow
  boxPlatform({ x: 0,  y: 6,   z:-172, w: 8, h:0.6, d: 8, color: NC.slate }); // finale

  levelEndZ = -172;
  spawnRing(0, 8.0, -172);
}

// ===== Ice background (Level 8) =====
function buildIceBackground() {
  iceGroup = new THREE.Group();
  scene.add(iceGroup);

  // Seeded LCG for deterministic placement
  let _s = 8888;
  function rng() { _s = (_s * 1664525 + 1013904223) & 0xFFFFFFFF; return (_s >>> 0) / 0xFFFFFFFF; }

  // Aurora — canvas texture with RepeatWrapping so UV scroll works in updateIce
  auroraMats = [];
  function addAurora(y, z, w, h, rStr, gStr, bStr, opacity, speed) {
    const ac = document.createElement("canvas"); ac.width = 512; ac.height = 64;
    const actx = ac.getContext("2d");
    const ag = actx.createLinearGradient(0, 0, 0, 64);
    ag.addColorStop(0,   "rgba(" + rStr + "," + gStr + "," + bStr + ",0.0)");
    ag.addColorStop(0.3, "rgba(" + rStr + "," + gStr + "," + bStr + "," + opacity + ")");
    ag.addColorStop(0.7, "rgba(" + rStr + "," + gStr + "," + bStr + "," + opacity + ")");
    ag.addColorStop(1,   "rgba(" + rStr + "," + gStr + "," + bStr + ",0.0)");
    actx.fillStyle = ag;
    actx.fillRect(0, 0, 512, 64);
    actx.strokeStyle = "rgba(255,255,255,0.06)";
    actx.lineWidth   = 2;
    for (let i = 0; i < 6; i++) {
      const sx = rng() * 512;
      actx.beginPath(); actx.moveTo(sx, 0); actx.lineTo(sx + 20, 64); actx.stroke();
    }
    const tex = new THREE.CanvasTexture(ac);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    plane.position.set(0, y, z);
    plane.rotation.x = -0.08;
    iceGroup.add(plane);
    auroraMats.push({ mat, speed });
  }
  addAurora(62, -110, 180, 8,  "60",  "210", "160", 0.30, 0.018);
  addAurora(66, -118, 160, 6,  "150", "110", "220", 0.22, 0.012);
  addAurora(70, -130, 140, 5,  "40",  "190", "230", 0.18, 0.022);

  // Background atmosphere plane — fills void behind far mountains
  {
    const bc = document.createElement("canvas"); bc.width = 256; bc.height = 64;
    const bctx = bc.getContext("2d");
    const bg = bctx.createLinearGradient(0, 0, 0, 64);
    bg.addColorStop(0,   "rgba(185,220,240,0.0)");
    bg.addColorStop(0.4, "rgba(200,232,248,0.55)");
    bg.addColorStop(1,   "rgba(218,240,252,0.0)");
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, 256, 64);
    const atmoPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 120),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(bc), transparent: true,
        depthWrite: false, fog: false, side: THREE.DoubleSide
      })
    );
    atmoPlane.position.set(0, 22, -185);
    iceGroup.add(atmoPlane);
  }

  // Mountains — 3 depth tiers + compound shoulder peaks for asymmetry
  const nearMts = [
    { x:  -42, z:  -88, h: 32, rb: 14, segs: 7, color: 0x6aa8bc },
    { x:   58, z:  -92, h: 26, rb: 12, segs: 6, color: 0x72afc0 },
    { x:  -88, z: -100, h: 36, rb: 16, segs: 8, color: 0x6daabc },
    { x:   85, z:  -96, h: 22, rb: 10, segs: 5, color: 0x75b2c2 },
    { x:   40, z: -107, h: 24, rb: 11, segs: 7, color: 0x70aebe },
  ];
  const midMts = [
    { x:  -90, z: -120, h: 62, rb: 30, segs: 7, color: 0x9ebacc },
    { x:  102, z: -116, h: 54, rb: 27, segs: 8, color: 0x9bb8ca },
    { x: -122, z: -133, h: 60, rb: 28, segs: 6, color: 0x97b5c8 },
    { x:  122, z: -128, h: 52, rb: 25, segs: 7, color: 0x9ab7c9 },
    { x:  -54, z: -114, h: 44, rb: 21, segs: 8, color: 0xa4c1d0 },
    { x:   66, z: -118, h: 48, rb: 23, segs: 6, color: 0xa2bfce },
    { x: -148, z: -124, h: 46, rb: 22, segs: 7, color: 0x9fb8c8 },
    { x:  150, z: -122, h: 42, rb: 20, segs: 6, color: 0xa1bac9 },
  ];
  // Secondary/shoulder peaks offset from 3 large mid mountains — breaks symmetry
  const shoulderMts = [
    { x:  -72, z: -116, h: 34, rb: 15, segs: 6, color: 0xa6c2d2 },
    { x:   86, z: -122, h: 28, rb: 13, segs: 7, color: 0xa8c4d3 },
    { x: -104, z: -128, h: 30, rb: 14, segs: 6, color: 0xa5c1d1 },
  ];
  const farMts = [
    { x:  -35, z: -153, h: 38, rb: 17, segs: 6, color: 0xbad0dd },
    { x:   45, z: -157, h: 34, rb: 15, segs: 7, color: 0xb8cedb },
    { x:  -30, z: -178, h: 46, rb: 19, segs: 8, color: 0xb5ccda },
    { x:  -92, z: -154, h: 30, rb: 14, segs: 5, color: 0xbdd2de },
    { x:   94, z: -151, h: 28, rb: 13, segs: 6, color: 0xbfd3df },
    { x:  -55, z: -164, h: 20, rb: 10, segs: 5, color: 0xc2d5e1 },
    { x:   58, z: -167, h: 18, rb:  9, segs: 6, color: 0xc4d6e2 },
  ];

  function buildMountainMesh(mt) {
    const segs     = mt.segs || 7;
    const h        = mt.h;
    const rb       = mt.rb;
    const numRings = 7;   // apex ring[0] + rings[1..6]
    const numBands = numRings - 1;
    const bandH    = h / numBands;

    // Build ring vertex positions in local space (apex = +h/2, base = -h/2)
    const rings = [];
    rings.push([{ x: 0, y: h * 0.5, z: 0 }]); // apex — single point, no jitter
    for (let i = 1; i < numRings; i++) {
      const baseY = h * 0.5 - (i / (numRings - 1)) * h;
      const baseR = rb * (i / (numRings - 1));
      const ring  = [];
      for (let j = 0; j < segs; j++) {
        const angle = (j / segs) * Math.PI * 2;
        const rJit  = baseR * (1.0 + (rng() - 0.5) * 0.20);
        const yJit  = baseY + (rng() - 0.5) * 0.16 * bandH;
        ring.push({ x: Math.cos(angle) * rJit, y: yJit, z: Math.sin(angle) * rJit });
      }
      rings.push(ring);
    }

    // totalTris: segs apex triangles + (numBands-1)*segs*2 lateral quad triangles
    const totalTris = segs + (numBands - 1) * segs * 2;
    const posArr    = new Float32Array(totalTris * 9); // 3 verts * xyz
    const colArr    = new Float32Array(totalTris * 9); // 3 verts * rgb

    const snowR = 0xee / 255, snowG = 0xf8 / 255, snowB = 0xff / 255;
    const rockC = new THREE.Color(mt.color);
    const snowLine = 0.0;

    let tri = 0;
    function pushTri(a, b, c) {
      const snow = (a.y + b.y + c.y) / 3 > snowLine;
      const cr = snow ? snowR : rockC.r;
      const cg = snow ? snowG : rockC.g;
      const cb = snow ? snowB : rockC.b;
      const base = tri * 9;
      posArr[base+0]=a.x; posArr[base+1]=a.y; posArr[base+2]=a.z;
      posArr[base+3]=b.x; posArr[base+4]=b.y; posArr[base+5]=b.z;
      posArr[base+6]=c.x; posArr[base+7]=c.y; posArr[base+8]=c.z;
      colArr[base+0]=cr; colArr[base+1]=cg; colArr[base+2]=cb;
      colArr[base+3]=cr; colArr[base+4]=cg; colArr[base+5]=cb;
      colArr[base+6]=cr; colArr[base+7]=cg; colArr[base+8]=cb;
      tri++;
    }

    // Apex triangles
    const apex = rings[0][0];
    for (let j = 0; j < segs; j++) {
      pushTri(apex, rings[1][j], rings[1][(j + 1) % segs]);
    }
    // Lateral band quads (ring i to ring i+1)
    for (let i = 1; i < numRings - 1; i++) {
      for (let j = 0; j < segs; j++) {
        const j1 = (j + 1) % segs;
        pushTri(rings[i][j], rings[i][j1],   rings[i+1][j1]);
        pushTri(rings[i][j], rings[i+1][j1], rings[i+1][j]);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute("color",    new THREE.BufferAttribute(colArr, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true,
      roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide
    }));
  }

  function addMountainTier(defs) {
    for (const mt of defs) {
      const bodyCenter = mt.h * 0.5 - 12;
      const mesh = buildMountainMesh(mt);
      mesh.position.set(mt.x, bodyCenter, mt.z);
      iceGroup.add(mesh);
      // Bright apex tip — small cone offset just above main mesh apex
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(mt.rb * 0.06, mt.h * 0.06, mt.segs || 7),
        new THREE.MeshStandardMaterial({ color: 0xf8ffff, roughness: 0.75, metalness: 0.0, flatShading: true })
      );
      tip.position.set(mt.x, bodyCenter + mt.h * 0.51, mt.z);
      iceGroup.add(tip);
    }
  }
  // Render far first so near tiers occlude correctly
  addMountainTier(farMts);
  addMountainTier(shoulderMts);
  addMountainTier(midMts);
  addMountainTier(nearMts);

  // Environmental shards — clustered near mountain bases (not center path)
  const shardColors = [0xbfefff, 0x9fe7ff, 0xdfffff, 0x88dfff];
  const shardClusters = [
    { cx: -42, cy: -9, cz:  -89, count: 5 },
    { cx:  57, cy: -9, cz:  -93, count: 4 },
    { cx: -87, cy: -9, cz: -101, count: 5 },
    { cx:  84, cy: -9, cz:  -97, count: 3 },
    { cx: -88, cy: -9, cz: -121, count: 6 },
    { cx: 100, cy: -9, cz: -117, count: 5 },
    { cx: -52, cy: -9, cz: -115, count: 4 },
    { cx:  65, cy: -9, cz: -119, count: 4 },
  ];
  for (const cl of shardClusters) {
    for (let i = 0; i < cl.count; i++) {
      const col  = shardColors[Math.floor(rng() * shardColors.length)];
      const size = 0.5 + rng() * 0.8;
      const ox   = (rng() - 0.5) * 6;
      const oy   = rng() * 2;
      const oz   = (rng() - 0.5) * 6;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({
          color: col, emissive: 0x66dfff, emissiveIntensity: 0.12,
          roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.82
        })
      );
      shard.position.set(cl.cx + ox, cl.cy + oy, cl.cz + oz);
      shard.rotation.set(rng(), rng() * Math.PI, rng());
      iceGroup.add(shard);
      shard.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(size, 0)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
      ));
    }
  }

  // Ambient cold lights — near mountain clusters
  [
    { x:  -42, y: 14, z:  -90, col: 0xbfefff, intensity: 0.20, dist:  95 },
    { x:   57, y: 12, z:  -93, col: 0xcdefff, intensity: 0.16, dist:  90 },
    { x:  -88, y: 16, z: -121, col: 0xaee8ff, intensity: 0.20, dist: 100 },
    { x:  100, y: 14, z: -117, col: 0xb8f0ff, intensity: 0.16, dist:  90 },
  ].forEach(({ x, y, z, col, intensity, dist }) => {
    const gl = new THREE.PointLight(col, intensity, dist);
    gl.position.set(x, y, z);
    iceGroup.add(gl);
  });

  // Snow particle system
  snowData = [];
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowData.push({
      x:     (rng() - 0.5) * 200,
      y:     rng() * 80,
      z:     -rng() * 200,
      speed: 2.2 + rng() * 2.0,
      drift: (rng() - 0.5) * 0.5,
      phase: rng() * Math.PI * 2,
    });
  }
  const snowSphereGeo = new THREE.SphereGeometry(0.08, 5, 4);
  const snowSphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, fog: true });
  snowMesh = new THREE.InstancedMesh(snowSphereGeo, snowSphereMat, SNOW_COUNT);
  snowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowDummy.position.set(snowData[i].x, snowData[i].y, snowData[i].z);
    snowDummy.updateMatrix();
    snowMesh.setMatrixAt(i, snowDummy.matrix);
  }
  snowMesh.instanceMatrix.needsUpdate = true;
  scene.add(snowMesh);

  // ── Rolling cloud sea — layered textured planes with vertex displacement ──
  // Mountain bases at y=-12, platforms at y=0..7.
  // 3 cloud layers at y=-6/-9/-11 create rolling cloud banks mountains emerge through.
  function makeRollingCloud(cfg) {
    const { blobCount, blobMaxR, colorHex, opacity, yPos, size, segs, waveAmp, seed, repeatS } = cfg;
    let _cs = seed;
    function cr() { _cs = (_cs * 16807) % 2147483647; return (_cs - 1) / 2147483646; }

    const cc = document.createElement("canvas"); cc.width = 512; cc.height = 512;
    const cctx = cc.getContext("2d");
    for (let i = 0; i < blobCount; i++) {
      const bx = cr() * 512, by = cr() * 512;
      const br = (blobMaxR * 0.35) + cr() * (blobMaxR * 0.65);
      const grad = cctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0,   "rgba(255,255,255,0.6)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.3)");
      grad.addColorStop(1,   "rgba(255,255,255,0)");
      cctx.fillStyle = grad;
      cctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    const tex = new THREE.CanvasTexture(cc);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatS, repeatS);

    const mat = new THREE.MeshBasicMaterial({
      map: tex, color: colorHex, transparent: true, opacity,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });

    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), ly = pos.getY(i);
      const d = Math.sin(lx * 0.014 + seed * 2.7) * Math.cos(ly * 0.011 + seed * 1.3) * waveAmp
              + Math.sin(lx * 0.027 + ly * 0.019 + seed * 4.1) * waveAmp * 0.35
              + (cr() - 0.5) * waveAmp * 0.12;
      pos.setZ(i, d);
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, yPos, -90);
    mesh.renderOrder = 1;
    iceGroup.add(mesh);
    return { mesh, mat };
  }

  // Top layers raised closer to platform level (y=0) so they're visible from the
  // forward chase camera at y=6.  Gaps between platforms reveal the cloud bank.
  const fog1 = makeRollingCloud({ blobCount: 40, blobMaxR: 160, colorHex: 0xe6f4ff,
    opacity: 0.25, yPos: -3,  size: 900, segs: 40, waveAmp: 2.5, seed: 7717, repeatS: 3 });
  const fog2 = makeRollingCloud({ blobCount: 55, blobMaxR: 130, colorHex: 0xd9efff,
    opacity: 0.20, yPos: -6,  size: 950, segs: 36, waveAmp: 2.0, seed: 3391, repeatS: 4 });
  const fog3 = makeRollingCloud({ blobCount: 70, blobMaxR: 100, colorHex: 0xcbe7ff,
    opacity: 0.14, yPos: -9,  size: 1000, segs: 32, waveAmp: 1.5, seed: 5503, repeatS: 5 });
  // Deep layers — fill the void below the main cloud bank
  const fog4 = makeRollingCloud({ blobCount: 50, blobMaxR: 140, colorHex: 0xc4dff0,
    opacity: 0.10, yPos: -14, size: 1100, segs: 28, waveAmp: 1.2, seed: 4219, repeatS: 4 });
  const fog5 = makeRollingCloud({ blobCount: 60, blobMaxR: 110, colorHex: 0xbdd8eb,
    opacity: 0.07, yPos: -20, size: 1200, segs: 24, waveAmp: 1.0, seed: 6637, repeatS: 5 });

  iceFogLayers = [
    { ...fog1, baseX: 0, baseZ: -90, oscSpeed: 0.08, uvSpeed: 0.003 },
    { ...fog2, baseX: 0, baseZ: -90, oscSpeed: 0.05, uvSpeed: 0.002 },
    { ...fog3, baseX: 0, baseZ: -90, oscSpeed: 0.03, uvSpeed: 0.0012 },
    { ...fog4, baseX: 0, baseZ: -90, oscSpeed: 0.022, uvSpeed: 0.0008 },
    { ...fog5, baseX: 0, baseZ: -90, oscSpeed: 0.015, uvSpeed: 0.0005 },
  ];
}

// ===== Ice crystal cluster spawner (Level 8 only) =====
function spawnCrystalCluster(cx, cy, cz, count, spread) {
  const group = new THREE.Group();

  const matBody = new THREE.MeshStandardMaterial({
    color: 0xbfefff, emissive: 0x66dfff, emissiveIntensity: 0.12,
    roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.88
  });
  const matTip = new THREE.MeshStandardMaterial({
    color: 0xe8fbff, emissive: 0xaeefff, emissiveIntensity: 0.08,
    roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.92
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });

  for (let i = 0; i < count; i++) {
    const angle  = (i / count) * Math.PI * 2 + i * 0.41;
    const r      = i === 0 ? 0 : spread * (0.4 + Math.random() * 0.7);
    const height = i === 0 ? 4.8 + Math.random() * 1.2 : 2.0 + Math.random() * 2.4;
    const baseR  = i === 0 ? 0.20 + Math.random() * 0.08 : 0.08 + Math.random() * 0.07;

    const geo   = new THREE.CylinderGeometry(baseR * 0.03, baseR, height, 6);
    const spike = new THREE.Mesh(geo, matBody);
    spike.position.set(Math.cos(angle) * r, height * 0.5, Math.sin(angle) * r);
    spike.rotation.y = Math.random() * Math.PI;
    spike.rotation.z = (Math.random() - 0.5) * 0.28;
    spike.rotation.x = (Math.random() - 0.5) * 0.18;

    const tipH   = height * 0.28;
    const tipGeo = new THREE.CylinderGeometry(baseR * 0.02, baseR * 0.36, tipH, 6);
    const tip    = new THREE.Mesh(tipGeo, matTip);
    tip.position.y = height * 0.5 - tipH * 0.5;
    spike.add(tip);

    spike.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    group.add(spike);
  }

  group.position.set(cx, cy, cz);
  scene.add(group);
  decorations.push(group);
}

// ===== Level 8 — Frozen Sky Peaks =====
function buildLevel8() {
  const IC = {
    white:   0xE6FBFF,   // near-white frost
    pale:    0xD0F5FF,   // pale ice
    crystal: 0xB8ECFF,   // soft crystal blue
    deep:    0x9DDDFF,   // medium ice
    teal:    0x88E0F0,   // cool teal
  };

  // ── Section 1: Entry ──
  icePlatform({ x: 0,  y: 0, z:  0,   w:12, d: 8,   color: IC.white,   icy: false });  // safe start
  icePlatform({ x: 0,  y: 0, z: -13,  w: 5, d: 4,   color: IC.pale  });
  icePlatform({ x: 0,  y: 1, z: -22,  w: 4, d: 4,   color: IC.crystal });

  // ── Section 2: Fork approach (wide, stable) ──
  icePlatform({ x: 0,  y: 2, z: -32,  w:12, d: 5,   color: IC.white, icy: false });

  // ── PATH A — LEFT: Glacier slabs route ──
  icePlatform({ x:-7,  y: 2, z: -43,  w: 4, d: 4,   color: IC.deep });
  iceMovingPlatform({ x:-8, y:2, z:-54, w:4, h:0.6, d:3.5, axis:"x", amplitude:3.0, speed:1.1, phase:0,          color: IC.teal });
  icePlatform({ x:-8,  y: 2, z: -65,  w: 4, d: 4,   color: IC.pale,    collapse: true, collapseDelay: 1.4 });
  iceMovingPlatform({ x:-7, y:3, z:-76, w:4.5, h:0.6, d:3, axis:"x", amplitude:2.5, speed:1.0, phase:1.2,       color: IC.deep });
  icePlatform({ x:-5,  y: 3, z: -87,  w: 4, d: 4,   color: IC.crystal });

  // ── PATH B — RIGHT: Slippery ledges + icicle pendulum ──
  icePlatform({ x: 7,  y: 2, z: -43,  w: 4, d: 4,   color: IC.pale });
  icePlatform({ x: 9,  y: 3, z: -54,  w: 3, d: 3,   color: IC.crystal });           // narrow & slippery
  iciclePendulum({ x: 6, y: 15, z: -60, armLength: 9, speed: 2.0, amplitude: 0.88, color: 0x88CCFF });
  icePlatform({ x: 7,  y: 3, z: -65,  w: 4, d: 4,   color: IC.deep });
  iceMovingPlatform({ x: 8, y:3, z:-76, w:4, h:0.6, d:3,  axis:"z", amplitude:2.0, speed:1.3, phase:0.6,        color: IC.teal });
  icePlatform({ x: 5,  y: 3, z: -87,  w: 4, d: 4,   color: IC.crystal });

  // ── Section 4: Merge (breather) ──
  icePlatform({ x: 0,  y: 3, z: -96,  w:10, d: 6,   color: IC.white, icy: false });

  // ── Section 5: Combined challenge ──
  icePlatform({ x: 0,  y: 4, z:-108,  w: 4, d: 4,   color: IC.pale,    collapse: true, collapseDelay: 1.2 });
  iceMovingPlatform({ x: 0, y:4, z:-118, w:5, h:0.6, d:4,  axis:"x", amplitude:4.0, speed:1.4, phase:0,         color: IC.teal });
  icePlatform({ x: 0,  y: 5, z:-127,  w: 4, d: 4,   color: IC.crystal });
  iciclePendulum({ x: 0, y: 16, z:-133, armLength: 10, speed: 2.2, amplitude: 0.90, color: 0x44AADD });
  icePlatform({ x: 0,  y: 5, z:-138,  w: 3, d: 3,   color: IC.deep });              // narrow after pendulum
  icePlatform({ x: 0,  y: 6, z:-148,  w:4.5,d: 4,   color: IC.pale,    collapse: true, collapseDelay: 1.0 });
  iceMovingPlatform({ x: 0, y:6, z:-158, w:5, h:0.6, d:4,  axis:"x", amplitude:3.5, speed:1.5, phase:0.4,       color: IC.deep });

  // ── Section 6: Finish ──
  icePlatform({ x: 0,  y: 7, z:-167,  w:10, d: 8,   color: IC.white, icy: false });

  // ── Ice crystal clusters ──
  // A. Wide scenic formations — emerge from the cloud ocean below platform level (y=-9)
  spawnCrystalCluster(-26, -9,  -18, 7, 1.9);
  spawnCrystalCluster( 24, -9,  -28, 6, 1.7);
  spawnCrystalCluster(-30, -9,  -55, 8, 2.1);
  spawnCrystalCluster( 28, -9,  -80, 7, 2.0);
  spawnCrystalCluster(-28, -9, -120, 8, 2.2);
  spawnCrystalCluster( 26, -9, -145, 7, 1.8);

  // B. Entry atmosphere — flanks the start platform
  spawnCrystalCluster(-7,  0.3,  -3, 4, 1.0);
  spawnCrystalCluster( 7,  0.3,  -5, 3, 0.8);

  // C. Landmark clusters at narrative moments
  // Fork (z=-32 wide platform)
  spawnCrystalCluster(-7, 2.3, -30, 5, 1.1);
  spawnCrystalCluster( 7, 2.3, -30, 5, 1.1);
  // Merge (z=-96 wide platform)
  spawnCrystalCluster(-6, 3.3, -94, 5, 1.1);
  spawnCrystalCluster( 6, 3.3, -94, 5, 1.1);
  // Finish (z=-167)
  spawnCrystalCluster(-6, 7.3, -163, 5, 1.1);
  spawnCrystalCluster( 6, 7.3, -163, 5, 1.1);
  spawnCrystalCluster( 0, 7.3, -172, 3, 0.8);

  // D. On-platform hazard spikes — danger zones on wide breather platforms
  spawnCrystalCluster(-4,   2.3, -31, 2, 0.34);
  spawnCrystalCluster( 4,   2.3, -31, 2, 0.34);
  spawnCrystalCluster(-3.5, 3.3, -95, 2, 0.32);
  spawnCrystalCluster( 3.5, 3.3, -95, 2, 0.32);

  // ── Environmental fill lights — near mountain clusters ──
  const envLight1 = new THREE.PointLight(0x88dfff, 0.28, 55);
  envLight1.position.set(-18, 12, -60);
  scene.add(envLight1);
  decorations.push(envLight1);

  const envLight2 = new THREE.PointLight(0x66ccff, 0.22, 55);
  envLight2.position.set(20, 14, -130);
  scene.add(envLight2);
  decorations.push(envLight2);

  levelEndZ = -167;
  spawnRing(0, 9.0, -167);
}

// ===== Level 9: Storm Realm =====
function buildLevel9() {
  const SC = {
    steel:   0x1a2030,
    iron:    0x222d3d,
    charged: 0x1a2844,
    bright:  0x2a3a50,
    dark:    0x111827,
  };

  // ── SECTION 1: Storm Entry (z=0 to z=-58) — gentle introduction ──
  stormPlatform({ x: 0,  y: 0,   z: 0,    w: 12, d: 8,  color: SC.bright, platType: "standard" }); // spawn
  stormPlatform({ x: 0,  y: 0.3, z: -12,  w: 6,  d: 5,  color: SC.steel,  platType: "standard" });
  stormPlatform({ x: -3, y: 0.6, z: -20,  w: 5,  d: 4,  color: SC.iron,   platType: "standard" }); // left offset
  stormPlatform({ x: 3,  y: 1.0, z: -28,  w: 5,  d: 4,  color: SC.steel,  platType: "standard" }); // right offset
  rampPlatform({ x: 0,  y: 1.5, z: -36,  w: 6,  d: 8,  angleDeg: -15, color: SC.bright });          // ramp up (negative = upward in -z)
  stormPlatform({ x: 0,  y: 2.5, z: -44,  w: 6,  d: 4,  color: SC.iron,   platType: "standard" }); // post-ramp
  stormPlatform({ x: 3,  y: 2.8, z: -50,  w: 4,  d: 4,  color: SC.charged, platType: "electric" }); // electric preview
  stormPlatform({ x: -3, y: 2.8, z: -50,  w: 4,  d: 4,  color: SC.steel,  platType: "standard" }); // safe alternative
  stormPlatform({ x: 0,  y: 3.0, z: -58,  w: 10, d: 6,  color: SC.bright, platType: "standard" }); // breather

  // ── SECTION 2: Wind Corridor (z=-58 to z=-126) — zig-zag wind jumps ──
  stormPlatform({ x: -5, y: 3.3, z: -68,  w: 4,  d: 4,  color: SC.iron,   platType: "standard" });
  stormPlatform({ x: 5,  y: 3.6, z: -76,  w: 4,  d: 4,  color: SC.steel,  platType: "standard" });
  stormPlatform({ x: -5, y: 3.8, z: -84,  w: 4,  d: 3.5, color: SC.iron,   platType: "standard" });
  stormPlatform({ x: 0,  y: 4.0, z: -90,  w: 3.5, d: 3,  color: SC.steel,  platType: "standard" }); // center rest
  stormPlatform({ x: 5,  y: 4.2, z: -96,  w: 4,  d: 3.5, color: SC.iron,   platType: "standard" });
  stormPlatform({ x: -5, y: 4.4, z: -102, w: 4,  d: 3.5, color: SC.steel,  platType: "standard" });
  stormPlatform({ x: 2,  y: 4.6, z: -108, w: 3.5, d: 3,  color: SC.iron,   platType: "standard" });
  stormPlatform({ x: 7,  y: 4.8, z: -113, w: 3.5, d: 3,  color: SC.charged, platType: "electric" }); // edge electric
  stormPlatform({ x: -2, y: 5.0, z: -118, w: 4,  d: 4,  color: SC.steel,  platType: "standard" });
  stormPlatform({ x: 0,  y: 5.2, z: -126, w: 10, d: 6,  color: SC.bright, platType: "standard" }); // breather

  // ── SECTION 3: Lightning Field (z=-126 to z=-188) — electric risk/reward + Lightning Run ──
  stormPlatform({ x: -4, y: 5.5, z: -136, w: 5,  d: 4,  color: SC.steel,  platType: "standard" }); // safe entry left
  stormPlatform({ x: 5,  y: 5.5, z: -136, w: 4,  d: 4,  color: SC.charged, platType: "electric" }); // risky shortcut
  stormPlatform({ x: -5, y: 5.8, z: -146, w: 4,  d: 4,  color: SC.iron,   platType: "standard" }); // safe step
  stormPlatform({ x: 4,  y: 5.8, z: -144, w: 3.5, d: 3.5, color: SC.charged, platType: "electric" }); // risk/reward
  stormPlatform({ x: 0,  y: 6.0, z: -154, w: 6,  d: 4,  color: SC.bright, platType: "standard" }); // merge
  stormPlatform({ x: 0,  y: 6.2, z: -162, w: 4,  d: 4,  color: SC.charged, platType: "electric" }); // Lightning Run 1/3
  stormPlatform({ x: 0,  y: 6.4, z: -170, w: 4,  d: 3.5, color: SC.charged, platType: "electric" }); // Lightning Run 2/3
  stormPlatform({ x: 0,  y: 6.6, z: -178, w: 4,  d: 3.5, color: SC.charged, platType: "electric" }); // Lightning Run 3/3
  stormPlatform({ x: -5, y: 6.5, z: -175, w: 3.5, d: 3,  color: SC.steel,  platType: "standard" }); // side escape L
  stormPlatform({ x: 5,  y: 6.7, z: -182, w: 3.5, d: 3,  color: SC.steel,  platType: "standard" }); // side escape R
  stormPlatform({ x: 0,  y: 6.8, z: -188, w: 10, d: 6,  color: SC.bright, platType: "standard" }); // breather

  // ── SECTION 4: Disappearing Platform Grid (z=-188 to z=-244) — phase timing ──
  // Row 1
  stormPlatform({ x: -5, y: 7.0, z: -198, w: 4,  d: 4,  color: SC.charged, platType: "phase" });
  stormPlatform({ x: 0,  y: 7.0, z: -198, w: 4,  d: 4,  color: SC.charged, platType: "phase" });
  stormPlatform({ x: 5,  y: 7.0, z: -198, w: 4,  d: 4,  color: SC.charged, platType: "phase" });
  // Safe rest
  stormPlatform({ x: 0,  y: 7.3, z: -208, w: 5,  d: 4,  color: SC.bright, platType: "standard" });
  // Row 2
  stormPlatform({ x: -6, y: 7.5, z: -216, w: 3.5, d: 3.5, color: SC.charged, platType: "phase" });
  stormPlatform({ x: 3,  y: 7.5, z: -216, w: 3.5, d: 3.5, color: SC.charged, platType: "phase" });
  stormPlatform({ x: 8,  y: 7.5, z: -216, w: 3.5, d: 3.5, color: SC.charged, platType: "phase" });
  // Safe rest
  stormPlatform({ x: 4,  y: 7.8, z: -226, w: 5,  d: 4,  color: SC.bright, platType: "standard" });
  // Row 3
  stormPlatform({ x: -4, y: 8.0, z: -234, w: 3.5, d: 3.5, color: SC.charged, platType: "phase" });
  stormPlatform({ x: 2,  y: 8.0, z: -234, w: 3.5, d: 3.5, color: SC.charged, platType: "phase" });
  stormPlatform({ x: 7,  y: 8.0, z: -234, w: 3.5, d: 3.5, color: SC.charged, platType: "phase" });
  // Breather
  stormPlatform({ x: 0,  y: 8.2, z: -244, w: 10, d: 6,  color: SC.bright, platType: "standard" });

  // ── SECTION 5: Moving Storm Bridges (z=-244 to z=-328) — ride the storm ──
  stormPlatform({ x: -3, y: 8.5, z: -254, w: 5,  d: 4,  color: SC.steel,  platType: "standard" }); // approach
  movingPlatform({ x: 0,  y: 8.8, z: -264, w: 8, h: 0.6, d: 5, axis: "x", amplitude: 6, speed: 0.8, phase: 0, color: SC.iron }); // bridge 1
  stormPlatform({ x: 5,  y: 9.0, z: -274, w: 5,  d: 4,  color: SC.steel,  platType: "standard" }); // landing
  rampPlatform({ x: 2,  y: 9.5, z: -282, w: 5,  d: 7,  angleDeg: -18, color: SC.bright });           // ramp up (negative = upward in -z)
  stormPlatform({ x: 0,  y: 10.2, z: -290, w: 5,  d: 4,  color: SC.iron,   platType: "standard" }); // post-ramp
  movingPlatform({ x: -2, y: 10.2, z: -300, w: 6, h: 0.6, d: 4, axis: "z", amplitude: 5, speed: 1.0, phase: 0, color: SC.iron }); // bridge 2
  stormPlatform({ x: 3,  y: 10.5, z: -304, w: 3.5, d: 3,  color: SC.steel,  platType: "standard" }); // stepping stone
  movingPlatform({ x: 0,  y: 10.5, z: -312, w: 7, h: 0.6, d: 4, axis: "x", amplitude: 5, speed: 1.0, phase: Math.PI, color: SC.iron }); // bridge 3
  stormPlatform({ x: -4, y: 10.8, z: -320, w: 5,  d: 4,  color: SC.steel,  platType: "standard" }); // landing
  stormPlatform({ x: 0,  y: 11.0, z: -328, w: 10, d: 6,  color: SC.bright, platType: "standard" }); // breather

  // ── SECTION 6: Final Storm Gauntlet (z=-328 to z=-392) — all mechanics combined ──
  stormPlatform({ x: -4, y: 11.3, z: -336, w: 4,  d: 4,  color: SC.charged, platType: "electric" }); // danger
  stormPlatform({ x: 4,  y: 11.3, z: -336, w: 4,  d: 4,  color: SC.charged, platType: "phase" });    // timing
  movingPlatform({ x: 0,  y: 11.5, z: -344, w: 5, h: 0.6, d: 4, axis: "x", amplitude: 4, speed: 1.2, phase: 0, color: SC.iron }); // moving
  stormPlatform({ x: -5, y: 11.8, z: -352, w: 4,  d: 3.5, color: SC.charged, platType: "phase" });   // phase from mover
  stormPlatform({ x: 5,  y: 11.8, z: -352, w: 4,  d: 3.5, color: SC.charged, platType: "electric" }); // electric alt
  stormPlatform({ x: 0,  y: 12.0, z: -358, w: 3.5, d: 3,  color: SC.steel,  platType: "standard" }); // safe step
  rampPlatform({ x: 0,  y: 12.5, z: -364, w: 5,  d: 7,  angleDeg: -20, color: SC.bright });           // final ramp (negative = upward in -z)
  stormPlatform({ x: 4,  y: 13.2, z: -372, w: 3.5, d: 3,  color: SC.charged, platType: "electric" }); // post-ramp
  stormPlatform({ x: -3, y: 13.2, z: -372, w: 3.5, d: 3,  color: SC.charged, platType: "phase" });   // post-ramp
  movingPlatform({ x: 0,  y: 13.5, z: -378, w: 5, h: 0.6, d: 4, axis: "x", amplitude: 3, speed: 1.3, phase: 0.5, color: SC.iron }); // final bridge
  stormPlatform({ x: 0,  y: 13.8, z: -384, w: 4,  d: 4,  color: SC.steel,  platType: "standard" }); // pre-finish
  stormPlatform({ x: 0,  y: 14.0, z: -392, w: 12, d: 8,  color: SC.bright, platType: "standard" }); // FINISH

  // ── Environmental electric glow lights (6 lights covering full level) ──
  const el1 = new THREE.PointLight(0x5fd0ff, 1.2, 100);
  el1.position.set(-10, 10, -30);
  scene.add(el1); decorations.push(el1);

  const el2 = new THREE.PointLight(0x4488cc, 1.0, 100);
  el2.position.set(10, 12, -95);
  scene.add(el2); decorations.push(el2);

  const el3 = new THREE.PointLight(0x5599cc, 1.1, 100);
  el3.position.set(-8, 12, -160);
  scene.add(el3); decorations.push(el3);

  const el4 = new THREE.PointLight(0x5fd0ff, 1.0, 100);
  el4.position.set(8, 14, -230);
  scene.add(el4); decorations.push(el4);

  const el5 = new THREE.PointLight(0x4488cc, 1.1, 100);
  el5.position.set(-10, 15, -310);
  scene.add(el5); decorations.push(el5);

  const el6 = new THREE.PointLight(0x5599cc, 1.2, 100);
  el6.position.set(5, 16, -380);
  scene.add(el6); decorations.push(el6);

  levelEndZ = -392;
  spawnRing(0, 16.0, -392);
}

let currentLevel = 1;

function loadLevel(n) {
  // If skin selector is open (e.g. admin hotkey pressed), dismiss it cleanly
  if (skinSelectActive) {
    skinSelectActive = false;
    const overlay = document.getElementById("skin-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  clearLevel();
  clearSpaceBackground();
  clearForestBackground();
  clearCaveBackground();
  clearVolcanoBackground();
  clearCandyBackground();
  clearParkBackground();
  clearCityBackground();
  clearStormBackground();
  clearMeteors();
  currentLevel = n;

  // Per-level platform material personality (read by buildBrightVisual + buildNeonVisual cap)
  if      (n === 0) levelMat = { roughness: 0.78, metalness: 0.0,  emissive: 0x000000, emissiveInt: 0.00, edgeColor: 0x111100, edgeOpacity: 0.18 }; // park / tutorial
  else if (n === 1) levelMat = { roughness: 0.88, metalness: 0.00, emissive: 0x000000, emissiveInt: 0.00, edgeColor: 0x000000, edgeOpacity: 0.18 }; // warm sandstone
  else if (n === 2) levelMat = { roughness: 0.96, metalness: 0.00, emissive: 0x000000, emissiveInt: 0.00, edgeColor: 0x0A1500, edgeOpacity: 0.22 }; // rough timber, green-tinted edges
  else if (n === 3) levelMat = { roughness: 0.15, metalness: 0.55, emissive: 0x000000, emissiveInt: 0.00, edgeColor: 0x222233, edgeOpacity: 0.15 }; // polished metal
  else if (n === 4) levelMat = { roughness: 0.95, metalness: 0.00, emissive: 0x110200, emissiveInt: 0.18, edgeColor: 0x1A0500, edgeOpacity: 0.15 }; // scorched rock
  else if (n === 5) levelMat = { roughness: 0.45, metalness: 0.18, emissive: 0x000000, emissiveInt: 0.00, edgeColor: 0x001122, edgeOpacity: 0.15 }; // wet stone
  else if (n === 6) levelMat = { roughness: 0.20, metalness: 0.08, emissive: 0x110011, emissiveInt: 0.06, edgeColor: 0x220022, edgeOpacity: 0.12 }; // candy gloss
  else if (n === 7) levelMat = { roughness: 0.50, metalness: 0.28, emissive: 0x001133, emissiveInt: 0.10, edgeColor: 0x003366, edgeOpacity: 0.28 }; // dark wet concrete
  else if (n === 9) levelMat = { roughness: 0.60, metalness: 0.35, emissive: 0x001133, emissiveInt: 0.08, edgeColor: 0x66ccff, edgeOpacity: 0.45, stormVisual: true }; // storm metal
  else              levelMat = { roughness: 0.15, metalness: 0.05, emissive: 0x22AACC, emissiveInt: 0.35, edgeColor: 0x00CCEE, edgeOpacity: 0.90, transparent: true, opacity: 0.92, colorTint: 0x4FBDD0, tintStrength: 0.65, iceVisual: true }; // frosty ice

  neonUnderglow = (n === 5 || n === 7);
  if      (n === 0) buildLevel0();
  else if (n === 1) buildLevel1();
  else if (n === 2) buildLevel2();
  else if (n === 3) buildLevel3();
  else if (n === 4) buildLevel5();   // buildLevel5 has volcano platforms → "Volcanic Lava World"
  else if (n === 5) buildLevel4();   // buildLevel4 has cave platforms   → "Underground Crystal Cave"
  else if (n === 6) buildLevel6();
  else if (n === 7) buildLevel7();
  else if (n === 8) buildLevel8();
  else if (n === 9) buildLevel9();
  else              buildLevel1();
  neonUnderglow = false;

  // Defaults restored every level switch
  ambientLight.intensity = 1.1; ambientLight.color.setHex(0xffffff);
  skyFill.intensity      = 0.4;
  skyFill.color.setHex(0x9cc8f0);     // restore default color (Level 9 changes it)
  skyFill.position.set(0, 20, -60);   // restore default position (Level 8 moves it)
  sunLight.color.setHex(0xfff8e0); sunLight.intensity = 1.6;  // restore warm sun (Level 8 recolors/moves it)
  sunLight.position.set(sunVec.x * 100, sunVec.y * 100, sunVec.z * 100);
  if (iceFillLight) { scene.remove(iceFillLight); iceFillLight = null; }  // Level 8 fill light
  renderer.toneMappingExposure = 0.55;

  if (n === 4) {
    sky.visible      = false;
    scene.background = new THREE.Color(0x100200);
    scene.fog        = new THREE.FogExp2(0x1A0400, 0.008);
    gravity          = -26;
    ambientLight.intensity = 0.35; ambientLight.color.setHex(0x441100);
    skyFill.intensity = 0;
    clouds.forEach(c => c.visible = false);
    buildVolcanoBackground();
  } else if (n === 5) {
    sky.visible      = false;
    scene.background = new THREE.Color(0x05050F);
    scene.fog        = new THREE.FogExp2(0x05050F, 0.010);
    gravity          = -26;
    ambientLight.intensity = 0.22; ambientLight.color.setHex(0x223355);
    skyFill.intensity = 0;
    clouds.forEach(c => c.visible = false);
    buildCaveBackground();
  } else if (n === 3) {
    sky.visible               = false;
    scene.background          = new THREE.Color(0x00000C);
    scene.fog                 = null;
    gravity                   = -16;
    meteorTimer               = 0.5;
    skyFill.intensity         = 0;
    clouds.forEach(c => c.visible = false);
    buildSpaceBackground();
  } else if (n === 2) {
    sky.visible               = false;
    scene.background          = new THREE.Color(0x4A90D9);
    scene.fog                 = new THREE.Fog(0x4A90D9, 90, 260);
    gravity                   = -26;
    skyFill.intensity         = 0;
    clouds.forEach((c, i) => c.visible = (i >= 6 && i <= 11));
    buildForestBackground();
  } else if (n === 6) {
    sky.visible      = false;
    scene.background = new THREE.Color(0xFFCCEE);
    scene.fog        = new THREE.Fog(0xFFCCEE, 65, 215);
    gravity          = -26;
    ambientLight.intensity = 1.3; ambientLight.color.setHex(0xFFEEFF);
    skyFill.intensity = 0.5;
    renderer.toneMappingExposure = 0.75;
    clouds.forEach(c => c.visible = false);
    buildCandyBackground();
  } else if (n === 0) {
    // Level 0 — bright sunny childrens park
    sky.visible               = true;
    scene.background          = null;
    scene.fog                 = new THREE.Fog(0xC8EAF8, 60, 200);
    gravity                   = -26;
    ambientLight.intensity    = 1.6; ambientLight.color.setHex(0xFFFFFF);
    skyFill.intensity         = 0.6;
    skyUni["turbidity"].value       = 2.0;
    skyUni["rayleigh"].value        = 1.2;
    skyUni["mieCoefficient"].value  = 0.004;
    skyUni["mieDirectionalG"].value = 0.80;
    skyUni["sunPosition"].value.setFromSphericalCoords(1,
      THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(180));
    renderer.toneMappingExposure   = 0.85;
    clouds.forEach(c => c.visible = true);
  } else if (n === 7) {
    sky.visible      = false;
    scene.background = new THREE.Color(0x050810);
    scene.fog        = new THREE.Fog(0x050810, 50, 180);
    gravity          = -26;
    ambientLight.intensity = 0.28; ambientLight.color.setHex(0x112233);
    // skyFill.color reset handled in defaults block
    skyFill.intensity = 0;
    renderer.toneMappingExposure = 0.54;
    clouds.forEach(c => c.visible = false);
    buildCityBackground();
  } else if (n === 8) {
    sky.visible      = false;
    scene.background = new THREE.Color(0xcfefff);
    scene.fog        = new THREE.Fog(0xcfefff, 40, 180);
    gravity          = -26;
    sunLight.color.setHex(0xffffff); sunLight.intensity = 1.05;
    sunLight.position.set(18, 30, 10);
    ambientLight.intensity = 0.75; ambientLight.color.setHex(0xeaf8ff);
    skyFill.intensity = 0;
    iceFillLight = new THREE.PointLight(0xbfefff, 0.45, 120);
    iceFillLight.position.set(-25, 18, -30);
    scene.add(iceFillLight);
    renderer.toneMappingExposure = 0.60;
    clouds.forEach(c => c.visible = false);
    buildIceBackground();
  } else if (n === 9) {
    // Level 9 — Storm Realm
    sky.visible      = false;
    scene.background = new THREE.Color(0x0a1322);
    scene.fog        = new THREE.FogExp2(0x0d1a2e, 0.006);
    gravity          = -26;
    ambientLight.intensity = 0.45; ambientLight.color.setHex(0x2a3a50);
    sunLight.color.setHex(0x6688aa); sunLight.intensity = 0.6;
    sunLight.position.set(10, 50, -60);
    skyFill.color.setHex(0x3a4466); skyFill.intensity = 0.20;
    renderer.toneMappingExposure = 0.55;
    clouds.forEach(c => c.visible = false);
    buildStormBackground();
  } else {
    // Level 1 — golden hour / warm sunrise
    sky.visible               = true;
    scene.background          = null;
    scene.fog                 = new THREE.Fog(0xF0A868, 55, 210);
    gravity                   = -26;
    skyUni["turbidity"].value       = 4.0;
    skyUni["rayleigh"].value        = 2.0;
    skyUni["mieCoefficient"].value  = 0.008;
    skyUni["mieDirectionalG"].value = 0.93;
    skyUni["sunPosition"].value.setFromSphericalCoords(1,
      THREE.MathUtils.degToRad(84), THREE.MathUtils.degToRad(192));
    renderer.toneMappingExposure   = 0.68;
    clouds.forEach(c => c.visible = true);
  }

  levelNameHud.textContent = LEVEL_NAMES[n] || "";
  if (n === 1) showSkinSelector(1);
  else         startCountdown(n);
}

// ===== Player =====
let wheelLRef = null, wheelRRef = null, bodyRef = null;
const player = new THREE.Group();

const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.6, 1.2),
  new THREE.MeshStandardMaterial({ color: 0xEE2222, roughness: 0.4, metalness: 0.1 })
);
body.position.y = 0.03;
player.add(body);
bodyRef = body;

const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.3, 16);

const wheelL = new THREE.Mesh(wheelGeo, wheelMat);
wheelL.rotation.z = Math.PI / 2;
wheelL.position.set(-0.58, -0.67, 0);
player.add(wheelL);

const wheelR = new THREE.Mesh(wheelGeo, wheelMat);
wheelR.rotation.z = Math.PI / 2;
wheelR.position.set(0.58, -0.67, 0);
player.add(wheelR);

wheelLRef = wheelL;
wheelRRef = wheelR;
scene.add(player);

const spawn = new THREE.Vector3(0, 2.0, 0);
player.position.copy(spawn);

// ===== Fake shadow =====
const shadowGeo  = new THREE.CircleGeometry(1.0, 16);
const shadowMat  = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.35,
  depthWrite: false, side: THREE.DoubleSide,
});
const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
shadowMesh.rotation.x = -Math.PI / 2;
scene.add(shadowMesh);

// ===== Motion trail =====
const TRAIL_LEN    = 8;
const trailHistory = [];
let   trailFrame   = 0;
const trailPosArr  = new Float32Array(TRAIL_LEN * 3).fill(-9999);
const trailColArr  = new Float32Array(TRAIL_LEN * 3);
const trailBufGeo  = new THREE.BufferGeometry();
trailBufGeo.setAttribute("position", new THREE.BufferAttribute(trailPosArr, 3));
trailBufGeo.setAttribute("color",    new THREE.BufferAttribute(trailColArr, 3));
const trailPoints  = new THREE.Points(trailBufGeo, new THREE.PointsMaterial({
  size: 0.28, vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false,
}));
trailPoints.frustumCulled = false;
scene.add(trailPoints);

// ===== DOM refs =====
const timerEl          = document.getElementById("timer");
const progressFill     = document.getElementById("progress-fill");
const nameOverlay      = document.getElementById("name-overlay");
const nameInput        = document.getElementById("name-input");
const nameSubmit       = document.getElementById("name-submit");
const levelCompleteMsg = document.getElementById("level-complete-msg");
const finalTimeDisplay = document.getElementById("final-time-display");
const lbOverlay        = document.getElementById("lb-overlay");
const lbTitle          = document.getElementById("lb-title");
const lbTable          = document.getElementById("lb-table");
const lbNotTop         = document.getElementById("lb-not-top");
const lbHint           = document.getElementById("lb-hint");
const countdownOverlay  = document.getElementById("countdown-overlay");
const countdownTitle    = document.getElementById("countdown-title");
const countdownSubtitle = document.getElementById("countdown-subtitle");
const countdownNumber   = document.getElementById("countdown-number");
const levelNameHud      = document.getElementById("level-name-hud");

const LEVEL_NAMES = {
  0: "Childrens Park",
  1: "Golden Hour",
  2: "Above the Canopy",
  3: "Cosmic Drift",
  4: "Volcanic Lava World",
  5: "Underground Crystal Cave",
  6: "Candyland",
  7: "Neon City Rooftops",
  8: "Frozen Sky Peaks",
  9: "Storm Realm",
};

// ===== Timer =====
let levelTime        = 0;
let won              = false;
let countdownActive  = false;
let countdownTime    = 0;
let skinSelectActive = false;

function formatTime(t) {
  const m  = Math.floor(t / 60);
  const s  = t % 60;
  const ss = s < 10 ? `0${s.toFixed(1)}` : s.toFixed(1);
  return `${m}:${ss}`;
}

function startCountdown(level) {
  countdownTitle.textContent    = `LEVEL ${level}`;
  countdownSubtitle.textContent = LEVEL_NAMES[level] || "";
  countdownNumber.textContent   = "3";
  countdownOverlay.classList.add("active");
  countdownActive = true;
  countdownTime   = 3.7;
}

// ===== Vehicle skin selector =====
const SKIN_KEY  = "jump_vehicle_color";
const SKIN_VALS = {
  "0xEE2222": 0xEE2222,
  "0x2255EE": 0x2255EE,
  "0x22BB44": 0x22BB44,
  "0xEECC00": 0xEECC00,
  "0xFF44BB": 0xFF44BB,
};

// Trail color components — updated whenever vehicle color changes
let trailColorR = 0xEE / 255, trailColorG = 0x22 / 255, trailColorB = 0x22 / 255;

function applyVehicleColor(hexStr) {
  const hex = SKIN_VALS[hexStr] ?? 0xEE2222;
  body.material.color.setHex(hex);
  localStorage.setItem(SKIN_KEY, hexStr);
  trailColorR = ((hex >> 16) & 0xFF) / 255;
  trailColorG = ((hex >>  8) & 0xFF) / 255;
  trailColorB = ( hex        & 0xFF) / 255;
}

// Apply saved skin immediately on startup
(function () {
  const saved = localStorage.getItem(SKIN_KEY);
  if (saved && SKIN_VALS[saved]) applyVehicleColor(saved);
})();

function showSkinSelector(level) {
  const overlay  = document.getElementById("skin-overlay");
  const swatches = overlay.querySelectorAll(".skin-swatch");
  const playBtn  = document.getElementById("skin-play");

  // Pre-select the stored color (default red)
  let selected = localStorage.getItem(SKIN_KEY) || "0xEE2222";
  swatches.forEach(s => s.classList.toggle("selected", s.dataset.color === selected));

  swatches.forEach(s => {
    s.onclick = () => {
      selected = s.dataset.color;
      swatches.forEach(x => x.classList.remove("selected"));
      s.classList.add("selected");
    };
  });

  skinSelectActive = true;
  overlay.classList.add("active");

  playBtn.onclick = () => {
    applyVehicleColor(selected);
    overlay.classList.remove("active");
    skinSelectActive = false;
    startCountdown(level);
  };
}

// ===== Screen shake =====
let shakeIntensity = 0;
function triggerShake(mag) {
  shakeIntensity = Math.max(shakeIntensity, mag);
}

// ===== Squash & stretch =====
let squashY   = 1;
let squashXZ  = 1;

// ===== Burst cleanup helper =====
function cleanupBurst() {
  if (burst) { scene.remove(burst.mesh); burst.geo.dispose(); burst.mat.dispose(); burst = null; }
}

// ===== Ring burst particles =====
function spawnRingBurst(pos) {
  cleanupBurst();
  const N       = 36;
  const pos3    = new Float32Array(N * 3);
  const col3    = new Float32Array(N * 3);
  const palette = [
    new THREE.Color(0xFFDD00), new THREE.Color(0xFF3333),
    new THREE.Color(0x33CC44), new THREE.Color(0x3388FF),
    new THREE.Color(0xFF8833), new THREE.Color(0xFF44AA),
    new THREE.Color(0x00BBCC), new THREE.Color(0xAA44FF),
  ];
  for (let i = 0; i < N; i++) {
    pos3[i * 3] = pos.x; pos3[i * 3 + 1] = pos.y; pos3[i * 3 + 2] = pos.z;
    const c = palette[i % palette.length];
    col3[i * 3] = c.r; col3[i * 3 + 1] = c.g; col3[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos3, 3));
  geo.setAttribute("color",    new THREE.BufferAttribute(col3, 3));
  const mat  = new THREE.PointsMaterial({
    size: 0.5, vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false,
  });
  const mesh = new THREE.Points(geo, mat);
  scene.add(mesh);

  // Random outward velocities, biased upward
  const vels = Array.from({ length: N }, () => {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.7;   // upper hemisphere
    const speed = 5 + Math.random() * 8;
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.abs(Math.cos(phi)) * speed + 2,
      Math.sin(phi) * Math.sin(theta) * speed
    );
  });
  burst = { mesh, geo, mat, vels, age: 0 };
}

function updateBurst(dt) {
  if (!burst) return;
  burst.age += dt;
  if (burst.age > 1.6) { cleanupBurst(); return; }
  const pos3 = burst.geo.attributes.position.array;
  for (let i = 0; i < burst.vels.length; i++) {
    pos3[i * 3]     += burst.vels[i].x * dt;
    pos3[i * 3 + 1] += burst.vels[i].y * dt;
    pos3[i * 3 + 2] += burst.vels[i].z * dt;
    burst.vels[i].y -= 11 * dt;            // particle gravity
  }
  burst.geo.attributes.position.needsUpdate = true;
  burst.mat.opacity = Math.max(0, 1 - burst.age / 1.6);
}

// ===== Crash (Level 2 ground impact) =====
let crashed    = false;
let crashTimer = 0;

function spawnCrashBurst(pos) {
  cleanupBurst();
  const N    = 40;
  const pos3 = new Float32Array(N * 3);
  const col3 = new Float32Array(N * 3);
  const palette = [
    new THREE.Color(0x7B4A20), new THREE.Color(0x5C3310),
    new THREE.Color(0xAA8855), new THREE.Color(0x888880),
    new THREE.Color(0xCC3322), new THREE.Color(0x444440),
  ];
  for (let i = 0; i < N; i++) {
    pos3[i * 3] = pos.x; pos3[i * 3 + 1] = pos.y; pos3[i * 3 + 2] = pos.z;
    const c = palette[i % palette.length];
    col3[i * 3] = c.r; col3[i * 3 + 1] = c.g; col3[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos3, 3));
  geo.setAttribute("color",    new THREE.BufferAttribute(col3, 3));
  const mat  = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false,
  });
  const mesh = new THREE.Points(geo, mat);
  scene.add(mesh);

  // Outward + sideways debris, no upward bias
  const vels = Array.from({ length: N }, () => {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI;
    const speed = 4 + Math.random() * 9;
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.abs(Math.cos(phi)) * speed * 0.5,
      Math.sin(phi) * Math.sin(theta) * speed
    );
  });
  burst = { mesh, geo, mat, vels, age: 0 };
}

function spawnIceBurst(pos) {
  cleanupBurst();
  const N    = 40;
  const pos3 = new Float32Array(N * 3);
  const col3 = new Float32Array(N * 3);
  const palette = [
    new THREE.Color(0xeef8ff), new THREE.Color(0xf8ffff),
    new THREE.Color(0xc4e6f4), new THREE.Color(0x6aa8bc),
    new THREE.Color(0xa4c1d0), new THREE.Color(0xddf2ff),
  ];
  for (let i = 0; i < N; i++) {
    pos3[i * 3] = pos.x; pos3[i * 3 + 1] = pos.y; pos3[i * 3 + 2] = pos.z;
    const c = palette[i % palette.length];
    col3[i * 3] = c.r; col3[i * 3 + 1] = c.g; col3[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos3, 3));
  geo.setAttribute("color",    new THREE.BufferAttribute(col3, 3));
  const mat  = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false,
  });
  const mesh = new THREE.Points(geo, mat);
  scene.add(mesh);
  const vels = Array.from({ length: N }, () => {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI;
    const speed = 4 + Math.random() * 9;
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.abs(Math.cos(phi)) * speed * 0.5,
      Math.sin(phi) * Math.sin(theta) * speed
    );
  });
  burst = { mesh, geo, mat, vels, age: 0 };
}

function triggerCrash(floorY = -22) {
  if (crashed) return;
  crashed    = true;
  crashTimer = 0;
  player.visible = false;
  vel.set(0, 0, 0);
  player.position.y = floorY + 0.8;
  if (currentLevel === 8) spawnIceBurst(player.position);
  else spawnCrashBurst(player.position);
  triggerShake(0.9);
}

function spawnFireBurst(pos) {
  cleanupBurst();
  const N      = 52;
  const pos3   = new Float32Array(N * 3);
  const col3   = new Float32Array(N * 3);
  const palette = [
    new THREE.Color(0xFF4400), new THREE.Color(0xFF7700),
    new THREE.Color(0xFFCC00), new THREE.Color(0xFF2200),
    new THREE.Color(0xFF5500), new THREE.Color(0xFFEE44),
  ];
  for (let i = 0; i < N; i++) {
    pos3[i * 3] = pos.x; pos3[i * 3 + 1] = pos.y; pos3[i * 3 + 2] = pos.z;
    const c = palette[i % palette.length];
    col3[i * 3] = c.r; col3[i * 3 + 1] = c.g; col3[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos3, 3));
  geo.setAttribute("color",    new THREE.BufferAttribute(col3, 3));
  const mat  = new THREE.PointsMaterial({
    size: 0.65, vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false,
  });
  const mesh = new THREE.Points(geo, mat);
  scene.add(mesh);
  const vels = Array.from({ length: N }, () => {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.72;
    const speed = 5 + Math.random() * 11;
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.abs(Math.cos(phi)) * speed * 0.9 + 2,
      Math.sin(phi) * Math.sin(theta) * speed
    );
  });
  burst = { mesh, geo, mat, vels, age: 0 };
}

function triggerLavaDeath() {
  if (crashed) return;
  crashed    = true;
  crashTimer = 0;
  player.visible = false;
  vel.set(0, 0, 0);
  player.position.y = -15 + 0.8;
  spawnFireBurst(player.position);
  triggerShake(1.2);
}

// ===== Meteor streaks (Level 3) =====
function spawnMeteor() {
  const x   = (Math.random() - 0.5) * 220;
  const y   =  38 + Math.random() * 50;
  const z   = -(Math.random() * 185 + 5);
  const dx  = (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.45);
  const dy  = -(0.12 + Math.random() * 0.28);
  const dz  = (Math.random() - 0.5) * 0.18;
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const len = 10 + Math.random() * 16;
  const verts = new Float32Array([x, y, z,  x - dir.x * len, y - dir.y * len, z - dir.z * len]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  const palette = [0xFFFFFF, 0xFFEECC, 0xBBDDFF, 0xFFFFBB];
  const mat = new THREE.LineBasicMaterial({
    color: palette[Math.floor(Math.random() * palette.length)],
    transparent: true, opacity: 0.0,
  });
  const mesh = new THREE.Line(geo, mat);
  scene.add(mesh);
  meteors.push({ mesh, geo, mat, dir, speed: 85 + Math.random() * 90, len,
    age: 0, life: 0.35 + Math.random() * 0.35, x, y, z });
}

function updateMeteors(dt) {
  meteorTimer -= dt;
  if (meteorTimer <= 0 && meteors.length < 9) {
    spawnMeteor();
    meteorTimer = 0.5 + Math.random() * 1.2;
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.age += dt;
    const t = m.age / m.life;
    m.mat.opacity = t < 0.15 ? (t / 0.15) * 0.95 : (1 - t) * 0.95;
    const mv = m.speed * dt;
    m.x += m.dir.x * mv;  m.y += m.dir.y * mv;  m.z += m.dir.z * mv;
    const pos = m.geo.attributes.position;
    pos.setXYZ(0, m.x, m.y, m.z);
    pos.setXYZ(1, m.x - m.dir.x * m.len, m.y - m.dir.y * m.len, m.z - m.dir.z * m.len);
    pos.needsUpdate = true;
    if (m.age >= m.life) {
      scene.remove(m.mesh); m.geo.dispose(); m.mat.dispose();
      meteors.splice(i, 1);
    }
  }
}

function clearMeteors() {
  for (const m of meteors) { scene.remove(m.mesh); m.geo.dispose(); m.mat.dispose(); }
  meteors.length = 0;
  meteorTimer    = 3.0;
}

// ===== Space death animation (Level 3) =====
function triggerSpaceDeath() {
  if (spaceDying || won) return;
  spaceDying      = true;
  spaceDyingTimer = 0;
  grounded        = false;
  groundObject    = null;
  vel.set((Math.random() - 0.5) * 4, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3);
  player.traverse(obj => {
    if (obj.isMesh && obj.material) {
      obj.material.transparent = true;
      obj.material.opacity     = 1.0;
    }
  });
}

// ===== Leaderboard =====
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function getLB(level) {
  try { return JSON.parse(localStorage.getItem(`jump_lb_${level}`) || "[]"); }
  catch { return []; }
}
function saveLB(level, entries) {
  localStorage.setItem(`jump_lb_${level}`, JSON.stringify(entries));
}
function showLeaderboard(level, top5, myTime, myIdx) {
  lbTitle.textContent = `Level ${level} — Top Times`;
  let rows = `<thead><tr><th>Rank</th><th>Name</th><th>Time</th></tr></thead><tbody>`;
  if (top5.length === 0) {
    rows += `<tr><td colspan="3" style="color:rgba(255,255,255,.35);padding:14px">No records yet</td></tr>`;
  } else {
    top5.forEach((e, i) => {
      const cls = i === myIdx ? ' class="lb-mine"' : "";
      rows += `<tr${cls}><td>${i + 1}</td><td>${escHtml(e.name)}</td><td>${formatTime(e.time)}</td></tr>`;
    });
  }
  lbTable.innerHTML = rows + "</tbody>";
  lbNotTop.textContent = myIdx === -1 ? `Your time: ${formatTime(myTime)} — not in top 5` : "";
  lbHint.textContent   = level < 9 ? `Press R for Level ${level + 1}` : "Press R to play again";
  lbOverlay.classList.add("active");
}
function showNameEntry(finalTime) {
  levelCompleteMsg.textContent  = `Level ${currentLevel} complete!`;
  finalTimeDisplay.textContent  = formatTime(finalTime);
  nameInput.value = "";
  nameOverlay.classList.add("active");
  setTimeout(() => nameInput.focus(), 60);
  nameSubmit.onclick  = doSubmit;
  nameInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); doSubmit(); } };
  function doSubmit() {
    const name     = nameInput.value.trim() || "Anonymous";
    const lb       = getLB(currentLevel);
    const myEntry  = { name, time: finalTime };
    lb.push(myEntry);
    lb.sort((a, b) => a.time - b.time);
    const top5  = lb.slice(0, 5);
    saveLB(currentLevel, top5);
    const myIdx = top5.indexOf(myEntry);
    nameOverlay.classList.remove("active");
    showLeaderboard(currentLevel, top5, finalTime, myIdx);
  }
}

// ===== Input =====
const keys = new Set();
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  keys.add(e.code); keys.add(e.key.toLowerCase());
});
addEventListener("keyup", (e) => {
  if (e.target.tagName === "INPUT") return;
  keys.delete(e.code); keys.delete(e.key.toLowerCase());
});

// ===== Mobile touch controls =====
(function () {
  function bindHold(id, code) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("touchstart",  e => { e.preventDefault(); keys.add(code); },    { passive: false });
    el.addEventListener("touchend",    e => { e.preventDefault(); keys.delete(code); }, { passive: false });
    el.addEventListener("touchcancel", ()  => { keys.delete(code); });
  }
  bindHold("btn-up",    "KeyW");
  bindHold("btn-down",  "KeyS");
  bindHold("btn-left",  "KeyA");
  bindHold("btn-right", "KeyD");
  bindHold("btn-jump",  "Space");

  const btnR = document.getElementById("btn-reset-mobile");
  if (btnR) {
    btnR.addEventListener("touchend", e => {
      e.preventDefault();
      keys.add("KeyR");
      setTimeout(() => keys.delete("KeyR"), 100);
    }, { passive: false });
  }
})();

// ===== Admin level jump (1 / 2 / 3) =====
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const lvl = e.code === "Digit0" ? 0 : e.code === "Digit1" ? 1 : e.code === "Digit2" ? 2 : e.code === "Digit3" ? 3 : e.code === "Digit4" ? 4 : e.code === "Digit5" ? 5 : e.code === "Digit6" ? 6 : e.code === "Digit7" ? 7 : e.code === "Digit8" ? 8 : e.code === "Digit9" ? 9 : -1;
  if (lvl < 0) return;
  nameOverlay.classList.remove("active");
  lbOverlay.classList.remove("active");
  countdownOverlay.classList.remove("active");
  countdownActive = false;
  won = false;
  loadLevel(lvl);
  reset();
});

// ===== Physics =====
const vel        = new THREE.Vector3();
let   gravity    = -26;
const accel      = 28;
const maxSpeed   = 11;
const airControl = 0.55;
const jumpSpeed  = 11.0;
let yaw          = 0;
let grounded     = false;
let groundObject = null;
const playerHalf = new THREE.Vector3(0.65, 0.95, 0.65);

// Pre-allocated temporaries to avoid per-frame heap allocations
const _tmpHalf   = new THREE.Vector3();
const _tmpPush   = new THREE.Vector3();
const _tmpBehind = new THREE.Vector3();
const _tmpCamPos = new THREE.Vector3();
const _tmpLookAt = new THREE.Vector3();
const _tmpRampP  = new THREE.Vector3();
const _tmpRampInv = new THREE.Matrix4();
const _tmpRingHalf = new THREE.Vector3(1.3, 1.3, 1.3);
const _allBoxes = [];   // reusable combined solids+movers array, rebuilt each frame

function aabbOverlap(aPos, aHalf, bPos, bHalf) {
  return (
    Math.abs(aPos.x - bPos.x) <= (aHalf.x + bHalf.x) &&
    Math.abs(aPos.y - bPos.y) <= (aHalf.y + bHalf.y) &&
    Math.abs(aPos.z - bPos.z) <= (aHalf.z + bHalf.z)
  );
}

function resolveSideXZ(p, padding = 0.02) {
  if (p.stormType === "phase" && !p.phaseVisible) return; // invisible phase platform
  const pHalf = _tmpHalf.set(p.w / 2, p.h / 2, p.d / 2);
  if (!aabbOverlap(player.position, playerHalf, p.mesh.position, pHalf)) return;
  const platformTop  = p.mesh.position.y + pHalf.y;
  const playerBottom = player.position.y - playerHalf.y;
  if (playerBottom >= platformTop - 0.1) return;
  const dx   = player.position.x - p.mesh.position.x;
  const dz   = player.position.z - p.mesh.position.z;
  const penX = (playerHalf.x + pHalf.x) - Math.abs(dx);
  const penZ = (playerHalf.z + pHalf.z) - Math.abs(dz);
  if (penX < penZ) { player.position.x += Math.sign(dx) * (penX + padding); vel.x = 0; }
  else             { player.position.z += Math.sign(dz) * (penZ + padding); vel.z = 0; }
}

function rampHeightAt(ramp, x, z) {
  const pWorld = _tmpRampP.set(x, 0, z);
  const inv    = _tmpRampInv.copy(ramp.mesh.matrixWorld).invert();
  const pLocal = pWorld.applyMatrix4(inv);
  if (Math.abs(pLocal.x) > ramp.w / 2) return null;
  if (Math.abs(pLocal.z) > ramp.d / 2) return null;
  const n = ramp.normal, P0 = ramp.point;
  if (Math.abs(n.y) < 1e-4) return null;
  return P0.y - (n.x * (x - P0.x) + n.z * (z - P0.z)) / n.y;
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

const facing        = new THREE.Vector3(0, 0, 1);
const camOffsetDist = 14;
const camHeight     = 6;
let time = 0;

function reset() {
  keys.clear();
  player.position.copy(spawn);
  vel.set(0, 0, 0);
  yaw = 0;
  facing.set(0, 0, 1);
  grounded      = false;
  groundObject  = null;
  squashY       = 1;
  squashXZ      = 1;
  shakeIntensity = 0;
  player.scale.set(1, 1, 1);
  player.visible = true;
  player.rotation.set(0, 0, 0);
  player.traverse(obj => {
    if (obj.isMesh && obj.material) { obj.material.opacity = 1.0; obj.material.transparent = false; }
  });
  crashed         = false;
  crashTimer      = 0;
  spaceDying      = false;
  spaceDyingTimer = 0;
  levelTime = 0;
  timerEl.textContent      = formatTime(0);
  progressFill.style.width = "0%";
  trailHistory.length = 0;

  // Restore collapsed ice blocks so they can be triggered again
  for (const p of solids) {
    if (!p.collapse) continue;
    p.collapseTimer = null;
    p.falling       = false;
    p.fallVel       = 0;
    p.mesh.position.set(p.baseX, p.baseY, p.baseZ);
  }

  // Restore phase platforms to visible state (Level 9)
  for (const pp of stormPhasePlats) {
    pp.phaseVisible = true;
    pp.phaseTimer   = Math.random() * 3; // stagger like initial spawn
    pp.mesh.visible = true;
    for (const m of pp.allMats) m.opacity = m._baseOpacity;
  }
}

function updateMovers() {
  for (const m of movers) {
    m.prevPos.copy(m.mesh.position);
    const a = m.amplitude;
    const s = m.speed;
    const p = m.phase;
    const v = Math.sin(time * s + p) * a;
    m.mesh.position.copy(m.basePos);
    if (m.axis === "x") m.mesh.position.x += v;
    if (m.axis === "z") m.mesh.position.z += v;
    if (m.axis === "y") m.mesh.position.y += v;
    m.delta.copy(m.mesh.position).sub(m.prevPos);

    // Calm emissive pulse — targets topMat directly when available (Level 8 ice)
    const mat = m.topMat ?? m.mesh.material;
    if (mat && "emissiveIntensity" in mat) {
      const pulse = m.baseEI + 0.03 * (0.5 + 0.5 * Math.sin(time * 1.3 + p));
      mat.emissiveIntensity = Math.min(pulse, 0.18);
    }
  }
}

function pulseStatics() {
  for (const s of solids) {
    const mat = s.topMat ?? s.mesh.material;
    if (mat && "emissiveIntensity" in mat) {
      const pulse = s.baseEI + 0.025 * (0.5 + 0.5 * Math.sin(time * 1.2 + s.mesh.position.x * 0.10));
      mat.emissiveIntensity = Math.min(pulse, 0.16);
    }
  }
  for (const r of ramps) {
    const mat = r.topMat ?? r.mesh.material;
    if (mat && "emissiveIntensity" in mat) {
      const pulse = r.baseEI + 0.025 * (0.5 + 0.5 * Math.sin(time * 1.2 + r.mesh.position.z * 0.10));
      mat.emissiveIntensity = Math.min(pulse, 0.16);
    }
  }
}

function updatePendulums(dt) {
  for (const p of pendulums) {
    p.group.rotation.z = Math.sin(time * p.speed) * p.amplitude;
    p.block.getWorldPosition(p.worldPos);
    if (p.saw) p.blade.rotation.z += p.spinSpeed * dt;
    if (p.fire) {
      // Compound flicker — two frequencies for organic look
      const flicker = Math.sin(time * 7.5 + p.phase) * 0.35
                    + Math.sin(time * 13.2 + p.phase + 1.1) * 0.18;
      for (let i = 0; i < p.flames.length; i++) {
        const sv = 1.0 + flicker * (1.0 - i * 0.18);
        p.flames[i].scale.set(0.85 + flicker * 0.25, sv, 0.85 + flicker * 0.25);
        p.flames[i].rotation.y += (1.4 + i * 0.5) * dt;
      }
      p.fireLight.intensity = 3.0 + flicker * 2.2;
    }
  }
}

function updateShadow() {
  const px = player.position.x, pz = player.position.z;
  const feet = player.position.y - playerHalf.y;
  let bestTop = -9999;
  let bestVtop = 0;  // visual top offset of the best candidate
  for (let i = 0; i < solids.length; i++) {
    const p = solids[i];
    if (Math.abs(px - p.mesh.position.x) > p.w / 2 + 0.5) continue;
    if (Math.abs(pz - p.mesh.position.z) > p.d / 2 + 0.5) continue;
    const top = p.mesh.position.y + p.h / 2;
    if (top < feet + 0.3 && top > bestTop) { bestTop = top; bestVtop = p.vtop || 0; }
  }
  for (let i = 0; i < movers.length; i++) {
    const p = movers[i];
    if (Math.abs(px - p.mesh.position.x) > p.w / 2 + 0.5) continue;
    if (Math.abs(pz - p.mesh.position.z) > p.d / 2 + 0.5) continue;
    const top = p.mesh.position.y + p.h / 2;
    if (top < feet + 0.3 && top > bestTop) { bestTop = top; bestVtop = p.vtop || 0; }
  }
  // Also check ramps — compute the ramp surface height at the player's XZ position
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    const yRamp = rampHeightAt(r, px, pz);
    if (yRamp == null) continue;
    const vt  = Math.max(r.thickness, 0.7);
    const top = yRamp + (vt - r.thickness * 0.5) * r.normal.y;
    if (top < feet + 0.3 && top > bestTop) { bestTop = top; bestVtop = 0; }
  }
  if (bestTop > -9999) {
    const height = Math.max(0, feet - bestTop);
    const scale  = Math.max(0, 1.0 - height / 10.0);
    // Place shadow on the visual surface (collision top + visual cap offset + z-fight clearance)
    shadowMesh.position.set(px, bestTop + bestVtop + 0.03, pz);
    shadowMesh.scale.setScalar(scale * 1.3 + 0.15);
    shadowMat.opacity  = 0.38 * scale;
    shadowMesh.visible = true;
  } else {
    shadowMesh.visible = false;
  }
}

function updateTrail() {
  const flatSpeed = Math.hypot(vel.x, vel.z);
  trailFrame++;
  if (trailFrame % 2 === 0 && flatSpeed > 2.0) {
    trailHistory.unshift({ x: player.position.x, y: player.position.y + 0.3, z: player.position.z });
    if (trailHistory.length > TRAIL_LEN) trailHistory.pop();
  }
  for (let i = 0; i < TRAIL_LEN; i++) {
    if (i < trailHistory.length) {
      const fade = 1.0 - i / TRAIL_LEN;
      trailPosArr[i*3]   = trailHistory[i].x;
      trailPosArr[i*3+1] = trailHistory[i].y;
      trailPosArr[i*3+2] = trailHistory[i].z;
      trailColArr[i*3]   = fade * trailColorR;
      trailColArr[i*3+1] = fade * trailColorG;
      trailColArr[i*3+2] = fade * trailColorB;
    } else {
      trailPosArr[i*3+1] = -9999;
    }
  }
  trailBufGeo.attributes.position.needsUpdate = true;
  trailBufGeo.attributes.color.needsUpdate    = true;
}

// ===== Main update =====
function update(dt) {
  time += dt;

  // R key — runs before won-freeze so leaderboard can advance
  if (keys.has("KeyR") && !nameOverlay.classList.contains("active")) {
    if (lbOverlay.classList.contains("active")) {
      lbOverlay.classList.remove("active");
      won = false;
      const next = currentLevel < 9 ? currentLevel + 1 : 1;
      loadLevel(next);
      reset();
    } else if (!won && !countdownActive) {
      reset();
    }
  }

  // ── Crash state (Level 2 ground impact) ──
  if (crashed) {
    crashTimer += dt;
    updateBurst(dt);
    updateShadow();
    if (crashTimer >= 1.0) reset();
    return;
  }

  // ── Space death animation (Level 3) ──
  if (spaceDying) {
    spaceDyingTimer += dt;
    const t = Math.min(spaceDyingTimer / 2.2, 1.0);
    // Weak gravity — floaty drift
    vel.y += (-1.5) * dt;
    player.position.addScaledVector(vel, dt);
    // Gentle tumble
    player.rotation.x += 0.55 * dt;
    player.rotation.z += 0.32 * dt;
    // Fade out
    const opacity = Math.max(0, 1 - t);
    player.traverse(obj => { if (obj.isMesh && obj.material) obj.material.opacity = opacity; });
    updateBurst(dt);
    updateShadow();
    if (spaceDyingTimer >= 2.2) reset();
    return;
  }

  // ── World animation (always runs behind modals) ──
  updateMovers();
  if (currentLevel === 8) pulseStatics();
  if (currentLevel === 9) pulseStormStatics();
  updatePendulums(dt);
  updateBurst(dt);
  for (const cloud of clouds) {
    cloud.position.x += dt * 2.2;
    if (cloud.position.x > 200) cloud.position.x -= 400;
  }
  if (ring) {
    ring.rotation.y += dt * 1.6;
    ring.position.y  = ringBaseY + Math.sin(time * 2.4) * 0.35;
  }
  updateShadow();

  // ── Skin selector blocks all game logic ──
  if (skinSelectActive) return;

  // ── Countdown ──
  if (countdownActive) {
    countdownTime -= dt;
    if      (countdownTime > 2.7) countdownNumber.textContent = "3";
    else if (countdownTime > 1.7) countdownNumber.textContent = "2";
    else if (countdownTime > 0.7) countdownNumber.textContent = "1";
    else if (countdownTime > 0)   countdownNumber.textContent = "GO!";
    else { countdownActive = false; countdownOverlay.classList.remove("active"); }
    return;
  }

  // ── Player frozen while modals are open ──
  if (won) return;

  // ── Timer + progress bar ──
  levelTime += dt;
  timerEl.textContent = formatTime(levelTime);
  progressFill.style.width =
    Math.min(100, Math.max(0, (-player.position.z / Math.abs(levelEndZ)) * 100)).toFixed(1) + "%";

  // ── Moving platform carry ──
  if (grounded && groundObject && groundObject.type === "mover") {
    player.position.add(groundObject.delta);
  }

  // ── Tank controls ──
  let throttle = 0;
  if (keys.has("ArrowUp")    || keys.has("KeyW") || keys.has("w")) throttle -= 1;
  if (keys.has("ArrowDown")  || keys.has("KeyS") || keys.has("s")) throttle += 1;

  const turnSpeed = 2.6;
  if (keys.has("ArrowLeft")  || keys.has("KeyA") || keys.has("a")) yaw += turnSpeed * dt;
  if (keys.has("ArrowRight") || keys.has("KeyD") || keys.has("d")) yaw -= turnSpeed * dt;

  facing.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();

  const desiredSpeed = throttle * maxSpeed;
  const targetVX     = facing.x * desiredSpeed;
  const targetVZ     = facing.z * desiredSpeed;
  const isIceLevel   = currentLevel === 8;
  const isIcy        = grounded && groundObject && groundObject.icy;
  const iceFactor    = isIcy ? 0.32 : (isIceLevel ? 0.65 : 1.0);
  const control      = grounded ? 1.0 * iceFactor : airControl;
  const brakingAccel = isIcy      ? accel * 0.90
                     : isIceLevel ? accel * 1.8
                     : grounded   ? accel * 5.0
                                  : accel * 1.5;
  const moveAccel    = accel * control;
  const ax = throttle === 0 ? brakingAccel : moveAccel;
  const az = throttle === 0 ? brakingAccel : moveAccel;

  vel.x = approach(vel.x, targetVX, ax * dt);
  vel.z = approach(vel.z, targetVZ, az * dt);

  if (throttle === 0 && grounded) {
    if (Math.abs(vel.x) < 0.05) vel.x = 0;
    if (Math.abs(vel.z) < 0.05) vel.z = 0;
  }

  if (bodyRef) {
    const leanMax    = THREE.MathUtils.degToRad(25);
    const targetLean = THREE.MathUtils.clamp(-throttle * leanMax, -leanMax, leanMax);
    bodyRef.rotation.x = THREE.MathUtils.lerp(bodyRef.rotation.x, targetLean, 1 - Math.pow(0.02, dt));
  }

  // ── Jump — stretch on launch ──
  if (keys.has("Space") && grounded) {
    vel.y    = jumpSpeed;
    grounded = false; groundObject = null;
    squashY  = 1.28;    // stretch tall
    squashXZ = 0.80;    // narrow
  }

  // ── Gravity ──
  vel.y += gravity * dt;

  // ── Y integration + ground check ──
  // Save state before the ground check so we can detect the landing moment
  const wasGrounded    = grounded;
  const velYAtImpact   = vel.y;    // velocity just before it gets zeroed on contact

  player.position.y += vel.y * dt;
  grounded = false; groundObject = null;

  _allBoxes.length = 0;
  for (let i = 0; i < solids.length; i++) _allBoxes.push(solids[i]);
  for (let i = 0; i < movers.length; i++) _allBoxes.push(movers[i]);
  const allBoxes = _allBoxes;
  for (const p of allBoxes) {
    if (p.stormType === "phase" && !p.phaseVisible) continue; // invisible phase platform
    const pHalf = _tmpHalf.set(p.w / 2, p.h / 2, p.d / 2);
    if (!aabbOverlap(player.position, playerHalf, p.mesh.position, pHalf)) continue;
    const playerBottom = player.position.y - playerHalf.y;
    const platformTop  = p.mesh.position.y + pHalf.y;
    if (vel.y <= 0 && playerBottom <= platformTop + 0.12) {
      player.position.y = platformTop + playerHalf.y;

      if (p.type === "bounce") {
        // Bounce pad — launch upward, no grounding
        vel.y    = p.bounceSpeed;
        grounded = false; groundObject = null;
        triggerShake(0.28);
        squashY  = 0.58;
        squashXZ = 1.40;
      } else {
        vel.y = 0; grounded = true; groundObject = p;
        // Landing feedback — scale with fall speed
        if (!wasGrounded && velYAtImpact < -4) {
          const impact = Math.abs(velYAtImpact);
          const t = Math.min((impact - 4) / 16, 1);   // 0 at -4, 1 at -20
          triggerShake(t * 0.45);
          squashY  = 1 - t * 0.36;   // 0.64 at max impact
          squashXZ = 1 + t * 0.30;   // 1.30 at max impact
        }
      }
      break;
    }
  }

  if (!grounded && vel.y <= 0) {
    for (const r of ramps) {
      const yRamp = rampHeightAt(r, player.position.x, player.position.z);
      if (yRamp == null) continue;
      // rampHeightAt returns mid-plane; offset to visual surface top
      const vt   = Math.max(r.thickness, 0.7);
      const topY = yRamp + (vt - r.thickness * 0.5) * r.normal.y;
      const playerBottom = player.position.y - playerHalf.y;
      if (playerBottom <= topY + 0.12 && playerBottom >= topY - 0.75) {
        player.position.y = topY + playerHalf.y;
        vel.y = 0; grounded = true; groundObject = r; break;
      }
    }
  }

  // ── Collapsing ice block logic (Level 8) ──
  if (currentLevel === 8) {
    for (const p of solids) {
      if (!p.collapse) continue;
      // Trigger timer when player first lands on this block
      if (grounded && groundObject === p && p.collapseTimer === null) {
        p.collapseTimer = p.collapseDelay;
      }
      if (p.collapseTimer !== null) {
        if (!p.falling) {
          p.collapseTimer -= dt;
          // Shake jitter in last 0.4 s
          if (p.collapseTimer < 0.4) {
            p.mesh.position.x = p.baseX + (Math.random() - 0.5) * 0.10;
            p.mesh.position.z = p.baseZ + (Math.random() - 0.5) * 0.10;
          }
          if (p.collapseTimer <= 0) {
            p.mesh.position.x = p.baseX;
            p.mesh.position.z = p.baseZ;
            p.falling = true;
          }
        } else {
          // Fall under reduced gravity
          p.fallVel += gravity * 0.9 * dt;
          p.mesh.position.y += p.fallVel * dt;
        }
      }
    }
  }

  // ── Storm electric platform damage (Level 9) ──
  if (currentLevel === 9 && grounded) {
    for (const ep of stormElecPlats) {
      if (ep.electrified && groundObject === ep) {
        triggerCrash(player.position.y - playerHalf.y);
        break;
      }
    }
  }

  // ── Wind gust (Level 7 + Level 9) ──
  if ((currentLevel === 7 || currentLevel === 9) && windActive) {
    vel.x += windForceX * dt;
  }

  // ── X + Z integration with side resolution ──
  player.position.x += vel.x * dt;
  for (const p of allBoxes) resolveSideXZ(p);
  player.position.z += vel.z * dt;
  for (const p of allBoxes) resolveSideXZ(p);

  // ── Pendulum collision ──
  for (const p of pendulums) {
    const pHalf = _tmpHalf.set(p.boxW / 2, p.boxH / 2, p.boxD / 2);
    if (aabbOverlap(player.position, playerHalf, p.worldPos, pHalf)) {
      if (p.saw && currentLevel === 2) {
        triggerCrash();               // saw blade on level 2 = instant kill
      } else {
        const pushDir = _tmpPush.subVectors(player.position, p.worldPos).normalize();
        vel.x += pushDir.x * 14;
        vel.z += pushDir.z * 14;
        grounded = false;
        triggerShake(0.38);
      }
    }
  }

  // ── Geyser collision (Level 4 — Volcanic Lava World) ──
  if (currentLevel === 4 && !crashed) {
    for (const g of geysers) {
      if (!g.active) continue;
      const dx = player.position.x - g.x;
      const dz = player.position.z - g.z;
      if (Math.sqrt(dx * dx + dz * dz) < g.colR) {
        triggerLavaDeath();
        break;
      }
    }
  }

  // ── Fall reset / ground crash / space death ──
  if (currentLevel === 2 && !crashed && player.position.y - playerHalf.y <= -22) {
    triggerCrash(-22);
  }
  if (currentLevel === 4 && !crashed && player.position.y - playerHalf.y <= -15) {
    triggerLavaDeath();
  }
  if (currentLevel === 5 && !crashed && player.position.y - playerHalf.y <= -18) {
    triggerCrash(-18);
  }
  if (currentLevel === 0 && !crashed && player.position.y - playerHalf.y <= -8) {
    triggerCrash(-8);
  }
  if (currentLevel === 1 && !crashed && player.position.y - playerHalf.y <= -8) {
    triggerCrash(-8);
  }
  if (currentLevel === 6 && !crashed && player.position.y - playerHalf.y <= -14) {
    triggerCrash(-14);
  }
  if (currentLevel === 7 && !crashed && player.position.y - playerHalf.y <= -10) {
    triggerCrash(-10);
  }
  if (currentLevel === 8 && !crashed && player.position.y - playerHalf.y <= -12) {
    triggerCrash(-12);
  }
  if (currentLevel === 9 && !crashed && player.position.y - playerHalf.y <= -12) {
    triggerCrash(-12);
  }
  if (currentLevel === 3 && !spaceDying && player.position.y < -12) {
    triggerSpaceDeath();
  }
  if (!spaceDying && player.position.y < -50) reset();

  // ── Win check ──
  if (ring) {
    const ringHalf = _tmpRingHalf;
    if (aabbOverlap(player.position, playerHalf, ring.position, ringHalf)) {
      won = true;
      vel.set(0, 0, 0);
      spawnRingBurst(ring.position.clone());
      showNameEntry(levelTime);
    }
  }

  // ── Wheel spin ──
  const flatSpeed = Math.hypot(vel.x, vel.z);
  if (wheelLRef && wheelRRef) {
    const spin = flatSpeed * dt * 6;
    wheelLRef.rotation.x += spin;
    wheelRRef.rotation.x += spin;
  }

  // ── Squash & stretch — lerp back to neutral ──
  const ssf = 1 - Math.pow(1e-8, dt);    // ~0.255 per frame at 60fps, snappy spring
  squashY   = THREE.MathUtils.lerp(squashY,  1.0, ssf);
  squashXZ  = THREE.MathUtils.lerp(squashXZ, 1.0, ssf);
  player.scale.set(squashXZ, squashY, squashXZ);
  updateTrail();

  player.rotation.y = yaw;

  // ── Chase camera + screen shake ──
  _tmpBehind.copy(facing).multiplyScalar(camOffsetDist);
  _tmpCamPos.set(player.position.x + _tmpBehind.x, player.position.y + camHeight, player.position.z + _tmpBehind.z);
  camera.position.lerp(_tmpCamPos, 1 - Math.pow(0.0007, dt));

  if (shakeIntensity > 0.005) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity * 2;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    camera.position.z += (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity    *= Math.pow(0.0001, dt);  // fast exponential decay (~250ms)
  }

  camera.lookAt(_tmpLookAt.set(player.position.x, player.position.y + 1.2, player.position.z));
}

// ===== Ice update (Level 8) =====
function updateIce(dt) {
  // ── Scroll aurora textures ──
  for (const am of auroraMats) {
    if (am.mat.map) am.mat.map.offset.x -= am.speed * dt;
  }

  // ── Drift rolling cloud sea layers (UV scroll + gentle position oscillation) ──
  for (const layer of iceFogLayers) {
    if (layer.mat.map) layer.mat.map.offset.x -= layer.uvSpeed * dt;
    layer.mesh.position.x = layer.baseX + Math.sin(time * layer.oscSpeed) * 5;
    layer.mesh.position.z = layer.baseZ + Math.cos(time * layer.oscSpeed * 0.7) * 3;
  }

  if (!snowMesh || !snowData.length) return;
  const pz = player.position.z;

  for (let i = 0; i < SNOW_COUNT; i++) {
    const flake = snowData[i];

    // Fall + gentle side sway
    flake.y -= flake.speed * dt;
    flake.x += Math.sin(time * 0.8 + flake.phase) * flake.drift * dt;

    // Respawn above when fallen below ground level
    if (flake.y < -8) {
      flake.y = 50 + Math.random() * 30;
      flake.x = (Math.random() - 0.5) * 200;
      flake.z = pz - Math.random() * 180;
    }
    // Recycle flakes that have drifted behind the camera
    if (flake.z > pz + 20) {
      flake.z = pz - Math.random() * 180;
      flake.x = (Math.random() - 0.5) * 200;
      flake.y = 20 + Math.random() * 50;
    }

    snowDummy.position.set(flake.x, flake.y, flake.z);
    snowDummy.updateMatrix();
    snowMesh.setMatrixAt(i, snowDummy.matrix);
  }
  snowMesh.instanceMatrix.needsUpdate = true;

  // Slow rotation of decorative ice shards
  if (iceGroup) {
    iceGroup.children.forEach((child, idx) => {
      if (child.geometry && child.geometry.type === "OctahedronGeometry") {
        child.rotation.y += 0.004 * (idx % 2 === 0 ? 1 : -1);
      }
    });
  }
}

// ===== Level 9 Storm per-frame update =====
function spawnLightningBolt(targetX, targetZ) {
  const topY = 50 + Math.random() * 15;
  const botY = -2 + Math.random() * 8;
  const segments = 8 + Math.floor(Math.random() * 5);
  const positions = new Float32Array(segments * 6); // line segments: 2 verts each
  let px = targetX + (Math.random() - 0.5) * 6;
  let py = topY;
  let pz = targetZ + (Math.random() - 0.5) * 6;
  for (let i = 0; i < segments; i++) {
    positions[i * 6]     = px;
    positions[i * 6 + 1] = py;
    positions[i * 6 + 2] = pz;
    const stepY = (topY - botY) / segments;
    py -= stepY;
    px += (Math.random() - 0.5) * 3.5;
    pz += (Math.random() - 0.5) * 3.5;
    positions[i * 6 + 3] = px;
    positions[i * 6 + 4] = py;
    positions[i * 6 + 5] = pz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x9fd8ff, transparent: true, opacity: 0.95, depthWrite: false, linewidth: 2
  });
  const bolt = new THREE.LineSegments(geo, mat);
  scene.add(bolt);
  // Glow bolt — wider, dimmer, gives volumetric lightning feel
  const glowGeo = geo.clone();
  const glowBolt = new THREE.LineSegments(glowGeo,
    new THREE.LineBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.35, depthWrite: false, linewidth: 2 })
  );
  glowBolt.scale.set(1.3, 1.0, 1.3);
  scene.add(glowBolt);
  // Secondary thinner branch
  const branchPositions = new Float32Array(4 * 6);
  const midIdx = Math.floor(segments * 0.4);
  let bx = positions[midIdx * 6 + 3], by = positions[midIdx * 6 + 4], bz = positions[midIdx * 6 + 5];
  for (let i = 0; i < 4; i++) {
    branchPositions[i * 6]     = bx;
    branchPositions[i * 6 + 1] = by;
    branchPositions[i * 6 + 2] = bz;
    by -= (topY - botY) / segments * 0.8;
    bx += (Math.random() - 0.5) * 4;
    bz += (Math.random() - 0.5) * 4;
    branchPositions[i * 6 + 3] = bx;
    branchPositions[i * 6 + 4] = by;
    branchPositions[i * 6 + 5] = bz;
  }
  const branchGeo = new THREE.BufferGeometry();
  branchGeo.setAttribute("position", new THREE.BufferAttribute(branchPositions, 3));
  const branch = new THREE.LineSegments(branchGeo,
    new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.55, depthWrite: false })
  );
  scene.add(branch);

  stormLightning.push({ mesh: bolt, timer: 0.25 });
  stormLightning.push({ mesh: glowBolt, timer: 0.30 });
  stormLightning.push({ mesh: branch, timer: 0.25 });

  // Flash
  stormFlashTimer = 0.20;
  if (stormFlashLight) stormFlashLight.intensity = 4.0;
  ambientLight.intensity = 1.6;

  // Electrify nearby electric platforms
  for (const ep of stormElecPlats) {
    const dx = ep.mesh.position.x - targetX;
    const dz = ep.mesh.position.z - targetZ;
    if (dx * dx + dz * dz < 15 * 15) {
      ep.electrified = true;
      ep.elecTimer   = 2.0;
    }
  }
}

function pulseStormStatics() {
  for (const s of solids) {
    if (s.stormType === "electric") {
      const mat = s.topMat;
      if (mat && "emissiveIntensity" in mat) {
        if (s.electrified) {
          mat.emissiveIntensity = 2.0 + Math.sin(time * 20) * 0.5;
          mat.emissive.setHex(0xddf0ff);
        } else {
          mat.emissiveIntensity = s.baseEI + 0.3 * (0.5 + 0.5 * Math.sin(time * 4 + s.mesh.position.z * 0.08));
          mat.emissive.setHex(0x5fd0ff);
        }
      }
    }
  }
}

function updateStorm(dt, countdown) {
  // ── Rain intensity cycle (always runs) ──
  stormRainCycleTimer += dt;
  if (stormRainCycleTimer >= 10.0) stormRainCycleTimer -= 10.0;
  stormRainPhase = stormRainCycleTimer < 7.0 ? "normal" : "heavy";
  const targetRI = stormRainPhase === "heavy" ? 1.0 : 0.0;
  stormRainIntensity += (targetRI - stormRainIntensity) * Math.min(1, dt * 1.5);

  // During countdown, skip lightning, electric timers, phase cycling, and wind
  if (!countdown) {
    // ── Lightning bolt timer ──
    stormBoltTimer -= dt;
    if (stormBoltTimer <= 0) {
      // Pick random strike location near platforms
      const targetX = (Math.random() - 0.5) * 40;
      const targetZ = -10 - Math.random() * 385;
      spawnLightningBolt(targetX, targetZ);
      stormBoltTimer = 3.0 + Math.random() * 4.0; // next in 3-7s
    }
  }

  // ── Fade active lightning bolts ──
  for (let i = stormLightning.length - 1; i >= 0; i--) {
    const lb = stormLightning[i];
    lb.timer -= dt;
    lb.mesh.material.opacity = Math.max(0, lb.timer / 0.25);
    if (lb.timer <= 0) {
      scene.remove(lb.mesh);
      lb.mesh.geometry.dispose();
      lb.mesh.material.dispose();
      stormLightning.splice(i, 1);
    }
  }

  // ── Flash fade — background + cloud layers respond to lightning ──
  if (stormFlashTimer > 0) {
    stormFlashTimer -= dt;
    const t = Math.max(0, stormFlashTimer / 0.20);
    if (stormFlashLight) stormFlashLight.intensity = 4.0 * t;
    ambientLight.intensity = 0.45 + (1.6 - 0.45) * t;
    // Flash scene background
    if (stormBaseBackground) {
      scene.background.copy(stormBaseBackground).lerp(new THREE.Color(0x2a4060), t * 0.7);
    }
    // Temporarily boost cloud/ceiling/fog opacity during flash
    for (const cp of stormCloudPlanes) {
      if (cp.mat && cp.mat._baseOpacity !== undefined) cp.mat.opacity = cp.mat._baseOpacity + 0.25 * t;
    }
    for (const cl of stormCeilingLayers) {
      if (cl.mat && cl.mat._baseOpacity !== undefined) cl.mat.opacity = cl.mat._baseOpacity + 0.20 * t;
    }
    for (const fl of stormFogLayers) {
      if (fl.mat && fl.mat._baseOpacity !== undefined) fl.mat.opacity = fl.mat._baseOpacity + 0.20 * t;
    }
  } else {
    if (stormFlashLight) stormFlashLight.intensity = 0;
    ambientLight.intensity = 0.45;
    // Restore base background and cloud opacities
    if (stormBaseBackground) scene.background.copy(stormBaseBackground);
    for (const cp of stormCloudPlanes) {
      if (cp.mat && cp.mat._baseOpacity !== undefined) cp.mat.opacity = cp.mat._baseOpacity;
    }
    for (const cl of stormCeilingLayers) {
      if (cl.mat && cl.mat._baseOpacity !== undefined) cl.mat.opacity = cl.mat._baseOpacity;
    }
    for (const fl of stormFogLayers) {
      if (fl.mat && fl.mat._baseOpacity !== undefined) fl.mat.opacity = fl.mat._baseOpacity;
    }
  }

  if (!countdown) {
    // ── Electric platform timers ──
    for (const ep of stormElecPlats) {
      if (ep.electrified) {
        ep.elecTimer -= dt;
        if (ep.elecTimer <= 0) {
          ep.electrified = false;
          ep.elecTimer   = 0;
        }
      }
    }

    // ── Electric spark effects on electrified platforms ──
    for (const ep of stormElecPlats) {
      if (ep.electrified && Math.random() < 0.30) {
        const sp = stormSparkPool.find(s => !s.active);
        if (sp) {
          const hw = ep.w * 0.5, hd = ep.d * 0.5;
          const edge = Math.floor(Math.random() * 4);
          let sx, sz;
          if (edge === 0)      { sx = -hw + Math.random() * ep.w; sz = -hd; }
          else if (edge === 1) { sx = -hw + Math.random() * ep.w; sz =  hd; }
          else if (edge === 2) { sx = -hw; sz = -hd + Math.random() * ep.d; }
          else                 { sx =  hw; sz = -hd + Math.random() * ep.d; }
          sp.mesh.position.set(
            ep.mesh.position.x + sx,
            ep.mesh.position.y + ep.h * 0.5 + 0.1,
            ep.mesh.position.z + sz
          );
          sp.vx = (Math.random() - 0.5) * 6;
          sp.vy = 2 + Math.random() * 4;
          sp.vz = (Math.random() - 0.5) * 6;
          sp.life = sp.maxLife = 0.3 + Math.random() * 0.2;
          sp.active = true;
          sp.mesh.visible = true;
          sp.mat.opacity = 1.0;
        }
      }
    }
  }
  // ── Update active sparks ──
  for (const sp of stormSparkPool) {
    if (!sp.active) continue;
    sp.life -= dt;
    sp.mesh.position.x += sp.vx * dt;
    sp.mesh.position.y += sp.vy * dt;
    sp.mesh.position.z += sp.vz * dt;
    sp.vy -= 12 * dt; // gravity
    sp.mat.opacity = Math.max(0, sp.life / sp.maxLife);
    if (sp.life <= 0) { sp.active = false; sp.mesh.visible = false; }
  }

  // ── Phase platforms cycle (frozen during countdown) ──
  if (countdown) return;
  for (const pp of stormPhasePlats) {
    pp.phaseTimer += dt;
    if (pp.phaseTimer >= pp.phaseCycle) pp.phaseTimer -= pp.phaseCycle;

    const inVisPeriod = pp.phaseTimer < pp.phaseVisDur;
    if (inVisPeriod) {
      // Visible phase
      if (!pp.phaseVisible) {
        pp.phaseVisible = true;
        pp.mesh.visible = true;
      }
      // Last 0.5s before vanish: flicker
      const timeUntilVanish = pp.phaseVisDur - pp.phaseTimer;
      if (timeUntilVanish < 0.5) {
        const flicker = Math.sin(time * 30) > 0 ? 0.85 : 0.3;
        for (const m of pp.allMats) {
          if ("opacity" in m) m.opacity = flicker;
        }
      } else {
        // Fade in during first 0.3s
        const fadeIn = Math.min(1, pp.phaseTimer / 0.3);
        for (const m of pp.allMats) {
          if ("opacity" in m) m.opacity = (m._baseOpacity || 0.85) * fadeIn;
        }
      }
    } else {
      // Invisible phase
      if (pp.phaseVisible) {
        pp.phaseVisible = false;
      }
      // Quick fade out
      const intoInvis = pp.phaseTimer - pp.phaseVisDur;
      if (intoInvis < 0.2) {
        const fadeOut = 1 - (intoInvis / 0.2);
        for (const m of pp.allMats) {
          if ("opacity" in m) m.opacity = fadeOut * 0.3;
        }
      } else {
        pp.mesh.visible = false;
      }
    }
  }

  // ── Wind gust timer (same logic as Level 7) ──
  windTimer -= dt;
  if (!windActive) {
    if (windTimer <= 0) {
      windActive  = true;
      windForceX  = (Math.random() < 0.5 ? 1 : -1) * (3.0 + Math.random() * 3.0);
      windGustDur = 2.0 + Math.random() * 2.0;
      windTimer   = windGustDur;
    }
  } else {
    if (windTimer <= 0) {
      windActive = false;
      windForceX = 0;
      windTimer  = 4.0 + Math.random() * 3.0;
    }
  }

  // ── Rain animation ──
  if (stormRainMesh && stormRainData.length) {
    const pz = player.position.z;
    const windDrift = windActive ? windForceX * 0.6 : 0;
    const rainTilt = windActive ? -windForceX * 0.08 : 0;
    for (let i = 0; i < STORM_RAIN_COUNT; i++) {
      const drop = stormRainData[i];
      drop.y -= drop.speed * (1.0 + stormRainIntensity * 0.2) * dt;
      drop.x += (drop.drift + windDrift) * dt;
      if (drop.y < -15) {
        drop.y = 40 + Math.random() * 10;
        drop.x = (Math.random() - 0.5) * 140;
        drop.z = pz - Math.random() * 200;
      }
      if (drop.z > pz + 20) {
        drop.z = pz - Math.random() * 200;
        drop.x = (Math.random() - 0.5) * 140;
        drop.y = 25 + Math.random() * 20;
      }
      stormRainDummy.position.set(drop.x, drop.y, drop.z);
      stormRainDummy.rotation.set(0, 0, rainTilt);
      stormRainDummy.updateMatrix();
      stormRainMesh.setMatrixAt(i, stormRainDummy.matrix);
    }
    stormRainMesh.instanceMatrix.needsUpdate = true;
    // Rain intensity modulation
    stormRainMesh.material.opacity = 0.65 + stormRainIntensity * 0.15;
    stormRainMesh.material.color.setHex(stormRainIntensity > 0.5 ? 0xccddff : 0xbbccee);
  }

  // ── Wind streak animation ──
  if (stormWindStreaks && stormWindData.length) {
    const posArr = stormWindStreaks.geometry.attributes.position.array;
    const pz = player.position.z;
    const dir = windActive ? Math.sign(windForceX) : 1;
    const spd = windActive ? Math.abs(windForceX) * 2.5 : 8;
    for (let i = 0; i < STORM_WIND_COUNT; i++) {
      const w = stormWindData[i];
      w.x += dir * (w.speed + spd) * dt;
      if (w.x > 100) { w.x = -100; w.z = pz - Math.random() * 180; w.y = Math.random() * 40 - 5; }
      if (w.x < -100) { w.x = 100; w.z = pz - Math.random() * 180; w.y = Math.random() * 40 - 5; }
      posArr[i * 6]     = w.x;
      posArr[i * 6 + 1] = w.y;
      posArr[i * 6 + 2] = w.z;
      posArr[i * 6 + 3] = w.x + w.len * dir;
      posArr[i * 6 + 4] = w.y;
      posArr[i * 6 + 5] = w.z;
    }
    stormWindStreaks.geometry.attributes.position.needsUpdate = true;
  }

  // ── Wind wisp animation ──
  {
    const pz = player.position.z;
    const wDir = windActive ? Math.sign(windForceX) : 0;
    // Spawn new wisps during gusts
    if (windActive) {
      for (const wp of stormWindWisps) {
        if (wp.active) continue;
        if (Math.random() < 0.03) { // ~2 spawns/sec at 60fps
          wp.active = true;
          wp.life = wp.maxLife;
          wp.x = -wDir * 60;
          wp.y = 2 + Math.random() * 18;
          wp.z = pz - 5 - Math.random() * 140;
          wp.mesh.visible = true;
          wp.mesh.scale.set(wp.scale, wp.scale, wp.scale);
          break; // one spawn per frame
        }
      }
    }
    // Update active wisps
    for (const wp of stormWindWisps) {
      if (!wp.active) continue;
      wp.life -= dt;
      wp.x += wDir * wp.speed * dt;
      wp.mesh.position.set(wp.x, wp.y, wp.z);
      const t = 1 - wp.life / wp.maxLife; // 0→1
      const fadeIn = Math.min(1, t / 0.2);
      const fadeOut = Math.min(1, (1 - t) / 0.2);
      wp.mat.opacity = 0.45 * fadeIn * fadeOut;
      if (wp.life <= 0 || Math.abs(wp.x) > 80) {
        wp.active = false;
        wp.mesh.visible = false;
        wp.mat.opacity = 0;
      }
    }
  }

  // ── Animate rolling storm cloud layers (UV scroll + position oscillation) ──
  for (const cp of stormCloudPlanes) {
    if (cp.mat.map) cp.mat.map.offset.x -= cp.uvSpeed * dt;
    cp.mesh.position.x = cp.baseX + Math.sin(time * cp.oscSpeed) * 6;
    cp.mesh.position.z = cp.baseZ + Math.cos(time * cp.oscSpeed * 0.7) * 4;
  }
  for (const cl of stormCeilingLayers) {
    if (cl.mat.map) cl.mat.map.offset.x -= cl.uvSpeed * dt;
    cl.mesh.position.x = cl.baseX + Math.sin(time * cl.oscSpeed + 1.5) * 4;
    cl.mesh.position.z = cl.baseZ + Math.cos(time * cl.oscSpeed * 0.6) * 3;
  }
  // ── Animate individual storm cloud masses — position drift + wind push ──
  for (const fl of stormFogLayers) {
    // Wind pushes clouds gradually in wind direction
    if (windActive) fl.baseX += windForceX * fl.windMult * dt;
    // Recycle clouds that drift too far off-screen
    if (fl.baseX > 160) fl.baseX -= 320;
    if (fl.baseX < -160) fl.baseX += 320;
    // Sinusoidal drift creates organic floating motion
    fl.mesh.position.x = fl.baseX + Math.sin(time * fl.oscSpeedX + fl.phase) * fl.oscAmpX;
    fl.mesh.position.z = fl.baseZ + Math.cos(time * fl.oscSpeedZ + fl.phase * 0.7) * fl.oscAmpZ;
    // Subtle vertical bob — clouds breathe up and down
    fl.mesh.position.y = fl.baseY + Math.sin(time * fl.oscSpeedX * 0.5 + fl.phase * 1.3) * 0.5;
  }
  for (const sw of stormWallClouds) {
    if (sw.mat.map) sw.mat.map.offset.x -= sw.uvSpeed * dt;
  }

  // ── Distant cloud silent lightning flashes ──
  for (const dc of stormDistantClouds) {
    if (!dc.hasFlash) continue;
    if (dc.flashDur > 0) {
      dc.flashDur -= dt;
      const pulse = Math.sin((dc.flashDur / 0.5) * Math.PI);
      dc.mat.opacity = dc.baseOpacity + Math.max(0, pulse) * 0.28;
      if (dc.flashDur <= 0) {
        dc.mat.opacity = dc.baseOpacity;
        dc.flashDur = 0;
        dc.nextFlash = 5 + Math.random() * 10;
      }
    } else {
      dc.nextFlash -= dt;
      if (dc.nextFlash <= 0) dc.flashDur = 0.5;
    }
  }

  // ── Enhanced storm debris animation ──
  for (const db of stormDebrisData) {
    const m = db.mesh;
    if (db.isFlying) {
      const flyDir = windActive ? Math.sign(windForceX) : 1;
      const flySpeed = windActive ? db.driftSpeed * 1.5 : db.driftSpeed;
      m.position.x += flyDir * flySpeed * dt;
      m.rotation.x += db.spinSpeed * 3 * dt;
      m.rotation.z += db.spinSpeed * 2 * dt;
      if (m.position.x > 90 || m.position.x < -90) {
        m.position.x = -flyDir * 85;
        m.position.y = 3 + Math.random() * 18;
        m.position.z = player.position.z - 10 - Math.random() * 150;
      }
    } else {
      m.position.y = db.baseY + Math.sin(time * 0.5 + db.phase) * 0.15;
      m.rotation.y += db.spinSpeed * 0.004;
      if (windActive) {
        m.position.x += Math.sign(windForceX) * db.driftSpeed * dt;
        m.rotation.x += db.spinSpeed * 0.5 * dt;
        m.rotation.z += db.spinSpeed * 0.3 * dt;
        if (Math.abs(m.position.x) > 80) {
          m.position.x = -Math.sign(windForceX) * 75;
          m.position.z = player.position.z - Math.random() * 150;
        }
      }
    }
  }
}

loadLevel(1);

// ===== Loop =====
let last = performance.now();
function animate() {
  const now = performance.now();
  const dt  = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  if (starGroup) starGroup.position.copy(camera.position);
  if (currentLevel === 2) { updateBirds(dt); }
  if (currentLevel === 3) { updateMeteors(dt); }
  if (currentLevel === 4) { updateVolcano(dt); updateGeysers(); }
  if (currentLevel === 5) { updateCave(dt); }
  if (currentLevel === 7) { updateCity(dt, countdownActive); }
  if (currentLevel === 8) { updateIce(dt); }
  if (currentLevel === 9) { updateStorm(dt, countdownActive); }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
