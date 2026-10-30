import { CONFIG } from './config.js';

const { webgazer } = window;

let mode = 'mouse';
let tracking = false;
let smoothed = null;
let mouse = null;
let drag = false;
let pressed = false;
let listener = () => {};

function feed(p) {
  if (!p) {
    smoothed = null;
    return listener(null);
  }
  const a = CONFIG.SMOOTHING;
  smoothed = smoothed
    ? { x: smoothed.x + a * (p.x - smoothed.x), y: smoothed.y + a * (p.y - smoothed.y) }
    : { x: p.x, y: p.y };
  listener({ ...smoothed, t: performance.now() });
}

const setMouse = e => {
  const ui = e.target.closest?.('#controls');
  if (e.type === 'pointerdown') pressed = !ui;
  if (e.type === 'pointerup') pressed = false;
  mouse = !ui && (!drag || pressed) ? { x: e.clientX, y: e.clientY } : null;
};
addEventListener('pointermove', setMouse);
addEventListener('pointerdown', setMouse);
addEventListener('pointerup', setMouse);
(function tick() {
  if (mode === 'mouse') feed(mouse);
  requestAnimationFrame(tick);
})();

export const gaze = {
  get mode() { return mode; },
  get drag() { return drag; },

  onSample(fn) { listener = fn; },

  setDrag(on) {
    drag = on;
    mouse = null;
  },

  async startTracking() {
    webgazer.saveDataAcrossSessions(false);
    webgazer.setGazeListener(d => { if (mode === 'gaze') feed(d); });
    await webgazer.begin();
    tracking = true;
    mode = 'gaze';
  },

  endCalibration() {
    webgazer.removeMouseEventListeners();
  },

  setDebug(on) {
    if (tracking) webgazer.showVideoPreview(on).showPredictionPoints(on);
  },

  toggleMode() {
    if (!tracking) return console.warn('eye tracking not started, staying in mouse mode');
    mode = mode === 'gaze' ? 'mouse' : 'gaze';
    mode === 'gaze' ? webgazer.resume() : webgazer.pause();
    feed(null);
  },
};
