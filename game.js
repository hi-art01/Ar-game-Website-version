const $ = (id) => document.getElementById(id);
const ui = { camera: $('camera'), fallback: $('fallback'), arena: $('arena'), start: $('startScreen'), end: $('endCard'), turn: $('turnCard'), combat: $('combatHud'), bottom: $('bottomHud'), attacks: $('attackBar'), fire: $('fireButton'), playerHp: $('playerHealth'), enemyHp: $('enemyHealth'), playerNum: $('playerHealthNumber'), enemyNum: $('enemyHealthNumber'), timer: $('timer'), charge: $('chargeBar'), toast: $('toast'), flash: $('damageFlash'), mode: $('modeLabel') };
const ENEMY_TYPES = [
  { id: 'drone', name: 'DRONE', hp: 100, damage: 7, className: 'enemy-drone' },
  { id: 'wraith', name: 'WRAITH', hp: 125, damage: 11, className: 'enemy-wraith' },
  { id: 'brute', name: 'BRUTE', hp: 170, damage: 16, className: 'enemy-brute' },
  { id: 'splitter', name: 'SPLITTER', hp: 85, damage: 5, className: 'enemy-splitter' }
];
const ATTACKS = { pulse: { name: 'PULSE', cost: 12, damage: 17 }, nova: { name: 'NOVA', cost: 30, damage: 42 }, freeze: { name: 'FREEZE', cost: 22, damage: 25 } };
let state = { mode: 'ai', active: false, player: 100, enemy: 100, enemyType: ENEMY_TYPES[0], selectedAttack: 'pulse', frozen: false, time: 60, shots: 0, hits: 0, charge: 100, timerId: null, enemyId: null, turn: 1, pvpScores: [0, 0], stream: null, cameraRequested: false, sound: true };

document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => { document.querySelector('.mode-card.selected').classList.remove('selected'); card.classList.add('selected'); state.mode = card.dataset.mode; }));
$('launchButton').addEventListener('click', start);
$('restartButton').addEventListener('click', start);
$('turnButton').addEventListener('click', beginTurn);
ui.fire.addEventListener('click', fire);
document.querySelectorAll('.attack').forEach(button => button.addEventListener('click', () => { if (!state.active) return; document.querySelector('.attack.selected')?.classList.remove('selected'); button.classList.add('selected'); state.selectedAttack = button.dataset.attack; showToast(ATTACKS[state.selectedAttack].name + ' ARMED', '#55f6ff'); }));
ui.arena.addEventListener('click', (e) => { if (state.active && !e.target.closest('.enemy')) fire(); });
$('soundButton').addEventListener('click', () => { state.sound = !state.sound; $('soundButton').textContent = state.sound ? '◖))' : '◖×'; });

function start() {
  // Start gameplay immediately. Camera permissions can take time on mobile and must never block replay.
  reset(); ui.start.hidden = true; ui.end.hidden = true; ui.turn.hidden = true; ui.mode.textContent = state.mode === 'ai' ? 'SOLO // AI' : 'PASS & PLAY';
  getCamera();
  if (state.mode === 'pvp') { showTurnIntro(); } else beginRound();
}
async function getCamera() {
  if (state.stream || state.cameraRequested || !navigator.mediaDevices?.getUserMedia) return;
  state.cameraRequested = true;
  try { state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); ui.camera.srcObject = state.stream; ui.fallback.style.display = 'none'; }
  catch { ui.fallback.style.display = 'block'; showToast('SIMULATION MODE', '#ffcf65'); }
}
function reset() { clearInterval(state.timerId); clearInterval(state.enemyId); ui.arena.innerHTML = ''; Object.assign(state, { active:false, player:100, enemy:100, enemyType:ENEMY_TYPES[0], selectedAttack:'pulse', frozen:false, time:60, shots:0, hits:0, charge:100, turn:1, pvpScores:[0,0] }); document.querySelector('.attack.selected')?.classList.remove('selected'); document.querySelector('[data-attack="pulse"]')?.classList.add('selected'); updateHud(); }
function showTurnIntro() { ui.turn.hidden = false; $('turnTitle').innerHTML = `PLAYER ${state.turn}<br />READY?`; $('turnText').textContent = state.turn === 1 ? 'Aim for the target. You have 10 seconds to score.' : 'Pass the phone. Beat Player 1’s score!'; }
function beginTurn() { ui.turn.hidden = true; state.time = state.mode === 'pvp' ? 10 : 60; beginRound(); }
function beginRound() { state.active = true; ui.combat.hidden = false; ui.bottom.hidden = false; ui.attacks.hidden = false; $('playerName').textContent = state.mode === 'pvp' ? `P${state.turn}` : 'YOU'; $('enemyName').textContent = state.mode === 'pvp' ? `P${state.turn === 1 ? 2 : 1}` : 'SENTINEL'; spawnEnemy(); state.timerId = setInterval(() => { state.time--; ui.timer.textContent = state.time; if (state.time <= 0) finish(); }, 1000); if (state.mode === 'ai') state.enemyId = setInterval(enemyAttack, 1900); }
function spawnEnemy() { const old = document.querySelector('.enemy'); if (old) old.remove(); state.enemyType = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]; state.enemy = state.enemyType.hp; state.frozen = false; const enemy = document.createElement('button'); enemy.className = `enemy ${state.enemyType.className}`; enemy.setAttribute('aria-label', `${state.enemyType.name} target`); enemy.innerHTML = `<span class="label">${state.enemyType.name} // LOCK</span>`; enemy.style.left = `${10 + Math.random() * 72}%`; enemy.style.top = `${20 + Math.random() * 54}%`; enemy.addEventListener('click', hitEnemy); ui.arena.append(enemy); updateHud(); showToast(`${state.enemyType.name} INBOUND`, '#ff7aad'); }
function hitEnemy(e) { e.stopPropagation(); castAttack(state.selectedAttack, e.currentTarget); }
function castAttack(id, target = document.querySelector('.enemy')) { const attack = ATTACKS[id]; if (!state.active || !target) return; if (state.charge < attack.cost) { showToast('NOT ENOUGH CHARGE', '#ffcf65'); return; } state.shots++; state.hits++; state.charge -= attack.cost; state.enemy = Math.max(0, state.enemy - attack.damage); if (id === 'freeze') state.frozen = true; target.classList.add('hit'); ping(id === 'nova' ? 760 : 540, .06); updateHud(); showToast(`${attack.name} HIT // -${attack.damage}`, '#55f6ff'); setTimeout(() => { if (!state.active) return; if (state.enemy <= 0) { target.remove(); showToast('TARGET DOWN — NEW THREAT', '#55f6ff'); setTimeout(spawnEnemy, 260); } else { target.classList.remove('hit'); } }, 210); }
function fire() { castAttack(state.selectedAttack); }
function enemyAttack() { if (!state.active || state.frozen) { state.frozen = false; return; } state.player = Math.max(0, state.player - (state.enemyType.damage + Math.floor(Math.random() * 5))); ui.flash.classList.add('show'); setTimeout(() => ui.flash.classList.remove('show'), 100); ping(90, .13); updateHud(); showToast(`${state.enemyType.name} ATTACKS`, '#ff7aad'); if (state.player <= 0) finish(false); }
function updateHud() { ui.playerHp.style.width = `${state.player}%`; ui.enemyHp.style.width = `${state.enemy}%`; ui.playerNum.textContent = state.player; ui.enemyNum.textContent = state.enemy; ui.timer.textContent = state.time; ui.charge.style.width = `${state.charge}%`; }
function finish(won) { if (!state.active) return; state.active = false; clearInterval(state.timerId); clearInterval(state.enemyId); ui.arena.innerHTML = ''; ui.combat.hidden = true; ui.bottom.hidden = true; ui.attacks.hidden = true; if (state.mode === 'pvp') state.pvpScores[state.turn - 1] = state.hits; if (state.mode === 'pvp' && state.turn === 1) { state.turn = 2; state.player = 100; state.enemy = 100; state.time = 10; state.hits = 0; state.shots = 0; showTurnIntro(); return; } ui.end.hidden = false; const pvp = state.mode === 'pvp'; $('resultTag').textContent = pvp ? 'MATCH COMPLETE' : won ? 'COMBAT COMPLETE' : 'SYSTEM FAILURE'; $('resultTitle').innerHTML = pvp ? (state.pvpScores[0] === state.pvpScores[1] ? 'PERFECT<br />DRAW' : `PLAYER ${state.pvpScores[0] > state.pvpScores[1] ? '1' : '2'}<br />WINS`) : won ? 'TARGET<br />ELIMINATED' : 'YOU WERE<br />HUNTED'; $('resultText').textContent = pvp ? 'The camera arena has chosen its champion.' : won ? 'The arena is clear. Excellent work.' : 'The Sentinel got the better of you this round.'; document.querySelector('.result-stats span:first-child').firstChild.textContent = pvp ? 'P1 HITS ' : 'ACCURACY '; document.querySelector('.result-stats span:last-child').firstChild.textContent = pvp ? 'P2 HITS ' : 'HITS '; $('accuracy').textContent = pvp ? state.pvpScores[0] : (state.shots ? `${Math.round(state.hits / state.shots * 100)}%` : '0%'); $('hits').textContent = pvp ? state.pvpScores[1] : state.hits; }
function showToast(message, color) { ui.toast.textContent = message; ui.toast.style.color = color; ui.toast.classList.add('show'); clearTimeout(showToast.id); showToast.id = setTimeout(() => ui.toast.classList.remove('show'), 650); }
function ping(freq, duration) { if (!state.sound || !window.AudioContext) return; const ctx = ping.ctx ||= new AudioContext(); const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.frequency.value = freq; gain.gain.setValueAtTime(.045, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration); }
setInterval(() => { if (state.active && state.charge < 100) { state.charge = Math.min(100, state.charge + 3); updateHud(); } }, 180);
