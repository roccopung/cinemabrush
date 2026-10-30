import { CONFIG } from './config.js';

const canvas = document.createElement('canvas');
canvas.id = 'debug';
const ctx = canvas.getContext('2d');
let samples = 0;
let rate = 0;
setInterval(() => { rate = samples; samples = 0; }, 1000);

export const debug = {
  on: false,

  toggle() {
    this.on = !this.on;
    this.on ? document.body.append(canvas) : canvas.remove();
  },

  countSample() { samples++; },

  draw({ point, dwell, centers, videos, mode }) {
    if (!this.on) return;
    if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;

    ctx.strokeStyle = '#0ff';
    for (const c of centers) {
      ctx.beginPath();
      ctx.moveTo(c.x - 8, c.y); ctx.lineTo(c.x + 8, c.y);
      ctx.moveTo(c.x, c.y - 8); ctx.lineTo(c.x, c.y + 8);
      ctx.stroke();
    }

    if (dwell) {
      const s = CONFIG.DWELL_SIZE;
      const { x, y } = dwell.centroid;
      ctx.strokeStyle = 'rgba(255,255,0,0.6)';
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
      ctx.fillStyle = '#ff0';
      ctx.fillRect(x - s / 2, y + s / 2 + 4, s * dwell.progress, 4);
    }

    if (point) {
      ctx.fillStyle = '#f0f';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    ctx.fillText(`mode ${mode} · videos ${videos} · ${rate} samples/s`, 12, innerHeight - 12);
  },
};
