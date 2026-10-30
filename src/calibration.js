import { CONFIG } from './config.js';

export function calibrate() {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.id = 'calibration';
    root.innerHTML = `<p>Look at each dot and click it ${CONFIG.CALIBRATION_CLICKS} times.</p>`;
    let remaining = 9;

    for (const y of [10, 50, 90]) for (const x of [10, 50, 90]) {
      const dot = document.createElement('button');
      dot.className = 'dot';
      dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
      let clicks = 0;
      dot.onclick = () => {
        dot.style.opacity = 1 - (++clicks / CONFIG.CALIBRATION_CLICKS) * 0.6;
        if (clicks < CONFIG.CALIBRATION_CLICKS) return;
        dot.disabled = true;
        dot.style.opacity = 1;
        if (--remaining === 0) {
          root.remove();
          resolve();
        }
      };
      root.append(dot);
    }
    document.body.append(root);
  });
}
