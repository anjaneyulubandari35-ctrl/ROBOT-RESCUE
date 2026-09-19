(function(){
  "use strict";

  // ---------------------------------------------------------------
  // THREE SETUP
  // ---------------------------------------------------------------
  const canvas = document.getElementById('scene');
  if (!canvas) return;
  // Antialiasing is a real cost on mobile GPUs and buys very little on a
  // scene made of soft, low-contrast shapes — so it's desktop-only.
  const lowEnd = (typeof Perf !== 'undefined') && Perf.low;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowEnd,
    powerPreference: lowEnd ? 'low-power' : 'high-performance'
  });
  // Matches the cap used by the main game canvas so the landing scene
  // doesn't look softer than the gameplay that follows it — while still
  // refusing to render at a phone's raw DPR 3.
  renderer.setPixelRatio((typeof Perf !== 'undefined')
    ? Perf.dpr
    : Math.min(window.devicePixelRatio || 1, 2));
  // r128's color-management API (outputEncoding), not the newer
  // outputColorSpace — gives punchier, less washed-out colors.
  if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070912);
  scene.fog = new THREE.FogExp2(0x070912, 0.05);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 6.2);

  function resize(){
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // lighting
  const ambient = new THREE.AmbientLight(0x8899cc, 0.5);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xcfe6ff, 0.9);
  key.position.set(-3, 6, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x8b7cff, 1.4, 14);
  rim.position.set(2.5, 3, -3);
  scene.add(rim);
  const coreLight = new THREE.PointLight(0x4ce0d2, 0, 8);
  coreLight.position.set(0, 1.3, 1);
  scene.add(coreLight);

  // ---------------------------------------------------------------
  // BACKGROUND THEMES — swappable 3D environments (floor / sky / props)
  // ---------------------------------------------------------------
  const THEME_ORDER  = ['cyberlab', 'asteroid', 'neon'];
  const THEME_LABELS = { cyberlab:'CYBER LAB HD', asteroid:'ASTEROID RIFT', neon:'NEON GRID' };
  let themeGroup = new THREE.Group();
  scene.add(themeGroup);
  let themeAnimators = [];
  let currentThemeName = null;

  function makeGridTexture(lineColor, bgColor){
    // 1024px source (up from 512) with a devicePixelRatio-aware supersample
    // so the floor grid stays crisp instead of going soft/blurry once it's
    // stretched across a large phone screen.
    const size = 1024;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgColor || '#0a0d18'; ctx.fillRect(0,0,size,size);
    // soft center vignette so the grid reads as a lit floor, not a flat texture
    const vg = ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size*0.65);
    vg.addColorStop(0, 'rgba(255,255,255,0.05)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vg; ctx.fillRect(0,0,size,size);
    ctx.strokeStyle = lineColor || 'rgba(76,224,210,0.28)'; ctx.lineWidth = 1.5;
    for(let i=0;i<=16;i++){
      const p = i*(size/16);
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(size,p); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    if ('anisotropy' in tex) tex.anisotropy = 8;
    return tex;
  }

  function makeNebulaTexture(hue1, hue2){
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0, hue1);
    g.addColorStop(0.5, hue2);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,256,256);
    return new THREE.CanvasTexture(c);
  }

  function makeRockGeometry(radius, jag){
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const n = 1 + (Math.random()-0.5)*jag;
      pos.setXYZ(i, pos.getX(i)*n, pos.getY(i)*n, pos.getZ(i)*n);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function disposeThemeGroup(obj){
    obj.traverse(node=>{
      if(node.geometry && !node.isSprite) node.geometry.dispose();
      if(node.material){
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(m=>{ if(m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  // Theme 1: the original cyan/violet grid lab
  function buildCyberLab(){
    const group = new THREE.Group();
    const floorMat = new THREE.MeshStandardMaterial({ map: makeGridTexture('rgba(76,224,210,0.35)', '#0a0d18'), roughness:0.55, metalness:0.35 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), floorMat);
    floor.rotation.x = -Math.PI/2; floor.position.y = -1.0;
    group.add(floor);

    const ringMat = new THREE.MeshStandardMaterial({ color:0x4ce0d2, emissive:0x4ce0d2, emissiveIntensity:1.2, metalness:0.6, roughness:0.3 });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.02, 8, 64), ringMat);
    r1.rotation.x = -Math.PI/2; r1.position.y = -0.98;
    group.add(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.015, 8, 64), new THREE.MeshStandardMaterial({ color:0x8b7cff, emissive:0x8b7cff, emissiveIntensity:0.9 }));
    r2.rotation.x = -Math.PI/2; r2.position.y = -0.97;
    group.add(r2);

    themeAnimators.push((delta)=>{ r1.rotation.z += delta*0.15; r2.rotation.z -= delta*0.1; });

    return { group, ambientColor:0x8899cc, ambientIntensity:0.5, bgColor:0x070912, fogColor:0x070912, fogDensity:0.05, particleColor:0x4ce0d2 };
  }

  // Theme 2: shattered asteroid cavern with nebula clouds & floating portals
  function buildAsteroidRift(){
    const group = new THREE.Group();

    const padMat = new THREE.MeshStandardMaterial({ color:0x120a1f, roughness:0.9, metalness:0.1, emissive:0x2a1240, emissiveIntensity:0.25 });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), padMat);
    pad.rotation.x = -Math.PI/2; pad.position.y = -1.0;
    group.add(pad);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.02, 8, 64), new THREE.MeshStandardMaterial({ color:0xff8ad1, emissive:0xff8ad1, emissiveIntensity:1.1 }));
    padRing.rotation.x = -Math.PI/2; padRing.position.y = -0.99;
    group.add(padRing);

    [
      { u:'rgba(255,138,209,0.55)', v:'rgba(139,124,255,0.25)', x:-3.2, y:1.4, z:-6, s:7 },
      { u:'rgba(76,224,210,0.4)',  v:'rgba(76,120,224,0.2)',   x:3.6,  y:0.8, z:-7, s:8 },
      { u:'rgba(139,124,255,0.5)', v:'rgba(255,138,209,0.2)',  x:0.4,  y:2.6, z:-8, s:9 }
    ].forEach(n=>{
      const mat = new THREE.SpriteMaterial({ map: makeNebulaTexture(n.u, n.v), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.8 });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(n.x, n.y, n.z);
      sprite.scale.set(n.s, n.s, 1);
      group.add(sprite);
    });

    const rockMat = new THREE.MeshStandardMaterial({ color:0x6a7590, roughness:0.95, metalness:0.05, emissive:0x1a1030, emissiveIntensity:0.15 });
    const rocks = [];
    [
      { x:-3.4, y:1.6, z:-1.5, r:1.1 }, { x:-4.2, y:-0.6, z:-0.8, r:0.85 },
      { x:3.6,  y:1.9, z:-1.8, r:1.3 }, { x:4.1,  y:-0.4, z:-1.0, r:0.7 },
      { x:-2.2, y:3.0, z:-3.5, r:0.9 }, { x:2.6,  y:3.2, z:-3.8, r:1.0 }
    ].forEach(r=>{
      const rock = new THREE.Mesh(makeRockGeometry(r.r, 0.45), rockMat);
      rock.position.set(r.x, r.y, r.z);
      rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      rock.userData.spin = (Math.random()-0.5)*0.15;
      rock.userData.floatPhase = Math.random()*Math.PI*2;
      rock.userData.baseY = r.y;
      group.add(rock);
      rocks.push(rock);
    });

    const asteroidMat = new THREE.MeshStandardMaterial({ color:0x8a8a9a, roughness:0.9, emissive:0x220e33, emissiveIntensity:0.2 });
    const asteroids = [];
    for(let i=0;i<5;i++){
      const a = new THREE.Mesh(makeRockGeometry(0.18 + Math.random()*0.16, 0.5), asteroidMat);
      a.position.set((Math.random()-0.5)*6, 0.5 + Math.random()*2.5, -2 - Math.random()*4);
      a.userData.spin = (Math.random()-0.5)*0.3;
      a.userData.floatPhase = Math.random()*Math.PI*2;
      a.userData.baseY = a.position.y;
      group.add(a);
      asteroids.push(a);
    }

    const portals = [];
    [
      { x:-1.8, y:2.3, z:-2.6, w:0.5, h:0.9, color:0x4ce0d2 },
      { x:2.1,  y:1.7, z:-2.2, w:0.4, h:0.7, color:0xff8ad1 }
    ].forEach(p=>{
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, p.h, 0.04)), new THREE.LineBasicMaterial({ color:p.color }));
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(p.w*0.85, p.h*0.85), new THREE.MeshBasicMaterial({ color:p.color, transparent:true, opacity:0.18, side:THREE.DoubleSide }));
      frame.add(glass);
      frame.position.set(p.x, p.y, p.z);
      frame.userData.floatPhase = Math.random()*Math.PI*2;
      frame.userData.baseY = p.y;
      group.add(frame);
      portals.push(frame);
    });

    const rimGlow = new THREE.PointLight(0xff8ad1, 1.1, 12);
    rimGlow.position.set(-2.5, 1.5, 1.5);
    group.add(rimGlow);

    themeAnimators.push((delta, t)=>{
      rocks.forEach(r=>{ r.rotation.x += r.userData.spin*delta; r.rotation.y += r.userData.spin*0.7*delta; r.position.y = r.userData.baseY + Math.sin(t*0.5 + r.userData.floatPhase)*0.12; });
      asteroids.forEach(a=>{ a.rotation.x += a.userData.spin*delta; a.rotation.y += a.userData.spin*delta; a.position.y = a.userData.baseY + Math.sin(t*0.6 + a.userData.floatPhase)*0.25; });
      portals.forEach(p=>{ p.rotation.y += delta*0.25; p.position.y = p.userData.baseY + Math.sin(t*0.8 + p.userData.floatPhase)*0.15; });
      padRing.rotation.z += delta*0.2;
    });

    return { group, ambientColor:0x6a5fb0, ambientIntensity:0.35, bgColor:0x0d0620, fogColor:0x140a26, fogDensity:0.045, particleColor:0xff8ad1 };
  }

  // Theme 3: magenta/cyan neon grid with a distant skyline
  function buildNeonGrid(){
    const group = new THREE.Group();
    const floorMat = new THREE.MeshStandardMaterial({ map: makeGridTexture('rgba(255,90,200,0.35)', '#0a0616'), roughness:0.8, metalness:0.2 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), floorMat);
    floor.rotation.x = -Math.PI/2; floor.position.y = -1.0;
    group.add(floor);

    const ringMat = new THREE.MeshStandardMaterial({ color:0xff2fd0, emissive:0xff2fd0, emissiveIntensity:1.2, metalness:0.6, roughness:0.3 });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.02, 8, 64), ringMat);
    r1.rotation.x = -Math.PI/2; r1.position.y = -0.98;
    group.add(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.015, 8, 64), new THREE.MeshStandardMaterial({ color:0x3fd0ff, emissive:0x3fd0ff, emissiveIntensity:0.9 }));
    r2.rotation.x = -Math.PI/2; r2.position.y = -0.97;
    group.add(r2);

    const skyC = document.createElement('canvas'); skyC.width = 512; skyC.height = 160;
    const sctx = skyC.getContext('2d');
    for(let i=0;i<22;i++){
      const bw = 14 + Math.random()*22, bh = 40 + Math.random()*110, bx = i*(512/22);
      sctx.fillStyle = i%3===0 ? 'rgba(255,47,208,0.5)' : 'rgba(63,208,255,0.4)';
      sctx.fillRect(bx, 160-bh, bw, bh);
    }
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(skyC), transparent:true, depthWrite:false }));
    sky.position.set(0, 0.6, -7);
    group.add(sky);

    themeAnimators.push((delta)=>{ r1.rotation.z += delta*0.15; r2.rotation.z -= delta*0.1; });

    return { group, ambientColor:0x7a4bcc, ambientIntensity:0.45, bgColor:0x0a0616, fogColor:0x0a0616, fogDensity:0.055, particleColor:0xff2fd0 };
  }

  const THEME_BUILDERS = { cyberlab:buildCyberLab, asteroid:buildAsteroidRift, neon:buildNeonGrid };

  function applyTheme(name){
    if(!THEME_BUILDERS[name]) name = THEME_ORDER[0];
    scene.remove(themeGroup);
    disposeThemeGroup(themeGroup);
    themeAnimators = [];

    const cfg = THEME_BUILDERS[name]();
    themeGroup = cfg.group;
    scene.add(themeGroup);

    scene.background = new THREE.Color(cfg.bgColor);
    scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    ambient.color.setHex(cfg.ambientColor);
    ambient.intensity = cfg.ambientIntensity;
    if (typeof pMat !== 'undefined') pMat.color.setHex(cfg.particleColor);

    currentThemeName = name;
    try { localStorage.setItem('robot_rescue_theme', name); } catch(e){}
    const label = document.getElementById('themeLabel');
    if(label) label.textContent = THEME_LABELS[name];
  }

  function nextTheme(){
    const idx = THEME_ORDER.indexOf(currentThemeName);
    applyTheme(THEME_ORDER[(idx+1) % THEME_ORDER.length]);
    if (typeof AudioManager !== 'undefined') AudioManager.menuBeep();
  }

  // ---------------------------------------------------------------
  // ROBOT MODEL
  // ---------------------------------------------------------------
  const robot = new THREE.Group();

  const shell = new THREE.MeshStandardMaterial({ color:0xd7dee8, metalness:0.8, roughness:0.18, emissive:0x0e1620, emissiveIntensity:0.5 });
  const shellDark = new THREE.MeshStandardMaterial({ color:0x2a3244, metalness:0.6, roughness:0.4 });
  const glow = new THREE.MeshStandardMaterial({ color:0x4ce0d2, emissive:0x4ce0d2, emissiveIntensity:0, metalness:0.4, roughness:0.2 });

  // torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.4,0.9,16), shell);
  torso.position.y = 0.55;
  robot.add(torso);
  const chestPlate = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), glow);
  chestPlate.position.set(0, 0.62, 0.42);
  robot.add(chestPlate);

  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,0.16,12), shellDark);
  neck.position.y = 1.08;
  robot.add(neck);

  const head = new THREE.Group();
  const headShell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 20), shell);
  headShell.scale.set(1, 0.92, 0.95);
  head.add(headShell);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.30, 24, 16, 0, Math.PI*2, 0, Math.PI*0.55), glow);
  visor.rotation.x = Math.PI*0.62;
  visor.position.set(0, -0.02, 0.22);
  head.add(visor);
  // two eye dots on visor
  const eyeMat = new THREE.MeshBasicMaterial({ color:0x0a0d18 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), eyeMat); eyeL.position.set(-0.11, -0.03, 0.42); head.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), eyeMat); eyeR.position.set(0.11, -0.03, 0.42); head.add(eyeR);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.3,8), shellDark);
  antenna.position.set(0, 0.5, 0);
  head.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), glow);
  antennaTip.position.set(0, 0.66, 0);
  head.add(antennaTip);
  head.position.y = 1.42;
  robot.add(head);

  // shoulders/arms with hierarchy for waving
  function makeArm(side){
    const g = new THREE.Group();
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), shellDark);
    g.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.08,0.42,12), shell);
    upper.position.y = -0.21;
    g.add(upper);
    const elbowGroup = new THREE.Group();
    elbowGroup.position.y = -0.42;
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.065,0.38,12), shell);
    fore.position.y = -0.19;
    elbowGroup.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), shellDark);
    hand.position.y = -0.40;
    elbowGroup.add(hand);
    g.add(elbowGroup);
    g.userData.elbow = elbowGroup;
    g.position.set(side*0.56, 0.85, 0);
    g.rotation.z = side * 0.12;
    return g;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);
  robot.add(armL, armR);

  function makeLeg(side){
    const g = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.1,0.36,12), shell);
    upper.position.y = -0.18;
    g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.08,0.32,12), shellDark);
    lower.position.y = -0.5;
    g.add(lower);
    g.position.set(side*0.19, 0.12, 0);
    return g;
  }
  robot.add(makeLeg(-1), makeLeg(1));

  const hoverGlow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color:0x4ce0d2, transparent:true, opacity:0.35 }));
  hoverGlow.rotation.x = -Math.PI/2;
  hoverGlow.position.y = -0.55;
  robot.add(hoverGlow);

  const robotLight = new THREE.PointLight(0x4ce0d2, 0, 4);
  robotLight.position.set(0, 1.2, 0.6);
  robot.add(robotLight);

  robot.position.y = 5.5;
  robot.rotation.y = 0.15;
  scene.add(robot);

  // ---------------------------------------------------------------
  // AMBIENT PARTICLES
  // ---------------------------------------------------------------
  const particleCount = 120;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){
    pPos[i*3] = (Math.random()-0.5)*14;
    pPos[i*3+1] = Math.random()*6 - 1;
    pPos[i*3+2] = (Math.random()-0.5)*14;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color:0x4ce0d2, size:0.03, transparent:true, opacity:0.55 });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Apply the saved theme (or the default) now that everything the
  // theme builders touch — ambient light, particle material — exists.
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('robot_rescue_theme'); } catch(e){}
  applyTheme(THEME_BUILDERS[savedTheme] ? savedTheme : THEME_ORDER[0]);

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    // stopPropagation so tapping the chip doesn't also trigger the
    // full-screen pointerdown handler that launches the game.
    themeBtn.addEventListener('pointerdown', (e)=> e.stopPropagation());
    themeBtn.addEventListener('click', (e)=> { e.stopPropagation(); nextTheme(); });
  }

  // ---------------------------------------------------------------
  // MISSION START BUTTONS — PLAY / LEVEL SELECT / SETTINGS
  // Same stopPropagation pattern as themeBtn above: these sit on top
  // of the whole-screen "tap anywhere to launch" handler, so taps on
  // them must not also fall through and trigger/duplicate it.
  // ---------------------------------------------------------------
  const startButtons  = document.getElementById('startButtons');
  const btnPlay        = document.getElementById('btnPlay');
  const btnLevelSelect = document.getElementById('btnLevelSelect');
  const btnSettings    = document.getElementById('btnSettings');
  const settingsPanel  = document.getElementById('settingsPanel');
  const btnMute        = document.getElementById('btnMute');
  const muteState      = document.getElementById('muteState');
  const btnCloseSettings = document.getElementById('btnCloseSettings');

  if (startButtons) startButtons.addEventListener('pointerdown', (e)=> e.stopPropagation());
  if (settingsPanel) settingsPanel.addEventListener('pointerdown', (e)=> e.stopPropagation());

  if (btnPlay) btnPlay.addEventListener('click', (e)=> { e.stopPropagation(); launchGame(); });
  // Level Select drops straight into the same game boot sequence — the
  // dashboard it lands on already IS the level-select screen.
  if (btnLevelSelect) btnLevelSelect.addEventListener('click', (e)=> { e.stopPropagation(); launchGame(); });

  if (btnSettings) btnSettings.addEventListener('click', (e)=> {
    e.stopPropagation();
    if (typeof AudioManager !== 'undefined') {
      AudioManager.unlock();
      if (muteState) muteState.textContent = AudioManager.muted ? 'OFF' : 'ON';
    }
    if (settingsPanel) settingsPanel.classList.toggle('show');
  });
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', (e)=> {
    e.stopPropagation();
    if (settingsPanel) settingsPanel.classList.remove('show');
  });
  if (btnMute) btnMute.addEventListener('click', (e)=> {
    e.stopPropagation();
    if (typeof AudioManager === 'undefined' || !AudioManager.toggleMute) return;
    const muted = AudioManager.toggleMute();
    if (muteState) muteState.textContent = muted ? 'OFF' : 'ON';
    if (!muted) AudioManager.menuBeep();
  });

  // ---------------------------------------------------------------
  // ANIMATION TIMELINE
  // ---------------------------------------------------------------
  const clock = new THREE.Clock();
  let t = 0;
  let phase = 'descend';
  let waveT = 0;
  let waving = false;
  let blinkT = 2 + Math.random()*3;
  let camAngle = 0;
  let launched = false;

  function setChip(id, delay){
    setTimeout(()=> {
      const el = document.getElementById(id);
      if (el) el.classList.add('show','on');
    }, delay);
  }
  setTimeout(()=> { const e = document.getElementById('chipPower'); if (e) e.classList.add('show'); }, 200);
  setTimeout(()=> { const e = document.getElementById('chipCore'); if (e) e.classList.add('show'); }, 200);
  setTimeout(()=> { const e = document.getElementById('chipLink'); if (e) e.classList.add('show'); }, 200);
  setChip('chipPower', 900);
  setChip('chipCore', 1500);
  setChip('chipLink', 2100);

  setTimeout(()=>{
    const e = document.getElementById('eyebrow');
    if (e) e.classList.add('show');
  }, 700);

  function triggerWave(){
    if(waving) return;
    waving = true; waveT = 0;
  }

  function revealText(){
    const title = document.getElementById('title');
    const rule = document.getElementById('rule');
    const sub = document.getElementById('subtitle');
    const hint = document.getElementById('hint');
    const buttons = document.getElementById('startButtons');
    if (title) title.classList.add('show','glitch');
    if (rule) rule.classList.add('show');
    setTimeout(()=> { if (sub) sub.classList.add('show'); }, 300);
    setTimeout(()=> { if (buttons) buttons.classList.add('show'); }, 600);
    setTimeout(()=> { if (hint) hint.classList.add('show'); }, 1000);
  }

  function launchGame() {
    if (launched) return;
    launched = true;
    if (typeof AudioManager !== 'undefined') AudioManager.select();

    // Smooth warp transition into game container
    const welcomeUI = document.getElementById('welcomeScreen');
    const loadingScreen = document.getElementById('loadingScreen');
    const gameContainer = document.getElementById('gameContainer');
    if (welcomeUI) welcomeUI.style.opacity = '0';
    if (welcomeUI) welcomeUI.style.transition = 'opacity 0.6s ease';

    setTimeout(() => {
      if (welcomeUI) welcomeUI.style.display = 'none';
      if (loadingScreen) {
        loadingScreen.classList.add('show');
        const fill = document.getElementById('loaderFill');
        if (fill) {
          // Kick the fill transition on the next frame so it actually animates
          requestAnimationFrame(() => {
            fill.style.transition = 'width 1.15s cubic-bezier(0.4,0,0.2,1)';
            fill.style.width = '100%';
          });
        }
      }

      setTimeout(() => {
        if (loadingScreen) loadingScreen.classList.remove('show');
        if (gameContainer) gameContainer.style.display = 'flex';
        // Kill the 3D welcome scene before the 2D game starts, so the
        // game never has to share the GPU with a hidden WebGL canvas.
        if (window.__stopWelcomeScene) window.__stopWelcomeScene();
        if (typeof Game !== 'undefined') Game.init();
      }, 1300);
    }, 600);
  }

  window.addEventListener('pointerdown', (e)=>{
    triggerWave();
    launchGame();
  });

  function update(delta){
    t += delta;

    camAngle += delta * 0.09;
    const radius = 6.2;
    camera.position.x = Math.sin(camAngle) * radius * 0.35;
    camera.position.z = 6.2 - (1-Math.cos(camAngle))*0.4;
    camera.position.y = 1.6 + Math.sin(camAngle*0.6)*0.08;
    camera.lookAt(0, 0.9, 0);

    particles.rotation.y += delta * 0.01;
    for (let i = 0; i < themeAnimators.length; i++) themeAnimators[i](delta, t);

    if(phase === 'descend'){
      robot.position.y += (0.35 - robot.position.y) * Math.min(1, delta*1.8);
      if(robot.position.y < 0.42){
        robot.position.y = 0.35;
        phase = 'land';
        t = 0;
      }
    } else if(phase === 'land'){
      // A single, gentle settle instead of the old multi-oscillation squash
      // (which read as a jittery wobble, especially on small phone
      // screens) — one clean compress-and-recover with a fast decay.
      const s = 1 - Math.sin(Math.min(1, t*3.2)) * 0.035 * Math.exp(-t*5);
      const inv = 1 + (1 - s) * 0.5;
      robot.scale.set(inv, s, inv);
      if(t > 0.35){
        robot.scale.set(1,1,1);
        phase = 'boot';
        t = 0;
      }
    } else if(phase === 'boot'){
      const p = Math.min(1, t/1.1);
      glow.emissiveIntensity = p * 1.4;
      coreLight.intensity = p * 1.6;
      robotLight.intensity = p * 1.2;
      hoverGlow.material.opacity = p*0.35;
      if(t > 1.2){
        phase = 'greet';
        t = 0;
        revealText();
        triggerWave();
      }
    } else if(phase === 'greet' || phase === 'idle'){
      if(t > 1.5 && phase === 'greet'){ phase = 'idle'; }
    }

    if(phase !== 'descend' && phase !== 'land'){
      robot.position.y = 0.35 + Math.sin(t*1.6)*0.045;
      head.rotation.y = Math.sin(t*0.7)*0.12;
      head.rotation.z = Math.sin(t*0.5)*0.03;
      hoverGlow.scale.setScalar(1 + Math.sin(t*1.6)*0.06);

      blinkT -= delta;
      if(blinkT < 0.12 && blinkT > 0){
        glow.emissiveIntensity = 1.4 * (1 - (0.12-Math.max(0,blinkT))/0.12) * 0.3 + 1.0;
      }
      if(blinkT <= 0){ blinkT = 2.5 + Math.random()*3.5; }
    }

    if(waving){
      waveT += delta;
      const dur = 1.6;
      const p = Math.min(1, waveT/dur);
      const swing = Math.sin(p*Math.PI*3) * (1-p) * 0.9;
      armR.rotation.z = -0.9 + swing;
      armR.rotation.x = -0.3;
      armR.userData.elbow.rotation.x = -0.4 + Math.sin(p*Math.PI*3)*0.3;
      armL.rotation.z = 0.12 + Math.sin(t*1.6)*0.03;
      if(p >= 1){ waving = false; armR.rotation.z = 0.12; armR.rotation.x = 0; armR.userData.elbow.rotation.x = 0; }
    } else if(phase !== 'descend' && phase !== 'land'){
      armL.rotation.z = -0.12 + Math.sin(t*1.6)*0.03;
      armR.rotation.z = 0.12 + Math.sin(t*1.6 + 1)*0.03;
    }

    if(phase === 'idle' && !waving && Math.floor(t) % 7 === 0 && (t - Math.floor(t)) < delta){
      triggerWave();
    }
  }

  // ---------------------------------------------------------------
  // The welcome screen is a full 3D WebGL scene. It used to keep
  // rendering every single frame forever — including the entire time
  // the player was actually in the 2D game, hidden behind it. On a
  // phone that meant two renderers fighting for the same GPU, which is
  // why gameplay felt heavy and hot. Now the scene shuts down for good
  // once the game launches, and idles while the tab is hidden.
  // ---------------------------------------------------------------
  let sceneRunning = true;
  let scenePaused = false;

  function stopScene(){
    if (!sceneRunning) return;
    sceneRunning = false;
    try {
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    } catch(e) {}
  }
  window.__stopWelcomeScene = stopScene;

  document.addEventListener('visibilitychange', () => {
    scenePaused = document.hidden;
    if (!scenePaused) clock.getDelta(); // swallow the gap so nothing jumps
  });

  function animate(){
    if (!sceneRunning) return;
    requestAnimationFrame(animate);
    if (scenePaused) return;
    const delta = Math.min(0.05, clock.getDelta());
    update(delta);
    renderer.render(scene, camera);
  }

  resize();
  animate();
})();
