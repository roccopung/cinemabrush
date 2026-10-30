import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDwell } from '../src/dwell.js';
import { createSpawner } from '../src/spawner.js';
import { CONFIG } from '../src/config.js';

const D = CONFIG.DWELL_MS;

const feed = (dwell, fn, ms, hz = 60, t0 = 0) => {
  const hits = [];
  for (let t = t0; t <= t0 + ms; t += 1000 / hz) {
    const r = dwell.push(...fn(t), t);
    if (r.hit) hits.push({ t, ...r.centroid });
  }
  return hits;
};

test('steady gaze fires once after DWELL_MS, then needs another full window', () => {
  const hits = feed(createDwell(CONFIG), () => [400, 300], 2 * D + 100);
  assert.equal(hits.length, 2);
  assert.ok(hits[0].t >= D && hits[0].t < D + 100);
  assert.ok(hits[1].t >= 2 * D);
  assert.deepEqual([hits[0].x, hits[0].y], [400, 300]);
});

test('jitter inside the box fires, a sample outside it does not', () => {
  assert.equal(feed(createDwell(CONFIG), t => [500 + 100 * Math.sin(t), 500 + 100 * Math.cos(t)], D + 100).length, 1);
  assert.equal(feed(createDwell(CONFIG), t => [t < D / 2 ? 100 : 500, 300], D + 100).length, 0);
});

test('too few samples never fires', () => {
  assert.equal(feed(createDwell(CONFIG), () => [0, 0], 2 * D, 3).length, 0);
});

test('reset clears progress', () => {
  const d = createDwell(CONFIG);
  feed(d, () => [0, 0], D - 100);
  d.reset();
  assert.equal(feed(d, () => [0, 0], D - 100, 30, D).length, 0);
});

test('spawner requires MIN_OFFSET on x or y from every center', () => {
  const s = createSpawner(CONFIG.MIN_OFFSET);
  assert.ok(s.tryAdd({ x: 500, y: 500 }).ok);
  assert.ok(!s.tryAdd({ x: 550, y: 550 }).ok);
  assert.ok(s.tryAdd({ x: 600, y: 520 }).ok);
  assert.ok(s.tryAdd({ x: 550, y: 400 }).ok);
  assert.ok(!s.tryAdd({ x: 560, y: 480 }).ok);
  assert.equal(s.centers.length, 3);
});
