import * as THREE from 'three';
import { CONFIG } from './config.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 uvScale;
  uniform float opacity;
  uniform sampler2D mask;
  varying vec2 vUv;

  vec4 sampleVideo(vec2 uv) {
    return texture2D(map, (uv - 0.5) * uvScale + 0.5);
  }

  float brushMask(vec2 uv) {
    return texture2D(mask, uv).a;
  }

  void main() {
    vec4 color = sampleVideo(vUv);
    gl_FragColor = vec4(color.rgb, brushMask(vUv) * opacity);
  }
`;

const geometry = new THREE.PlaneGeometry(1, 1);
const LAYERS = 64;
const invSmoothstep = y => 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3);

function paintBrush(points) {
  const half = CONFIG.BRUSH_WIDTH / 2;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const left = Math.min(...xs) - half;
  const top = Math.min(...ys) - half;
  const w = Math.ceil(Math.max(...xs) + half - left);
  const h = Math.ceil(Math.max(...ys) + half - top);

  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d');
  ctx.translate(-left, -top);
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,255,255,${1 / LAYERS})`;
  ctx.beginPath();
  for (const p of points) ctx.lineTo(p.x, p.y);
  const last = points.at(-1);
  ctx.lineTo(last.x + 0.01, last.y);

  for (let k = 1; k <= LAYERS; k++) {
    const r = CONFIG.MASK_INNER + (1 - CONFIG.MASK_INNER) * invSmoothstep(1 - k / LAYERS);
    ctx.lineWidth = 2 * half * r;
    ctx.stroke();
  }
  return { canvas, x: left + w / 2, y: top + h / 2, w, h };
}

export function createVideoLayer(src, path, order) {
  const brush = paintBrush(path);
  const video = Object.assign(document.createElement('video'), {
    src, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous',
  });

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      map: { value: new THREE.VideoTexture(video) },
      uvScale: { value: new THREE.Vector2(1, 1) },
      opacity: { value: 0 },
      mask: { value: new THREE.CanvasTexture(brush.canvas) },
    },
  });

  video.addEventListener('loadedmetadata', () => {
    const ratio = (video.videoWidth / video.videoHeight) / (brush.w / brush.h);
    material.uniforms.uvScale.value.set(Math.min(1, 1 / ratio), Math.min(1, ratio));
  });
  video.play()
    .catch(() => {
      console.warn('autoplay with sound blocked, falling back to muted', src);
      video.muted = true;
      return video.play();
    })
    .catch(err => console.error('video play failed', src, err));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(brush.w, brush.h, 1);
  mesh.position.set(brush.x, -brush.y, 0);
  mesh.renderOrder = order;

  const born = performance.now();
  return {
    mesh,
    update(now) {
      material.uniforms.opacity.value = Math.min(1, (now - born) / CONFIG.FADE_IN_MS);
    },
  };
}
