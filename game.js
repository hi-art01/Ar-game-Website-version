// NEON HUNT AR Engine v2.0 - 60FPS AR Smooth Tracking & WebGL/Canvas Particle System
const $ = (id) => document.getElementById(id);

// UI Element Cache
const ui = {
  app: $('appShell'),
  camera: $('camera'),
  fallback: $('fallback'),
  arena: $('arena'),
  projectiles: $('projectileLayer'),
  start: $('startScreen'),
  end: $('endCard'),
  turn: $('turnCard'),
  combat: $('combatHud'),
  bottom: $('bottomHud'),
  attacks: $('attackBar'),
  fire: $('fireButton'),
  dodge: $('dodgeButton'),
  playerHp: $('playerHealth'),
  enemyHp: $('enemyHealth'),
  playerNum: $('playerHealthNumber'),
  enemyNum: $('enemyHealthNumber'),
  timer: $('timer'),
  charge: $('chargeBar'),
  chargeVal: $('chargeVal'),
  toast: $('toast'),
  flash: $('damageFlash'),
  mode: $('modeLabel'),
  crosshair: $('crosshair'),
  radar: $('radarContainer'),
  radarBlip: $('radarBlip'),
  offscreen: $('offscreenIndicator'),
  offscreenDist: $('offscreenDistance'),
  canvas: $('particleCanvas'),
  soundBtn: $('soundButton'),
  recenterBtn: $('recenterButton'),
  blasterContainer: $('blasterContainer'),
  blasterWeapon: $('blasterWeapon'),
  muzzleFlash: $('muzzleFlash'),
  gunBarrel: $('gunBarrel'),
  gunCore: $('gunCore'),
  gunRailLeft: $('gunRailLeft'),
  gunRailRight: $('gunRailRight'),
  comboBadge: $('comboBadge'),
  comboVal: $('comboVal'),
  scoreLabel: $('scoreLabel')
};

// Enemy Bestiary Config
const ENEMY_TYPES = [
  { id: 'drone', name: 'CYBER DRONE', hp: 100, damage: 7, className: 'enemy-drone', speed: 1.2 },
  { id: 'wraith', name: 'NEON WRAITH', hp: 130, damage: 11, className: 'enemy-wraith', speed: 1.8 },
  { id: 'brute', name: 'PLASMA BRUTE', hp: 180, damage: 16, className: 'enemy-brute', speed: 0.8 },
  { id: 'splitter', name: 'VOID SPLITTER', hp: 90, damage: 6, className: 'enemy-splitter', speed: 2.2 },
  { id: 'titan', name: 'TITAN BEHEMOTH', hp: 300, damage: 22, className: 'enemy-titan', speed: 0.6 }
];

// Attack Spell Config
const ATTACKS = {
  pulse: { name: 'PULSE', cost: 12, damage: 18, color: '#55f6ff' },
  nova: { name: 'NOVA', cost: 30, damage: 45, color: '#ffb33e' },
  freeze: { name: 'FREEZE', cost: 22, damage: 28, color: '#8eeaff' },
  beam: { name: 'BEAM', cost: 38, damage: 70, color: '#bc75ff' },
  meteor: { name: 'METEOR', cost: 50, damage: 110, color: '#ff3e9d' }
};

const WAVE_POOLS = [
  ['drone', 'drone', 'wraith'],
  ['wraith', 'splitter', 'drone'],
  ['brute', 'wraith', 'splitter'],
  ['splitter', 'titan', 'wraith'],
  ['titan', 'brute', 'titan']
];

// Core Game & AR Sensor State
let state = {
  mode: 'ai',
  active: false,
  wave: 1,
  waveKills: 0,
  waveGoal: 3,
  score: 0,
  combo: 0,
  lastHitTime: 0,
  player: 100,
  enemy: 100,
  enemyType: ENEMY_TYPES[0],
  selectedAttack: 'pulse',
  frozen: false,
  dodgeUntil: 0,
  
  // AR Sensor Motion tracking (Raw & LERP Smoothed)
  rawHeading: 0,
  rawPitch: 0,
  smoothHeading: 0,
  smoothPitch: 0,
  headingOffset: 0, // Recenter offset for heading
  pitchOffset: 0,   // Recenter offset for pitch
  isDragActive: false,
  dragStart: { x: 0, y: 0, heading: 0, pitch: 0 },
  
  // Spherical 3D Target Anchor in space
  anchor: { yaw: 0, pitch: 0, depth: 3.8 },
  isLocked: false,

  time: 60,
  shots: 0,
  hits: 0,
  charge: 100,
  timerId: null,
  enemyAttackId: null,
  turn: 1,
  pvpScores: [0, 0],
  stream: null,
  cameraRequested: false,
  sound: true
};

// ==========================================================================
// AUDIO SYNTHESIZER ENGINE (Web Audio API)
// ==========================================================================
class SoundSynth {
  constructor() { this.ctx = null; }
  init() { if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } }

  play(type) {
    if (!state.sound) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'pulse') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
    } else if (type === 'nova') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'freeze') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'dodge') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.18);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now); osc.stop(now + 0.18);
    } else if (type === 'lock') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'enemy_down') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
  }
}
const audio = new SoundSynth();

// ==========================================================================
// CANVAS PARTICLE SYSTEM (Sparks, Beams, Explosions & Floating Text)
// ==========================================================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.floatingTexts = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  spawnExplosion(x, y, color = '#55f6ff', count = 28) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.03
      });
    }
  }

  spawnText(x, y, text, color = '#ffffff') {
    this.floatingTexts.push({
      x, y,
      text,
      color,
      alpha: 1,
      vy: -1.8
    });
  }

  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Update Floating Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy;
      t.alpha -= 0.025;

      if (t.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = t.alpha;
      this.ctx.font = 'bold 18px "Space Mono", monospace';
      this.ctx.fillStyle = t.color;
      this.ctx.shadowColor = t.color;
      this.ctx.shadowBlur = 8;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(t.text, t.x, t.y);
      this.ctx.restore();
    }
  }
}
const fx = new ParticleSystem(ui.canvas);

// ==========================================================================
// EVENT LISTENERS & MODE CONTROLS
// ==========================================================================
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelector('.mode-card.selected')?.classList.remove('selected');
    card.classList.add('selected');
    state.mode = card.dataset.mode;
  });
});

$('launchButton').addEventListener('click', start);
$('restartButton').addEventListener('click', start);
$('turnButton').addEventListener('click', beginTurn);
ui.fire.addEventListener('click', fire);
ui.dodge.addEventListener('click', dodge);

// Recenter Button
ui.recenterBtn.addEventListener('click', () => {
  recenterArena();
});

// Sound Toggle
ui.soundBtn.addEventListener('click', () => {
  state.sound = !state.sound;
  ui.soundBtn.textContent = state.sound ? '🔊' : '🔇';
});

// Attack Selection
document.querySelectorAll('.attack').forEach(button => {
  button.addEventListener('click', () => {
    if (!state.active) return;
    document.querySelector('.attack.selected')?.classList.remove('selected');
    button.classList.add('selected');
    state.selectedAttack = button.dataset.attack;
    showToast(ATTACKS[state.selectedAttack].name + ' SYSTEM ARMED', ATTACKS[state.selectedAttack].color);
    audio.play('lock');
    updateBlasterVisibility();
  });
});

function updateBlasterVisibility() {
  const current = state.selectedAttack;
  if (current === 'pulse' || current === 'beam') {
    ui.blasterContainer.hidden = false;
    ui.blasterContainer.style.display = 'flex';

    // Clear old classes
    ui.blasterWeapon.className = 'blaster-weapon';
    ui.blasterWeapon.classList.add(`weapon-${current}`);
  } else {
    ui.blasterContainer.hidden = true;
    ui.blasterContainer.style.display = 'none';
  }
}

// Touch / Mouse Drag Aiming Fallback (For simulation & desktop)
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, .attack-bar, .top-hud, .bottom-hud')) return;
  state.isDragActive = true;
  state.dragStart = { x: e.clientX, y: e.clientY, heading: state.rawHeading, pitch: state.rawPitch };
});

window.addEventListener('pointermove', (e) => {
  if (!state.isDragActive) return;
  const dx = e.clientX - state.dragStart.x;
  const dy = e.clientY - state.dragStart.y;
  state.rawHeading = (state.dragStart.heading - dx * 0.15 + 360) % 360;
  state.rawPitch = Math.max(-80, Math.min(80, state.dragStart.pitch + dy * 0.15));
});

window.addEventListener('pointerup', () => state.isDragActive = false);

// Device Motion Gyro Listeners
window.addEventListener('deviceorientationabsolute', updateOrientation, true);
window.addEventListener('deviceorientation', updateOrientation, true);

function updateOrientation(event) {
  if (state.isDragActive) return; // Touch drag overrides gyro if actively dragging
  const heading = event.webkitCompassHeading ?? (event.alpha == null ? state.rawHeading : 360 - event.alpha);
  state.rawHeading = heading || state.rawHeading;
  state.rawPitch = Math.max(-80, Math.min(80, event.beta || 0));
}

function recenterArena() {
  // Sets orientation offsets so current viewport is facing yaw=0, pitch=0
  state.headingOffset = state.rawHeading;
  state.pitchOffset = state.rawPitch;

  // Reposition existing enemy if active
  if (state.active) {
    state.anchor.yaw = state.headingOffset;
    state.anchor.pitch = state.pitchOffset;
  }

  showToast('ARENA RE-CENTERED', '#55f6ff');
  audio.play('lock');
}

// Math Utility Helpers
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
  let diff = (b - a + 540) % 360 - 180;
  return (a + diff * t + 360) % 360;
}

// ==========================================================================
// MAIN 60FPS RENDER & AR SMOOTHING LOOP
// ==========================================================================
function animLoop() {
  // Smooth LERP camera orientation
  state.smoothHeading = lerpAngle(state.smoothHeading, state.rawHeading, 0.18);
  state.smoothPitch = lerp(state.smoothPitch, state.rawPitch, 0.18);

  if (state.active) {
    positionEnemyAndHUD();
  }
  
  fx.update();
  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);

// Position 3D AR Target, Crosshair Lock-on, and 360° Radar
function positionEnemyAndHUD() {
  const enemy = document.querySelector('.enemy');

  // Calculate orientation relative to recentered offset
  const curHeading = (state.smoothHeading - state.headingOffset + 360) % 360;
  const curPitch = state.smoothPitch - state.pitchOffset;

  // Relative yaw and pitch deltas
  const yawDelta = (state.anchor.yaw - state.smoothHeading + 540) % 360 - 180; // -180 to +180
  const pitchDelta = state.anchor.pitch - state.smoothPitch;

  // Update background parallax based on device movement to enhance 3D depth
  const bgFallback = document.querySelector('.camera-fallback');
  if (bgFallback) {
    const bgX = -yawDelta * 0.4;
    const bgY = pitchDelta * 0.4;
    bgFallback.style.transform = `translate(${bgX}px, ${bgY}px) scale(1.1)`;
  }

  if (!enemy) return;

  // Perspective Projection onto camera screen space
  const focal = Math.min(window.innerWidth, window.innerHeight) * 1.1;
  const screenX = window.innerWidth / 2 + Math.tan(yawDelta * Math.PI / 180) * focal;
  const screenY = window.innerHeight / 2 - Math.tan(pitchDelta * Math.PI / 180) * focal;
  const scale = Math.max(0.4, Math.min(1.6, 4.2 / (state.anchor.depth + Math.abs(yawDelta) * 0.03)));

  // Check if inside Field of View
  const isInsideFOV = (screenX >= -60 && screenX <= window.innerWidth + 60 && screenY >= -60 && screenY <= window.innerHeight + 60);

  if (isInsideFOV) {
    enemy.style.display = 'block';
    enemy.style.left = `${screenX - enemy.offsetWidth / 2}px`;
    enemy.style.top = `${screenY - enemy.offsetHeight / 2}px`;
    enemy.style.transform = `scale(${scale}) rotateY(${yawDelta * 0.8}deg)`;

    ui.offscreen.hidden = true;

    // Target Lock-On Check
    const distToCenter = Math.hypot(screenX - window.innerWidth / 2, screenY - window.innerHeight / 2);
    if (distToCenter < 65) {
      if (!state.isLocked) {
        state.isLocked = true;
        ui.crosshair.classList.add('locked');
        audio.play('lock');
        if (navigator.vibrate) navigator.vibrate(15);
      }
    } else {
      if (state.isLocked) {
        state.isLocked = false;
        ui.crosshair.classList.remove('locked');
      }
    }
  } else {
    // Enemy is off-screen -> Show Directional Perimeter Indicator!
    enemy.style.display = 'none';
    ui.crosshair.classList.remove('locked');
    state.isLocked = false;

    ui.offscreen.hidden = false;
    const angleRad = Math.atan2(-pitchDelta, yawDelta);
    const edgeMargin = 40;
    const edgeX = Math.max(edgeMargin, Math.min(window.innerWidth - edgeMargin, window.innerWidth / 2 + Math.cos(angleRad) * (window.innerWidth / 2 - edgeMargin)));
    const edgeY = Math.max(edgeMargin, Math.min(window.innerHeight - edgeMargin, window.innerHeight / 2 - Math.sin(angleRad) * (window.innerHeight / 2 - edgeMargin)));
    
    ui.offscreen.style.left = `${edgeX}px`;
    ui.offscreen.style.top = `${edgeY}px`;
    ui.offscreen.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(-pitchDelta, yawDelta) * 180 / Math.PI - 90}deg)`;
    ui.offscreenDist.textContent = `${Math.round(state.anchor.depth * 3.5)}m`;
  }

  // Update 360° Radar HUD Widget
  const radarRadius = 30; // max radar blip offset px
  const blipX = (yawDelta / 180) * radarRadius;
  const blipY = (-pitchDelta / 90) * radarRadius;
  ui.radarBlip.style.transform = `translate(calc(-50% + ${blipX}px), calc(-50% + ${blipY}px))`;
}

// ==========================================================================
// GAME FLOW & COMBAT CONTROLLER
// ==========================================================================
function start() {
  reset();
  hidePanel(ui.start);
  hidePanel(ui.end);
  hidePanel(ui.turn);
  ui.mode.textContent = state.mode === 'ai' ? 'SOLO // AI' : 'PASS & PLAY';
  
  getCamera();
  requestMotionPermission();

  if (state.mode === 'pvp') {
    showTurnIntro();
  } else {
    beginRound();
  }
}

async function requestMotionPermission() {
  try {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
  } catch {
    showToast('SIMULATION CONTROLS ACTIVE', '#ffcf65');
  }
}

async function getCamera() {
  if (state.stream || state.cameraRequested || !navigator.mediaDevices?.getUserMedia) return;
  state.cameraRequested = true;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    ui.camera.srcObject = state.stream;
    ui.fallback.style.display = 'none';
  } catch {
    ui.fallback.style.display = 'block';
    showToast('SIMULATION ARENA MODE', '#ffcf65');
  }
}

function reset() {
  clearInterval(state.timerId);
  clearInterval(state.enemyAttackId);
  ui.arena.innerHTML = '';
  ui.projectiles.innerHTML = '';
  
  Object.assign(state, {
    active: false,
    wave: 1,
    waveKills: 0,
    waveGoal: 3,
    score: 0,
    combo: 0,
    lastHitTime: 0,
    player: 100,
    enemy: 100,
    enemyType: ENEMY_TYPES[0],
    selectedAttack: 'pulse',
    frozen: false,
    dodgeUntil: 0,
    anchor: { yaw: state.rawHeading, pitch: state.rawPitch, depth: 3.8 },
    time: 60,
    shots: 0,
    hits: 0,
    charge: 100,
    turn: 1,
    pvpScores: [0, 0]
  });

  document.querySelector('.attack.selected')?.classList.remove('selected');
  document.querySelector('[data-attack="pulse"]')?.classList.add('selected');
  updateHud();
}

function showTurnIntro() {
  ui.turn.hidden = false;
  $('turnTitle').innerHTML = `PLAYER ${state.turn}<br />READY?`;
  $('turnText').textContent = state.turn === 1 ? 'Aim at the spatial targets. You have 15 seconds!' : 'Pass device to Player 2. Beat Player 1’s high score!';
}

function beginTurn() {
  hidePanel(ui.turn);
  state.time = state.mode === 'pvp' ? 15 : 60;
  beginRound();
}

function beginRound() {
  state.active = true;
  showPanel(ui.combat, 'grid');
  showPanel(ui.bottom, 'grid');
  showPanel(ui.attacks, 'flex');
  ui.radar.hidden = false;
  updateBlasterVisibility();

  $('playerName').textContent = state.mode === 'pvp' ? `PLAYER ${state.turn}` : 'YOU';
  $('enemyName').textContent = state.mode === 'pvp' ? `TARGET` : state.enemyType.name;

  spawnEnemy();

  state.timerId = setInterval(() => {
    state.time--;
    ui.timer.textContent = state.time;
    if (state.time <= 0) finish(false);
  }, 1000);

  if (state.mode === 'ai') {
    state.enemyAttackId = setInterval(enemyAttackLogic, 1800);
  }
}

function spawnEnemy() {
  const old = document.querySelector('.enemy');
  if (old) old.remove();

  const pool = WAVE_POOLS[Math.min(state.wave - 1, WAVE_POOLS.length - 1)];
  const id = pool[Math.floor(Math.random() * pool.length)];
  state.enemyType = ENEMY_TYPES.find(t => t.id === id) || ENEMY_TYPES[0];
  state.enemy = Math.round(state.enemyType.hp * (1 + (state.wave - 1) * 0.12));
  state.frozen = false;

  // Set 3D Spherical position relative to current camera heading and recenter offsets
  state.anchor = {
    yaw: (state.smoothHeading + (-30 + Math.random() * 60) + 360) % 360,
    pitch: (state.smoothPitch + (-10 + Math.random() * 20)),
    depth: 3.2 + Math.random() * 1.8
  };

  const enemy = document.createElement('button');
  enemy.className = `enemy ${state.enemyType.className}`;
  enemy.setAttribute('aria-label', `${state.enemyType.name} target`);

  // Generate beautiful CSS 3D nested elements based on type
  let modelHtml = '';
  if (state.enemyType.id === 'drone') {
    modelHtml = `
      <div class="model-3d-wrap drone-model">
        <div class="drone-wing"></div>
        <div class="drone-wing back"></div>
        <div class="drone-core"></div>
      </div>
    `;
  } else if (state.enemyType.id === 'wraith') {
    modelHtml = `
      <div class="model-3d-wrap wraith-model">
        <div class="wraith-shard"></div>
        <div class="wraith-shard"></div>
        <div class="wraith-shard"></div>
        <div class="wraith-shard"></div>
        <div class="wraith-core"></div>
      </div>
    `;
  } else if (state.enemyType.id === 'brute') {
    modelHtml = `
      <div class="model-3d-wrap brute-model">
        <div class="brute-shield"></div>
        <div class="brute-core"></div>
      </div>
    `;
  } else if (state.enemyType.id === 'splitter') {
    modelHtml = `
      <div class="model-3d-wrap splitter-model">
        <div class="splitter-prism">
          <div class="splitter-side"></div>
          <div class="splitter-side"></div>
          <div class="splitter-side"></div>
          <div class="splitter-side"></div>
        </div>
      </div>
    `;
  } else if (state.enemyType.id === 'titan') {
    modelHtml = `
      <div class="model-3d-wrap titan-model">
        <div class="titan-ring-inner"></div>
        <div class="titan-ring-outer"></div>
        <div class="titan-orb"></div>
      </div>
    `;
  }

  enemy.innerHTML = `
    ${modelHtml}
    <span class="label">${state.enemyType.name} // W-${String(state.wave).padStart(2, '0')}</span>
  `;
  
  enemy.addEventListener('click', hitEnemy);
  ui.arena.append(enemy);

  showToast(`${state.enemyType.name} INBOUND`, '#ff3e9d');
  audio.play('lock');
}

function hitEnemy(e) {
  e.stopPropagation();
  castAttack(state.selectedAttack, e.currentTarget);
}

function fire() {
  castAttack(state.selectedAttack);
}

function castAttack(id, target = document.querySelector('.enemy')) {
  const attack = ATTACKS[id];
  if (!state.active || !target) return;

  if (state.charge < attack.cost) {
    showToast('CHARGER DEPLETED — WAIT FOR RECHARGE', '#ffcf65');
    audio.play('hit');
    return;
  }

  state.shots++;
  state.charge -= attack.cost;
  updateHud();

  audio.play(id);

  // Handle Weapon Muzzle Flash, Recoil and Beam Vibrations
  const isGun = (id === 'pulse' || id === 'beam');
  if (isGun) {
    ui.muzzleFlash.classList.add('active');
    setTimeout(() => ui.muzzleFlash.classList.remove('active'), 80);

    if (id === 'pulse') {
      ui.blasterWeapon.style.animation = 'none';
      void ui.blasterWeapon.offsetWidth; // trigger reflow
      ui.blasterWeapon.style.animation = 'gunRecoil 0.15s ease-out';
    } else if (id === 'beam') {
      // Beam charges and vibrates intense screen shake
      ui.blasterWeapon.style.animation = 'gunVibrate 0.1s infinite';
      ui.app.classList.add('screen-shake');
      setTimeout(() => {
        ui.blasterWeapon.style.animation = '';
        ui.app.classList.remove('screen-shake');
      }, 500);
    }
  }

  // Launch Projectile & Visual Sparks
  const rect = target.getBoundingClientRect();
  const tx = rect.left + rect.width / 2;
  const ty = rect.top + rect.height / 2;

  launchProjectile(id, tx, ty, () => {
    if (!state.active) return;
    state.hits++;
    
    // Combo calculation (within 2.8s)
    const now = Date.now();
    if (now - state.lastHitTime < 2800) {
      state.combo++;
    } else {
      state.combo = 1;
    }
    state.lastHitTime = now;

    const hitDamage = attack.damage + (state.isLocked ? 10 : 0);
    state.enemy = Math.max(0, state.enemy - hitDamage);
    state.score += hitDamage * 10 * state.combo;

    if (id === 'freeze') {
      state.frozen = true;
      target.classList.add('frozen-effect');
      // Thaw after 3 seconds
      setTimeout(() => {
        target.classList.remove('frozen-effect');
      }, 3000);
    }

    target.classList.add('hit');
    fx.spawnExplosion(tx, ty, attack.color, 24);
    fx.spawnText(tx, ty - 20, `-${hitDamage}${state.combo > 1 ? ` (x${state.combo})` : ''}`, attack.color);
    audio.play('hit');

    if (navigator.vibrate) navigator.vibrate(30);

    setTimeout(() => {
      if (!state.active) return;
      target.classList.remove('hit');

      if (state.enemy <= 0) {
        fx.spawnExplosion(tx, ty, '#ffffff', 45);
        audio.play('enemy_down');
        target.remove();
        showToast('TARGET DESTROYED', '#55f6ff');
        nextEnemy();
      }
    }, 200);
  });
}

function launchProjectile(kind, tx, ty, onImpact) {
  const bolt = document.createElement('div');
  bolt.className = `projectile projectile-${kind}`;
  ui.projectiles.append(bolt);

  if (kind === 'meteor') {
    // Meteors fall from top-left screen corner
    bolt.style.left = '0px';
    bolt.style.top = '0px';
    bolt.style.setProperty('--tx', `${tx}px`);
    bolt.style.setProperty('--ty', `${ty}px`);
  } else {
    bolt.style.setProperty('--tx', `${tx - window.innerWidth / 2}px`);
    bolt.style.setProperty('--ty', `${ty - window.innerHeight / 2}px`);
  }

  requestAnimationFrame(() => bolt.classList.add('travelling'));

  const travelDuration = kind === 'meteor' ? 500 : 380;

  setTimeout(() => {
    bolt.remove();
    onImpact();
  }, travelDuration);
}

function dodge() {
  if (!state.active) return;
  state.dodgeUntil = Date.now() + 900;
  audio.play('dodge');
  showToast('DODGE MATRIX ACTIVE', '#55f6ff');
  ui.app.style.transform = 'scale(0.98)';
  setTimeout(() => ui.app.style.transform = 'none', 200);
}

function enemyAttackLogic() {
  if (!state.active || state.frozen) {
    state.frozen = false;
    return;
  }

  showToast(`${state.enemyType.name} ATTACKING`, '#ff3e9d');

  const enemy = document.querySelector('.enemy');
  const rect = enemy?.getBoundingClientRect();
  const ex = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const ey = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

  launchProjectile('enemy', window.innerWidth / 2, window.innerHeight / 2, () => {
    if (!state.active) return;

    if (Date.now() < state.dodgeUntil) {
      showToast('PERFECT DODGE! +40 CHARGE', '#6cff91');
      state.charge = Math.min(100, state.charge + 40);
      state.score += 250;
      fx.spawnText(window.innerWidth / 2, window.innerHeight / 2, 'PERFECT DODGE!', '#6cff91');
      audio.play('freeze');
      updateHud();
      return;
    }

    // Player takes damage
    state.combo = 0;
    const dmg = state.enemyType.damage + Math.floor(Math.random() * 4);
    state.player = Math.max(0, state.player - dmg);

    ui.flash.classList.add('show');
    setTimeout(() => ui.flash.classList.remove('show'), 120);

    audio.play('hit');
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);

    updateHud();

    if (state.player <= 0) finish(false);
  });
}

function nextEnemy() {
  state.waveKills++;
  if (state.waveKills >= state.waveGoal) {
    state.wave++;
    state.waveKills = 0;
    state.waveGoal = Math.min(8, 3 + state.wave);
    showToast(`WAVE ${String(state.wave).padStart(2, '0')} // ESCALATING`, '#55f6ff');
  }
  setTimeout(spawnEnemy, 300);
}

function updateHud() {
  ui.playerHp.style.width = `${state.player}%`;
  ui.enemyHp.style.width = `${state.enemy}%`;
  ui.playerNum.textContent = state.player;
  ui.enemyNum.textContent = state.enemy;
  ui.timer.textContent = state.time;

  ui.charge.style.width = `${state.charge}%`;
  ui.chargeVal.textContent = `${Math.round(state.charge)}%`;

  $('roundLabel').textContent = `WAVE ${String(state.wave).padStart(2, '0')} // ${state.waveKills}/${state.waveGoal}`;
  ui.scoreLabel.textContent = `${state.score} PTS`;

  if (state.combo > 1) {
    ui.comboBadge.hidden = false;
    ui.comboVal.textContent = `x${state.combo}`;
  } else {
    ui.comboBadge.hidden = true;
  }
}

function finish(won = true) {
  if (!state.active) return;
  state.active = false;
  clearInterval(state.timerId);
  clearInterval(state.enemyAttackId);

  ui.arena.innerHTML = '';
  ui.combat.hidden = true;
  ui.bottom.hidden = true;
  ui.attacks.hidden = true;
  ui.radar.hidden = true;
  ui.offscreen.hidden = true;
  ui.blasterContainer.hidden = true;
  ui.blasterContainer.style.display = 'none';

  if (state.mode === 'pvp') {
    state.pvpScores[state.turn - 1] = state.score;
    if (state.turn === 1) {
      state.turn = 2;
      state.player = 100;
      state.enemy = 100;
      state.time = 15;
      state.score = 0;
      showTurnIntro();
      return;
    }
  }

  ui.end.hidden = false;
  const pvp = state.mode === 'pvp';

  $('resultTag').textContent = pvp ? 'MATCH RESULT' : (state.player > 0 ? 'COMBAT COMPLETE' : 'SYSTEM FAILURE');
  
  if (pvp) {
    const winner = state.pvpScores[0] > state.pvpScores[1] ? 'PLAYER 1' : (state.pvpScores[1] > state.pvpScores[0] ? 'PLAYER 2' : 'DRAW');
    $('resultTitle').innerHTML = winner === 'DRAW' ? 'PERFECT<br />DRAW' : `${winner}<br />VICTORY`;
  } else {
    $('resultTitle').innerHTML = state.player > 0 ? 'TARGET<br />ELIMINATED' : 'YOU WERE<br />ELIMINATED';
  }

  $('stat1Label').textContent = pvp ? 'P1 SCORE' : 'ACCURACY';
  $('stat2Label').textContent = pvp ? 'P2 SCORE' : 'HITS';

  $('accuracy').textContent = pvp ? state.pvpScores[0] : (state.shots ? `${Math.round((state.hits / state.shots) * 100)}%` : '0%');
  $('hits').textContent = pvp ? state.pvpScores[1] : state.hits;
  $('finalScore').textContent = pvp ? Math.max(state.pvpScores[0], state.pvpScores[1]) : state.score;
}

function showToast(message, color = '#55f6ff') {
  ui.toast.textContent = message;
  ui.toast.style.color = color;
  ui.toast.classList.add('show');
  clearTimeout(showToast.id);
  showToast.id = setTimeout(() => ui.toast.classList.remove('show'), 800);
}

function hidePanel(panel) {
  panel.hidden = true;
}

function showPanel(panel, display = 'flex') {
  panel.hidden = false;
  panel.style.display = display;
}

// Charge regeneration loop
setInterval(() => {
  if (state.active && state.charge < 100) {
    state.charge = Math.min(100, state.charge + 4);
    updateHud();
  }
}, 160);
