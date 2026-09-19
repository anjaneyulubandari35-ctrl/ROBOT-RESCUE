// ============================================================
//  GAME THEMES - painted, animated backdrops for the platformer.
//  Purely a visual swap-in for Renderer.drawBackground: the tile
//  map, physics, and every other render call are untouched.
// ============================================================
const GameThemes = (() => {

  const ORDER = ['auto', 'lab', 'space', 'reactor', 'neoncity', 'icecave', 'lavafactory',
                 'jungle', 'desert', 'storm', 'fortress'];
  const LABELS = {
    auto:       'AUTO',
    lab:        'TECH LAB',
    space:      'SPACE STATION',
    reactor:    'REACTOR CORE',
    neoncity:   'NEON CITY',
    icecave:    'ICE CAVE',
    lavafactory:'LAVA FACTORY',
    jungle:     'BIO JUNGLE',
    desert:     'DESERT RUINS',
    storm:      'STORM FACILITY',
    fortress:   'SPACE FORTRESS'
  };

  // Fallback theme rotation, used if a level ever ships without its own
  // `theme` field. Index = level number - 1, so every level still gets a
  // visibly different biome even in that case.
  const BY_LEVEL = ['lab', 'space', 'reactor', 'neoncity', 'icecave',
                    'lavafactory', 'jungle', 'desert', 'storm', 'fortress'];

  // AUTO is the default and it's what the storage key remembers. The key
  // is versioned (…_v2) so anyone who had previously pinned one single
  // theme on the old build gets moved back onto per-level automatic
  // theming instead of staying stuck on whatever they last selected.
  let current = 'auto';
  try {
    const saved = localStorage.getItem('robot_rescue_bg_theme_v2');
    if (saved && ORDER.includes(saved)) current = saved;
    localStorage.removeItem('robot_rescue_bg_theme');
  } catch (e) {}

  // Decorative element counts (stars, embers, motes) get scaled down on
  // low-end devices — this is where a lot of the per-frame cost lives.
  function dens(n) {
    const d = (typeof Perf !== 'undefined') ? Perf.density : 1;
    return Math.max(4, Math.round(n * d));
  }

  // ---- small shared helpers -------------------------------------------
  function grad(ctx, H, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    stops.forEach(([pos, color]) => g.addColorStop(pos, color));
    return g;
  }

  function seeded(i, salt) {
    // cheap deterministic pseudo-random so scenery doesn't jitter every frame
    const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function stars(ctx, W, H, count, camX, camY, tick, colorA, colorB) {
    count = dens(count);
    for (let i = 0; i < count; i++) {
      const px = ((i * 137 + seeded(i, 1) * W - camX * 0.05) % W + W) % W;
      const py = ((i * 91 + seeded(i, 2) * H - camY * 0.05) % H + H) % H;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(tick * 0.03 + i));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = i % 3 === 0 ? colorB : colorA;
      const sz = (i % 3) + 1;
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function risingEmbers(ctx, W, H, count, camX, tick, color) {
    count = dens(count);
    for (let i = 0; i < count; i++) {
      const speed = 18 + (i % 5) * 6;
      const px = ((i * 173 + seeded(i, 3) * W - camX * 0.15) % W + W) % W;
      const py = H - (((tick * speed * 0.02) + seeded(i, 4) * H) % (H + 40));
      const flick = 0.3 + 0.7 * Math.abs(Math.sin(tick * 0.08 + i));
      ctx.globalAlpha = flick;
      ctx.fillStyle = color;
      const sz = 1.5 + (i % 3);
      ctx.fillRect(px + Math.sin(tick * 0.03 + i) * 6, py, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // Gently drifting glow-motes (fireflies, dust, spores) that wander in
  // place rather than rising or falling in one direction.
  function driftMotes(ctx, W, H, count, camX, tick, colorA, colorB) {
    count = dens(count);
    for (let i = 0; i < count; i++) {
      const baseX = ((i * 151 + seeded(i, 21) * W - camX * 0.1) % W + W) % W;
      const baseY = seeded(i, 22) * H;
      const px = baseX + Math.sin(tick * 0.02 + i * 1.7) * 18;
      const py = baseY + Math.cos(tick * 0.017 + i * 2.1) * 14;
      const glow = 0.35 + 0.65 * Math.abs(Math.sin(tick * 0.05 + i * 1.3));
      ctx.globalAlpha = glow;
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      const sz = 1.5 + (i % 3) * 1.2;
      ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // A single jagged lightning bolt, flashed briefly based on a seeded
  // per-strike timer so it doesn't fire identically across strikes.
  function lightningBolt(ctx, W, H, camX, tick, seed) {
    const cycle = 130 + (seed % 5) * 37;
    const phase = (tick + seed * 53) % cycle;
    if (phase > 6) return 0;
    const flashP = 1 - phase / 6;
    const startX = ((seed * 211 + seeded(seed, 30) * W - camX * 0.12) % (W + 200)) - 100;
    let x = startX, y = 0;
    ctx.save();
    ctx.strokeStyle = `rgba(200,225,255,${0.55 * flashP})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#9fd6ff';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 7;
    for (let i = 1; i <= segs; i++) {
      x += (seeded(seed + i, 31) - 0.5) * 46;
      y = (H * 0.55) * (i / segs);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    return flashP;
  }

  // ---- theme renderers ---------------------------------------------------
  const THEMES = {

    lab(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#031414'], [0.55, '#04211f'], [1, '#062a27']]);
      ctx.fillRect(0, 0, W, H);

      // perspective floor grid
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#2be8d4';
      ctx.lineWidth = 1.2;
      const horizonY = H * 0.42, vanX = W / 2;
      for (let i = 0; i <= 14; i++) {
        const xFloor = (i / 14) * W * 2.2 - W * 0.6 - (camX * 0.15) % (W / 4);
        ctx.beginPath(); ctx.moveTo(vanX, horizonY); ctx.lineTo(xFloor, H); ctx.stroke();
      }
      for (let y = horizonY; y < H; y += 22) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      // holographic pods left/right
      [{ x: W * 0.08 }, { x: W * 0.92 }].forEach((p, idx) => {
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.05 + idx * 2);
        ctx.save();
        ctx.translate(p.x - camX * 0.02, H * 0.5);
        const podGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
        podGrad.addColorStop(0, `rgba(43,232,212,${0.5 + pulse * 0.3})`);
        podGrad.addColorStop(1, 'rgba(43,232,212,0)');
        ctx.fillStyle = podGrad;
        ctx.fillRect(-70, -140, 140, 280);
        ctx.strokeStyle = 'rgba(43,232,212,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-26, -120, 52, 240);
        ctx.beginPath();
        ctx.arc(0, -60, 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(180,255,245,0.8)';
        ctx.stroke();
        ctx.restore();
      });

      // scanning light sweep
      const sweepX = ((tick * 1.5 - camX * 0.1) % (W + 200)) - 100;
      const sweepGrad = ctx.createLinearGradient(sweepX - 40, 0, sweepX + 40, 0);
      sweepGrad.addColorStop(0, 'rgba(43,232,212,0)');
      sweepGrad.addColorStop(0.5, 'rgba(180,255,245,0.12)');
      sweepGrad.addColorStop(1, 'rgba(43,232,212,0)');
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(sweepX - 40, 0, 80, H);

      stars(ctx, W, H, 20, camX, camY, tick, '#7effe8', '#2be8d4');
    },

    space(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#04060f'], [0.6, '#080a1c'], [1, '#0d1128']]);
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, H, 60, camX, camY, tick, '#ffffff', '#cfe4ff');

      // nebula tint patches
      [{ x: W * 0.2, y: H * 0.25, c: 'rgba(139,124,255,0.10)' },
       { x: W * 0.75, y: H * 0.4, c: 'rgba(255,138,209,0.08)' }].forEach(n => {
        const ng = ctx.createRadialGradient(n.x - camX * 0.05, n.y, 10, n.x - camX * 0.05, n.y, 180);
        ng.addColorStop(0, n.c);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng;
        ctx.fillRect(0, 0, W, H);
      });

      // large planet, cropped at the edge, with a soft crater arc
      const planetX = W * 0.82 - camX * 0.08, planetY = H * 0.62, planetR = 190;
      const pg = ctx.createRadialGradient(planetX - 60, planetY - 60, 20, planetX, planetY, planetR);
      pg.addColorStop(0, '#8fa3c9');
      pg.addColorStop(0.6, '#5a6d94');
      pg.addColorStop(1, '#333c56');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#1e2440';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(planetX - 40 + i * 30, planetY - 20 + i * 18, 14 + i * 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // small distant moon
      const moonX = W * 0.15 - camX * 0.12, moonY = H * 0.2;
      ctx.fillStyle = '#c9d6f5';
      ctx.beginPath(); ctx.arc(moonX, moonY, 14, 0, Math.PI * 2); ctx.fill();

      // drifting asteroid silhouettes
      for (let i = 0; i < 4; i++) {
        const ax = ((i * 260 + seeded(i, 5) * 200 - camX * 0.18) % (W + 100)) - 50;
        const ay = H * 0.75 + Math.sin(tick * 0.01 + i) * 10;
        ctx.fillStyle = 'rgba(20,22,38,0.85)';
        ctx.beginPath();
        ctx.ellipse(ax, ay, 16 + (i % 3) * 5, 10 + (i % 2) * 4, i, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    reactor(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#170703'], [0.55, '#2a0d05'], [1, '#160603']]);
      ctx.fillRect(0, 0, W, H);

      const pulse = 0.6 + 0.4 * Math.sin(tick * 0.06);
      const coreX = W / 2 - camX * 0.05;

      // radiating horizontal glow bands
      for (let i = 0; i < 6; i++) {
        const y = H * 0.15 + i * (H * 0.13);
        ctx.globalAlpha = 0.08 + pulse * 0.05;
        ctx.fillStyle = '#ff7a1a';
        ctx.fillRect(0, y, W, 3);
      }
      ctx.globalAlpha = 1;

      // central glowing beam
      const beamGrad = ctx.createLinearGradient(coreX - 60, 0, coreX + 60, 0);
      beamGrad.addColorStop(0, 'rgba(255,122,26,0)');
      beamGrad.addColorStop(0.5, `rgba(255,${140 + pulse * 60},60,${0.5 + pulse * 0.3})`);
      beamGrad.addColorStop(1, 'rgba(255,122,26,0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(coreX - 60, 0, 120, H);

      // side pipe silhouettes
      [W * 0.1, W * 0.9].forEach(px => {
        ctx.fillStyle = '#1b0d08';
        ctx.fillRect(px - camX * 0.05 - 14, 0, 28, H);
        ctx.fillStyle = 'rgba(255,140,50,0.5)';
        for (let y = 20; y < H; y += 60) ctx.fillRect(px - camX * 0.05 - 14, y, 28, 6);
      });

      risingEmbers(ctx, W, H, 22, camX, tick, '#ffb14d');
    },

    neoncity(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#0a0620'], [0.6, '#160a35'], [1, '#1d0f42']]);
      ctx.fillRect(0, 0, W, H);

      // skyline silhouette with lit windows
      const baseY = H * 0.78;
      for (let i = 0; i < 16; i++) {
        const bw = 40 + seeded(i, 6) * 40;
        const bh = 80 + seeded(i, 7) * (H * 0.4);
        const bx = ((i * 70 + seeded(i, 8) * 40 - camX * 0.22) % (W + 100)) - 50;
        ctx.fillStyle = '#120a2e';
        ctx.fillRect(bx, baseY - bh, bw, bh);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,80,220,0.55)' : 'rgba(80,220,255,0.5)';
        for (let wy = baseY - bh + 8; wy < baseY - 6; wy += 12) {
          for (let wx = bx + 6; wx < bx + bw - 6; wx += 10) {
            if (seeded(wx + wy, 9) > 0.4) ctx.fillRect(wx, wy, 4, 6);
          }
        }
      }
      // neon accent strips
      [W * 0.25, W * 0.6].forEach((x, i) => {
        ctx.fillStyle = i === 0 ? 'rgba(255,60,210,0.7)' : 'rgba(70,220,255,0.7)';
        ctx.fillRect(x - camX * 0.22, baseY - 220, 6, 220);
      });

      // falling rain streaks
      ctx.strokeStyle = 'rgba(180,210,255,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const rx = ((i * 53 + seeded(i, 10) * W - camX * 0.3) % W + W) % W;
        const ry = ((tick * 9 + seeded(i, 11) * H) % (H + 30)) - 15;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
      }

      // occasional lightning flash
      if (Math.sin(tick * 0.017) > 0.985) {
        ctx.fillStyle = 'rgba(210,225,255,0.10)';
        ctx.fillRect(0, 0, W, H);
      }
    },

    icecave(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#04101f'], [0.55, '#0a2038'], [1, '#123152']]);
      ctx.fillRect(0, 0, W, H);

      // hanging icicles along the top
      for (let i = 0; i < 14; i++) {
        const ix = ((i * 78 + seeded(i, 12) * 40 - camX * 0.2) % (W + 60)) - 30;
        const ih = 30 + seeded(i, 13) * 60;
        ctx.fillStyle = 'rgba(150,220,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(ix - 10, 0); ctx.lineTo(ix + 10, 0); ctx.lineTo(ix, ih); ctx.closePath();
        ctx.fill();
      }

      // glowing crystal clusters
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 165 + seeded(i, 14) * 90 - camX * 0.15) % (W + 120)) - 60;
        const cy = H * 0.55 + seeded(i, 15) * H * 0.35;
        const glow = 0.5 + 0.5 * Math.sin(tick * 0.04 + i);
        const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 36);
        cg.addColorStop(0, `rgba(140,225,255,${0.5 + glow * 0.3})`);
        cg.addColorStop(1, 'rgba(140,225,255,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(cx - 36, cy - 36, 72, 72);
        ctx.fillStyle = 'rgba(200,240,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 18); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx, cy + 18); ctx.lineTo(cx - 10, cy);
        ctx.closePath(); ctx.fill();
      }

      // drifting frost particles
      for (let i = 0; i < 26; i++) {
        const px = ((i * 91 + seeded(i, 16) * W - camX * 0.08) % W + W) % W;
        const py = ((tick * 4 + seeded(i, 17) * H) % H);
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(tick * 0.02 + i);
        ctx.fillStyle = '#dff3ff';
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.globalAlpha = 1;

      // low mist
      const mist = ctx.createLinearGradient(0, H * 0.8, 0, H);
      mist.addColorStop(0, 'rgba(160,210,255,0)');
      mist.addColorStop(1, 'rgba(160,210,255,0.15)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, H * 0.8, W, H * 0.2);
    },

    lavafactory(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#150402'], [0.55, '#2e0e04'], [1, '#170603']]);
      ctx.fillRect(0, 0, W, H);

      // distant industrial silhouette
      const baseY = H * 0.72;
      for (let i = 0; i < 10; i++) {
        const bw = 30 + seeded(i, 18) * 50;
        const bh = 60 + seeded(i, 19) * (H * 0.3);
        const bx = ((i * 95 + seeded(i, 20) * 40 - camX * 0.2) % (W + 100)) - 50;
        ctx.fillStyle = '#1c0d08';
        ctx.fillRect(bx, baseY - bh, bw, bh);
      }
      // crane silhouette
      const craneX = W * 0.78 - camX * 0.2;
      ctx.strokeStyle = '#1c0d08';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(craneX, baseY); ctx.lineTo(craneX, baseY - 140);
      ctx.lineTo(craneX + 90, baseY - 140);
      ctx.stroke();

      // central glowing tower beam (like the reactor, but industrial)
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.05);
      const coreX = W / 2 - camX * 0.05;
      const beamGrad = ctx.createLinearGradient(coreX - 50, 0, coreX + 50, 0);
      beamGrad.addColorStop(0, 'rgba(255,110,20,0)');
      beamGrad.addColorStop(0.5, `rgba(255,${130 + pulse * 60},40,${0.45 + pulse * 0.25})`);
      beamGrad.addColorStop(1, 'rgba(255,110,20,0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(coreX - 50, H * 0.1, 100, H * 0.65);

      // glowing lava band with a wavy top edge
      const lavaY = H * 0.9;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) {
        ctx.lineTo(x, lavaY + Math.sin(tick * 0.05 + x * 0.05) * 5);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      const lavaGrad = ctx.createLinearGradient(0, lavaY, 0, H);
      lavaGrad.addColorStop(0, '#ffcf5a');
      lavaGrad.addColorStop(0.4, '#ff7a1a');
      lavaGrad.addColorStop(1, '#7a1a02');
      ctx.fillStyle = lavaGrad;
      ctx.fill();

      risingEmbers(ctx, W, H, 26, camX, tick, '#ffb14d');
    },

    jungle(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#031810'], [0.55, '#04231d'], [1, '#062818']]);
      ctx.fillRect(0, 0, W, H);

      // giant alien tree trunk silhouettes, left & right
      [{ x: -20, w: 90 }, { x: W - 70, w: 100 }].forEach((t, idx) => {
        const tx = t.x - camX * (0.1 + idx * 0.02);
        ctx.fillStyle = '#041712';
        ctx.beginPath();
        ctx.moveTo(tx, H);
        ctx.quadraticCurveTo(tx + t.w * 0.5, H * 0.4, tx + t.w * 0.35, 0);
        ctx.lineTo(tx + t.w, 0);
        ctx.quadraticCurveTo(tx + t.w * 0.8, H * 0.5, tx + t.w * 1.2, H);
        ctx.closePath();
        ctx.fill();
      });

      // futuristic ruin pillars, vine-covered
      for (let i = 0; i < 5; i++) {
        const px = ((i * 210 + seeded(i, 23) * 120 - camX * 0.16) % (W + 160)) - 80;
        const ph = 60 + seeded(i, 24) * 90;
        ctx.fillStyle = 'rgba(20,30,26,0.8)';
        ctx.fillRect(px, H * 0.72 - ph, 22, ph);
        ctx.strokeStyle = 'rgba(120,255,190,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, H * 0.72 - ph, 22, ph);
      }

      // huge glowing alien leaves / canopy blobs
      for (let i = 0; i < 8; i++) {
        const lx = ((i * 140 + seeded(i, 25) * 100 - camX * 0.13) % (W + 140)) - 70;
        const ly = seeded(i, 26) * H * 0.5;
        const glow = 0.5 + 0.5 * Math.sin(tick * 0.03 + i);
        const colors = ['rgba(120,120,255,', 'rgba(140,255,210,', 'rgba(190,120,255,'];
        const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 46);
        lg.addColorStop(0, colors[i % 3] + (0.35 + glow * 0.2) + ')');
        lg.addColorStop(1, colors[i % 3] + '0)');
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 46, ly - 46, 92, 92);
      }

      // glowing mushrooms along the ground line
      for (let i = 0; i < 10; i++) {
        const mx = ((i * 97 + seeded(i, 27) * 60 - camX * 0.18) % (W + 80)) - 40;
        const my = H * 0.78 + seeded(i, 28) * H * 0.1;
        const glow = 0.5 + 0.5 * Math.sin(tick * 0.06 + i * 1.5);
        ctx.fillStyle = `rgba(150,255,220,${0.5 + glow * 0.4})`;
        ctx.beginPath(); ctx.arc(mx, my, 4 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }

      // faint distant alien-creature eyes in the dark
      const eyeBlink = 0.4 + 0.6 * Math.abs(Math.sin(tick * 0.015));
      ctx.globalAlpha = eyeBlink * 0.5;
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(W * 0.68 - camX * 0.06, H * 0.42, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W * 0.68 - camX * 0.06 + 14, H * 0.42, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      driftMotes(ctx, W, H, 26, camX, tick, '#a8ffd8', '#c9a8ff');

      const mist = ctx.createLinearGradient(0, H * 0.82, 0, H);
      mist.addColorStop(0, 'rgba(120,220,190,0)');
      mist.addColorStop(1, 'rgba(120,220,190,0.14)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, H * 0.82, W, H * 0.18);
    },

    desert(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#2a1638'], [0.45, '#6a3320'], [0.75, '#c9702f'], [1, '#e8a94a']]);
      ctx.fillRect(0, 0, W, H);

      // low sun glow near the horizon
      const sunX = W * 0.5 - camX * 0.04, sunY = H * 0.62;
      const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
      sg.addColorStop(0, 'rgba(255,214,140,0.85)');
      sg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);

      // distant futuristic towers
      for (let i = 0; i < 4; i++) {
        const bx = ((i * 240 + seeded(i, 32) * 100 - camX * 0.1) % (W + 200)) - 100;
        const bh = 70 + seeded(i, 33) * 60;
        ctx.fillStyle = 'rgba(60,30,45,0.55)';
        ctx.fillRect(bx, H * 0.6 - bh, 16, bh);
        ctx.fillStyle = 'rgba(255,180,120,0.5)';
        ctx.fillRect(bx + 5, H * 0.6 - bh - 6, 6, 6);
      }

      // dune layers, far to near, with light parallax
      const duneLayers = [
        { y: H * 0.66, amp: 22, color: 'rgba(90,42,28,0.55)', speed: 0.06 },
        { y: H * 0.76, amp: 30, color: 'rgba(120,55,30,0.7)', speed: 0.1 },
        { y: H * 0.88, amp: 36, color: 'rgba(150,72,32,0.9)', speed: 0.16 }
      ];
      duneLayers.forEach((d, idx) => {
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 24) {
          const y = d.y + Math.sin((x - camX * d.speed) * 0.01 + idx) * d.amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = d.color;
        ctx.fill();
      });

      // broken statue / ruin silhouettes on the crest of a dune
      for (let i = 0; i < 3; i++) {
        const rx = ((i * 300 + seeded(i, 34) * 140 - camX * 0.18) % (W + 220)) - 110;
        const ry = H * 0.82;
        ctx.fillStyle = 'rgba(60,28,22,0.9)';
        ctx.fillRect(rx, ry - 60, 20, 60);
        ctx.fillRect(rx - 14, ry - 34, 48, 14);
      }

      // glowing orange energy crystals in the sand
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 165 + seeded(i, 35) * 90 - camX * 0.2) % (W + 120)) - 60;
        const cy = H * 0.9;
        const glow = 0.5 + 0.5 * Math.sin(tick * 0.05 + i);
        ctx.fillStyle = `rgba(255,150,50,${0.5 + glow * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy + 4); ctx.lineTo(cx - 6, cy);
        ctx.closePath(); ctx.fill();
      }

      // drifting dust / sandstorm haze
      ctx.globalAlpha = 0.15 + 0.05 * Math.sin(tick * 0.02);
      ctx.fillStyle = '#e8b374';
      ctx.fillRect(0, H * 0.5, W, H * 0.5);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 20; i++) {
        const px = ((i * 83 + seeded(i, 36) * W - camX * 0.3 - tick * 0.6) % W + W) % W;
        const py = H * 0.5 + seeded(i, 37) * H * 0.45;
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(tick * 0.04 + i);
        ctx.fillStyle = '#ffd9a0';
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.globalAlpha = 1;
    },

    storm(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#050614'], [0.55, '#0e0f2a'], [1, '#141338']]);
      ctx.fillRect(0, 0, W, H);

      stars(ctx, W, H, 14, camX, camY, tick, '#8fa8ff', '#c9d4ff');

      // tall generator towers, left & right
      [W * 0.08, W * 0.9].forEach((tx, idx) => {
        const x = tx - camX * 0.06;
        ctx.fillStyle = '#0c0d24';
        ctx.fillRect(x - 16, H * 0.15, 32, H * 0.75);
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.05 + idx * 3);
        ctx.fillStyle = `rgba(110,150,255,${0.4 + pulse * 0.3})`;
        for (let y = H * 0.2; y < H * 0.85; y += 40) ctx.fillRect(x - 12, y, 24, 5);
      });

      // glowing blue energy cores between the towers
      for (let i = 0; i < 3; i++) {
        const cx = W * (0.3 + i * 0.2) - camX * 0.06;
        const cy = H * 0.5 + Math.sin(tick * 0.04 + i) * 10;
        const glow = 0.5 + 0.5 * Math.sin(tick * 0.07 + i * 2);
        const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
        cg.addColorStop(0, `rgba(120,170,255,${0.55 + glow * 0.3})`);
        cg.addColorStop(1, 'rgba(120,170,255,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(cx - 34, cy - 34, 68, 68);
      }

      // electric arcs (small jagged zaps) near the towers
      for (let i = 0; i < 2; i++) {
        const flick = Math.sin(tick * 0.15 + i * 4);
        if (flick > 0.6) {
          const ax = W * (0.2 + i * 0.55) - camX * 0.06;
          ctx.strokeStyle = 'rgba(160,200,255,0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(ax, H * 0.3);
          ctx.lineTo(ax + 10, H * 0.37);
          ctx.lineTo(ax - 6, H * 0.44);
          ctx.lineTo(ax + 8, H * 0.5);
          ctx.stroke();
        }
      }

      // lightning bolts + brief screen flash
      const f1 = lightningBolt(ctx, W, H, camX, tick, 1);
      const f2 = lightningBolt(ctx, W, H, camX, tick, 2);
      const flash = Math.max(f1, f2);
      if (flash > 0) {
        ctx.fillStyle = `rgba(210,225,255,${0.12 * flash})`;
        ctx.fillRect(0, 0, W, H);
      }

      // rain streaks
      ctx.strokeStyle = 'rgba(150,180,255,0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 36; i++) {
        const rx = ((i * 59 + seeded(i, 38) * W - camX * 0.3) % W + W) % W;
        const ry = ((tick * 10 + seeded(i, 39) * H) % (H + 30)) - 15;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 13); ctx.stroke();
      }

      // drifting sparks
      driftMotes(ctx, W, H, 12, camX, tick, '#bcd4ff', '#eaf2ff');
    },

    fortress(ctx, W, H, camX, camY, tick) {
      ctx.fillStyle = grad(ctx, H, [[0, '#02030a'], [0.55, '#080611'], [1, '#12060a']]);
      ctx.fillRect(0, 0, W, H);
      stars(ctx, W, H, 40, camX, camY, tick, '#ffffff', '#ffd0d0');

      // distant dark planet
      const planetX = W * 0.18 - camX * 0.05, planetY = H * 0.3, planetR = 90;
      const pg = ctx.createRadialGradient(planetX - 25, planetY - 25, 8, planetX, planetY, planetR);
      pg.addColorStop(0, '#4a3540');
      pg.addColorStop(0.6, '#2c1c26');
      pg.addColorStop(1, '#140a10');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2); ctx.fill();

      // massive fortress hull silhouette dominating the background
      const hullX = W * 0.55 - camX * 0.08;
      ctx.fillStyle = '#0a0a14';
      ctx.beginPath();
      ctx.moveTo(hullX - 260, H);
      ctx.lineTo(hullX - 220, H * 0.35);
      ctx.lineTo(hullX - 60, H * 0.15);
      ctx.lineTo(hullX + 180, H * 0.22);
      ctx.lineTo(hullX + 260, H * 0.5);
      ctx.lineTo(hullX + 260, H);
      ctx.closePath();
      ctx.fill();

      // armored panel seams
      ctx.strokeStyle = 'rgba(120,40,60,0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const sy = H * 0.2 + i * 40;
        ctx.beginPath(); ctx.moveTo(hullX - 220 + i * 10, sy); ctx.lineTo(hullX + 240 - i * 6, sy + 10); ctx.stroke();
      }

      // massive mechanical door in the hull
      const doorX = hullX - 10, doorY = H * 0.55, doorW = 70, doorH = 130;
      ctx.fillStyle = '#141420';
      ctx.fillRect(doorX, doorY, doorW, doorH);
      ctx.strokeStyle = 'rgba(255,80,80,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(doorX, doorY, doorW, doorH);
      ctx.beginPath(); ctx.moveTo(doorX + doorW / 2, doorY); ctx.lineTo(doorX + doorW / 2, doorY + doorH); ctx.stroke();

      // blinking red warning lights across the hull
      for (let i = 0; i < 7; i++) {
        const wx = hullX - 200 + i * 70;
        const wy = H * 0.28 + (i % 3) * 30;
        const on = Math.sin(tick * 0.08 + i * 1.3) > 0.2;
        ctx.fillStyle = on ? 'rgba(255,60,60,0.9)' : 'rgba(120,20,20,0.3)';
        ctx.beginPath(); ctx.arc(wx, wy, 3, 0, Math.PI * 2); ctx.fill();
      }

      // pulsing glowing energy core
      const coreGlow = 0.5 + 0.5 * Math.sin(tick * 0.05);
      const coreX = hullX + 40, coreY = H * 0.35;
      const cg = ctx.createRadialGradient(coreX, coreY, 2, coreX, coreY, 40);
      cg.addColorStop(0, `rgba(255,90,90,${0.5 + coreGlow * 0.35})`);
      cg.addColorStop(1, 'rgba(255,90,90,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(coreX - 40, coreY - 40, 80, 80);

      // floating debris drifting past
      for (let i = 0; i < 6; i++) {
        const dx = ((i * 210 + seeded(i, 40) * 200 - camX * 0.22) % (W + 160)) - 80;
        const dy = H * 0.2 + seeded(i, 41) * H * 0.6;
        ctx.fillStyle = 'rgba(30,20,26,0.85)';
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(seeded(i, 42) * Math.PI * 2 + tick * 0.01);
        ctx.fillRect(-6 - (i % 3) * 2, -4, 12 + (i % 3) * 4, 8);
        ctx.restore();
      }
    }
  };

  // Offscreen buffer used by the low-quality background path.
  let bgBuf = null, bgCtx = null;

  // AUTO means "use each level's own assigned biome", which is what makes
  // the backdrop change by itself from one level to the next with no input
  // from the player. Picking a specific theme with the BG button pins that
  // one across every level instead.
  function paintBg(ctx, W, H, camX, camY, tick, ld, levelIndex) {
    let key = null;
    if (current === 'auto') {
      if (ld && ld.theme && THEMES[ld.theme]) key = ld.theme;
      else if (typeof levelIndex === 'number') key = BY_LEVEL[levelIndex % BY_LEVEL.length];
    } else if (THEMES[current]) {
      key = current;
    }
    if (key && THEMES[key]) THEMES[key](ctx, W, H, camX, camY, tick);
    else if (ld) Renderer.drawBackground(ctx, W, H, ld.bgTop, ld.bgBot, camX, camY, tick);
  }

  return {
    LABELS,
    get current() { return current; },

    // Which theme a given level actually renders with, respecting AUTO.
    themeFor(ld, levelIndex) {
      if (current !== 'auto') return THEMES[current] ? current : null;
      if (ld && ld.theme && THEMES[ld.theme]) return ld.theme;
      if (typeof levelIndex === 'number') return BY_LEVEL[levelIndex % BY_LEVEL.length];
      return null;
    },

    // Human-readable name of whatever is on screen right now — used for
    // the "biome" banner that appears as each level starts.
    labelFor(ld, levelIndex) {
      const key = this.themeFor(ld, levelIndex);
      return key ? LABELS[key] : 'UNKNOWN ZONE';
    },

    draw(ctx, W, H, camX, camY, tick, ld, levelIndex) {
      const scale = (typeof Perf !== 'undefined') ? Perf.bgScale : 1;
      if (scale >= 1) { paintBg(ctx, W, H, camX, camY, tick, ld, levelIndex); return; }

      // Low-end path: paint the backdrop into a half-size buffer and
      // stretch it over the screen. Backgrounds are all soft gradients
      // and glow, so the upscale is essentially invisible in motion —
      // but it cuts the most fill-rate-heavy part of the frame to a
      // quarter of the pixels.
      const bw = Math.max(1, Math.ceil(W * scale));
      const bh = Math.max(1, Math.ceil(H * scale));
      if (!bgBuf) { bgBuf = document.createElement('canvas'); bgCtx = bgBuf.getContext('2d'); }
      if (bgBuf.width !== bw || bgBuf.height !== bh) {
        bgBuf.width = bw; bgBuf.height = bh;
        bgCtx.setTransform(1, 0, 0, 1, 0, 0);
        bgCtx.scale(bw / W, bh / H);
        if (typeof Renderer !== 'undefined') Renderer.applyQuality(bgCtx);
      }
      bgCtx.clearRect(0, 0, W, H);
      paintBg(bgCtx, W, H, camX, camY, tick, ld, levelIndex);
      ctx.drawImage(bgBuf, 0, 0, bw, bh, 0, 0, W, H);
    },

    cycle() {
      const idx = ORDER.indexOf(current);
      current = ORDER[(idx + 1) % ORDER.length];
      try { localStorage.setItem('robot_rescue_bg_theme_v2', current); } catch (e) {}
      const label = document.getElementById('bgThemeLabel');
      if (label) label.textContent = LABELS[current];
      if (typeof AudioManager !== 'undefined') AudioManager.menuBeep();
      return current;
    },

    label() { return LABELS[current]; }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  const label = document.getElementById('bgThemeLabel');
  if (label) label.textContent = GameThemes.label();
});
