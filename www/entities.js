// ============================================================
//  ENTITIES - Player (with Health & Clamped Y), HealthPack, Enemies,
//             Coins, Switches, Doors, Exit, Platform, Crusher, Turrets
// ============================================================

const T = 32;
const GRAVITY = 0.55;
const MAX_FALL = 14;
const JUMP_VEL = -12.5;
const MOVE_ACC = 1.4;
const MOVE_MAX = 4.8;
const FRICTION = 0.82;

function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 12;
    this.vy = (Math.random() - 0.8) * 12;
    this.size = Math.random() * 6 + 3;
    this.color = color || '#00ffcc';
    this.life = 45;
    this.maxLife = 45;
    this.rot = Math.random() * Math.PI * 2;
    this.vrot = (Math.random() - 0.5) * 0.4;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.35;
    this.rot += this.vrot;
    this.life--;
  }
}

class Player {
  constructor(tx, ty) {
    this.w = 26; this.h = 32;
    this.x = tx * T + (T - this.w) / 2;
    this.y = ty * T - this.h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.jumpHeld = false;
    this.jumpReleased = true;
    this.facing = 1;
    this.state = 'idle';
    this.hp = 3;       // 3 Hearts ❤️
    this.maxHp = 3;
    this.invincible = 0;
    this.hurtAnim = 0;
    this.frame = 0;
    this.frameTimer = 0;
    this.dead = false;
    this.interactCooldown = 0;
    this.gravityDir = 1; // 1 = down, -1 = up
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(map, mapW, mapH, entities, keys) {
    if (this.dead) return;

    const left     = keys['ArrowLeft']  || keys['KeyA'];
    const right    = keys['ArrowRight'] || keys['KeyD'];
    const jump     = keys['ArrowUp']    || keys['KeyW'] || keys['Space'];
    const interact = keys['KeyE'];
    const flipGrav = keys['KeyG'];

    if (flipGrav && this.interactCooldown === 0) {
      this.gravityDir *= -1;
      this.interactCooldown = 25;
      AudioManager.switchClick();
    }

    if (left)  { this.vx -= MOVE_ACC; this.facing = -1; }
    if (right) { this.vx += MOVE_ACC; this.facing =  1; }
    if (!left && !right) this.vx *= FRICTION;
    this.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, this.vx));

    const g = GRAVITY * this.gravityDir;
    this.vy += g;
    if (this.gravityDir === 1) this.vy = Math.min(this.vy, MAX_FALL);
    else                       this.vy = Math.max(this.vy, -MAX_FALL);

    const jVel = JUMP_VEL * this.gravityDir;
    if (jump && this.onGround && this.jumpReleased) {
      this.vy = jVel;
      this.onGround = false;
      this.jumpReleased = false;
      this.jumpHeld = true;
      AudioManager.jump();
    }
    if (jump && this.jumpHeld && ((this.gravityDir === 1 && this.vy < 0) || (this.gravityDir === -1 && this.vy > 0))) {
      this.vy -= 0.22 * this.gravityDir;
    }
    if (!jump) { this.jumpReleased = true; this.jumpHeld = false; }

    this.x += this.vx;
    this._collideTilesX(map, mapW, mapH);
    this._collideDoors(entities);

    const prevBottom = this.y + this.h;
    const prevTop = this.y;
    this.onGround = false;
    this.y += this.vy;
    this._collideTilesY(map, mapW, mapH);
    this._collidePlatforms(entities, prevBottom, prevTop);

    // Strict boundary clamps so robot CANNOT float away above or below
    this.x = Math.max(0, Math.min(this.x, mapW * T - this.w));
    this.y = Math.max(0, this.y); // Clamp top of screen!

    if (this.y > mapH * T + 100) this._die(entities);

    if (this.interactCooldown > 0) this.interactCooldown--;
    if (interact && this.interactCooldown === 0) {
      this._tryInteract(entities);
      this.interactCooldown = 20;
    }

    this.frameTimer++;
    const speed = Math.abs(this.vx);
    const interval = speed > 0.5 ? Math.max(4, 12 - speed * 2) : 16;
    if (this.frameTimer >= interval) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }

    if (!this.onGround)              this.state = 'jump';
    else if (Math.abs(this.vx) > 0.5) this.state = 'run';
    else                              this.state = 'idle';

    if (this.invincible > 0) this.invincible--;
    if (this.hurtAnim > 0)   this.hurtAnim--;
  }

  _tileAt(map, mapW, mapH, col, row) {
    if (col < 0 || col >= mapW || row < 0 || row >= mapH) return 1;
    return map[row][col];
  }

  _collideTilesX(map, mapW, mapH) {
    const rows = [Math.floor(this.y / T), Math.floor((this.y + this.h - 1) / T)];
    const cols = [Math.floor(this.x / T), Math.floor((this.x + this.w) / T)];
    const incomingVx = this.vx; // capture BEFORE the loop mutates this.vx
    for (const row of rows) {
      for (const col of cols) {
        const tile = this._tileAt(map, mapW, mapH, col, row);
        if (tile === 1) {
          if (incomingVx > 0) { this.x = col * T - this.w; }
          else                { this.x = (col + 1) * T; }
          this.vx = 0;
        }
        if (tile === 2) this._hurt();
      }
    }
  }

  _collideTilesY(map, mapW, mapH) {
    const cols = [Math.floor((this.x + 2) / T), Math.floor((this.x + this.w - 2) / T)];
    const rows = [Math.floor(this.y / T), Math.floor((this.y + this.h) / T)];
    const incomingVy = this.vy; // capture BEFORE the loop mutates this.vy — otherwise a
                                 // second tile hit in the same call reads back the already-
                                 // zeroed vy, misreads it as "falling", and wrongly marks
                                 // the robot onGround while it's actually stuck on a ceiling.
    for (const col of cols) {
      for (const row of rows) {
        const tile = this._tileAt(map, mapW, mapH, col, row);
        if (tile === 1) {
          if (this.gravityDir === 1) {
            if (incomingVy >= 0) { this.y = row * T - this.h; this.onGround = true; }
            else                 { this.y = (row + 1) * T; }
          } else {
            if (incomingVy <= 0) { this.y = (row + 1) * T; this.onGround = true; }
            else                 { this.y = row * T - this.h; }
          }
          this.vy = 0;
        }
        if (tile === 2) this._hurt();
      }
    }
  }

  _collidePlatforms(entities, prevBottom, prevTop) {
    for (const e of entities) {
      if (e.type !== 'platform') continue;
      const p = e;
      if (this.x + this.w <= p.x || this.x >= p.x + p.w) continue;

      if (this.gravityDir === 1 && prevBottom <= p.y && this.y + this.h >= p.y && this.vy >= 0) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.x += p.vx || 0;
      } else if (this.gravityDir === -1 && prevTop >= p.y + p.h && this.y <= p.y + p.h && this.vy <= 0) {
        this.y = p.y + p.h;
        this.vy = 0;
        this.onGround = true;
        this.x += p.vx || 0;
      }
    }
  }

  _collideDoors(entities) {
    for (const e of entities) {
      if (e.type !== 'door' || !e.solid) continue;
      const d = e.bounds;
      if (!d) continue;
      if (rectsOverlap(this.bounds, d)) {
        const overlapRight = (this.x + this.w) - d.x;
        const overlapLeft  = (d.x + d.w) - this.x;
        if (this.vx > 0 && overlapRight < overlapLeft) { this.x = d.x - this.w; this.vx = 0; }
        else if (this.vx < 0 && overlapLeft < overlapRight) { this.x = d.x + d.w; this.vx = 0; }
      }
    }
  }

  _tryInteract(entities) {
    const reach = { x: this.x - 10, y: this.y - 10, w: this.w + 20, h: this.h + 20 };
    for (const e of entities) {
      if (e.type === 'switch' && !e.activated && rectsOverlap(reach, e.bounds)) {
        e.activate(entities);
      }
    }
  }

  _hurt() {
    if (this.invincible > 0 || this.dead) return;
    this.hp--;
    this.invincible = 75;
    this.hurtAnim = 30;
    this.vy = -7 * this.gravityDir;
    this.vx = -this.facing * 4; // Knockback!
    AudioManager.hurt();

    if (this.hp <= 0) {
      this._die(typeof Game !== 'undefined' ? Game.entities : null);
    }
  }

  _die(entities) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    AudioManager.explode();

    if (entities && typeof Game !== 'undefined') {
      const colors = ['#00ffcc', '#ffffff', '#0077e6', '#004499', '#ff9900'];
      for (let i = 0; i < 40; i++) {
        Game.particles.push(new Particle(this.x + this.w / 2, this.y + this.h / 2, colors[i % colors.length]));
      }
    }

    if (typeof Game !== 'undefined') Game.loseLife();
  }
}

class HealthPack {
  constructor(tx, ty) {
    this.w = 18; this.h = 18;
    this.x = tx * T + (T - this.w) / 2;
    this.y = ty * T + (T - this.h) / 2;
    this.type = 'health';
    this.collected = false;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

class Enemy {
  constructor(tx, ty, range) {
    this.w = 28; this.h = 28;
    this.x = tx * T;
    this.y = ty * T - this.h;
    this.startX = this.x;
    this.range = (range || 5) * T;
    this.vx = 1.6;
    this.vy = 0;
    this.type = 'enemy';
    this.alive = true;
    this.deathTimer = 0;
    this.frame = 0;
    this.frameTimer = 0;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(map, mapW, mapH) {
    if (!this.alive) { this.deathTimer++; return; }

    if (this.x <= this.startX - this.range) this.vx = Math.abs(this.vx);
    if (this.x >= this.startX + this.range) this.vx = -Math.abs(this.vx);

    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.x += this.vx;
    this.y += this.vy;

    const col = Math.floor((this.x + this.w / 2) / T);
    const rowB = Math.floor((this.y + this.h) / T);
    if (rowB >= 0 && rowB < mapH && col >= 0 && col < mapW && map[rowB][col] === 1) {
      this.y = rowB * T - this.h; this.vy = 0;
    }
    if (this.y > mapH * T + 200) this.alive = false;

    this.frameTimer++;
    if (this.frameTimer > 10) { this.frame = (this.frame + 1) % 2; this.frameTimer = 0; }
  }

  stomp() { this.alive = false; this.deathTimer = 0; AudioManager.stomp(); }
}

class Coin {
  constructor(tx, ty) {
    this.w = 16; this.h = 16;
    this.x = tx * T + (T - this.w) / 2;
    this.y = ty * T + (T - this.h) / 2;
    this.type = 'coin';
    this.collected = false;
    this.frame = 0;
    this.frameTimer = 0;
    this.floatPhase = Math.random() * Math.PI * 2;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update() {
    if (this.collected) return;
    this.frameTimer++;
    if (this.frameTimer > 5) { this.frame = (this.frame + 1) % 8; this.frameTimer = 0; }
  }
}

class Turret {
  constructor(tx, ty, fireRate) {
    this.x = tx * T; this.y = ty * T;
    this.w = T; this.h = T;
    this.type = 'turret';
    this.fireTimer = 0;
    this.fireInterval = fireRate || 120;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(entities) {
    this.fireTimer++;
    if (this.fireTimer >= this.fireInterval) {
      this.fireTimer = 0;
      AudioManager.laser();
      entities.push(new Bullet(this.x + 16, this.y + 16, -4, 0));
    }
  }
}

class Bullet {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y;
    this.w = 12; this.h = 6;
    this.vx = vx; this.vy = vy;
    this.type = 'bullet';
    this.active = true;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }
}

class Crusher {
  constructor(tx, ty, heightTiles) {
    this.x = tx * T; this.y = ty * T;
    this.w = T * 2; this.h = (heightTiles || 3) * T;
    this.type = 'crusher';
    this.timer = 0;
    this.currH = 10;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.currH }; }

  update() {
    this.timer++;
    if (this.timer % 140 < 70) {
      this.currH = Math.min(this.h, this.currH + 4);
    } else {
      this.currH = Math.max(10, this.currH - 2);
    }
  }
}

class GameSwitch {
  constructor(tx, ty, doorIds) {
    this.x = tx * T; this.y = ty * T;
    this.w = T; this.h = T;
    this.type = 'switch';
    this.activated = false;
    this.doorIds = doorIds || [];
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  activate(entities) {
    if (this.activated) return;
    this.activated = true;
    AudioManager.switchClick();
    for (const e of entities) {
      if (e.type === 'door' && this.doorIds.includes(e.id)) e.open();
    }
  }
}

class Door {
  constructor(tx, ty, heightTiles, id) {
    this.x = tx * T; this.y = ty * T;
    this.w = T; this.h = (heightTiles || 2) * T;
    this.type = 'door';
    this.id = id;
    this.isOpen = false;
    this.progress = 0;
    this.solid = true;
  }

  get bounds() { return this.solid ? { x: this.x, y: this.y, w: this.w, h: this.h } : null; }

  open() { this.isOpen = true; AudioManager.door(); }

  update() {
    if (this.isOpen && this.progress < 1) this.progress = Math.min(1, this.progress + 0.04);
    this.solid = this.progress < 0.5;
  }
}

class Exit {
  constructor(tx, ty) {
    this.x = tx * T; this.y = ty * T;
    this.w = T; this.h = T * 2;
    this.type = 'exit';
    this.active = false;
    this.pulse = 0;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update() {
    this.pulse = (this.pulse + 0.05) % (Math.PI * 2);
  }
}

class Platform {
  constructor(tx, ty, widthTiles, moveX, moveY, speed) {
    this.x = tx * T; this.y = ty * T;
    this.startX = this.x; this.startY = this.y;
    this.w = (widthTiles || 3) * T; this.h = 10;
    this.type = 'platform';
    this.moveX = (moveX || 0) * T;
    this.moveY = (moveY || 0) * T;
    this.speed = speed || 1;
    this.t = 0;
    this.vx = 0; this.vy = 0;
    this.prevX = this.x; this.prevY = this.y;
  }

  update() {
    this.prevX = this.x; this.prevY = this.y;
    this.t += this.speed * 0.018;
    if (this.moveX !== 0) this.x = this.startX + Math.sin(this.t) * this.moveX;
    if (this.moveY !== 0) this.y = this.startY + Math.sin(this.t) * this.moveY;
    this.vx = this.x - this.prevX;
    this.vy = this.y - this.prevY;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

class Boss {
  constructor(tx, ty) {
    this.w = 64; this.h = 48;
    this.x = tx * T; this.y = ty * T;
    this.startX = this.x;
    this.type = 'boss';
    this.t = 0;
    this.attackTimer = 0;
  }

  get bounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  update(entities) {
    this.t += 0.03;
    this.x = this.startX + Math.sin(this.t) * 120;

    this.attackTimer++;
    if (this.attackTimer >= 100) {
      this.attackTimer = 0;
      AudioManager.laser();
      entities.push(new Bullet(this.x + 32, this.y + 40, 0, 4));
    }
  }
}
