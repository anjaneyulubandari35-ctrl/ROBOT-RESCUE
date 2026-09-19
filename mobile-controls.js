// ============================================================
//  MOBILE CONTROLS - virtual d-pad/buttons for touch devices
//  Drives Game.keys[...] the same way real keyboard events do,
//  so nothing in game.js / entities.js needs to change.
// ============================================================
(function () {
  "use strict";

  function isTouchDevice() {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
           window.matchMedia('(pointer: coarse)').matches ||
           window.innerWidth <= 900; // treat small/narrow windows as mobile too, for easy testing
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    const panel = document.getElementById('touchControls');
    if (!panel) return;

    function syncVisibility() {
      document.body.classList.toggle('touch-device', isTouchDevice());
    }
    syncVisibility();
    window.addEventListener('resize', syncVisibility);

    if (!isTouchDevice()) return;

    const buttons = panel.querySelectorAll('[data-key]');

    // Track which pointer id is currently holding each button, so a
    // second finger landing on a different button doesn't cancel it,
    // and so we correctly release only when *that* finger lifts.
    buttons.forEach(btn => {
      const code = btn.getAttribute('data-key');
      let activePointerId = null;

      function press(e) {
        if (e.cancelable) e.preventDefault();
        if (typeof AudioManager !== 'undefined') AudioManager.unlock();
        if (typeof Game === 'undefined') return;
        activePointerId = e.pointerId;
        Game.keys[code] = true;
        btn.classList.add('active');
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      }

      function release(e) {
        if (e.pointerId !== undefined && activePointerId !== null && e.pointerId !== activePointerId) return;
        activePointerId = null;
        if (typeof Game !== 'undefined') Game.keys[code] = false;
        btn.classList.remove('active');
      }

      btn.addEventListener('pointerdown', press, { passive: false });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });

    // Restart (R) already has its own on-screen button in #gameHint;
    // clear all touch-driven keys if the tab loses focus/visibility so
    // a stuck finger-hold doesn't leave the robot walking forever.
    window.addEventListener('blur', clearAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearAll();
    });

    function clearAll() {
      if (typeof Game === 'undefined') return;
      buttons.forEach(btn => {
        Game.keys[btn.getAttribute('data-key')] = false;
        btn.classList.remove('active');
      });
    }
  });
})();
