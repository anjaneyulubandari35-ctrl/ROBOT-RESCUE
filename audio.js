// ============================================================
//  AUDIO MANAGER - Web Audio API procedural chiptune & sfx
// ============================================================
const AudioManager = (() => {
  let actx = null;
  let muted = false;
  try { muted = localStorage.getItem('robot_rescue_muted') === '1'; } catch(e) {}

  function getCtx() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return actx;
  }

  function tone(freq, type, duration, volume, delay) {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = type;
      const t = ctx.currentTime + (delay || 0);
      gain.gain.setValueAtTime(volume || 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration);
    } catch(e) {}
  }

  function noise(duration, volume, delay) {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const bufLen = Math.floor(ctx.sampleRate * duration);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      src.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + (delay || 0);
      gain.gain.setValueAtTime(volume || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.start(t);
      src.stop(t + duration);
    } catch(e) {}
  }

  return {
    unlock() { getCtx(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('robot_rescue_muted', muted ? '1' : '0'); } catch(e) {}
      return muted;
    },
    jump()       { tone(340,'square',0.06,0.18); tone(580,'square',0.1,0.12,0.03); },
    coin()       { tone(988,'sine',0.08,0.3); tone(1318,'sine',0.14,0.3,0.06); },
    health()     { tone(523,'triangle',0.1,0.3); tone(659,'triangle',0.1,0.3,0.08); tone(784,'triangle',0.2,0.4,0.16); },
    hurt()       { noise(0.2,0.5); tone(140,'sawtooth',0.25,0.4,0.04); },
    explode()    { noise(0.4,0.6); tone(100,'sawtooth',0.35,0.5); tone(60,'sawtooth',0.4,0.6,0.08); },
    laser()      { tone(1200,'sawtooth',0.08,0.25); tone(700,'sawtooth',0.1,0.2,0.04); },
    stomp()      { tone(220,'square',0.09,0.5); noise(0.12,0.3,0.04); },
    door()       { tone(240,'square',0.15,0.2); tone(360,'square',0.2,0.15,0.08); tone(480,'square',0.25,0.1,0.16); },
    switchClick(){ tone(650,'square',0.05,0.3); tone(850,'square',0.08,0.2,0.04); },
    pipeRotate() { tone(420,'sine',0.05,0.2); tone(540,'sine',0.05,0.2,0.04); },
    levelComplete(){ [523,659,784,1047,1318].forEach((f,i)=>tone(f,'triangle',0.3,0.4,i*0.1)); },
    win()        { [523,659,784,880,1047,1319,1567,1760].forEach((f,i)=>tone(f,'triangle',0.4,0.4,i*0.09)); },
    gameOver()   { [440,349,293,220,146].forEach((f,i)=>tone(f,'sawtooth',0.3,0.4,i*0.16)); },
    select()     { tone(700,'square',0.08,0.22); },
    menuBeep()   { tone(480,'square',0.06,0.15); },
    puzzleClick(){ tone(560,'sine',0.06,0.2); },
    puzzleSuccess(){ tone(523,'sine',0.1,0.3); tone(659,'sine',0.1,0.3,0.09); tone(784,'sine',0.22,0.4,0.18); },
    puzzleFail() { tone(220,'sawtooth',0.18,0.3); tone(150,'sawtooth',0.28,0.3,0.12); }
  };
})();
