# Gaze Cinema (prototype)

A browser piece driven by webcam eye tracking. When the viewer keeps looking at the same area of the screen for 3 seconds, a new video (an extract from a public-domain film) appears centered on that spot. Videos accumulate and overlap. Each one is shown through a soft elliptical gradient mask, so they blend into each other instead of reading as rectangles.

This is a prototype. Performance is explicitly not a concern for now: the goal is to have many videos playing at once.

## Stack

- Vite (vanilla JS, no framework)
- Three.js for rendering (one plane per video, `VideoTexture` + custom `ShaderMaterial`)
- WebGazer.js for webcam gaze estimation

## Core behavior

### 1. Gaze input

- Use WebGazer to get gaze predictions `{x, y}` in viewport pixels.
- Smooth raw predictions with an exponential moving average (configurable factor) before feeding the dwell detector. Raw WebGazer output is noisy and drifts.
- If no face or no prediction is available, reset the dwell buffer.
- Implement a **mouse fallback mode** (toggle with `M`) that feeds the mouse position into the same pipeline instead of gaze. This is needed for development without calibrating every time.

### 2. Calibration screen

- Before the piece starts, show a simple calibration screen: 9 dots (3×3 grid), the viewer looks at each dot and clicks it a few times (WebGazer learns from click + gaze pairs).
- After calibration, hide WebGazer's default video preview and prediction dot (unless debug mode is on), then start the piece.
- Camera permission is requested on a user gesture (a "Start" button).

### 3. Dwell detection (rolling centroid)

- Keep a buffer of timestamped smoothed gaze samples covering the last `DWELL_MS` (3000 ms).
- On each new sample:
  1. Drop samples older than `DWELL_MS`.
  2. Only evaluate if the buffer actually spans at least `DWELL_MS` (oldest sample is ≥ 3000 ms old) and has at least `MIN_SAMPLES` samples.
  3. Compute the centroid of all samples in the buffer.
  4. The dwell is valid if **every** sample is within a `DWELL_SIZE × DWELL_SIZE` box (300×300 px) centered on the centroid, i.e. `|sample.x - c.x| <= 150` and `|sample.y - c.y| <= 150`.
- When a dwell is valid, it produces a **candidate center** = the centroid. Then clear the buffer, so a new dwell needs another full 3 s.

### 4. Spawn rule

- Keep a list of all previous spawn centers.
- A candidate center spawns a new video only if, **for every previous center**, it differs by at least `MIN_OFFSET` (100 px) in x **or** in y: `|dx| >= 100 || |dy| >= 100`.
- Looking again at the same general area is allowed and overlapping is expected, as long as the new center is at least 100 px away on some axis from every earlier center.
- If the candidate is rejected, nothing happens (no spawn, buffer already cleared).

### 5. Videos

- The source videos live in `public/videos/`, listed in `public/videos/manifest.json` (array of filenames). Pick randomly from the manifest for each spawn (avoid repeating the last few if possible).
- Each video element: `muted`, `loop`, `playsInline`, `autoplay`, `crossOrigin = "anonymous"`.
- Each spawned video is rendered at `VIDEO_SIZE` (default 500×500 px, larger than the 300 px dwell area so neighbors blend more), centered on the spawn center. It is fine for videos to extend past the screen edges.
- Fit the source to the square with **cover** behavior (crop, keep aspect ratio) by adjusting UVs in the shader, not by stretching.
- New videos render on top of older ones (render order = spawn order).
- Fade in each new video over ~800 ms (opacity uniform).
- No cap on the number of videos for now.

### 6. Elliptical gradient mask

Every video is drawn through an elliptical radial gradient alpha mask:

- Fully opaque (alpha 1) at the center, fading to fully transparent at the edge of the ellipse inscribed in the video's quad.
- In the fragment shader: normalize UV to `[-1, 1]`, compute `r = length(uvNorm)` (with an optional x/y ratio for non-circular ellipses), and set `alpha = 1.0 - smoothstep(MASK_INNER, 1.0, r)`.
- `MASK_INNER` (default 0.3) controls how large the fully opaque core is. Expose it in config.
- Use normal alpha blending with `transparent: true`, `depthWrite: false`.

Keep the shader structured so a second effect pass (e.g. luminance dissolve, feedback buffer) can be added later without rewriting the mask. Do not implement additional effects in v1.

### 7. Rendering setup

- Fullscreen canvas, black background.
- `OrthographicCamera` set up in pixel space (1 unit = 1 CSS px, origin top-left or convert gaze coordinates accordingly) so gaze coordinates map directly to plane positions.
- Handle window resize.

## Debug mode (toggle with `D`)

- Show the smoothed gaze point as a small dot.
- Show the current dwell candidate box (300×300) around the live centroid, plus a progress indicator (0 to 3 s).
- Show previous spawn centers as small crosses.
- Show counters: number of live videos, gaze sample rate.
- Log accepted and rejected candidates to the console with the reason.

## Config

All tunables in one `src/config.js`:

```js
export const CONFIG = {
  DWELL_MS: 3000,
  DWELL_SIZE: 300,      // px, side of the dwell box
  MIN_SAMPLES: 15,
  MIN_OFFSET: 100,      // px, min distance on x OR y from every previous center
  SMOOTHING: 0.3,       // EMA factor for gaze samples
  VIDEO_SIZE: 500,      // px, rendered size of each video
  MASK_INNER: 0.3,      // 0..1, opaque core radius of the elliptical mask
  MASK_RATIO: 1.0,      // x/y ratio of the ellipse
  FADE_IN_MS: 800,
};
```

## Suggested file structure

```
src/
  main.js          // bootstrap, start screen, mode switching
  config.js
  gaze.js          // WebGazer setup, smoothing, mouse fallback
  calibration.js   // 9-point calibration screen
  dwell.js         // rolling centroid dwell detector (pure logic, no DOM)
  spawner.js       // spawn rule + previous centers
  renderer.js      // Three.js scene, camera, resize
  videoLayer.js    // creates a video + plane + ShaderMaterial
  shaders/
    mask.vert
    mask.frag
  debug.js
public/
  videos/
    manifest.json
```

Keep `dwell.js` and `spawner.js` free of DOM and Three.js dependencies so they can be unit-tested with fake sample streams.

## Known constraints and risks

- **Webcam gaze accuracy is coarse** (roughly 100 px in good conditions, worse with head movement, and it drifts over time). The 300 px dwell box and the 3 s window are designed around this. Do not tighten them without testing on real gaze data.
- **CORS:** WebGL can only use videos that are same-origin or served with CORS headers. Download the videos into `public/videos/` instead of hotlinking archive URLs.
- **Autoplay:** videos only autoplay reliably when muted. Keep them muted.
- **WebGazer license:** WebGazer is GPL licensed. Fine for a prototype, but check the license before distributing or publishing the piece.
- **Calibration friction:** calibration plus a camera permission prompt are required before anything happens. Acceptable for an installation, worth reconsidering for a public website.

## Video sources (for now)

Public-domain material, e.g. the Prelinger Archives and public-domain feature films on the Internet Archive. Cut short extracts (10 to 30 s), encode as H.264 MP4, around 720p, and add them to the manifest.

## Out of scope for v1

- Additional shader effects (luminance dissolve, feedback/ping-pong reveal, peripheral-only changes)
- Performance work (layer caps, freezing old videos, texture pooling)
- Sound
