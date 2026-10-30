export function createDwell(cfg) {
  const { DWELL_MS, MIN_SAMPLES } = cfg;
  let buf = [];

  return {
    reset() { buf = []; },

    push(x, y, t) {
      buf.push({ x, y, t });
      // keep one sample at/beyond the window edge so the buffer can actually span DWELL_MS
      while (buf.length > 1 && t - buf[1].t >= DWELL_MS) buf.shift();

      const centroid = {
        x: buf.reduce((s, p) => s + p.x, 0) / buf.length,
        y: buf.reduce((s, p) => s + p.y, 0) / buf.length,
      };
      const half = cfg.DWELL_SIZE / 2;
      const progress = Math.min(1, (t - buf[0].t) / DWELL_MS);
      const hit = progress === 1 && buf.length >= MIN_SAMPLES &&
        buf.every(p => Math.abs(p.x - centroid.x) <= half && Math.abs(p.y - centroid.y) <= half);

      if (hit) buf = [];
      return { centroid, progress, hit };
    },
  };
}
