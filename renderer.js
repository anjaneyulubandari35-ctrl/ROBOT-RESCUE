// ============================================================
//  RENDERER - Crisp 3D Art Engine, UI Buttons & HD Welcome Screens
// ============================================================

const Renderer = {
  DEPTH: 8,

  // Glow (shadowBlur) is by far the most expensive thing a 2D canvas can
  // do on a phone GPU, and it's used in dozens of places across the art.
  // Rather than gut every one of those call sites, we neutralise the
  // property on the live context in low-quality mode: assignments still
  // work, they just don't cost anything. Colours and shapes stay exactly
  // as authored — only the soft halo around them goes away.
  applyQuality(ctx) {
    if (!ctx || typeof Perf === 'undefined') return;
    try {
      if (Perf.low) {
        Object.defineProperty(ctx, 'shadowBlur', {
          configurable: true, get() { return 0; }, set() {}
        });
      } else if (Object.getOwnPropertyDescriptor(ctx, 'shadowBlur')) {
        delete ctx.shadowBlur;
      }
    } catch (e) {}
  },

  draw3DBox(ctx, x, y, w, h, depth, topColor, frontColor, sideColor, strokeColor) {
    const d = depth || this.DEPTH;

    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + d, y - d);
    ctx.lineTo(x + w + d, y + h - d);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = sideColor;
    ctx.fill();
    if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5; ctx.stroke(); }

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y - d);
    ctx.lineTo(x + w + d, y - d);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5; ctx.stroke(); }

    ctx.fillStyle = frontColor;
    ctx.fillRect(x, y, w, h);
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    }
  },

  drawBackground(ctx, W, H, bgTop, bgBot, camX, camY, tick) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1.5;

    const horizonY = H * 0.35;
    const vanX = W / 2;
    const numLines = 16;
    for (let i = 0; i <= numLines; i++) {
      const xFloor = (i / numLines) * W * 2.5 - W * 0.75 - (camX * 0.2) % (W / 4);
      ctx.beginPath();
      ctx.moveTo(vanX, horizonY);
      ctx.lineTo(xFloor, H);
      ctx.stroke();
    }

    for (let y = horizonY; y < H; y += Math.pow((y - horizonY) / 15 + 1.2, 1.8)) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 25; i++) {
      const px = ((i * 137 + tick * 0.4 - camX * 0.1) % W + W) % W;
      const py = ((i * 91 + Math.sin(tick * 0.02 + i) * 20 - camY * 0.1) % H + H) % H;
      const sz = (i % 3) + 1;
      ctx.fillStyle = i % 2 === 0 ? '#00ffff' : '#00ff88';
      ctx.fillRect(px, py, sz, sz);
    }

    ctx.restore();
  },

  // ------------------------------------------------------------------
  //  Tile sprite cache
  //  Tiles are static art, but the old code re-ran a gradient build and
  //  a shadow-blurred glow for every single tile, every single frame —
  //  several hundred of them on a wide level. Painting each tile type
  //  once into a small offscreen canvas and blitting it instead turns
  //  that into a plain drawImage, which is where most of the mobile
  //  frame time was going.
  // ------------------------------------------------------------------
  _tileCache: null,
  _tileCacheScale: 0,

  _ctxScale(ctx) {
    try {
      const t = ctx.getTransform();
      return Math.min(3, Math.max(0.5, Math.round(t.a * 100) / 100));
    } catch (e) { return 1; }
  },

  _buildTileCache(scale) {
    const self = this;
    const mk = (w, h, ox, oy, tile) => {
      const c = document.createElement('canvas');
      c.width  = Math.ceil(w * scale);
      c.height = Math.ceil(h * scale);
      const g = c.getContext('2d');
      g.scale(scale, scale);
      self._paintTile(g, tile, ox, oy);
      return { canvas: c, ox, oy, w, h };
    };
    // Solid blocks overhang 6px up and right (the 3D top/side faces);
    // spikes need room for their red glow. Hence the padded boxes.
    this._tileCache = { 1: mk(40, 40, 0, 6, 1), 2: mk(56, 56, 12, 12, 2) };
    this._tileCacheScale = scale;
  },

  drawTile(ctx, tile, px, py, tick) {
    const scale = this._ctxScale(ctx);
    if (!this._tileCache || this._tileCacheScale !== scale) this._buildTileCache(scale);
    const s = this._tileCache[tile];
    if (!s) { this._paintTile(ctx, tile, px, py); return; }
    ctx.drawImage(s.canvas, px - s.ox, py - s.oy, s.w, s.h);
  },

  _paintTile(ctx, tile, px, py) {
    if (tile === 1) {
      this.draw3DBox(ctx, px, py, 32, 32, 6, '#4a6d8c', '#1b2f44', '#111f2e', '#00ffcc44');
      ctx.fillStyle = '#2b445e';
      ctx.fillRect(px + 4, py + 4, 24, 24);
      ctx.strokeStyle = '#3a5f82';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 4, py + 4, 24, 24);
      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(px + 6, py + 6, 2, 2);
      ctx.fillRect(px + 24, py + 6, 2, 2);
    } else if (tile === 2) {
      ctx.save();
      ctx.fillStyle = '#880011';
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 32);
      ctx.lineTo(px + 16, py + 2);
      ctx.lineTo(px + 28, py + 32);
      ctx.closePath();
      ctx.fill();

      const g = ctx.createLinearGradient(px, py, px + 32, py + 32);
      g.addColorStop(0, '#ff3355');
      g.addColorStop(1, '#990022');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 32);
      ctx.lineTo(px + 16, py + 4);
      ctx.lineTo(px + 28, py + 32);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = '#ff0044';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 15, py + 4, 2, 6);
      ctx.restore();
    }
  },

  drawMap(ctx, map, mapH, mapW, camX, camY, W, H, tick) {
    const startCol = Math.max(0, Math.floor(camX / 32));
    const endCol   = Math.min(mapW - 1, Math.ceil((camX + W) / 32));
    const startRow = Math.max(0, Math.floor(camY / 32));
    const endRow   = Math.min(mapH - 1, Math.ceil((camY + H) / 32));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const tile = map[row][col];
        if (tile === 0) continue;
        const px = col * 32 - camX;
        const py = row * 32 - camY;
        this.drawTile(ctx, tile, px, py, tick);
      }
    }
  },

  drawPlayer(ctx, player, camX, camY, tick, avatarEmoji) {
    if (player.dead) return;
    const px = Math.round(player.x - camX);
    const py = Math.round(player.y - camY);
    const f  = player.facing;
    const state = player.state;
    const frame = player.frame;

    if (player.invincible > 0 && Math.floor(tick / 4) % 2 === 0) return;

    ctx.save();
    ctx.translate(px + player.w / 2, py + player.h / 2);

    if (player.gravityDir === -1) {
      ctx.scale(1, -1);
    }

    ctx.save();
    ctx.scale(1, 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(0, player.h * 1.4, player.w * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (f === -1) ctx.scale(-1, 1);

    const w = player.w, h = player.h;
    const hw = w / 2, hh = h / 2;

    this.draw3DBox(ctx, -hw, -hh, w, h - 4, 5, '#66ccff', '#0077e6', '#004499', '#ffffff');

    const visorG = ctx.createLinearGradient(-hw + 3, -hh + 3, hw - 3, -hh + 11);
    visorG.addColorStop(0, '#00ffff');
    visorG.addColorStop(1, '#0088cc');
    ctx.fillStyle = visorG;
    ctx.fillRect(-hw + 3, -hh + 3, w - 6, 8);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(-hw + 6, -hh + 5, 4, 4);
    ctx.fillRect(hw - 10, -hh + 5, 4, 4);
    ctx.shadowBlur = 0;

    const pulse = Math.sin(tick * 0.1) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(0, 255, 136, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, -hh + 17, 4, 0, Math.PI * 2);
    ctx.fill();

    const legSwing = state === 'run' ? Math.sin(frame * Math.PI / 2) * 5 : 0;
    ctx.fillStyle = '#0055aa';
    ctx.fillRect(-hw + 2, hh - 6, 6, 8 + legSwing);
    ctx.fillRect(hw - 8, hh - 6, 6, 8 - legSwing);

    ctx.fillStyle = '#003366';
    ctx.fillRect(-hw + 1, hh + 2 + legSwing, 8, 3);
    ctx.fillRect(hw - 9, hh + 2 - legSwing, 8, 3);

    const armSwing = state === 'run' ? Math.sin(frame * Math.PI / 2) * 4 : 0;
    ctx.fillStyle = '#3399ff';
    ctx.fillRect(-hw - 4, -hh + 6 - armSwing, 4, 11);
    ctx.fillRect(hw, -hh + 6 + armSwing, 4, 11);

    if (state === 'jump' && player.vy < 0) {
      ctx.fillStyle = '#ff9900';
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-4, hh + 2);
      ctx.lineTo(0, hh + 12 + Math.random() * 4);
      ctx.lineTo(4, hh + 2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  },

  drawEnemy(ctx, enemy, camX, camY, tick) {
    if (!enemy.alive && enemy.deathTimer > 20) return;
    const px = Math.round(enemy.x - camX);
    const py = Math.round(enemy.y - camY);

    ctx.save();
    ctx.translate(px + enemy.w / 2, py + enemy.h / 2);

    if (!enemy.alive) {
      const scale = Math.max(0, 1 - enemy.deathTimer / 20);
      ctx.scale(1 + (1 - scale) * 0.5, scale);
      ctx.globalAlpha = scale;
    }

    const w = enemy.w, h = enemy.h;
    const hw = w / 2, hh = h / 2;
    const dir = enemy.vx >= 0 ? 1 : -1;
    if (dir === -1) ctx.scale(-1, 1);

    this.draw3DBox(ctx, -hw, -hh, w, h - 2, 5, '#ff4444', '#b30000', '#660000', '#ffffff');

    ctx.fillStyle = '#330000';
    ctx.fillRect(-hw + 3, -hh + 4, w - 6, 6);
    const scanX = -hw + 4 + (tick % 16);
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.fillRect(Math.min(scanX, hw - 8), -hh + 5, 4, 4);
    ctx.shadowBlur = 0;

    const lf = enemy.frame;
    ctx.fillStyle = '#440000';
    ctx.fillRect(-hw + 2, hh - 4, 7, 5 + (lf ? 2 : 0));
    ctx.fillRect(hw - 9, hh - 4, 7, 5 + (lf ? 0 : 2));

    ctx.restore();
  },

  drawParticles(ctx, particles, camX, camY) {
    particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x - camX, p.y - camY);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
  },

  drawTurret(ctx, turret, camX, camY) {
    const px = Math.round(turret.x - camX);
    const py = Math.round(turret.y - camY);
    this.draw3DBox(ctx, px, py, 32, 32, 6, '#6600cc', '#330066', '#1a0033', '#00ffcc');
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(px + 16, py + 16, 6, 0, Math.PI * 2);
    ctx.fill();
  },

  drawBullet(ctx, bullet, camX, camY) {
    const px = Math.round(bullet.x - camX);
    const py = Math.round(bullet.y - camY);
    ctx.fillStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 10;
    ctx.fillRect(px, py, bullet.w, bullet.h);
    ctx.shadowBlur = 0;
  },

  drawCrusher(ctx, crusher, camX, camY) {
    const px = Math.round(crusher.x - camX);
    const py = Math.round(crusher.y - camY);
    this.draw3DBox(ctx, px, py, crusher.w, crusher.currH, 8, '#ff8800', '#994400', '#441100', '#ffff00');
  },

  drawBoss(ctx, boss, camX, camY, tick) {
    const px = Math.round(boss.x - camX);
    const py = Math.round(boss.y - camY);
    this.draw3DBox(ctx, px, py, boss.w, boss.h, 10, '#ff0033', '#880011', '#440000', '#00ffcc');
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👾 BOSS', px + boss.w / 2, py + boss.h / 2 + 6);
  },

  drawCoin(ctx, coin, camX, camY, tick) {
    if (coin.collected) return;
    const px = Math.round(coin.x - camX);
    const py = Math.round(coin.y - camY) + Math.sin(tick * 0.05 + coin.floatPhase) * 4;
    const r  = coin.w / 2;
    const cx = px + r, cy = py + r;

    ctx.save();
    ctx.translate(cx, cy);
    const spin = Math.cos(coin.frame * Math.PI / 4 + tick * 0.1);
    const absSpin = Math.max(0.15, Math.abs(spin));

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    const cg = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 1, 0, 0, r);
    cg.addColorStop(0, '#ffffcc');
    cg.addColorStop(0.5, '#ffd700');
    cg.addColorStop(1, '#b8860b');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * absSpin, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawSwitch(ctx, sw, camX, camY, tick) {
    const px = Math.round(sw.x - camX);
    const py = Math.round(sw.y - camY);
    ctx.save();
    this.draw3DBox(ctx, px + 4, py + 12, 24, 16, 5,
      sw.activated ? '#006622' : '#661100',
      sw.activated ? '#004411' : '#440000',
      sw.activated ? '#002200' : '#220000',
      sw.activated ? '#00ff44' : '#ff4400');

    ctx.strokeStyle = sw.activated ? '#00ff88' : '#ff6600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (sw.activated) { ctx.moveTo(px + 16, py + 20); ctx.lineTo(px + 23, py + 12); }
    else              { ctx.moveTo(px + 16, py + 20); ctx.lineTo(px + 9, py + 12); }
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('[E]', px + 16, py + 8);
    ctx.restore();
  },

  drawDoor(ctx, door, camX, camY, tick) {
    const px = Math.round(door.x - camX);
    const py = Math.round(door.y - camY);
    const visH = Math.round(door.h * (1 - door.progress));
    if (visH <= 0) return;

    ctx.save();
    const offY = door.h - visH;
    this.draw3DBox(ctx, px, py + offY, door.w, visH, 6,
      '#cc7700', '#994400', '#552200', door.isOpen ? '#00ff44' : '#ff8800');

    if (!door.isOpen) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒', px + door.w / 2, py + offY + visH / 2 + 4);
    }
    ctx.restore();
  },

  drawExit(ctx, exit, camX, camY, tick) {
    const px = Math.round(exit.x - camX);
    const py = Math.round(exit.y - camY);
    const active = exit.active;

    ctx.save();
    const cx = px + exit.w / 2, cy = py + exit.h / 2;
    this.draw3DBox(ctx, px, py, exit.w, exit.h, 7,
      active ? '#00ffcc' : '#334455',
      active ? '#009977' : '#1a2936',
      active ? '#005544' : '#0d1620',
      active ? '#00ffcc' : '#446688');

    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = active ? '#00ffcc' : '#6688aa';
    ctx.fillText(active ? 'EXIT OPEN' : 'LOCKED', cx, py - 6);
    ctx.restore();
  },

  drawPlatform(ctx, plat, camX, camY, tick) {
    const px = Math.round(plat.x - camX);
    const py = Math.round(plat.y - camY);
    this.draw3DBox(ctx, px, py, plat.w, plat.h, 6, '#00ffaa', '#009955', '#004422', '#00ffcc');
  },

  drawHUD(ctx, W, H, lives, hp, coinsCollected, minCoins, levelNum, levelName, timer, totalLevels, profile) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 15, 30, 0.92)';
    ctx.fillRect(0, 0, W, 48);
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, 48);

    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';

    // Profile Avatar & Name
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(`${profile.avatar} ${profile.name}`, 15, 24);

    // Hearts ❤️ HP
    ctx.fillStyle = '#ff3366';
    let heartsStr = '';
    for (let i = 0; i < hp; i++) heartsStr += '❤️ ';
    ctx.fillText(heartsStr, 150, 24);

    // Coins
    ctx.fillStyle = '#ffd700';
    ctx.fillText('🪙', 250, 24);
    ctx.fillStyle = coinsCollected >= minCoins ? '#00ff88' : '#ffffff';
    ctx.fillText(`${coinsCollected}/${minCoins}`, 275, 24);

    // Level Header
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'center';
    ctx.fillText(`LVL ${levelNum}/${totalLevels}: ${levelName.toUpperCase()}`, W / 2 + 30, 24);

    // RESTART & EXIT UI BUTTONS IN HUD!
    this.draw3DBox(ctx, W - 230, 8, 100, 32, 4, '#00aa66', '#006644', '#003322', '#ffffff');
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('🔄 RESTART', W - 180, 24);

    this.draw3DBox(ctx, W - 115, 8, 100, 32, 4, '#cc3300', '#882200', '#441100', '#ffffff');
    ctx.fillText('🚪 DASHBOARD', W - 65, 24);

    ctx.restore();
  },

  // Short-lived banner naming the biome as a level opens. The backdrop
  // swaps itself every level, and this makes that read as a deliberate
  // change of location rather than an unexplained art shift.
  drawThemeToast(ctx, W, H, t, label, levelNum) {
    // Slide in over ~14 frames, hold, then fade out over the last 40.
    const inP  = Math.min(1, (170 - t) / 14);
    const outP = Math.min(1, t / 40);
    const a = Math.min(inP, outP);
    if (a <= 0) return;

    const cx = W / 2;
    const y  = 74 - (1 - inP) * 18;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';

    ctx.font = 'bold 13px "Chakra Petch", system-ui, sans-serif';
    const w = Math.max(230, ctx.measureText(label).width + 90);

    ctx.fillStyle = 'rgba(6,10,20,0.72)';
    ctx.fillRect(cx - w / 2, y - 24, w, 44);
    ctx.strokeStyle = 'rgba(0,255,204,0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - w / 2, y - 24, w, 44);

    ctx.fillStyle = '#7fe9dd';
    ctx.fillText('ZONE ' + levelNum, cx, y - 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px "Chakra Petch", system-ui, sans-serif';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 10;
    ctx.fillText(label, cx, y + 13);
    ctx.restore();
  },

  drawCoinHint(ctx, W, H, coinsCollected, minCoins) {
    if (coinsCollected >= minCoins) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(W / 2 - 150, H - 36, 300, 28);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W / 2 - 150, H - 36, 300, 28);
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`Need ${minCoins - coinsCollected} more coins to open Exit!`, W / 2, H - 18);
    ctx.restore();
  },

  drawDashboard(ctx, W, H, tick, profile, levelUnlocks, selectedLevel) {
    this.drawBackground(ctx, W, H, '#040b19', '#0a1a33', tick * 10, 0, tick);

    ctx.save();
    ctx.textAlign = 'center';

    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 20;
    ctx.fillText('🤖 ROBOT RESCUE 3D DASHBOARD', W / 2, 50);
    ctx.shadowBlur = 0;

    this.draw3DBox(ctx, 40, 80, 250, 460, 8, '#004455', '#001a26', '#000d13', '#00ffcc');
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('PILOT PROFILE', 165, 115);

    ctx.font = '55px "Segoe UI", sans-serif';
    ctx.fillText(profile.avatar, 165, 185);

    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(profile.name, 165, 250);

    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`Lifetime Coins: ${profile.totalCoins} 🪙`, 165, 295);
    ctx.fillText(`Stars Earned: ${profile.stars} ⭐`, 165, 330);

    ctx.fillStyle = '#aaccff';
    ctx.fillText('CLICK Avatar / Name', 165, 430);
    ctx.fillText('to Change Character!', 165, 455);

    this.draw3DBox(ctx, 320, 80, 600, 460, 8, '#003344', '#001a26', '#000d13', '#00ffcc');
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('SELECT MISSION LEVEL (1 - 10)', 620, 115);

    for (let i = 0; i < 10; i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;
      const bx = 345 + col * 110;
      const by = 150 + row * 140;
      const isUnlocked = levelUnlocks[i];
      const isSel = selectedLevel === i;

      const topC = isSel ? '#00ffcc' : (isUnlocked ? '#0088aa' : '#334455');
      const mainC = isSel ? '#00aa88' : (isUnlocked ? '#004466' : '#1a2430');

      this.draw3DBox(ctx, bx, by, 95, 115, 6, topC, mainC, '#08121c', isSel ? '#ffffff' : '#00ffcc44');

      ctx.font = 'bold 28px "Segoe UI", sans-serif';
      ctx.fillStyle = isUnlocked ? '#ffffff' : '#667788';
      ctx.fillText(isUnlocked ? `${i + 1}` : '🔒', bx + 47, by + 50);

      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(isUnlocked ? '⭐⭐⭐' : 'LOCKED', bx + 47, by + 90);
    }

    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('CLICK LEVEL TO LAUNCH MISSION!', 620, 500);

    ctx.restore();
  },

  // ============================================================
  //  HD LEVEL WELCOME SCREEN
  //  Replaces the old puzzle gate: each level now opens with a
  //  high-detail robot greeting the player over that level's own
  //  themed backdrop, with the mission briefing and a START button.
  // ============================================================

  // Per-theme accent palette, so the welcome screen recolors itself to
  // match whichever biome the level is set in.
  WELCOME_ACCENTS: {
    lab:         { a: '#00ffcc', b: '#0aa8ff', panel: '#04202c', ink: '#bfe9ff' },
    space:       { a: '#8ad4ff', b: '#3a6cff', panel: '#0a1430', ink: '#cfe2ff' },
    reactor:     { a: '#ffb347', b: '#ff5e3a', panel: '#2a1205', ink: '#ffe0bf' },
    neoncity:    { a: '#ff5ec7', b: '#7a5cff', panel: '#1d0736', ink: '#ffd2f2' },
    icecave:     { a: '#aef2ff', b: '#4aa8ff', panel: '#06202e', ink: '#dff6ff' },
    lavafactory: { a: '#ff8a3d', b: '#ff3b2f', panel: '#2a0a06', ink: '#ffd9c2' },
    jungle:      { a: '#7dff9e', b: '#18c08a', panel: '#04231a', ink: '#d2ffe0' },
    desert:      { a: '#ffd479', b: '#e08a2b', panel: '#2a1c06', ink: '#ffeccb' },
    storm:       { a: '#b8a6ff', b: '#5b6bff', panel: '#120a2e', ink: '#e2dcff' },
    fortress:    { a: '#ff7b7b', b: '#c02a5a', panel: '#260814', ink: '#ffd6d6' }
  },

  welcomeAccent(theme) {
    return this.WELCOME_ACCENTS[theme] || this.WELCOME_ACCENTS.lab;
  },

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  },

  _wrapText(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  },

  // Reads the level's own contents so the briefing lists exactly the
  // hazards that level actually spawns — no hand-maintained duplicate list.
  welcomeChips(ld) {
    const chips = [];
    if (!ld) return chips;
    if ((ld.enemies   || []).length) chips.push('🤖 DRONES');
    if ((ld.turrets   || []).length) chips.push('🔫 TURRETS');
    if ((ld.crushers  || []).length) chips.push('⚙️ CRUSHERS');
    if ((ld.bosses    || []).length) chips.push('💀 BOSS');
    if ((ld.platforms || []).length) chips.push('🛗 MOVING PLATFORMS');
    if ((ld.switches  || []).length || (ld.doors || []).length) chips.push('🔘 SWITCH + DOOR');
    const hasSpikes = (ld.map || []).some(row => row.indexOf(2) !== -1);
    if (hasSpikes) chips.push('⚠️ SPIKES');
    if (!chips.length) chips.push('✅ CLEAR RUN');
    return chips;
  },

  // Single source of truth for the welcome screen's clickable regions —
  // drawn from here AND hit-tested from here, so the buttons can never
  // drift out of sync with where the player actually has to tap.
  welcomeButtons(W, H) {
    return {
      start: { x: 400, y: 440, w: 300, h: 58 },
      dash:  { x: 716, y: 440, w: 204, h: 58 },
      theme: { x: 400, y: 512, w: 520, h: 34 }
    };
  },

  drawWelcome(ctx, W, H, wState, tick, ld, profile, lives) {
    // If the player has forced one background theme, the panel recolors to
    // match what they're actually looking at; on AUTO it follows the level.
    const shownTheme = (typeof GameThemes !== 'undefined' && GameThemes.current !== 'auto')
      ? GameThemes.current : (ld && ld.theme);
    const acc = this.welcomeAccent(shownTheme);
    const levelNum = (wState && wState.levelIndex + 1) || 1;
    const total = (typeof LEVELS !== 'undefined') ? LEVELS.length : 10;

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Scrim over the live themed backdrop: dark at the edges, readable
    // behind the panel, but still letting the animated theme show through.
    const scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, 'rgba(3,7,16,0.86)');
    scrim.addColorStop(0.45, 'rgba(3,7,16,0.62)');
    scrim.addColorStop(1, 'rgba(3,7,16,0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);

    // ---- header -------------------------------------------------------
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = acc.a;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`MISSION BRIEFING  //  LEVEL ${levelNum} OF ${total}`, W / 2, 38);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 40px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = acc.a;
    ctx.shadowBlur = 18;
    ctx.fillText(String((ld && ld.name) || 'MISSION').toUpperCase(), W / 2, 80);
    ctx.shadowBlur = 0;

    const ruleG = ctx.createLinearGradient(W / 2 - 220, 0, W / 2 + 220, 0);
    ruleG.addColorStop(0, 'rgba(255,255,255,0)');
    ruleG.addColorStop(0.5, acc.a);
    ruleG.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ruleG;
    ctx.fillRect(W / 2 - 220, 92, 440, 2);

    // biome chip (top-right)
    const themeLabel = (typeof GameThemes !== 'undefined' && GameThemes.LABELS[shownTheme])
      ? GameThemes.LABELS[shownTheme] : 'UNKNOWN BIOME';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    this._roundRect(ctx, W - 230, 20, 210, 30, 15);
    ctx.fill();
    ctx.strokeStyle = acc.a;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = acc.a;
    ctx.fillText('🌐 ' + themeLabel, W - 125, 39);

    // ---- hero robot ---------------------------------------------------
    this.drawHeroRobot(ctx, 212, 452, tick, 3, acc);

    ctx.textAlign = 'center';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    const unitName = (profile && profile.name) ? profile.name.toUpperCase() : 'SPARKY';
    ctx.fillText(unitName, 212, 494);
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = acc.a;
    ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(tick * 0.06));
    ctx.fillText('● RESCUE UNIT ONLINE', 212, 514);
    ctx.globalAlpha = 1;

    // ---- briefing panel -----------------------------------------------
    const px = 400, py = 116, pw = 520, ph = 300;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(6,12,22,0.9)';
    this._roundRect(ctx, px, py, pw, ph, 16);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = acc.a;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, px, py, pw, ph, 16);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // speech tail pointing back at the robot
    ctx.fillStyle = 'rgba(6,12,22,0.9)';
    ctx.beginPath();
    ctx.moveTo(px, py + 84);
    ctx.lineTo(px - 18, py + 100);
    ctx.lineTo(px, py + 116);
    ctx.closePath();
    ctx.fill();

    // panel header strip
    const headG = ctx.createLinearGradient(px, py, px + pw, py);
    headG.addColorStop(0, acc.b);
    headG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = headG;
    this._roundRect(ctx, px + 1, py + 1, pw - 2, 36, 15);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('📡 INCOMING TRANSMISSION', px + 20, py + 24);
    ctx.textAlign = 'right';
    ctx.fillStyle = acc.a;
    ctx.fillText(`LEVEL ${String(levelNum).padStart(2, '0')}`, px + pw - 20, py + 24);

    let cy = py + 66;
    ctx.textAlign = 'left';

    // robot's greeting, revealed with a typewriter effect
    const brief = (ld && ld.brief) || (ld && ld.hint) || 'Mission ready.';
    ctx.font = '17px "Segoe UI", sans-serif';
    const revealed = wState
      ? brief.slice(0, Math.floor((wState.frames || 0) * 1.1))
      : brief;
    const lines = this._wrapText(ctx, brief, pw - 48);
    let shown = revealed.length;
    ctx.fillStyle = '#ffffff';
    for (const line of lines) {
      const part = line.slice(0, Math.max(0, shown));
      if (part) ctx.fillText(part, px + 24, cy);
      shown -= line.length + 1;
      cy += 25;
    }
    cy += 6;

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 24, cy);
    ctx.lineTo(px + pw - 24, cy);
    ctx.stroke();
    cy += 26;

    // objective line
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = acc.a;
    ctx.fillText('OBJECTIVE', px + 24, cy);
    cy += 20;
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillStyle = acc.ink;
    const hintLines = this._wrapText(ctx, (ld && ld.hint) || '', pw - 48).slice(0, 2);
    for (const line of hintLines) { ctx.fillText(line, px + 24, cy); cy += 19; }
    cy += 10;

    // hazard chips
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    let chipX = px + 24;
    let chipY = cy;
    for (const label of this.welcomeChips(ld)) {
      const cw = ctx.measureText(label).width + 22;
      if (chipX + cw > px + pw - 24) { chipX = px + 24; chipY += 30; }
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this._roundRect(ctx, chipX, chipY, cw, 24, 12);
      ctx.fill();
      ctx.strokeStyle = acc.a;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, chipX + 11, chipY + 16);
      chipX += cw + 10;
    }

    // stat strip along the bottom of the panel
    const statY = py + ph - 30;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`◈ COLLECT ${(ld && ld.minCoins) || 0} CORES`, px + 24, statY);
    ctx.fillStyle = '#ff5b7f';
    ctx.fillText('❤ '.repeat(Math.max(0, lives || 0)).trim() || '—', px + 230, statY);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`⭐ ${(profile && profile.stars) || 0}   ◈ ${(profile && profile.totalCoins) || 0}`, px + pw - 24, statY);
    ctx.textAlign = 'left';

    // ---- buttons ------------------------------------------------------
    const btns = this.welcomeButtons(W, H);
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.08);

    // START (primary, glowing)
    ctx.save();
    ctx.shadowColor = acc.a;
    ctx.shadowBlur = 14 + pulse * 16;
    const startG = ctx.createLinearGradient(btns.start.x, btns.start.y, btns.start.x, btns.start.y + btns.start.h);
    startG.addColorStop(0, acc.a);
    startG.addColorStop(1, acc.b);
    ctx.fillStyle = startG;
    this._roundRect(ctx, btns.start.x, btns.start.y, btns.start.w, btns.start.h, 12);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    this._roundRect(ctx, btns.start.x + 6, btns.start.y + 5, btns.start.w - 12, 16, 8);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillStyle = '#04121a';
    ctx.fillText('▶  START MISSION', btns.start.x + btns.start.w / 2, btns.start.y + 38);

    // DASHBOARD
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    this._roundRect(ctx, btns.dash.x, btns.dash.y, btns.dash.w, btns.dash.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, btns.dash.x, btns.dash.y, btns.dash.w, btns.dash.h, 12);
    ctx.stroke();
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🚪 DASHBOARD', btns.dash.x + btns.dash.w / 2, btns.dash.y + 36);

    // theme cycler
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    this._roundRect(ctx, btns.theme.x, btns.theme.y, btns.theme.w, btns.theme.h, 10);
    ctx.fill();
    ctx.strokeStyle = acc.a;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    this._roundRect(ctx, btns.theme.x, btns.theme.y, btns.theme.w, btns.theme.h, 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = acc.ink;
    const curTheme = (typeof GameThemes !== 'undefined') ? GameThemes.label() : 'AUTO';
    ctx.fillText('🎨 BACKGROUND THEME:  ' + curTheme + '   (TAP TO CHANGE)',
                 btns.theme.x + btns.theme.w / 2, btns.theme.y + 22);

    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('PRESS ENTER / SPACE TO LAUNCH  ·  ESC FOR DASHBOARD', W / 2, 566);

    ctx.restore();
  },

  // ---- HD hero robot -------------------------------------------------
  // High-detail, fully vector-drawn welcome robot: metal gradients, rim
  // light, glossy visor with blinking eyes and a sweeping scanline, a
  // pulsing chest core, a waving arm and hover thrusters. Everything is
  // drawn in a local space whose origin sits at the robot's feet.
  drawHeroRobot(ctx, cx, cy, tick, scale, acc) {
    scale = scale || 1;
    acc = acc || this.welcomeAccent('lab');

    const bob = Math.sin(tick * 0.045) * 4;
    const wave = Math.sin(tick * 0.13);
    const blink = (tick % 230) < 7;
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.07);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // --- backlight halo
    const halo = ctx.createRadialGradient(0, -48, 6, 0, -48, 96);
    halo.addColorStop(0, acc.a);
    halo.addColorStop(0.35, acc.b);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.16 + pulse * 0.1;
    ctx.fillStyle = halo;
    ctx.fillRect(-100, -150, 200, 200);
    ctx.globalAlpha = 1;

    // --- holo floor pad
    ctx.save();
    ctx.translate(0, 4);
    ctx.scale(1, 0.26);
    for (let i = 0; i < 3; i++) {
      const r = 34 + i * 10 + Math.sin(tick * 0.05 - i) * 3;
      ctx.strokeStyle = acc.a;
      ctx.globalAlpha = 0.28 - i * 0.07;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, 26 - bob * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.translate(0, bob);

    // --- hover thruster glow under each foot
    for (const fx of [-9, 9]) {
      const flick = 0.55 + 0.45 * Math.abs(Math.sin(tick * 0.31 + fx));
      const jet = ctx.createLinearGradient(0, -12, 0, 2 - bob);
      jet.addColorStop(0, acc.a);
      jet.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5 * flick;
      ctx.fillStyle = jet;
      ctx.beginPath();
      ctx.moveTo(fx - 5, -12);
      ctx.lineTo(fx + 5, -12);
      ctx.lineTo(fx + 8, 2 - bob);
      ctx.lineTo(fx - 8, 2 - bob);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // --- legs
    const legG = ctx.createLinearGradient(-14, 0, 14, 0);
    legG.addColorStop(0, '#5d6c85');
    legG.addColorStop(0.45, '#c7d3e4');
    legG.addColorStop(1, '#6d7b93');
    for (const lx of [-15, 5]) {
      ctx.fillStyle = legG;
      this._roundRect(ctx, lx, -16, 10, 16, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(lx + 1, -8, 8, 2);
    }

    // --- torso
    const bodyG = ctx.createLinearGradient(-22, -52, 22, -14);
    bodyG.addColorStop(0, '#8c9ab2');
    bodyG.addColorStop(0.3, '#eef3fa');
    bodyG.addColorStop(0.62, '#c2cddf');
    bodyG.addColorStop(1, '#6b7891');
    ctx.fillStyle = bodyG;
    this._roundRect(ctx, -21, -54, 42, 40, 12);
    ctx.fill();

    // torso seams + side vents
    ctx.strokeStyle = 'rgba(40,52,72,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-21, -30); ctx.lineTo(21, -30); ctx.stroke();
    ctx.fillStyle = 'rgba(40,52,72,0.35)';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-17, -26 + i * 4, 8, 2);
      ctx.fillRect(9, -26 + i * 4, 8, 2);
    }

    // shoulder pads
    const shG = ctx.createLinearGradient(0, -54, 0, -42);
    shG.addColorStop(0, '#f2f6fc');
    shG.addColorStop(1, '#7c8aa3');
    ctx.fillStyle = shG;
    this._roundRect(ctx, -28, -52, 12, 14, 6); ctx.fill();
    this._roundRect(ctx, 16, -52, 12, 14, 6); ctx.fill();

    // --- chest core
    const coreY = -36;
    const coreGlow = ctx.createRadialGradient(0, coreY, 1, 0, coreY, 16);
    coreGlow.addColorStop(0, '#ffffff');
    coreGlow.addColorStop(0.35, acc.a);
    coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.fillStyle = coreGlow;
    ctx.fillRect(-16, coreY - 16, 32, 32);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0d1826';
    ctx.beginPath(); ctx.arc(0, coreY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = acc.a;
    ctx.beginPath(); ctx.arc(0, coreY, 5 + pulse * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = acc.a;
    ctx.globalAlpha = 1 - pulse;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, coreY, 8 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    // --- arms (left one waves hello)
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#b9c6da';
    ctx.lineWidth = 6;
    // right arm, resting
    ctx.beginPath();
    ctx.moveTo(22, -46);
    ctx.quadraticCurveTo(29, -36, 27, -22);
    ctx.stroke();
    ctx.fillStyle = '#dfe8f5';
    ctx.beginPath(); ctx.arc(27, -20, 4.5, 0, Math.PI * 2); ctx.fill();

    // left arm, waving
    ctx.save();
    ctx.translate(-22, -46);
    ctx.rotate(-0.85 + wave * 0.35);
    ctx.strokeStyle = '#cdd8e8';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16); ctx.stroke();
    ctx.translate(0, -16);
    ctx.rotate(wave * 0.45);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke();
    ctx.fillStyle = '#eef3fa';
    ctx.beginPath(); ctx.arc(0, -15, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = acc.a;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(0, -15, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- neck
    ctx.fillStyle = '#7b8aa2';
    ctx.fillRect(-5, -58, 10, 6);

    // --- head
    const headG = ctx.createLinearGradient(-19, -90, 19, -56);
    headG.addColorStop(0, '#94a2ba');
    headG.addColorStop(0.28, '#f4f8fd');
    headG.addColorStop(0.68, '#ccd7e8');
    headG.addColorStop(1, '#75849d');
    ctx.fillStyle = headG;
    this._roundRect(ctx, -19, -90, 38, 34, 12);
    ctx.fill();

    // ear discs
    ctx.fillStyle = '#8a98b0';
    this._roundRect(ctx, -23, -78, 5, 12, 2.5); ctx.fill();
    this._roundRect(ctx, 18, -78, 5, 12, 2.5); ctx.fill();
    ctx.fillStyle = acc.a;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-22, -74, 3, 4);
    ctx.fillRect(19, -74, 3, 4);
    ctx.globalAlpha = 1;

    // visor
    const visorG = ctx.createLinearGradient(0, -84, 0, -66);
    visorG.addColorStop(0, '#0a1420');
    visorG.addColorStop(1, '#12263a');
    ctx.fillStyle = visorG;
    this._roundRect(ctx, -15, -84, 30, 17, 8);
    ctx.fill();

    // eyes (blink by squashing them flat)
    ctx.save();
    ctx.shadowColor = acc.a;
    ctx.shadowBlur = 10;
    ctx.fillStyle = acc.a;
    for (const ex of [-6.5, 6.5]) {
      ctx.beginPath();
      ctx.ellipse(ex, -75.5, 3.4, blink ? 0.5 : 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!blink) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-7.6, -76.8, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5.4, -76.8, 1.1, 0, Math.PI * 2); ctx.fill();
    }

    // visor scanline sweep + glass specular
    ctx.save();
    this._roundRect(ctx, -15, -84, 30, 17, 8);
    ctx.clip();
    const sweep = -15 + ((tick * 0.9) % 46);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = acc.a;
    ctx.fillRect(sweep, -84, 5, 17);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-15, -84); ctx.lineTo(2, -84); ctx.lineTo(-8, -67); ctx.lineTo(-15, -67);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // head top highlight
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    this._roundRect(ctx, -13, -88, 26, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- antenna with signal rings
    ctx.strokeStyle = '#6f7d95';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(0, -102); ctx.stroke();
    ctx.save();
    ctx.shadowColor = acc.a;
    ctx.shadowBlur = 12;
    ctx.fillStyle = acc.a;
    ctx.beginPath(); ctx.arc(0, -105, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 2; i++) {
      const p = ((tick * 0.02 + i * 0.5) % 1);
      ctx.strokeStyle = acc.a;
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, -105, 4 + p * 14, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // --- rim light down the left silhouette
    ctx.strokeStyle = acc.a;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.6;
    this._roundRect(ctx, -19, -90, 38, 34, 12); ctx.stroke();
    this._roundRect(ctx, -21, -54, 42, 40, 12); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    // --- orbiting holo motes (drawn in screen space so they stay crisp)
    for (let i = 0; i < 7; i++) {
      const a = tick * 0.018 + (i / 7) * Math.PI * 2;
      const r = (52 + Math.sin(tick * 0.04 + i) * 8) * scale;
      const sx = cx + Math.cos(a) * r;
      const sy = cy - 120 + Math.sin(a) * r * 0.42 + bob * scale * 0.4;
      const tw = (Math.sin(tick * 0.09 + i * 1.7) + 1) / 2;
      ctx.save();
      ctx.globalAlpha = 0.25 + tw * 0.55;
      ctx.fillStyle = i % 2 === 0 ? acc.a : '#ffffff';
      ctx.shadowColor = acc.a;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.4 + tw * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // Bouncy, arms-up victory dance — used on the level-complete and win screens.
  drawDanceRobot(ctx, cx, cy, tick, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const bob = Math.sin(tick * 0.25) * 8;
    const wobble = Math.sin(tick * 0.25) * 0.12;
    ctx.translate(0, bob);
    ctx.rotate(wobble);

    // ground shadow (counter-squashed so it doesn't bob with the body)
    ctx.save();
    ctx.translate(0, 46 - bob);
    ctx.scale(1, 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 26 - Math.abs(Math.sin(tick * 0.25)) * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const w = 34, h = 40, hw = w / 2, hh = h / 2;
    this.draw3DBox(ctx, -hw, -hh, w, h - 4, 5, '#66ccff', '#0077e6', '#004499', '#ffffff');

    const visorG = ctx.createLinearGradient(-hw + 3, -hh + 3, hw - 3, -hh + 11);
    visorG.addColorStop(0, '#00ffff');
    visorG.addColorStop(1, '#0088cc');
    ctx.fillStyle = visorG;
    ctx.fillRect(-hw + 3, -hh + 3, w - 6, 8);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 8;
    ctx.fillRect(-hw + 6, -hh + 5, 4, 4);
    ctx.fillRect(hw - 10, -hh + 5, 4, 4);
    ctx.shadowBlur = 0;

    // legs kicking alternately (classic dance-step)
    const kick = Math.sin(tick * 0.5);
    ctx.fillStyle = '#0055aa';
    ctx.save(); ctx.translate(-hw + 5, hh - 6); ctx.rotate(kick * 0.5); ctx.fillRect(-3, 0, 6, 12); ctx.restore();
    ctx.save(); ctx.translate(hw - 5, hh - 6); ctx.rotate(-kick * 0.5); ctx.fillRect(-3, 0, 6, 12); ctx.restore();

    // arms thrown up alternately — "raise the roof"
    const armUp = Math.sin(tick * 0.5);
    ctx.strokeStyle = '#3399ff';
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-hw, -hh + 8);
    ctx.lineTo(-hw - 10, -hh - 6 - armUp * 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hw, -hh + 8);
    ctx.lineTo(hw + 10, -hh - 6 + armUp * 10);
    ctx.stroke();

    ctx.restore();

    // celebration sparkles orbiting the robot
    for (let i = 0; i < 6; i++) {
      const a = tick * 0.06 + (i / 6) * Math.PI * 2;
      const r = 46 + Math.sin(tick * 0.15 + i) * 6;
      const sx = cx + Math.cos(a) * r * scale;
      const sy = cy + bob + Math.sin(a) * r * 0.55 * scale - 6;
      const tw = (Math.sin(tick * 0.3 + i * 2) + 1) / 2;
      ctx.save();
      ctx.globalAlpha = 0.4 + tw * 0.6;
      ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#00ffcc';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + tw * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // Slumped, sparking, glitching robot — used on the game-over screen.
  drawSadRobot(ctx, cx, cy, tick) {
    ctx.save();
    ctx.translate(cx, cy);

    const jitter = Math.sin(tick * 1.3) * 1.2 + Math.sin(tick * 3.1) * 0.6;
    ctx.translate(jitter, Math.max(0, Math.sin(tick * 0.05)) * 1.5);
    ctx.rotate(0.18); // slumped over to one side

    // shadow
    ctx.save();
    ctx.translate(2, 40);
    ctx.scale(1, 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const w = 34, h = 40, hw = w / 2, hh = h / 2;

    // drooping antenna
    ctx.strokeStyle = '#556'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -hh - 2);
    ctx.quadraticCurveTo(10, -hh - 10, 6, -hh - 2);
    ctx.stroke();

    this.draw3DBox(ctx, -hw, -hh, w, h - 4, 5, '#7a8699', '#3d4759', '#232b38', '#111');

    // cracked/broken visor — a dim red X instead of the usual bright cyan eyes
    ctx.strokeStyle = 'rgba(255,60,60,0.85)';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-hw + 6, -hh + 3); ctx.lineTo(-hw + 14, -hh + 11);
    ctx.moveTo(-hw + 14, -hh + 3); ctx.lineTo(-hw + 6, -hh + 11);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hw - 14, -hh + 3); ctx.lineTo(hw - 6, -hh + 11);
    ctx.moveTo(hw - 6, -hh + 3); ctx.lineTo(hw - 14, -hh + 11);
    ctx.stroke();

    // arms hanging limp
    ctx.strokeStyle = '#5a6478';
    ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-hw, -hh + 8); ctx.lineTo(-hw - 4, hh - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hw, -hh + 8); ctx.lineTo(hw + 4, hh - 4); ctx.stroke();

    // legs crumpled
    ctx.fillStyle = '#3d4759';
    ctx.fillRect(-hw + 4, hh - 6, 7, 6);
    ctx.fillRect(hw - 11, hh - 6, 7, 6);

    ctx.restore();

    // occasional spark bursts off the shoulder
    if (Math.sin(tick * 0.7) > 0.85) {
      const shoulderOffset = 14;
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 10;
        ctx.save();
        ctx.fillStyle = '#ffdd55';
        ctx.shadowColor = '#ff9900'; ctx.shadowBlur = 6;
        ctx.fillRect(cx + shoulderOffset + Math.cos(a) * r, cy - 6 + Math.sin(a) * r, 2, 2);
        ctx.restore();
      }
    }
  },

  drawLevelComplete(ctx, W, H, tick, levelNum, coinsCollected, timer, isLastLevel) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);

    this.draw3DBox(ctx, W / 2 - 200, H / 2 - 110, 400, 220, 8, '#00ffcc', '#006655', '#003322', '#ffffff');

    this.drawDanceRobot(ctx, W / 2, H / 2 - 128, tick, 0.85);

    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🎉 MISSION ESCAPED!', W / 2, H / 2 - 60);

    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`Coins Collected: ${coinsCollected}`, W / 2, H / 2 - 15);
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(`Clear Time: ${Math.floor(timer / 60)}s`, W / 2, H / 2 + 15);

    this.draw3DBox(ctx, W / 2 - 140, H / 2 + 45, 280, 40, 5, '#00ffcc', '#009977', '#004433', '#ffffff');
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isLastLevel ? '▶ LAUNCH VICTORY SCREEN' : '▶ NEXT MISSION (ENTER)', W / 2, H / 2 + 70);

    ctx.restore();
  },

  drawGameOver(ctx, W, H, tick) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 0, 0, 0.92)';
    ctx.fillRect(0, 0, W, H);

    this.draw3DBox(ctx, W / 2 - 200, H / 2 - 90, 400, 180, 8, '#ff4444', '#990000', '#440000', '#ffffff');

    this.drawSadRobot(ctx, W / 2, H / 2 - 108, tick);

    ctx.textAlign = 'center';
    ctx.font = 'bold 32px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('💀 ROBOT SHATTERED', W / 2, H / 2 - 35);

    this.draw3DBox(ctx, W / 2 - 130, H / 2 + 10, 260, 42, 5, '#ff4444', '#cc0000', '#660000', '#ffffff');
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🔄 RETRY MISSION (ENTER)', W / 2, H / 2 + 36);

    ctx.restore();
  },

  drawWin(ctx, W, H, tick) {
    ctx.save();
    ctx.fillStyle = '#020b18';
    ctx.fillRect(0, 0, W, H);

    this.drawBackground(ctx, W, H, '#020b18', '#082247', tick * 15, 0, tick);
    this.draw3DBox(ctx, W / 2 - 260, H / 2 - 130, 520, 260, 10, '#ffd700', '#b8860b', '#5c4300', '#ffffff');

    this.drawDanceRobot(ctx, W / 2, H / 2 - 150, tick, 1.15);

    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🏆 GALAXY ESCAPED! 🏆', W / 2, H / 2 - 60);

    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('You cleared every mission and brought all the humans home!', W / 2, H / 2);

    this.draw3DBox(ctx, W / 2 - 150, H / 2 + 40, 300, 45, 5, '#00ffcc', '#00aa88', '#004433', '#ffffff');
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🚪 RETURN TO DASHBOARD', W / 2, H / 2 + 68);

    ctx.restore();
  },

  drawVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },

  drawPause(ctx, W, H, tick) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);
    this.draw3DBox(ctx, W / 2 - 160, H / 2 - 80, 320, 160, 8, '#00ffcc', '#006655', '#003322', '#ffffff');
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('⏸ PAUSED', W / 2, H / 2 - 20);

    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('Press P or ESC to Resume', W / 2, H / 2 + 25);
    ctx.restore();
  }
};
