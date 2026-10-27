/* =====================================================================
   Chitragāthā — Immersive AR/VR module (explore-immersive.html only)
   Real WebXR via the three.js ARButton/VRButton helpers: navigator.xr is
   feature-detected natively by those helpers, which show "AR/VR NOT
   SUPPORTED" on a device/browser without it rather than faking a session.
   Every static prop here is procedural geometry + canvas-painted textures
   — no downloaded set-dressing. The one exception, by explicit request, is
   a real rigged human figure in both scenes: "Rigged Figure" from Khronos'
   official glTF-Sample-Assets, (c) 2017 Cesium, CC BY 4.0 — credited on the
   Sources & Scholarship page. It ships with a plain grey, untextured
   material, recolored here per scene; nothing about its look is borrowed
   beyond the geometry/rig/animation itself. 52KB, so it stays in keeping
   with this project's low-file-size constraint.

   On top of the free-explore scene sits a scripted cinematic "Play the
   Film" mode: a documentary-style sequence of chapters, each one a camera
   move + caption + narration (SpeechSynthesis) built from this project's
   real field interviews (Gajan) and the Naya village patua collective
   (Patachitra). The camera tweening below is a small dependency-free
   tween queue (not GSAP) — this feature is the centrepiece of the page,
   so it does not lean on an external CDN that might be blocked.
   ===================================================================== */
import * as THREE from "three";
import { ARButton } from "three/addons/ARButton.js";
import { VRButton } from "three/addons/VRButton.js";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { GLTFLoader } from "three/addons/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/SkeletonUtils.js";
import { RIGGED_FIGURE_GLB } from "./rigged-figure.glb.js";

const statusEl = document.getElementById("xr-status");
const hotspotPanel = document.getElementById("hotspot-panel");
const hotspotTitle = document.getElementById("hotspot-title");
const hotspotBody = document.getElementById("hotspot-body");
const narrateBtn = document.getElementById("hotspot-narrate");
const sceneButtons = document.querySelectorAll(".scene-switch button");
const canvasHost = document.getElementById("xr-canvas-host");

function setStatus(msg){ if(statusEl) statusEl.textContent = msg; }

// ---------- renderer / camera / controls (shared by both scenes) ----------
const scene = new THREE.Scene();
const PALETTE = {
  cream: 0xF4ECDA, lac: 0xA63A2E, turmeric: 0xE7A93C, leaf: 0x4F6B3A,
  indigo: 0x2C3E70, brown: 0x6B4226, soot: 0x16130F, ink: 0x1C2541
};
scene.background = new THREE.Color(0x0b0e18);
scene.fog = new THREE.FogExp2(0x0b0e18, 0.045);

/* Everything in the world hangs off this rig rather than off the scene
   directly. Outside XR the rig never moves and the film flies the camera.
   Inside an AR/VR session the headset owns the camera — you cannot push
   someone's head around — so the film plays by moving the rig instead:
   the ritual space glides and settles around a viewer who is still free
   to look wherever they like. Same chapter list, same timings, same
   narration; only which side of the transform moves. */
const worldRig = new THREE.Group();
scene.add(worldRig);

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 50);
camera.position.set(0, 1.5, 4.2);

// Note on visual approach: an EffectComposer + UnrealBloomPass pipeline was
// tried here for a cinematic glow and measured, not guessed: on software-
// rendered WebGL (the kind of fallback path older phones, budget laptops,
// and some integrated GPUs can fall back to) the extra render-to-texture
// passes caused the frame rate to collapse to near-zero — the opposite of
// "high performance". The glow look below comes instead from additive-
// blended sprite billboards (buildGlowSprite) plus real point lights: one
// cheap draw call each, no offscreen passes, no GPU readback stalls, and
// it still looks genuinely warm and gorgeous around the flame and pigments.
let renderer;
try{
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.xr.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  canvasHost.appendChild(renderer.domElement);
}catch(err){
  setStatus("Your browser could not start WebGL — try a recent Chrome, Edge or Firefox. The rest of the archive works normally without this page.");
  throw err;
}

function resize(){
  const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);

// ---------- cheap additive glow sprite (radial-gradient canvas texture) ----------
const glowTexCache = {};
function glowTexture(hex){
  if(glowTexCache[hex]) return glowTexCache[hex];
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const col = "#" + hex.toString(16).padStart(6,"0");
  const grad = ctx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0, col); grad.addColorStop(0.35, col);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
  const tex = new THREE.CanvasTexture(c);
  glowTexCache[hex] = tex;
  return tex;
}
function addGlowSprite(parent, position, hex, scale=0.9, opacity=0.8){
  const mat = new THREE.SpriteMaterial({ map: glowTexture(hex), transparent:true, opacity, blending: THREE.AdditiveBlending, depthWrite:false });
  const spr = new THREE.Sprite(mat);
  spr.position.copy(position);
  spr.scale.set(scale, scale, 1);
  parent.add(spr);
  return spr;
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 1.5; controls.maxDistance = 9;
controls.target.set(0, 1, 0);

// ---------- lighting ----------
const hemi = new THREE.HemisphereLight(0xfff1cf, 0x14172a, 0.65);
worldRig.add(hemi);
const key = new THREE.DirectionalLight(0xffe2ad, 1.1);
key.position.set(3, 5, 2);
worldRig.add(key);
const rim = new THREE.DirectionalLight(0x7fa3ff, 0.55);
rim.position.set(-3, 2, -4);
worldRig.add(rim);

// ---------- atmosphere: slow-drifting dust / ember motes ----------
function buildAtmosphere(count, color, spread, ySpread){
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const seed = new Float32Array(count);
  for(let i=0;i<count;i++){
    pos[i*3] = (Math.random()-0.5)*spread;
    pos[i*3+1] = Math.random()*ySpread;
    pos[i*3+2] = (Math.random()-0.5)*spread;
    seed[i] = Math.random()*Math.PI*2;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
  const mat = new THREE.PointsMaterial({ color, size:0.022, transparent:true, opacity:0.5, blending: THREE.AdditiveBlending, depthWrite:false });
  const pts = new THREE.Points(geo, mat);
  pts.userData.seed = seed;
  pts.userData.base = pos.slice();
  return pts;
}
const gajanDust = buildAtmosphere(90, 0xffcf8a, 4.2, 2.6);
const pataDust = buildAtmosphere(80, 0xd9c79a, 3.6, 2.4);
worldRig.add(gajanDust, pataDust);

// ---------- WebXR buttons — real feature detection, no faking ----------
// three.js's ARButton/VRButton.createButton() ship inline styles meant for a
// fixed full-viewport overlay (position:absolute, bottom:20px, left:50%...),
// since every official three.js example appends them straight to <body>.
// We want them sitting inline in our own toolbar instead, so we strip the
// positioning-related inline styles while leaving the button's own click
// handling (bound internally via addEventListener) completely untouched.
function deFloat(btn){
  btn.style.position = "static";
  btn.style.left = "auto"; btn.style.bottom = "auto";
  btn.style.transform = "none";
  btn.style.margin = "0";
  return btn;
}
let xrSupported = { ar: false, vr: false };
const xrButtonRow = document.getElementById("xr-buttons");
const supportNote = document.getElementById("xr-support-note");

// Why might a real XR session be impossible here? WebXR needs (a) a secure
// context, (b) a browser that implements it, (c) — when embedded — an iframe
// whose permissions policy grants xr-spatial-tracking, and (d) actual AR/VR
// hardware. Each of those failures deserves a different sentence and a
// different next step, instead of one shrug that tells the reader nothing.
function framedWithoutXrPermission(){
  if(window.self === window.top) return false;
  try{
    if(document.featurePolicy && document.featurePolicy.allowsFeature){
      return !document.featurePolicy.allowsFeature("xr-spatial-tracking");
    }
  }catch(e){}
  return true; // embedded and unverifiable — most embeds don't grant it
}
function xrBlocker(){
  if(!window.isSecureContext) return "insecure";
  if(!navigator.xr || !navigator.xr.isSessionSupported) return "no-webxr";
  if(framedWithoutXrPermission()) return "framed";
  return null;
}

const NOTES = {
  insecure: "AR/VR needs a secure connection (https://), and this page is being served over a plain or local one — so the browser blocks WebXR before any hardware is even consulted. Everything else on this page works: use <b>Immersive View</b> for a full-screen look around, or explore the scene directly with mouse or touch.",
  "no-webxr": "This browser doesn't implement WebXR, so no headset or phone-AR session can start here — that's a browser limitation, not a problem with the scene. <b>Immersive View</b> below works everywhere, and Chrome or Edge on an ARCore Android phone will give you true AR.",
  framed: "This page is running inside an embedded frame, which isn't granted the <code>xr-spatial-tracking</code> permission — so WebXR is switched off even if your device supports it. <b>Open this page in its own browser tab</b> and the AR/VR buttons will appear if your hardware offers them. Meanwhile, <b>Immersive View</b> gives you a full-screen walk around the scene.",
  "no-hardware": "Your browser supports WebXR, but this device has no AR or VR hardware attached — which is simply what a desktop or laptop without a headset reports. Use <b>Immersive View</b> for a full-screen look around here, or open this page on an ARCore Android phone for genuine AR and in a headset browser for VR.",
  ok: "WebXR is live on this device — the AR and VR buttons above start a real immersive session. <b>Immersive View</b> is also there for a full-screen look without a headset."
};

function updateSupportNote(){
  if(!supportNote) return;
  const blocked = xrBlocker();
  let key;
  if(blocked) key = blocked;
  else if(xrSupported.ar || xrSupported.vr) key = "ok";
  else key = "no-hardware";
  supportNote.innerHTML = NOTES[key];
}

function mountXrButtons(){
  xrButtonRow.innerHTML = "";
  xrButtonRow.appendChild(immersiveBtn);
  if(gyroBtn) xrButtonRow.appendChild(gyroBtn);
  // Only mount a real AR/VR button when that session type is genuinely
  // available — a row of greyed-out "NOT SUPPORTED" chips reads as breakage.
  if(!xrBlocker()){
    navigator.xr.isSessionSupported("immersive-ar").then(ok => {
      xrSupported.ar = ok;
      if(ok) xrButtonRow.appendChild(deFloat(ARButton.createButton(renderer, { requiredFeatures: [], optionalFeatures: ["hit-test","dom-overlay"], domOverlay: { root: document.getElementById("xr-overlay") } })));
      updateSupportNote();
    }).catch(()=>{ updateSupportNote(); });
    navigator.xr.isSessionSupported("immersive-vr").then(ok => {
      xrSupported.vr = ok;
      if(ok) xrButtonRow.appendChild(deFloat(VRButton.createButton(renderer)));
      updateSupportNote();
    }).catch(()=>{ updateSupportNote(); });
  } else {
    updateSupportNote();
  }
}

/* ---------- Immersive View: full-screen + (on phones) gyroscope look ----------
   This is the part that works on every device, with no headset and no WebXR.
   It tries the real Fullscreen API first and falls back to a fixed-position
   CSS takeover, which still works inside restrictive embeds where
   requestFullscreen() is refused. */
const immersiveBtn = document.createElement("button");
immersiveBtn.type = "button";
immersiveBtn.id = "immersive-btn";
immersiveBtn.textContent = "⛶ Immersive View";

const exitImmersiveBtn = document.createElement("button");
exitImmersiveBtn.type = "button";
exitImmersiveBtn.className = "immersive-exit";
exitImmersiveBtn.textContent = "Exit ✕";
exitImmersiveBtn.setAttribute("aria-label", "Leave immersive view");
canvasHost.appendChild(exitImmersiveBtn);

let immersiveOn = false;
function enterImmersive(){
  if(immersiveOn) return;
  immersiveOn = true;
  canvasHost.classList.add("immersive");
  if(canvasHost.requestFullscreen){
    canvasHost.requestFullscreen().catch(() => { canvasHost.classList.add("pseudo-fullscreen"); resize(); });
  } else {
    canvasHost.classList.add("pseudo-fullscreen");
  }
  immersiveBtn.textContent = "⛶ Exit Immersive";
  setTimeout(resize, 60);
  setTimeout(resize, 400);
}
function exitImmersive(){
  if(!immersiveOn) return;
  immersiveOn = false;
  canvasHost.classList.remove("immersive", "pseudo-fullscreen");
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  immersiveBtn.textContent = "⛶ Immersive View";
  if(gyroOn) toggleGyro();
  setTimeout(resize, 60);
  setTimeout(resize, 400);
}
immersiveBtn.addEventListener("click", () => { immersiveOn ? exitImmersive() : enterImmersive(); });
exitImmersiveBtn.addEventListener("click", exitImmersive);
document.addEventListener("fullscreenchange", () => {
  // Esc or the browser's own chrome can drop us out of fullscreen directly
  if(!document.fullscreenElement && immersiveOn && !canvasHost.classList.contains("pseudo-fullscreen")) exitImmersive();
  resize();
});
document.addEventListener("keydown", (e) => { if(e.key === "Escape" && immersiveOn) exitImmersive(); });

/* ---------- gyroscope "magic window" look, for phones and tablets ----------
   three.js dropped DeviceOrientationControls, so this is the standard
   screen-orientation-corrected quaternion conversion, written out directly. */
const hasTouch = window.matchMedia && window.matchMedia("(hover: none)").matches;
const gyro = { alpha:0, beta:0, gamma:0, seen:false };
let gyroOn = false;
const _zee = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _q0 = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° about X: device frame → three.js frame
function applyGyroToCamera(){
  const orient = THREE.MathUtils.degToRad(screen.orientation ? (screen.orientation.angle || 0) : (window.orientation || 0));
  _euler.set(gyro.beta, gyro.alpha, -gyro.gamma, "YXZ");
  camera.quaternion.setFromEuler(_euler);
  camera.quaternion.multiply(_q1);
  camera.quaternion.multiply(_q0.setFromAxisAngle(_zee, -orient));
}
function onDeviceOrientation(e){
  if(e.alpha === null && e.beta === null && e.gamma === null) return;
  gyro.seen = true;
  gyro.alpha = THREE.MathUtils.degToRad(e.alpha || 0);
  gyro.beta  = THREE.MathUtils.degToRad(e.beta  || 0);
  gyro.gamma = THREE.MathUtils.degToRad(e.gamma || 0);
}
const gyroBtn = hasTouch && window.DeviceOrientationEvent ? document.createElement("button") : null;
if(gyroBtn){
  gyroBtn.type = "button";
  gyroBtn.id = "gyro-btn";
  gyroBtn.textContent = "◎ Gyro Look";
}
function startGyroListening(){
  gyro.seen = false;
  window.addEventListener("deviceorientation", onDeviceOrientation, true);
  gyroOn = true;
  gyroBtn.textContent = "◎ Gyro On";
  gyroBtn.classList.add("active");
  stopFilm();
  controls.enabled = false;
  if(!immersiveOn) enterImmersive();
  // If no reading arrives, this device has no usable motion sensor — say so
  // rather than leaving a dead button switched on.
  setTimeout(() => {
    if(gyroOn && !gyro.seen){
      toggleGyro();
      setStatus("No motion sensor readings came back from this device — Immersive View and touch-drag still work.");
    }
  }, 1800);
}
function toggleGyro(){
  if(gyroOn){
    window.removeEventListener("deviceorientation", onDeviceOrientation, true);
    gyroOn = false;
    gyroBtn.textContent = "◎ Gyro Look";
    gyroBtn.classList.remove("active");
    if(!filmState.playing) controls.enabled = true;
    return;
  }
  // iOS 13+ gates motion sensors behind an explicit permission prompt that
  // must be requested from inside a user gesture — this click is one.
  const DOE = window.DeviceOrientationEvent;
  if(DOE && typeof DOE.requestPermission === "function"){
    DOE.requestPermission().then(state => {
      if(state === "granted") startGyroListening();
      else setStatus("Motion access was declined, so gyro look stays off — Immersive View and touch-drag still work.");
    }).catch(() => setStatus("This device wouldn't grant motion access — Immersive View and touch-drag still work."));
  } else {
    startGyroListening();
  }
}
if(gyroBtn) gyroBtn.addEventListener("click", toggleGyro);

mountXrButtons();
window.addEventListener("orientationchange", () => setTimeout(resize, 200));

// ---------- canvas-painted texture generator (original folk-art-style panels, not photographs) ----------
function paintPatachitraPanel(seed){
  const c = document.createElement("canvas"); c.width = 512; c.height = 768;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#F4ECDA"; ctx.fillRect(0,0,c.width,c.height);
  // border frame, pata-style
  ctx.strokeStyle = "#A63A2E"; ctx.lineWidth = 14; ctx.strokeRect(10,10,c.width-20,c.height-20);
  ctx.strokeStyle = "#E7A93C"; ctx.lineWidth = 4; ctx.strokeRect(26,26,c.width-52,c.height-52);
  const rand = (n) => { seed = (seed*9301+49297)%233280; return (seed/233280)*n; };
  const panelH = c.height/4;
  const colors = ["#A63A2E","#E7A93C","#4F6B3A","#2C3E70","#6B4226"];
  for(let p=0;p<4;p++){
    const y0 = 40 + p*panelH;
    ctx.save(); ctx.beginPath(); ctx.rect(36,y0,c.width-72,panelH-16); ctx.clip();
    // sky/ground band
    ctx.fillStyle = p%2===0 ? "#f0dfb8" : "#e9d9ac"; ctx.fillRect(36,y0,c.width-72,panelH-16);
    // sun/moon disc
    ctx.fillStyle = colors[Math.floor(rand(colors.length))];
    ctx.beginPath(); ctx.arc(80+rand(60), y0+40+rand(20), 18, 0, Math.PI*2); ctx.fill();
    // simple folk figure (circle head + triangle body) x2-3
    const figs = 2+Math.floor(rand(2));
    for(let i=0;i<figs;i++){
      const fx = 120 + i*90 + rand(40), fy = y0 + panelH*0.55;
      ctx.fillStyle = colors[Math.floor(rand(colors.length))];
      ctx.beginPath(); ctx.arc(fx, fy-34, 12, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx-16,fy+30); ctx.lineTo(fx+16,fy+30); ctx.lineTo(fx,fy-20); ctx.closePath(); ctx.fill();
    }
    // tree / river motif
    ctx.strokeStyle = "#4F6B3A"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(c.width-110, y0+panelH-30); ctx.lineTo(c.width-110, y0+40); ctx.stroke();
    ctx.fillStyle = "#4F6B3A"; ctx.beginPath(); ctx.arc(c.width-110, y0+36, 26, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#16130F"; ctx.lineWidth = 2; ctx.strokeRect(36,y0,c.width-72,panelH-16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- scene builders ----------
const groups = { gajan: new THREE.Group(), patachitra: new THREE.Group() };
worldRig.add(groups.gajan, groups.patachitra);

const hotspots = []; // {mesh, title, body}
function addHotspot(parent, position, title, body, color=0xE7A93C){
  const geo = new THREE.SphereGeometry(0.085, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(position);
  m.userData = { title, body };
  parent.add(m);
  hotspots.push(m);
  // an invisible, larger concentric sphere is the actual raycast target —
  // keeps the dot itself small and pretty while still giving fingers and
  // mouse pointers a generous, forgiving tap/click area around it.
  const hitGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.copy(position);
  hitMesh.userData = { title, body, visualMesh: m };
  parent.add(hitMesh);
  hotspots.push(hitMesh);
  return m;
}

function buildGajanScene(){
  const g = groups.gajan;
  // temple platform
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.8,0.3,24), new THREE.MeshStandardMaterial({ color: PALETTE.brown, roughness:0.9 }));
  base.position.y = 0.15; g.add(base);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,1.6,12), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness:0.85 }));
  pillar.position.set(0,1.1,-0.8); g.add(pillar);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55,0.7,8), new THREE.MeshStandardMaterial({ color: PALETTE.lac, roughness:0.7 }));
  roof.position.set(0,2.2,-0.8); g.add(roof);

  // charak wheel (rotating)
  const wheelGroup = new THREE.Group(); wheelGroup.position.set(1.1,1.1,0.4);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.5,0.035,10,28), new THREE.MeshStandardMaterial({ color: PALETTE.indigo, metalness:0.3, roughness:0.5 }));
  wheelGroup.add(rimRing);
  for(let i=0;i<6;i++){
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,1.0,6), new THREE.MeshStandardMaterial({ color: PALETTE.turmeric }));
    spoke.rotation.z = Math.PI/2; spoke.rotation.y = (i/6)*Math.PI;
    wheelGroup.add(spoke);
  }
  g.add(wheelGroup); g.userData.wheel = wheelGroup;

  // dhak drum
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.22,0.42,16), new THREE.MeshStandardMaterial({ color: PALETTE.soot, roughness:0.8 }));
  drum.position.set(-1.0,0.5,0.6); drum.rotation.z = 0.25; g.add(drum);

  // trishul
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1.4,8), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness:0.7, roughness:0.3 }));
  shaft.position.set(-0.6,1.4,-0.2); g.add(shaft);
  for(let i=-1;i<=1;i++){
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.03,0.3,6), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness:0.7, roughness:0.3 }));
    prong.position.set(-0.6+i*0.08,2.1,-0.2); g.add(prong);
  }

  // flame particle system
  const flameCount = 260;
  const flameGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(flameCount*3);
  const vel = new Float32Array(flameCount);
  for(let i=0;i<flameCount;i++){
    pos[i*3]= (Math.random()-0.5)*0.18; pos[i*3+1]=Math.random()*0.6; pos[i*3+2]=(Math.random()-0.5)*0.18;
    vel[i] = 0.004 + Math.random()*0.006;
  }
  flameGeo.setAttribute("position", new THREE.BufferAttribute(pos,3));
  const flameMat = new THREE.PointsMaterial({ color: PALETTE.turmeric, size:0.055, transparent:true, opacity:0.9, blending: THREE.AdditiveBlending, depthWrite:false });
  const flame = new THREE.Points(flameGeo, flameMat);
  flame.position.set(0.5,0.35,0.9);
  g.add(flame); g.userData.flame = flame; g.userData.flameVel = vel;
  const flameLight = new THREE.PointLight(0xffb155, 2.4, 3.5, 2);
  flameLight.position.copy(flame.position).add(new THREE.Vector3(0,0.3,0));
  g.add(flameLight); g.userData.flameLight = flameLight;
  const flameGlow = addGlowSprite(g, flame.position.clone().add(new THREE.Vector3(0,0.28,0)), PALETTE.turmeric, 1.3, 0.85);
  g.userData.flameGlow = flameGlow;

  addHotspot(g, new THREE.Vector3(0.5,0.9,0.9), "Agni Pariksha & Agun Jhap", "Fire-walking and trial-by-fire rituals testing endurance and faith, drawn from the field accounts of Gajan's active performers and observers alike.", PALETTE.lac);
  addHotspot(g, new THREE.Vector3(1.1,1.65,0.4), "Charak", "The closing ceremony built around the Charak Kath, the ritual pole — hook-swinging and the culmination of the ascetic cycle, as described by Nirmal Pramanik's own performer's account.", PALETTE.indigo);
  addHotspot(g, new THREE.Vector3(-1.0,0.78,0.6), "The Sound of the Dhak", "The dhak drum drives the ritual's tempo — Nirmal Pramanik's interview specifically names its rhythm as part of how preparation and performance stay synchronised across a crowd.", PALETTE.turmeric);
  addHotspot(g, new THREE.Vector3(-0.6,2.3,-0.2), "Dandi Kata & Devotion", "Prostration and measured bodily discipline performed as surrender to Shiva — a core act of devotion among Sannyasis, central to every one of this project's five Gajan interviews.", 0xcfcfcf);
}

function buildPatachitraScene(){
  const g = groups.patachitra;
  const panelTex = paintPatachitraPanel(17);
  const scrollGeo = new THREE.PlaneGeometry(1.1, 1.65, 1, 1);
  const scrollMat = new THREE.MeshStandardMaterial({ map: panelTex, side: THREE.DoubleSide, roughness:0.95 });
  const scroll = new THREE.Mesh(scrollGeo, scrollMat);
  scroll.position.set(0,1.1,0);
  g.add(scroll); g.userData.scroll = scroll;

  // scroll rollers (top/bottom)
  const rollerMat = new THREE.MeshStandardMaterial({ color: PALETTE.brown, roughness:0.7 });
  const rollerTop = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.25,16), rollerMat);
  rollerTop.rotation.z = Math.PI/2; rollerTop.position.set(0,1.95,0); g.add(rollerTop);
  const rollerBottom = rollerTop.clone(); rollerBottom.position.set(0,0.25,0); g.add(rollerBottom);
  g.userData.rollerBottom = rollerBottom;

  // floating pigment pots orbiting the scroll
  const potColors = [PALETTE.lac, PALETTE.turmeric, PALETTE.leaf, PALETTE.indigo, PALETTE.brown];
  const pots = new THREE.Group();
  potColors.forEach((col, i) => {
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.07,12,12), new THREE.MeshStandardMaterial({ color: col, roughness:0.4, metalness:0.1 }));
    const ang = (i/potColors.length) * Math.PI*2;
    pot.position.set(Math.cos(ang)*1.3, 0.9+Math.sin(ang*1.7)*0.25, Math.sin(ang)*1.3);
    pot.userData.angle = ang;
    pots.add(pot);
    addGlowSprite(pot, new THREE.Vector3(0,0,0), col, 0.4, 0.5);
  });
  g.add(pots); g.userData.pots = pots;

  // a simple brush mesh drifting near the scroll
  const brush = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.5,8), new THREE.MeshStandardMaterial({ color: PALETTE.brown }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.12,8), new THREE.MeshStandardMaterial({ color: PALETTE.soot }));
  tip.position.y = -0.3; brush.add(handle, tip);
  brush.position.set(0.9,1.3,0.4); brush.rotation.z = 0.6;
  g.add(brush); g.userData.brush = brush;

  addHotspot(g, new THREE.Vector3(0,1.95,0.08), "Preparing the Scroll", "Cloth is backed and sized by hand before a single stroke is painted — the unglamorous groundwork behind every finished Patachitra scroll.", PALETTE.brown);
  addHotspot(g, new THREE.Vector3(1.3,0.9,0), "Natural Pigments", "Every colour is sourced locally and ground by hand: turmeric and marigold for yellow, pomegranate rind and red earth for red, indigo and aparajita flower for blue — the recipe recorded field-side in July 2024.", PALETTE.turmeric);
  addHotspot(g, new THREE.Vector3(0.9,1.1,0.4), "The Brush & the Line", "A patua's line is drawn freehand, panel by panel, building the narrative sequence that the scroll will later be sung against.", PALETTE.soot);
  addHotspot(g, new THREE.Vector3(0,0.25,0.08), "Pata Khelano — Sung as It Unrolls", "The scroll is performed, not just displayed: an artist sings the story live while unrolling panel by panel — hear three real examples on the Patachitra page.", PALETTE.indigo);
  addHotspot(g, new THREE.Vector3(-0.75,1.6,0.05), "Sealing With Lacquer", "Once painted and cured over a charcoal fire, the scroll is sealed in lacquer — the final step that lets a pigment recipe this old survive handling and display.", PALETTE.lac);
}

buildGajanScene();
buildPatachitraScene();
groups.patachitra.visible = false;
pataDust.visible = false;

/* =====================================================================
   Human figure — "Rigged Figure", Khronos glTF-Sample-Assets, (c) 2017
   Cesium, CC BY 4.0 (see /assets/vendor/models/rigged-figure.glb.LICENSE.txt
   and the Sources & Scholarship page for full credit). Loaded once, then
   cloned with a correctly-bound independent skeleton (SkeletonUtils — a
   plain Object3D.clone() does not clone SkinnedMesh bone bindings) into
   each scene, recolored, and set to loop its one walk-cycle animation.
   Scene still works normally if this fails to load (slow network, blocked
   file, older browser) — it's an enhancement, not a dependency.
   ===================================================================== */
const mixers = [];
function setupFigureInstance(sourceScene, clip, parent, position, rotationY, colorHex, scale){
  const inst = cloneSkinned(sourceScene);
  inst.traverse(node => {
    if(node.isMesh || node.isSkinnedMesh){
      node.material = node.material.clone();
      node.material.color.set(colorHex);
      node.castShadow = false; node.receiveShadow = false;
    }
  });
  inst.scale.setScalar(scale);
  inst.position.copy(position);
  inst.rotation.y = rotationY;
  parent.add(inst);
  const mixer = new THREE.AnimationMixer(inst);
  const action = mixer.clipAction(clip);
  action.play();
  mixers.push(mixer);
  return inst;
}
new GLTFLoader().load(RIGGED_FIGURE_GLB, (gltf) => {
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const dims = new THREE.Vector3(); box.getSize(dims);
  const rawHeight = Math.max(dims.x, dims.y, dims.z) || 1; // bind pose axis is unreliable; use the largest extent as "height"
  const targetHeight = 1.68; // metres-equivalent, matching this scene's human-scale geometry
  const scale = targetHeight / rawHeight;
  const clip = gltf.animations[0];
  if(!clip) return;
  // Gajan: the performer, standing at the platform edge facing the flame/wheel
  setupFigureInstance(gltf.scene, clip, groups.gajan, new THREE.Vector3(-0.25, 0.3, 1.15), Math.PI*0.15, 0xB8622E, scale);
  // Patachitra: a member of the collective, standing by the scroll
  setupFigureInstance(gltf.scene, clip, groups.patachitra, new THREE.Vector3(-1.0, 0.0, 0.75), -Math.PI*0.2, 0x2C3E70, scale);
}, undefined, (err) => {
  console.warn("Human figure model failed to load — scene continues without it.", err);
});

let activeScene = "gajan";
function switchScene(name){
  if(filmState.playing) stopFilm();
  activeScene = name;
  groups.gajan.visible = (name === "gajan");
  groups.patachitra.visible = (name === "patachitra");
  gajanDust.visible = (name === "gajan");
  pataDust.visible = (name === "patachitra");
  hotspotPanel.classList.remove("open");
  sceneButtons.forEach(b => b.classList.toggle("active", b.dataset.scene === name));
  controls.target.set(0, name === "gajan" ? 1 : 1.1, 0);
  closeFilmMenu();
}
sceneButtons.forEach(b => b.addEventListener("click", () => switchScene(b.dataset.scene)));

// ---------- interaction: raycast on click/tap to open a hotspot ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function onPointerDown(evt){
  if(filmState.playing) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (evt.clientX ?? (evt.touches && evt.touches[0].clientX));
  const y = (evt.clientY ?? (evt.touches && evt.touches[0].clientY));
  pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const visible = hotspots.filter(h => h.parent.visible);
  const hits = raycaster.intersectObjects(visible, false);
  if(hits.length){
    const h = hits[0].object;
    hotspotTitle.textContent = h.userData.title;
    hotspotBody.textContent = h.userData.body;
    hotspotPanel.classList.add("open");
  }
}
renderer.domElement.addEventListener("pointerdown", onPointerDown);
if(narrateBtn){
  narrateBtn.addEventListener("click", () => {
    if(!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(hotspotTitle.textContent + ". " + hotspotBody.textContent);
    window.speechSynthesis.speak(u);
  });
}
const closeBtn = document.getElementById("hotspot-close");
if(closeBtn) closeBtn.addEventListener("click", () => hotspotPanel.classList.remove("open"));

/* =====================================================================
   Dependency-free tween queue — drives the cinematic camera moves.
   ===================================================================== */
const activeTweens = [];
function easeInOutCubic(x){ return x<0.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }
function tweenTo(obj, to, duration, ease){
  const from = {}; for(const k in to) from[k] = obj[k];
  activeTweens.push({ obj, from, to, duration, elapsed:0, ease: ease||easeInOutCubic });
}
function clearTweensOf(obj){
  for(let i=activeTweens.length-1;i>=0;i--) if(activeTweens[i].obj===obj) activeTweens.splice(i,1);
}
function updateTweens(dt){
  for(let i=activeTweens.length-1;i>=0;i--){
    const tw = activeTweens[i];
    tw.elapsed += dt;
    const p = Math.min(1, tw.elapsed/tw.duration);
    const e = tw.ease(p);
    for(const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k]-tw.from[k])*e;
    if(p>=1) activeTweens.splice(i,1);
  }
}

/* =====================================================================
   The Film — documentary chapters grounded in this project's real
   fieldwork, each with English and Bengali (বাংলা) caption/narration
   text. Chapters[0] is the wide establishing shot and the last entry is
   the wide closing shot; everything between is one named voice. From
   this single master list we also auto-build a short, separate two- or
   three-chapter film per named voice (buildIndividualFilms below), so
   "Play a Film" can play the full documentary OR just one person's
   story — no hand-authored camera moves duplicated.
   ===================================================================== */
function lerp3(a, b, t){ return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, z:a.z+(b.z-a.z)*t }; }

const GAJAN_CHAPTERS = [
  { en:{ title:"Gajan — Paschim Medinipur", body:"A living festival of Lord Shiva, carried through ritual performance, oral knowledge, and bodily practice rather than written record. Five people, five roles, one festival — this is their Gajan." },
    bn:{ title:"গাজন — পশ্চিম মেদিনীপুর", body:"শিবের একটি জীবন্ত উৎসব, যা লিখিত নথির বদলে আচার-অনুষ্ঠান, মৌখিক জ্ঞান এবং শারীরিক অনুশীলনের মধ্য দিয়ে বাহিত হয়ে আসছে। পাঁচজন মানুষ, পাঁচটি ভূমিকা, একটি উৎসব — এই তাঁদের গাজন।" },
    cam:{x:0,y:2.4,z:5.6}, look:{x:0,y:1,z:0} },
  { en:{ title:"Dipak Pramanik — Cultural Memory", body:"Dipak Pramanik has carried Gajan with him since childhood, through every return trip back to Rahatpur. His account treats the festival not as a fixed yearly event, but as a thread tying personal memory to village life — a reason to come home." },
    bn:{ title:"দীপক প্রামাণিক — সাংস্কৃতিক স্মৃতি", body:"দীপক প্রামাণিক শৈশব থেকেই গাজনকে সঙ্গে বহন করে এনেছেন, রাহাতপুরে প্রতিটি ফিরে আসার সঙ্গে। তাঁর বিবরণে উৎসবটি নিছক একটি বাৎসরিক অনুষ্ঠান নয়, বরং ব্যক্তিগত স্মৃতিকে গ্রামজীবনের সঙ্গে জুড়ে রাখা একটি সূত্র — বাড়ি ফেরার একটি কারণ।" },
    cam:{x:-2.2,y:1.8,z:3.2}, look:{x:0,y:0.9,z:0.2} },
  { en:{ title:"Manjulata Pramanik — Devotion & Vows", body:"For nearly fifty years, since her marriage into the village, Manjulata Pramanik has kept Gajan through fasting, vows and prayer — devotional labour carried out for the wellbeing of her children and grandchildren." },
    bn:{ title:"মঞ্জুলতা প্রামাণিক — ভক্তি ও মানত", body:"প্রায় পঞ্চাশ বছর ধরে, গ্রামে বিবাহসূত্রে আসার পর থেকেই, মঞ্জুলতা প্রামাণিক উপবাস, মানত ও প্রার্থনার মধ্য দিয়ে গাজন পালন করে আসছেন — তাঁর সন্তান ও নাতি-নাতনিদের কল্যাণের জন্য এই ভক্তিমূলক শ্রম।" },
    cam:{x:0.9,y:0.95,z:1.7}, look:{x:0.5,y:0.5,z:0.9} },
  { en:{ title:"Soumen Chakrabarty — The Priest's Structure", body:"Priest at Jhareswar Shiva Temple for some twenty years, Soumen Chakrabarty holds the structure the festival runs on — mantras, ceremonial order, and the responsibilities that fall to those who lead worship." },
    bn:{ title:"সৌমেন চক্রবর্তী — পুরোহিতের কাঠামো", body:"প্রায় বিশ বছর ধরে ঝরেশ্বর শিব মন্দিরের পুরোহিত সৌমেন চক্রবর্তী উৎসবটি যে কাঠামোর উপর দাঁড়িয়ে আছে তা ধরে রাখেন — মন্ত্র, আনুষ্ঠানিক ক্রম, এবং পূজা পরিচালনাকারীদের উপর ন্যস্ত দায়িত্ব।" },
    cam:{x:0.3,y:2.6,z:0.9}, look:{x:0,y:1.9,z:-0.8} },
  { en:{ title:"Ankan Karmakar — Watching It Happen", body:"Ankan Karmakar comes to Gajan mostly as an observer: Agun Jhap, fire-jumping; Ban Phora, ritual piercing; Pronam Seba, devotional prostration. His account is how a younger generation meets a tradition it grew up watching, not performing." },
    bn:{ title:"অঙ্কন কর্মকার — ঘটতে দেখা", body:"অঙ্কন কর্মকার গাজনে আসেন মূলত একজন দর্শক হিসেবে — আগুন ঝাঁপ, বাণ ফোঁড়া, প্রণাম সেবা। তাঁর বিবরণ হল, একটি নবীন প্রজন্ম কীভাবে এমন একটি ঐতিহ্যের মুখোমুখি হয় যা দেখে দেখে বড় হয়েছে, পালন করে নয়।" },
    cam:{x:1.1,y:0.55,z:1.3}, look:{x:0.5,y:0.4,z:0.9} },
  { en:{ title:"Nirmal Pramanik — The Performer's Body", body:"Nirmal Pramanik performs Gajan from the inside: fasting, the discipline of Sannyasis and Bhoktas, the dhak setting the ritual's tempo, and the preparation that leads to the Charak Kath — embodied, practical knowledge." },
    bn:{ title:"নির্মল প্রামাণিক — পালনকারীর শরীর", body:"নির্মল প্রামাণিক গাজন পালন করেন ভেতর থেকে — উপবাস, সন্ন্যাসী ও ভক্তদের নিয়মানুবর্তিতা, আচারের ছন্দ বেঁধে দেওয়া ঢাক, এবং চড়ক কাঠ পর্যন্ত পৌঁছনোর প্রস্তুতি — দেহজ, বাস্তব অভিজ্ঞতালব্ধ জ্ঞান।" },
    cam:{x:-0.2,y:1.3,z:1.9}, look:{x:0.3,y:0.95,z:0.5} },
  { en:{ title:"Five Voices, One Festival", body:"A migrated villager, a devotee of fifty years, a temple priest, a young observer, an active performer. Explore freely now, or read every profile in full on the Gajan page." },
    bn:{ title:"পাঁচটি কণ্ঠ, একটি উৎসব", body:"একজন প্রবাসী গ্রামবাসী, পঞ্চাশ বছরের এক ভক্ত, একজন মন্দিরের পুরোহিত, একজন তরুণ দর্শক, একজন সক্রিয় পালনকারী। এখন স্বাধীনভাবে ঘুরে দেখুন, অথবা গাজন পাতায় প্রতিটি পরিচিতি সম্পূর্ণ পড়ুন।" },
    cam:{x:0,y:3.2,z:6.6}, look:{x:0,y:1,z:0} },
];

const PATACHITRA_CHAPTERS = [
  { en:{ title:"Patachitra — Naya Village, Pingla Block", body:"Every one of 176 households in Naya carries the surname Chitrakar — artist — and paints. Patachitra is audio-visual storytelling that predates the moving image: a scroll unrolled panel by panel while the artist sings the story live." },
    bn:{ title:"পটচিত্র — নয়া গ্রাম, পিংলা ব্লক", body:"নয়া গ্রামের ১৭৬টি পরিবারের প্রতিটিরই পদবি চিত্রকর — শিল্পী — এবং প্রত্যেকেই ছবি আঁকেন। পটচিত্র এক শ্রুতি-দৃশ্য আখ্যান-পরম্পরা, যা চলচ্চিত্রেরও আগে থেকে চলে আসছে — শিল্পী জীবন্ত গান গাইতে গাইতে প্যানেল ধরে ধরে পট উন্মোচন করেন।" },
    cam:{x:0,y:1.6,z:3.9}, look:{x:0,y:1.1,z:0} },
  { en:{ title:"Natural Pigments", body:"Every colour is sourced locally and ground by hand — turmeric and marigold for yellow, pomegranate rind and red earth for red, indigo and aparajita flower for blue — then bound with gum from the bel tree and sealed in lacquer after curing over a charcoal fire." },
    bn:{ title:"প্রাকৃতিক রং", body:"প্রতিটি রং স্থানীয়ভাবে সংগ্রহ করে হাতে বাটা হয় — হলুদের জন্য হলুদ ও গাঁদা ফুল, লালের জন্য ডালিমের খোসা ও লাল মাটি, নীলের জন্য নীল ও অপরাজিতা ফুল — তারপর বেল গাছের আঠা দিয়ে বাঁধা হয়, এবং কাঠকয়লার আগুনে শুকিয়ে লাক্ষার প্রলেপে সিল করা হয়।" },
    cam:{x:1.7,y:1.0,z:1.6}, look:{x:1.3,y:0.9,z:0} },
  { en:{ title:"Shiuli Chitrakar — Shobai Mile Koro Gaach Ropon", body:"Shiuli Chitrakar performs “Let's Plant Trees Together” — an ecological call to action that sits, in Naya, comfortably alongside the language of the UN Sustainable Development Goals." },
    bn:{ title:"শিউলি চিত্রকর — সবাই মিলে করো গাছ রোপণ", body:"শিউলি চিত্রকর পরিবেশন করেন “সবাই মিলে করো গাছ রোপণ” — একটি পরিবেশ-সচেতনতামূলক আহ্বান, যা নয়া গ্রামে জাতিসংঘের টেকসই উন্নয়ন লক্ষ্যমাত্রার ভাষার পাশাপাশি সাবলীলভাবে জায়গা করে নেয়।" },
    cam:{x:0,y:1.9,z:1.5}, look:{x:0,y:1.72,z:0.05} },
  { en:{ title:"Ruksana Chitrakar — Saanjher Belae Jamunar Jol", body:"Ruksana Chitrakar sings of dusk on the Jamuna — the hour read, in the Bhakti tradition, as a threshold between the ordinary world and the divine, carried through the story of Radha and Krishna." },
    bn:{ title:"রুকসানা চিত্রকর — সাঁঝের বেলায় যমুনার জল", body:"রুকসানা চিত্রকর গেয়ে ওঠেন যমুনার তীরে সন্ধ্যার কথা — ভক্তি-পরম্পরায় এই প্রহরকে পড়া হয় সাধারণ জগৎ ও দৈবের মধ্যেকার এক সন্ধিক্ষণ হিসেবে, রাধা-কৃষ্ণের আখ্যানের মধ্য দিয়ে বাহিত।" },
    cam:{x:0,y:1.5,z:1.4}, look:{x:0,y:1.28,z:0.05} },
  { en:{ title:"Sabera Chitrakar — Dariya Maacher Biye", body:"Sabera Chitrakar's “Wedding of the River Fish” turns local biodiversity into Bengali wedding custom — the boal fish standing in, folk-allegory fashion, for social hierarchy." },
    bn:{ title:"সাবেরা চিত্রকর — দরিয়া মাছের বিয়ে", body:"সাবেরা চিত্রকরের “দরিয়া মাছের বিয়ে” স্থানীয় জীববৈচিত্র্যকে বাঙালি বিবাহ-রীতিতে রূপান্তরিত করে — বোয়াল মাছ, লোকজ রূপকের ধাঁচে, সামাজিক স্তরবিন্যাসের প্রতীক হয়ে ওঠে।" },
    cam:{x:0,y:0.95,z:1.4}, look:{x:0,y:0.68,z:0.05} },
  { en:{ title:"Five Roles, One Collective", body:"A Master Patua holding institutional memory and pricing. A senior woman performer holding the sung repertoire. A next-generation artisan learning the pigment recipes. A market-facing patua. A community organiser holding it all together." },
    bn:{ title:"পাঁচটি ভূমিকা, একটি সমষ্টি", body:"একজন প্রধান পটুয়া, যিনি ধরে রাখেন প্রাতিষ্ঠানিক স্মৃতি ও মূল্য-নির্ধারণ। একজন প্রবীণা নারী পরিবেশক, যিনি ধরে রাখেন গীত-ভাণ্ডার। পরবর্তী প্রজন্মের এক শিল্পী, যিনি শিখছেন রং তৈরির প্রণালী। একজন বাজারমুখী পটুয়া। এবং একজন সমাজ-সংগঠক, যিনি সবটা একসূত্রে বেঁধে রাখেন।" },
    cam:{x:-1.7,y:1.3,z:2.5}, look:{x:0.2,y:1.0,z:0.1} },
  { en:{ title:"Painted and Sung", body:"Not a solitary artist, but a village collective — a scroll that is performed, not just displayed. Explore freely now, or read every profile in full on the Patachitra page." },
    bn:{ title:"আঁকা ও গাওয়া", body:"একক কোনো শিল্পী নন, বরং একটি গ্রাম-সমষ্টি — এমন এক পট, যা শুধু প্রদর্শিত হয় না, পরিবেশিতও হয়। এখন স্বাধীনভাবে ঘুরে দেখুন, অথবা পটচিত্র পাতায় প্রতিটি পরিচিতি সম্পূর্ণ পড়ুন।" },
    cam:{x:0,y:2.0,z:4.3}, look:{x:0,y:1.1,z:0} },
];

function splitNameRole(s){
  const parts = s.split(" — ");
  return parts.length > 1 ? { name: parts[0], role: parts.slice(1).join(" — ") } : { name: s, role: "" };
}
// Build one short (2-3 chapter) film per named voice out of a master
// chapter list, plus a "full" entry that is the whole documentary.
function buildFilmSet(chapters, ids, sceneLabel){
  const wide = chapters[0], close = chapters[chapters.length - 1];
  const set = {
    full: { id:"full", label:{ en:"Full Documentary", bn:"সম্পূর্ণ তথ্যচিত্র" }, chapters },
  };
  ids.forEach((id, idx) => {
    const ch = chapters[idx + 1];
    const enSplit = splitNameRole(ch.en.title), bnSplit = splitNameRole(ch.bn.title);
    const estCam = lerp3(wide.cam, ch.cam, 0.45), estLook = lerp3(wide.look, ch.look, 0.45);
    const outCam = lerp3(close.cam, ch.cam, 0.4), outLook = lerp3(close.look, ch.look, 0.4);
    set[id] = {
      id, label: { en: enSplit.name, bn: bnSplit.name },
      chapters: [
        { en:{ title: enSplit.name, body: enSplit.role || sceneLabel.en }, bn:{ title: bnSplit.name, body: bnSplit.role || sceneLabel.bn }, cam: estCam, look: estLook },
        { en: ch.en, bn: ch.bn, cam: ch.cam, look: ch.look },
        { en:{ title: enSplit.name, body:"Part of the " + sceneLabel.en + " documentary — watch the Full Documentary for every voice, or keep exploring freely." },
          bn:{ title: bnSplit.name, body: sceneLabel.bn + " তথ্যচিত্রের একটি অংশ — প্রতিটি কণ্ঠ শুনতে সম্পূর্ণ তথ্যচিত্র দেখুন, অথবা স্বাধীনভাবে ঘুরে দেখতে থাকুন।" }, cam: outCam, look: outLook },
      ],
    };
  });
  return set;
}
const GAJAN_FILMS = buildFilmSet(GAJAN_CHAPTERS, ["dipak","manjulata","soumen","ankan","nirmal"], { en:"Gajan", bn:"গাজন" });
// Patachitra's master list has a non-person "Natural Pigments" chapter at
// index 1 interleaved with the three named performers, so it's built by
// hand rather than via the generic by-index mapper above.
const PATACHITRA_FILMS_FINAL = (function(){
  const chapters = PATACHITRA_CHAPTERS, wide = chapters[0], close = chapters[chapters.length-1];
  const set = { full: { id:"full", label:{ en:"Full Documentary", bn:"সম্পূর্ণ তথ্যচিত্র" }, chapters } };
  [ ["pigments", 1, true], ["shiuli", 2, false], ["ruksana", 3, false], ["sabera", 4, false] ].forEach(([id, idx, isProcess]) => {
    const ch = chapters[idx];
    const enSplit = isProcess ? { name: ch.en.title, role:"" } : splitNameRole(ch.en.title);
    const bnSplit = isProcess ? { name: ch.bn.title, role:"" } : splitNameRole(ch.bn.title);
    const estCam = lerp3(wide.cam, ch.cam, 0.45), estLook = lerp3(wide.look, ch.look, 0.45);
    const outCam = lerp3(close.cam, ch.cam, 0.4), outLook = lerp3(close.look, ch.look, 0.4);
    set[id] = {
      id, label: { en: enSplit.name, bn: bnSplit.name },
      chapters: [
        { en:{ title: enSplit.name, body: enSplit.role || "How this scroll gets its colour." }, bn:{ title: bnSplit.name, body: bnSplit.role || "এই পট যেভাবে তার রং পায়।" }, cam: estCam, look: estLook },
        { en: ch.en, bn: ch.bn, cam: ch.cam, look: ch.look },
        { en:{ title: enSplit.name, body:"Part of the Patachitra documentary — watch the Full Documentary for every voice, or keep exploring freely." },
          bn:{ title: bnSplit.name, body:"পটচিত্র তথ্যচিত্রের একটি অংশ — প্রতিটি কণ্ঠ শুনতে সম্পূর্ণ তথ্যচিত্র দেখুন, অথবা স্বাধীনভাবে ঘুরে দেখতে থাকুন।" }, cam: outCam, look: outLook },
      ],
    };
  });
  return set;
})();

const filmState = {
  playing: false, paused: false, scene: null, filmId: null, chapters: null,
  index: 0, chapterElapsed: 0, chapterDuration: 10, lang: "en",
};
const camProxy = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
const lookProxy = { x: controls.target.x, y: controls.target.y, z: controls.target.z };

const captionEl = document.getElementById("film-caption");
const chapterNumEl = document.getElementById("film-chapter-num");
const filmTitleEl = document.getElementById("film-title");
const filmBodyEl = document.getElementById("film-body");
const dotsEl = document.getElementById("film-dots");
const playPauseBtn = document.getElementById("film-playpause");
const filmMenuBtn = document.getElementById("film-menu-btn");
const filmMenuEl = document.getElementById("film-menu");
const langBtns = Array.from(document.querySelectorAll(".lang-btn"));
const langNote = document.getElementById("film-lang-note");

function filmSetFor(sceneName){ return sceneName === "gajan" ? GAJAN_FILMS : PATACHITRA_FILMS_FINAL; }

// Bengali narration needs a Bengali voice installed in the browser —
// feature-detect rather than letting the default voice mangle the text.
let bnVoice = null, voicesChecked = false;
function refreshVoices(){
  if(!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if(voices && voices.length){
    bnVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("bn")) || null;
    voicesChecked = true;
    if(langNote) langNote.textContent = (filmState.lang === "bn" && !bnVoice)
      ? "No Bengali voice found on this device — showing Bengali captions without spoken narration."
      : "";
  }
}
if(window.speechSynthesis){
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function buildFilmMenu(){
  if(!filmMenuEl) return;
  filmMenuEl.innerHTML = "";
  const set = filmSetFor(activeScene);
  ["full", ...Object.keys(set).filter(k => k !== "full")].forEach(id => {
    const f = set[id];
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role","menuitem");
    b.className = "film-menu-item" + (id === "full" ? " full" : "");
    b.textContent = (id === "full" ? "▶ " : "") + f.label[filmState.lang];
    b.addEventListener("click", () => { closeFilmMenu(); startFilm(id); });
    filmMenuEl.appendChild(b);
  });
}
function openFilmMenu(){ buildFilmMenu(); filmMenuEl.classList.add("open"); filmMenuBtn.setAttribute("aria-expanded","true"); }
function closeFilmMenu(){ filmMenuEl.classList.remove("open"); filmMenuBtn.setAttribute("aria-expanded","false"); }
if(filmMenuBtn){
  filmMenuBtn.addEventListener("click", (e) => { e.stopPropagation(); filmMenuEl.classList.contains("open") ? closeFilmMenu() : openFilmMenu(); });
  document.addEventListener("click", (e) => { if(!filmMenuEl.contains(e.target) && e.target !== filmMenuBtn) closeFilmMenu(); });
}
langBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filmState.lang = btn.dataset.lang;
    langBtns.forEach(b => b.classList.toggle("active", b === btn));
    refreshVoices();
    if(filmState.playing) renderChapterText();
  });
});

function buildDots(n){
  dotsEl.innerHTML = "";
  for(let i=0;i<n;i++){
    const d = document.createElement("button");
    d.type = "button"; d.className = "film-dot"; d.setAttribute("aria-label","Chapter "+(i+1));
    d.addEventListener("click", () => goToChapter(i));
    dotsEl.appendChild(d);
  }
}
function updateDots(){
  Array.from(dotsEl.children).forEach((d,i) => d.classList.toggle("active", i===filmState.index));
}

function startFilm(filmId){
  const sceneName = activeScene;
  const film = filmSetFor(sceneName)[filmId];
  if(!film) return;
  filmState.playing = true; filmState.paused = false;
  filmState.scene = sceneName; filmState.filmId = filmId;
  lastFilmId = filmId;
  filmState.chapters = film.chapters;
  filmState.index = -1;
  controls.enabled = false;
  camProxy.x = camera.position.x; camProxy.y = camera.position.y; camProxy.z = camera.position.z;
  lookProxy.x = controls.target.x; lookProxy.y = controls.target.y; lookProxy.z = controls.target.z;
  hotspotPanel.classList.remove("open");
  canvasHost.classList.add("film-mode");
  buildDots(filmState.chapters.length);
  setPlayPauseIcon(true);
  goToChapter(0);
}
function stopFilm(){
  if(!filmState.playing) return;
  filmState.playing = false; filmState.paused = false;
  canvasHost.classList.remove("film-mode");
  captionEl.classList.remove("in");
  if(window.speechSynthesis) window.speechSynthesis.cancel();
  clearTweensOf(camProxy); clearTweensOf(lookProxy);
  controls.target.set(lookProxy.x, lookProxy.y, lookProxy.z);
  controls.enabled = true;
}
function renderChapterText(){
  const ch = filmState.chapters[filmState.index];
  const t = ch[filmState.lang] || ch.en;
  chapterNumEl.textContent = "Chapter " + (filmState.index+1) + " / " + filmState.chapters.length;
  filmTitleEl.textContent = t.title;
  filmBodyEl.textContent = t.body;
  updateXrCaption();
}
function goToChapter(i){
  const chapters = filmState.chapters;
  if(i<0 || i>=chapters.length){ stopFilm(); return; }
  filmState.index = i;
  filmState.chapterElapsed = 0;
  const ch = chapters[i];
  const t = ch[filmState.lang] || ch.en;
  const estSeconds = Math.min(18, Math.max(8, t.body.length*0.065));
  filmState.chapterDuration = estSeconds;
  clearTweensOf(camProxy); clearTweensOf(lookProxy);
  tweenTo(camProxy, ch.cam, 2.4);
  tweenTo(lookProxy, ch.look, 2.4);

  captionEl.classList.remove("in");
  if(window.speechSynthesis) window.speechSynthesis.cancel();
  setTimeout(() => {
    if(!filmState.playing || filmState.index !== i) return;
    renderChapterText();
    captionEl.classList.add("in");
    updateDots();
    if(window.speechSynthesis && !filmState.paused){
      const txt = (t.title + ". " + t.body);
      const u = new SpeechSynthesisUtterance(txt);
      if(filmState.lang === "bn"){
        if(bnVoice){ u.voice = bnVoice; u.lang = bnVoice.lang; window.speechSynthesis.speak(u); }
        // else: no Bengali voice on this device — captions still show, audio silently skipped
      } else {
        window.speechSynthesis.speak(u);
      }
    }
  }, 260);
}
function nextChapter(){ goToChapter(filmState.index+1); }
function prevChapter(){ goToChapter(Math.max(0, filmState.index-1)); }
function setPlayPauseIcon(playing){
  if(playPauseBtn){ playPauseBtn.textContent = playing ? "⏸" : "▶"; playPauseBtn.setAttribute("aria-label", playing ? "Pause" : "Play"); }
}
function togglePause(){
  if(!filmState.playing) return;
  filmState.paused = !filmState.paused;
  setPlayPauseIcon(!filmState.paused);
  if(window.speechSynthesis){
    if(filmState.paused && window.speechSynthesis.speaking) window.speechSynthesis.pause();
    else if(!filmState.paused && window.speechSynthesis.paused) window.speechSynthesis.resume();
  }
}
function updateFilm(dt){
  if(!filmState.playing || filmState.paused) return;
  filmState.chapterElapsed += dt;
  if(filmState.chapterElapsed >= filmState.chapterDuration) nextChapter();
}

const filmPrevBtn = document.getElementById("film-prev");
const filmNextBtn = document.getElementById("film-next");
const filmExitBtn = document.getElementById("film-exit");
if(filmPrevBtn) filmPrevBtn.addEventListener("click", prevChapter);
if(filmNextBtn) filmNextBtn.addEventListener("click", nextChapter);
if(filmExitBtn) filmExitBtn.addEventListener("click", stopFilm);
if(playPauseBtn) playPauseBtn.addEventListener("click", togglePause);

/* =====================================================================
   The same films, inside AR and VR.

   Three things have to change once a headset or phone-AR session owns the
   camera: the camera can no longer be flown (so the world moves instead,
   via worldRig), the HTML caption is no longer on screen (so the caption
   becomes a panel floating in the scene), and there is no mouse to press
   Next with (so a controller trigger or a screen tap advances a chapter).
   ===================================================================== */
scene.add(camera); // camera-parented HUD only renders if the camera is in the graph

const CAPTION_W = 1024, CAPTION_H = 420;
const capCanvas = document.createElement("canvas");
capCanvas.width = CAPTION_W; capCanvas.height = CAPTION_H;
const capCtx = capCanvas.getContext("2d");
const capTexture = new THREE.CanvasTexture(capCanvas);
capTexture.colorSpace = THREE.SRGBColorSpace;
const xrCaption = new THREE.Mesh(
  new THREE.PlaneGeometry(1.1, 1.1 * CAPTION_H / CAPTION_W),
  new THREE.MeshBasicMaterial({ map: capTexture, transparent: true, depthTest: false })
);
xrCaption.position.set(0, -0.32, -1.35);
xrCaption.renderOrder = 999;
xrCaption.visible = false;
camera.add(xrCaption);

function wrapText(ctx, text, maxWidth){
  const words = String(text).split(/\s+/), lines = [];
  let line = "";
  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if(ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = w; }
    else line = test;
  });
  if(line) lines.push(line);
  return lines;
}
function drawXrCaption(chapterLabel, title, body){
  const ctx = capCtx;
  ctx.clearRect(0, 0, CAPTION_W, CAPTION_H);
  ctx.fillStyle = "rgba(11,14,24,.82)";
  roundRect(ctx, 0, 0, CAPTION_W, CAPTION_H, 26); ctx.fill();
  ctx.strokeStyle = "rgba(231,169,60,.55)"; ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, CAPTION_W-3, CAPTION_H-3, 26); ctx.stroke();

  ctx.textBaseline = "top";
  ctx.fillStyle = "#e7a93c";
  ctx.font = "500 26px 'Space Mono', monospace";
  ctx.fillText(chapterLabel, 44, 34);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 46px 'Playfair Display', Georgia, serif";
  const titleLines = wrapText(ctx, title, CAPTION_W - 88).slice(0, 2);
  let y = 78;
  titleLines.forEach(l => { ctx.fillText(l, 44, y); y += 54; });

  ctx.fillStyle = "#f1ead8";
  ctx.font = "400 29px Georgia, serif";
  const bodyLines = wrapText(ctx, body, CAPTION_W - 88).slice(0, 6);
  y += 8;
  bodyLines.forEach(l => { ctx.fillText(l, 44, y); y += 40; });

  capTexture.needsUpdate = true;
}
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);     ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function updateXrCaption(){
  if(!filmState.playing || !filmState.chapters) return;
  const ch = filmState.chapters[filmState.index];
  if(!ch) return;
  const t = ch[filmState.lang] || ch.en;
  drawXrCaption("Chapter " + (filmState.index+1) + " / " + filmState.chapters.length, t.title, t.body);
}

// Move the world so the viewer ends up where the film's camera would be.
// This must be a camera, not a plain Object3D: Object3D.lookAt() aims +Z at
// the target, a camera aims -Z. Get that wrong and every chapter in VR puts
// the subject directly behind the viewer's head.
const _filmPose = new THREE.PerspectiveCamera();
function applyFilmRigForXR(){
  _filmPose.position.set(camProxy.x, camProxy.y, camProxy.z);
  _filmPose.lookAt(lookProxy.x, lookProxy.y, lookProxy.z);
  _filmPose.updateMatrixWorld(true);
  worldRig.matrixAutoUpdate = false;
  worldRig.matrix.copy(_filmPose.matrixWorld).invert();
  worldRig.matrixWorldNeedsUpdate = true;
}
function resetWorldRig(){
  worldRig.matrixAutoUpdate = true;
  worldRig.position.set(0,0,0); worldRig.rotation.set(0,0,0); worldRig.scale.set(1,1,1);
  worldRig.updateMatrix(); worldRig.matrixWorldNeedsUpdate = true;
}

// Entering AR/VR starts the film you picked last (the full documentary by
// default), so a headset viewer lands inside the narrated piece rather than
// an empty room with no way to press play.
let lastFilmId = "full";
renderer.xr.addEventListener("sessionstart", () => {
  if(gyroOn) toggleGyro();
  if(immersiveOn) exitImmersive();
  controls.enabled = false;
  if(!filmState.playing) startFilm(lastFilmId);
  xrCaption.visible = true;
  updateXrCaption();
});
renderer.xr.addEventListener("sessionend", () => {
  xrCaption.visible = false;
  stopFilm();
  resetWorldRig();
  controls.enabled = true;
  resize();
});

// A controller trigger in VR, or a tap on the screen in phone AR, moves the
// film on a chapter — the only "Next" available once the DOM is out of view.
[0, 1].forEach(i => {
  const ctrl = renderer.xr.getController(i);
  ctrl.addEventListener("select", () => { if(filmState.playing) nextChapter(); });
  scene.add(ctrl);
});

// ---------- animation loop ----------
const clock = new THREE.Clock();
function animate(){
  const dt = Math.min(0.05, clock.getDelta()), t = clock.getElapsedTime();

  // Gajan: rotate wheel, drift flame particles, flicker light
  const gg = groups.gajan.userData;
  if(gg.wheel) gg.wheel.rotation.z += dt * 0.6;
  if(gg.flame){
    const posAttr = gg.flame.geometry.attributes.position;
    for(let i=0;i<posAttr.count;i++){
      let y = posAttr.getY(i) + gg.flameVel[i];
      if(y > 0.65){ y = 0; }
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  }
  if(gg.flameLight) gg.flameLight.intensity = 1.8 + Math.sin(t*9)*0.5 + Math.random()*0.2;
  if(gg.flameGlow) gg.flameGlow.material.opacity = 0.7 + Math.sin(t*9)*0.12 + Math.random()*0.05;

  // Patachitra: gently rotate pigment pots, bob the brush, slow unroll pulse
  const pg = groups.patachitra.userData;
  if(pg.pots) pg.pots.children.forEach((pot,i) => {
    const ang = pot.userData.angle + t*0.3;
    pot.position.x = Math.cos(ang)*1.3; pot.position.z = Math.sin(ang)*1.3;
    pot.position.y = 0.9 + Math.sin(t*1.4+i)*0.08;
  });
  if(pg.brush){ pg.brush.position.y = 1.3 + Math.sin(t*1.1)*0.06; pg.brush.rotation.z = 0.6 + Math.sin(t*0.8)*0.1; }

  // atmosphere drift
  [gajanDust, pataDust].forEach(dust => {
    const pa = dust.geometry.attributes.position, base = dust.userData.base, seed = dust.userData.seed;
    for(let i=0;i<pa.count;i++){
      pa.setX(i, base[i*3] + Math.sin(t*0.15+seed[i])*0.3);
      pa.setY(i, (base[i*3+1] + t*0.05) % 2.6);
      pa.setZ(i, base[i*3+2] + Math.cos(t*0.12+seed[i])*0.3);
    }
    pa.needsUpdate = true;
  });

  hotspots.forEach(h => { if(h.material.visible !== false) h.scale.setScalar(1 + Math.sin(t*3 + h.position.x)*0.15); });

  mixers.forEach(m => m.update(dt));
  updateTweens(dt);
  updateFilm(dt);

  const inXR = renderer.xr.isPresenting;
  xrCaption.visible = inXR && filmState.playing;
  if(filmState.playing && inXR){
    applyFilmRigForXR();          // headset owns the camera: move the world
  } else if(filmState.playing){
    camera.position.set(camProxy.x, camProxy.y, camProxy.z);
    camera.lookAt(lookProxy.x, lookProxy.y, lookProxy.z);
  } else if(gyroOn){
    applyGyroToCamera();
  } else if(!inXR){
    controls.update();
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// initial sizing
requestAnimationFrame(resize);
setStatus("");
