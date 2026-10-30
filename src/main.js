import * as THREE from 'three';
import { CONFIG } from './config.js';
import { gaze } from './gaze.js';
import { calibrate } from './calibration.js';
import { createDwell } from './dwell.js';
import { createSpawner } from './spawner.js';
import { createVideoLayer } from './videoLayer.js';
import { debug } from './debug.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setClearColor(0x000000);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -1, 1);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.right = innerWidth;
  camera.bottom = -innerHeight;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);

const manifest = await (await fetch('/videos/manifest.json')).json();
const recent = [];
function pickVideo() {
  const pool = manifest.filter(f => !recent.includes(f));
  const file = pool[Math.floor(Math.random() * pool.length)];
  recent.push(file);
  if (recent.length > Math.min(3, manifest.length - 1)) recent.shift();
  return `/videos/${file}`;
}

const dwell = createDwell(CONFIG);
const spawner = createSpawner(CONFIG.MIN_OFFSET);
const layers = [];
let trail = [];
let point = null;
let dwellState = null;

function spawn(path) {
  const layer = createVideoLayer(pickVideo(), path, layers.length);
  layers.push(layer);
  scene.add(layer.mesh);
}

function onSample(s) {
  point = s;
  if (!s) {
    if (gaze.drag && trail.length) spawn(trail);
    dwell.reset();
    dwellState = null;
    trail = [];
    return;
  }
  debug.countSample();
  trail.push(s);
  while (s.t - trail[0].t > CONFIG.BRUSH_TRAIL_MS) trail.shift();
  if (gaze.drag) return;
  dwellState = dwell.push(s.x, s.y, s.t);
  if (!dwellState.hit) return;

  const center = dwellState.centroid;
  const { ok, clash } = spawner.tryAdd(center);
  if (debug.on) {
    ok ? console.log('accepted', center)
       : console.log('rejected', center, 'within', CONFIG.MIN_OFFSET, 'px on both axes of', clash);
  }
  if (!ok) return;
  spawn(trail);
  trail = [];
}

const cursor = document.getElementById('cursor');
for (const input of document.querySelectorAll('#controls input')) {
  const keys = input.dataset.keys.split(' ');
  input.value = CONFIG[keys[0]];
  const apply = () => {
    for (const key of keys) CONFIG[key] = +input.value;
    cursor.style.width = cursor.style.height = `${CONFIG.DWELL_SIZE}px`;
  };
  input.oninput = apply;
  apply();
}
addEventListener('pointermove', e => { cursor.style.translate = `${e.clientX}px ${e.clientY}px`; });

function start() {
  document.getElementById('start').remove();
  document.getElementById('controls').hidden = false;
  cursor.hidden = false;
  gaze.onSample(onSample);
  addEventListener('keydown', e => {
    if (e.key === 'm' || e.key === 'M') gaze.toggleMode();
    if (e.key === 'd' || e.key === 'D') {
      debug.toggle();
      gaze.setDebug(debug.on);
    }
  });
  renderer.setAnimationLoop(now => {
    for (const l of layers) l.update(now);
    renderer.render(scene, camera);
    debug.draw({ point, dwell: dwellState, centers: spawner.centers, videos: layers.length, mode: gaze.mode });
  });
}

document.getElementById('start-mouse').onclick = start;
document.getElementById('start-drag').onclick = () => {
  gaze.setDrag(true);
  start();
};
document.getElementById('start-gaze').onclick = async () => {
  document.getElementById('start').hidden = true;
  try {
    await gaze.startTracking();
  } catch (err) {
    alert(`Camera unavailable: ${err.message}`);
    document.getElementById('start').hidden = false;
    return;
  }
  await calibrate();
  gaze.endCalibration();
  gaze.setDebug(debug.on);
  start();
};
