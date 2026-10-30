export const CONFIG = {
  DWELL_MS: 300,
  DWELL_SIZE: 50,      // px, side of the dwell box
  MIN_SAMPLES: 15,
  MIN_OFFSET: 100,      // px, min distance on x OR y from every previous center
  SMOOTHING: 0.1,       // EMA factor for gaze samples
  MASK_INNER: 0.1,      // 0..1, opaque core of the brush stroke, as a fraction of its half-width
  BRUSH_WIDTH: 100,     // px, full width of a brush stroke
  BRUSH_TRAIL_MS: 5000, // how much of the mouse path since the previous spawn becomes the stroke
  FADE_IN_MS: 100,
  CALIBRATION_CLICKS: 5,
};
