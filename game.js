// ============================================================
//  GAME.JS - Crisp High-DPI Engine with HD Level Welcome Screens
// ============================================================

const GS = { DASHBOARD:'DASHBOARD', HOW:'HOW', WELCOME:'WELCOME', PLAYING:'PLAYING',
              PAUSED:'PAUSED', LEVEL_COMPLETE:'LEVEL_COMPLETE',
              GAME_OVER:'GAME_OVER', WIN:'WIN' };

const AVATARS = ['🤖', '🦾', '⚡', '🛸'];
const NAMES   = ['Sparky', 'Mecha-X', 'Cyber-Bolt', 'VORTEX'];

const Game = {
  canvas: null,
  ctx: null,
  W: 960,
  H: 580,

  keys: {},
  prevKeys: {},
  justPressed(code) { return this.keys[code] && !this.prevKeys[code]; },

  state: GS.DASHBOARD,
  levelIndex: 0,
  selectedLevel: 0,
  lives: 3,
  coinsCollected: 0,
  timer: 0,
  tick: 0,

  profile: {
    avatarIdx: 0,
    avatar: '🤖',
    name: 'Sparky',
    totalCoins: 0,
    stars: 0
  },
  levelUnlocks: [true, false, false, false, false, false, false, false, false, false],

  map: [], mapW: 0, mapH: 0,
  player: null,
  entities: [],
  particles: [],
  exit: null,
  minCoins: 0,
  levelData: null,

  welcomeState: null,
  themeToast: 0,
  cam: { x: 0, y: 0, tx: 0, ty: 0 },

  init() {
    if (this._initialized) return; // never let init() run twice (would start a second game loop)
    this._initialized = true;

    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this._fitCanvas();
    window.addEventListener('resize', () => this._fitCanvas());
    window.addEventListener('orientationchange', () => this._fitCanvas());

    this._loadProfile();

    document.addEventListener('keydown', e => {
      if (!this.keys[e.code]) AudioManager.unlock();
      this.keys[e.code] = true;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyR' && (this.state === GS.PLAYING || this.state === GS.GAME_OVER)) {
        this.restartLevel();
      }
    });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // If the window/tab loses focus while a key is held (switching tabs/apps,
    // opening dev tools, an OS dialog stealing focus, etc.), the browser never
    // delivers the matching keyup — so without this the game keeps "hearing"
    // that key as held forever, and the robot keeps walking on its own until
    // it rams into a wall and sits there stuck. Clearing all keys on blur
    // fixes both symptoms.
    window.addEventListener('blur', () => {
      for (const code in this.keys) this.keys[code] = false;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        for (const code in this.keys) this.keys[code] = false;
      }
    });

    this.canvas.addEventListener('click', e => {
      AudioManager.unlock();
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (this.W / rect.width);
      const my = (e.clientY - rect.top) * (this.H / rect.height);
      this._handleMouseClick(mx, my);
    });

    // If the FPS watchdog flips quality mid-session, rebuild anything
    // that baked the old setting in (canvas scale, cached tile sprites).
    Perf.onChange(() => {
      Renderer._tileCache = null;
      this._fitCanvas();
    });

    requestAnimationFrame(t => this.loop(t));
  },

  // Sizes the canvas's actual backing pixel buffer to match how big it's really
  // displayed on screen (times devicePixelRatio), so the game renders crisp at
  // any screen size — including large 1080p+ desktop displays — instead of
  // being stuck at a small fixed 960x580 backing buffer that gets blurrily
  // upscaled by the browser. All drawing code still just uses the fixed
  // logical 960x580 coordinate space (this.W / this.H); we only rescale how
  // that logical space maps onto the physical pixels.
  _fitCanvas() {
    const container = this.canvas.parentElement;
    const availW = (container ? container.clientWidth  : window.innerWidth)  * 0.96;
    const availH = (container ? container.clientHeight : window.innerHeight) * 0.86;
    const ratio = this.W / this.H;

    let dispW = availW;
    let dispH = dispW / ratio;
    if (dispH > availH) { dispH = availH; dispW = dispH * ratio; }
    dispW = Math.max(280, Math.round(dispW));
    dispH = Math.max(170, Math.round(dispH));

    this.canvas.style.width  = dispW + 'px';
    this.canvas.style.height = dispH + 'px';

    // Perf.dpr caps this well below the raw device ratio on phones. A
    // modern handset reports 3, which means a 9x pixel load versus DPR 1
    // for art that simply isn't detailed enough to show the difference.
    const dpr = Perf.dpr;
    this.canvas.width  = Math.round(dispW * dpr);
    this.canvas.height = Math.round(dispH * dpr);

    // Resizing the canvas resets all context state (including smoothing
    // settings), so these need to be reapplied every time we resize.
    this.ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in this.ctx) this.ctx.imageSmoothingQuality = 'high';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.canvas.width / this.W, this.canvas.height / this.H);
    Renderer.applyQuality(this.ctx);
  },

  _loadProfile() {
    try {
      const saved = localStorage.getItem('robot_rescue_profile_v3');
      if (saved) {
        const data = JSON.parse(saved);
        this.profile = data.profile || this.profile;
        this.levelUnlocks = data.levelUnlocks || this.levelUnlocks;
      }
    } catch(e) {}
  },

  _saveProfile() {
    try {
      localStorage.setItem('robot_rescue_profile_v3', JSON.stringify({
        profile: this.profile,
        levelUnlocks: this.levelUnlocks
      }));
    } catch(e) {}
  },

  // Every level now opens on its own HD welcome screen: the rescue robot
  // greets the player over that level's themed backdrop and gives the
  // briefing, then START MISSION drops straight into play.
  startWelcome(levelIdx) {
    this.levelIndex = levelIdx;
    this.levelData = LEVELS[levelIdx];
    this.state = GS.WELCOME;
    this.welcomeState = { levelIndex: levelIdx, frames: 0 };
    AudioManager.door();
  },

  launchLevel() {
    AudioManager.select();
    this.loadLevel(this.levelIndex);
    this.state = GS.PLAYING;
  },

  restartLevel() {
    AudioManager.select();
    this.loadLevel(this.levelIndex);
    this.state = GS.PLAYING;
  },

  exitToDashboard() {
    AudioManager.menuBeep();
    this.state = GS.DASHBOARD;
  },

  loadLevel(idx) {
    this.levelIndex = idx;
    const ld = LEVELS[idx];
    this.levelData = ld;
    this.map  = ld.map;
    this.mapH = ld.map.length;
    this.mapW = ld.map[0].length;
    this.minCoins = ld.minCoins;
    this.coinsCollected = 0;
    this.timer = 0;

    this.player = new Player(ld.player.tx, ld.player.ty);
    this.entities = [];
    this.particles = [];

    (ld.platforms || []).forEach(p =>
      this.entities.push(new Platform(p.tx, p.ty, p.w, p.moveX, p.moveY, p.speed))
    );

    (ld.coins || []).forEach(c =>
      this.entities.push(new Coin(c.tx, c.ty))
    );

    (ld.switches || []).forEach(s =>
      this.entities.push(new GameSwitch(s.tx, s.ty, s.doorIds))
    );

    (ld.doors || []).forEach(d =>
      this.entities.push(new Door(d.tx, d.ty, d.h, d.id))
    );

    (ld.enemies || []).forEach(e =>
      this.entities.push(new Enemy(e.tx, e.ty, e.range))
    );

    (ld.turrets || []).forEach(t =>
      this.entities.push(new Turret(t.tx, t.ty, t.fireRate))
    );

    (ld.crushers || []).forEach(cr =>
      this.entities.push(new Crusher(cr.tx, cr.ty, cr.h))
    );

    (ld.bosses || []).forEach(b =>
      this.entities.push(new Boss(b.tx, b.ty))
    );

    this.exit = new Exit(ld.exit.tx, ld.exit.ty);

    // Announce the biome for a couple of seconds as the level opens, so
    // the automatic theme change reads as intentional rather than as the
    // background randomly looking different.
    this.themeToast = 170;

    this.cam.x = Math.max(0, this.player.x + this.player.w / 2 - this.W / 2);
    this.cam.y = Math.max(0, this.player.y + this.player.h / 2 - this.H / 2);
    this._clampCam();
  },

  loseLife() {
    this.lives--;
    if (this.lives <= 0) {
      this.lives = 0;
      setTimeout(() => {
        this.state = GS.GAME_OVER;
        AudioManager.gameOver();
      }, 600);
    } else {
      setTimeout(() => this.loadLevel(this.levelIndex), 800);
    }
  },

  _clampCam() {
    const maxX = Math.max(0, this.mapW * 32 - this.W);
    const maxY = Math.max(0, this.mapH * 32 - this.H);
    this.cam.x = Math.max(0, Math.min(this.cam.x, maxX));
    this.cam.y = Math.max(0, Math.min(this.cam.y, maxY));
  },

  _updateCamera() {
    if (!this.player) return;
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    this.cam.tx = px - this.W / 2;
    this.cam.ty = py - this.H / 2;
    this.cam.x += (this.cam.tx - this.cam.x) * 0.1;
    this.cam.y += (this.cam.ty - this.cam.y) * 0.08;
    this._clampCam();
  },

  _handleMouseClick(mx, my) {
    // HUD RESTART & EXIT BUTTONS
    if (this.state === GS.PLAYING || this.state === GS.PAUSED) {
      if (my >= 8 && my <= 40) {
        if (mx >= this.W - 230 && mx <= this.W - 130) {
          this.restartLevel();
          return;
        } else if (mx >= this.W - 115 && mx <= this.W - 15) {
          this.exitToDashboard();
          return;
        }
      }
    }

    if (this.state === GS.DASHBOARD) {
      if (mx >= 40 && mx <= 290 && my >= 80 && my <= 540) {
        this.profile.avatarIdx = (this.profile.avatarIdx + 1) % AVATARS.length;
        this.profile.avatar = AVATARS[this.profile.avatarIdx];
        this.profile.name   = NAMES[this.profile.avatarIdx];
        AudioManager.menuBeep();
        this._saveProfile();
      }

      for (let i = 0; i < 10; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const bx = 345 + col * 110;
        const by = 150 + row * 140;
        if (mx >= bx && mx <= bx + 95 && my >= by && my <= by + 115) {
          if (this.levelUnlocks[i]) {
            this.selectedLevel = i;
            AudioManager.select();
            this.lives = 3;
            this.startWelcome(i);
          } else {
            AudioManager.puzzleFail();
          }
        }
      }
    } else if (this.state === GS.WELCOME) {
      // Button rectangles come straight from the renderer that drew them,
      // so what's on screen and what's clickable can never drift apart.
      const btns = Renderer.welcomeButtons(this.W, this.H);
      const hit = (b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;

      if (hit(btns.start)) {
        this.launchLevel();
      } else if (hit(btns.dash)) {
        this.exitToDashboard();
      } else if (hit(btns.theme)) {
        GameThemes.cycle();
      }

    } else if (this.state === GS.LEVEL_COMPLETE || this.state === GS.GAME_OVER || this.state === GS.WIN) {
      if (this.state === GS.WIN) {
        this.exitToDashboard();
      } else {
        this.keys['Enter'] = true;
        setTimeout(() => { this.keys['Enter'] = false; }, 100);
      }
    }
  },

  update() {
    const keys = this.keys;
    this.tick++;

    this.particles.forEach(p => p.update());
    this.particles = this.particles.filter(p => p.life > 0);
    // Hard ceiling: several deaths in quick succession used to stack
    // hundreds of live particles and visibly stall phones.
    if (this.particles.length > Perf.maxParticles) {
      this.particles.splice(0, this.particles.length - Perf.maxParticles);
    }

    // Drives the welcome screen's typewriter greeting.
    if (this.state === GS.WELCOME && this.welcomeState) this.welcomeState.frames++;

    switch (this.state) {

      case GS.DASHBOARD:
        if (this.justPressed('Enter') || this.justPressed('Space')) {
          AudioManager.select();
          this.lives = 3;
          this.startWelcome(this.selectedLevel);
        }
        break;

      case GS.WELCOME:
        if (this.justPressed('Enter') || this.justPressed('Space')) {
          this.launchLevel();
        } else if (this.justPressed('Escape')) {
          this.exitToDashboard();
        }
        break;

      case GS.PLAYING:
        this.timer++;
        if (this.themeToast > 0) this.themeToast--;

        if (this.justPressed('KeyP') || this.justPressed('Escape')) {
          this.state = GS.PAUSED;
          break;
        }

        for (const e of this.entities) {
          if (e.type === 'platform') e.update();
          if (e.type === 'turret')   e.update(this.entities);
          if (e.type === 'crusher')  e.update();
          if (e.type === 'boss')     e.update(this.entities);
          if (e.type === 'bullet')   e.update();
        }

        this.player.update(this.map, this.mapW, this.mapH, this.entities, keys);

        for (const e of this.entities) {
          if (e.type === 'bullet' && e.active) {
            if (rectsOverlap(this.player.bounds, e.bounds)) {
              e.active = false;
              this.player._hurt();
            }
            // Deactivate bullets once they leave the level so they get cleaned up below.
            if (e.x < -50 || e.x > this.mapW * 32 + 50 || e.y < -50 || e.y > this.mapH * 32 + 50) {
              e.active = false;
            }
          }
          if (e.type === 'crusher') {
            if (rectsOverlap(this.player.bounds, e.bounds)) {
              this.player._die(this.entities);
            }
          }
        }

        // Remove spent bullets so the entity list doesn't grow forever
        // (turrets fire continuously, so without this the game slows to a
        // crawl and eventually stalls the longer a level with turrets runs).
        this.entities = this.entities.filter(e => e.type !== 'bullet' || e.active);

        for (const e of this.entities) {
          if (e.type === 'door') e.update();
        }

        for (const e of this.entities) {
          if (e.type === 'coin') {
            e.update();
            if (!e.collected && rectsOverlap(this.player.bounds, e.bounds)) {
              e.collected = true;
              this.coinsCollected++;
              this.profile.totalCoins++;
              AudioManager.coin();
              this._saveProfile();
            }
          }
        }

        for (const e of this.entities) {
          if (e.type === 'switch' && !e.activated) {
            if (rectsOverlap(this.player.bounds, e.bounds)) {
              e.activate(this.entities);
            }
          }
        }

        for (const e of this.entities) {
          if (e.type === 'enemy') {
            e.update(this.map, this.mapW, this.mapH);
            if (e.alive && rectsOverlap(this.player.bounds, e.bounds)) {
              const playerBottom = this.player.y + this.player.h;
              if (this.player.vy > 0 && playerBottom <= e.y + 14) {
                e.stomp();
                this.player.vy = -9;
              } else {
                this.player._hurt();
              }
            }
          }
        }

        this.exit.update();
        this.exit.active = this.coinsCollected >= this.minCoins;

        if (this.exit.active && rectsOverlap(this.player.bounds, this.exit.bounds)) {
          this.state = GS.LEVEL_COMPLETE;
          this.profile.stars += 3;
          if (this.levelIndex + 1 < 10) {
            this.levelUnlocks[this.levelIndex + 1] = true;
          }
          this._saveProfile();
          AudioManager.levelComplete();
        }

        this._updateCamera();
        break;

      case GS.PAUSED:
        if (this.justPressed('KeyP') || this.justPressed('Escape')) {
          this.state = GS.PLAYING;
        }
        break;

      case GS.LEVEL_COMPLETE:
        if (this.justPressed('Enter') || this.justPressed('Space')) {
          AudioManager.select();
          const next = this.levelIndex + 1;
          if (next >= LEVELS.length) {
            this.state = GS.WIN;
            AudioManager.win();
          } else {
            this.startWelcome(next);
          }
        }
        break;

      case GS.GAME_OVER:
        if (this.justPressed('Enter') || this.justPressed('Space')) {
          AudioManager.select();
          this.lives = 3;
          this.startWelcome(this.levelIndex);
        }
        break;

      case GS.WIN:
        if (this.justPressed('Enter') || this.justPressed('Space')) {
          AudioManager.select();
          this.state = GS.DASHBOARD;
        }
        break;
    }

    this.prevKeys = Object.assign({}, this.keys);
  },

  render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const ld = this.levelData;

    ctx.clearRect(0, 0, W, H);

    switch (this.state) {

      case GS.DASHBOARD:
        Renderer.drawDashboard(ctx, W, H, this.tick, this.profile, this.levelUnlocks, this.selectedLevel);
        break;

      case GS.WELCOME: {
        // The level's own animated theme plays live behind the briefing,
        // slowly panning, so the welcome screen previews the biome.
        const drift = this.tick * 0.35;
        GameThemes.draw(ctx, W, H, drift, 0, this.tick, ld, this.levelIndex);
        Renderer.drawWelcome(ctx, W, H, this.welcomeState, this.tick, ld,
                             this.profile, this.lives);
        break;
      }

      case GS.PLAYING:
      case GS.PAUSED:
      case GS.LEVEL_COMPLETE: {
        const camX = Math.round(this.cam.x);
        const camY = Math.round(this.cam.y);

        GameThemes.draw(ctx, W, H, camX, camY, this.tick, ld, this.levelIndex);
        Renderer.drawMap(ctx, this.map, this.mapH, this.mapW, camX, camY, W, H, this.tick);

        for (const e of this.entities) {
          if (e.type === 'platform') Renderer.drawPlatform(ctx, e, camX, camY, this.tick);
          if (e.type === 'turret')   Renderer.drawTurret(ctx, e, camX, camY);
          if (e.type === 'bullet')   Renderer.drawBullet(ctx, e, camX, camY);
          if (e.type === 'crusher')  Renderer.drawCrusher(ctx, e, camX, camY);
          if (e.type === 'boss')     Renderer.drawBoss(ctx, e, camX, camY, this.tick);
        }

        for (const e of this.entities) {
          if (e.type === 'coin') Renderer.drawCoin(ctx, e, camX, camY, this.tick);
        }

        for (const e of this.entities) {
          if (e.type === 'switch') Renderer.drawSwitch(ctx, e, camX, camY, this.tick);
        }

        for (const e of this.entities) {
          if (e.type === 'door') Renderer.drawDoor(ctx, e, camX, camY, this.tick);
        }

        Renderer.drawExit(ctx, this.exit, camX, camY, this.tick);

        for (const e of this.entities) {
          if (e.type === 'enemy') Renderer.drawEnemy(ctx, e, camX, camY, this.tick);
        }

        Renderer.drawPlayer(ctx, this.player, camX, camY, this.tick, this.profile.avatar);
        Renderer.drawParticles(ctx, this.particles, camX, camY);
        Renderer.drawVignette(ctx, W, H);

        Renderer.drawHUD(ctx, W, H,
          this.lives, this.player.hp, this.coinsCollected, this.minCoins,
          this.levelIndex + 1, ld.name, this.timer, LEVELS.length, this.profile);

        Renderer.drawCoinHint(ctx, W, H, this.coinsCollected, this.minCoins);

        if (this.themeToast > 0 && this.state === GS.PLAYING) {
          Renderer.drawThemeToast(ctx, W, H, this.themeToast,
            GameThemes.labelFor(ld, this.levelIndex), this.levelIndex + 1);
        }

        if (this.state === GS.PAUSED) Renderer.drawPause(ctx, W, H, this.tick);
        if (this.state === GS.LEVEL_COMPLETE) {
          Renderer.drawLevelComplete(ctx, W, H, this.tick,
            this.levelIndex + 1, this.coinsCollected, this.timer,
            this.levelIndex >= LEVELS.length - 1);
        }
        break;
      }

      case GS.GAME_OVER:
        Renderer.drawGameOver(ctx, W, H, this.tick);
        break;

      case GS.WIN:
        Renderer.drawWin(ctx, W, H, this.tick);
        break;
    }
  },

  // ------------------------------------------------------------------
  //  Fixed-timestep loop
  //  Every physics constant in entities.js (gravity, jump velocity,
  //  friction) is written assuming one update = one 60fps frame. The old
  //  loop ran exactly one update per animation frame, which meant the
  //  whole game's *speed* was whatever the display happened to be doing:
  //  sluggish half-speed on a phone rendering at 30fps, and double speed
  //  on a 120Hz screen. Accumulating real elapsed time and stepping a
  //  fixed 1/60s slice keeps the robot moving at a constant, correct
  //  speed no matter what the frame rate does.
  // ------------------------------------------------------------------
  STEP: 1000 / 60,
  _lastTime: 0,
  _acc: 0,

  loop(now) {
    requestAnimationFrame(t => this.loop(t));

    if (now === undefined) now = performance.now();
    if (!this._lastTime) this._lastTime = now;
    let dt = now - this._lastTime;
    this._lastTime = now;

    // Coming back from a backgrounded tab: skip the gap instead of
    // fast-forwarding hundreds of steps at once.
    if (dt > 250) dt = this.STEP;

    Perf.sample(dt);

    this._acc += dt;
    let steps = 0;
    while (this._acc >= this.STEP && steps < 5) {
      this.update();
      this._acc -= this.STEP;
      steps++;
    }
    // If we're so far behind that 5 catch-up steps weren't enough, drop
    // the backlog rather than spiralling into an ever-longer update loop.
    if (steps >= 5) this._acc = 0;

    this.render();
  }
};
