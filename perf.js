// ============================================================
//  PERF - device tiering + adaptive quality
//  One shared place that decides how hard we're allowed to push
//  the GPU/CPU this frame. Everything else (renderer, themes,
//  the 3D welcome scene) just reads these flags.
//
//  Two layers:
//   1. A static guess from the device itself (touch + cores + RAM),
//      so a phone starts light instead of starting heavy and stuttering.
//   2. A live FPS watchdog that downgrades automatically if the real
//      frame rate can't keep up, and upgrades back if it's comfortable.
// ============================================================
const Perf = (() => {
  const isTouch = ('ontouchstart' in window) ||
                  (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
                  window.matchMedia('(pointer: coarse)').matches;

  const cores = navigator.hardwareConcurrency || 4;
  const mem   = navigator.deviceMemory || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) <= 900;

  // Anything phone-shaped, or weak on cores/RAM, starts in low mode.
  let low = (isTouch && small) || cores <= 4 || mem <= 4;

  // Manual override: ?quality=low / ?quality=high for testing on any device.
  try {
    const q = new URLSearchParams(location.search).get('quality');
    if (q === 'low')  low = true;
    if (q === 'high') low = false;
  } catch (e) {}

  let locked = false;          // true once the player picks a mode by hand
  let frames = 0, acc = 0, fps = 60;
  const listeners = [];

  function notify() { listeners.forEach(fn => { try { fn(low); } catch (e) {} }); }

  return {
    get isTouch() { return isTouch; },
    get low()     { return low; },

    // Capped device pixel ratio. A phone at DPR 3 is pushing ~9x the pixels
    // of DPR 1 for no visible gain at this art size — capping it here is the
    // single cheapest frame-rate win available.
    get dpr() {
      const d = window.devicePixelRatio || 1;
      return Math.min(d, low ? 1.5 : 2);
    },

    // Scale factor applied to decorative particle/star/ember counts.
    get density() { return low ? 0.45 : 1; },

    // Backgrounds render into a half-size buffer and get upscaled in low
    // mode: a quarter of the fill rate, and at these soft gradient art
    // styles the difference is close to invisible in motion.
    get bgScale() { return low ? 0.5 : 1; },

    get shadows() { return !low; },
    get maxParticles() { return low ? 60 : 220; },

    // Called once per rendered frame from the game loop.
    sample(dt) {
      frames++; acc += dt;
      if (acc < 1000) return;
      fps = frames * 1000 / acc;
      frames = 0; acc = 0;
      if (locked) return;
      if (!low && fps < 45) { low = true;  notify(); }
      else if (low && fps > 58 && !(isTouch && small)) { low = false; notify(); }
    },

    get fps() { return Math.round(fps); },

    setLow(v) { locked = true; low = !!v; notify(); },
    onChange(fn) { listeners.push(fn); }
  };
})();

// Mirror the quality tier onto <body> so CSS can drop expensive effects
// (blur, glow) on low-end devices without any JS having to reach into
// style rules directly. Runs once at load and again on every tier change.
(function () {
  function sync() {
    if (document.body) document.body.classList.toggle('perf-low', Perf.low);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }
  Perf.onChange(sync);
})();
