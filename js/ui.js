// ============================================================
//  CLAUDE'S ARENA — ui.js
//  Screen nav, HUD, high scores, touch controls
// ============================================================

const UI = (() => {

  // ── Elements ──────────────────────────────────────────────
  const screens = {
    menu:     document.getElementById('screen-menu'),
    howto:    document.getElementById('screen-howto'),
    scores:   document.getElementById('screen-scores'),
    game:     document.getElementById('screen-game'),
    gameover: document.getElementById('screen-gameover'),
  };

  // ── Wave banner ───────────────────────────────────────────
  let waveBanner = null;

  // ── Screen management ─────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
  }

  // ── HUD update ────────────────────────────────────────────
  function updateHUD(state, player) {
    // health
    const hpPct = Math.max(0, player.hp / player.maxHp * 100);
    const bar = document.getElementById('health-bar');
    bar.style.width = hpPct + '%';
    bar.style.background = hpPct > 50 ? '#00ff88' : hpPct > 25 ? '#ff8c00' : '#ff3030';
    bar.style.boxShadow  = hpPct > 50
      ? '0 0 8px #00ff88'
      : hpPct > 25 ? '0 0 8px #ff8c00' : '0 0 8px #ff3030';
    document.getElementById('hp-val').textContent = Math.ceil(player.hp);

    // score / streak / wave
    document.getElementById('score-display').textContent = state.score.toLocaleString();
    document.getElementById('streak-display').textContent = Math.min(state.streak, 8);
    document.getElementById('wave-num').textContent = state.wave;
    document.getElementById('enemy-count').textContent =
      Math.max(0, state.waveEnemies - state.waveKills);
  }

  function updateGrenades(count) {
    document.getElementById('grenades').textContent = `💥 ${count}`;
  }

  function setDashReady(ready) {
    const el = document.getElementById('dash-cd');
    el.textContent = ready ? 'DASH ✓' : 'DASH…';
    el.className = ready ? 'cd-ready' : 'cd-active';
  }

  // ── Wave banner ───────────────────────────────────────────
  function showWaveBanner(nextWave) {
    if (waveBanner) waveBanner.remove();
    waveBanner = document.createElement('div');
    waveBanner.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      font-family:'Courier New',monospace; font-size:clamp(1.5rem,5vw,3rem);
      font-weight:900; letter-spacing:0.2em; color:#00d4ff;
      text-shadow:0 0 20px #00d4ff, 0 0 40px #00d4ff;
      z-index:50; pointer-events:none;
      animation:waveFadeIn 0.3s ease, waveFadeOut 0.5s ease 2s forwards;
      text-align:center;
    `;
    waveBanner.innerHTML = `WAVE CLEAR<br><span style="color:#fff;font-size:0.6em;letter-spacing:0.3em">WAVE ${nextWave} INCOMING</span>`;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes waveFadeIn  { from { opacity:0; transform:translate(-50%,-60%) scale(0.8); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
      @keyframes waveFadeOut { from { opacity:1; } to { opacity:0; transform:translate(-50%,-40%); } }
    `;
    document.head.appendChild(style);
    document.body.appendChild(waveBanner);
    setTimeout(()=>{ if (waveBanner) waveBanner.remove(); }, 2600);
  }

  // ── Game Over ─────────────────────────────────────────────
  function showGameOver(state) {
    document.getElementById('final-score').textContent  = state.score.toLocaleString();
    document.getElementById('final-wave').textContent   = state.wave;
    document.getElementById('final-kills').textContent  = state.kills;
    document.getElementById('final-streak').textContent = state.maxStreak;
    showScreen('gameover');
  }

  // ── High Scores ───────────────────────────────────────────
  const SCORE_KEY = 'claudeArenaScores_v1';

  function loadScores() {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || []; }
    catch { return []; }
  }

  function saveScore(name, score, wave) {
    const scores = loadScores();
    scores.push({ name: name.toUpperCase().slice(0,10) || 'AGENT_X', score, wave, date: Date.now() });
    scores.sort((a,b) => b.score - a.score);
    scores.splice(10);
    localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
    return scores;
  }

  function renderScoreTable() {
    const scores = loadScores();
    const medals = ['🥇','🥈','🥉'];
    const tbody = document.getElementById('score-body');
    if (!scores.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:#6a8aaa;padding:1rem;text-align:center">No scores yet. Play the game!</td></tr>';
      return;
    }
    tbody.innerHTML = scores.map((s,i) => `
      <tr>
        <td>${medals[i] || (i+1)}</td>
        <td>${s.name}</td>
        <td>${s.score.toLocaleString()}</td>
        <td>${s.wave}</td>
      </tr>
    `).join('');
  }

  // ── Touch Controls ────────────────────────────────────────
  function buildTouchControls() {
    const tc = document.createElement('div');
    tc.id = 'touch-controls';
    tc.innerHTML = `
      <div class="touch-left">
        <div class="dpad">
          <div class="dpad-empty"></div>
          <div class="dpad-btn" id="t-up">▲</div>
          <div class="dpad-empty"></div>
          <div class="dpad-btn" id="t-left">◀</div>
          <div class="dpad-empty"></div>
          <div class="dpad-btn" id="t-right">▶</div>
        </div>
      </div>
      <div class="touch-right-area">
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="action-btn btn-grenade" id="t-grenade">💥</div>
          <div class="action-btn btn-dash" id="t-dash">⚡</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="action-btn btn-jump" id="t-jump">↑</div>
          <div class="action-btn btn-shoot" id="t-shoot">🔫</div>
        </div>
      </div>
    `;
    document.body.appendChild(tc);

    function bind(id, key, hold=true) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e=>{ e.preventDefault(); Game.setTouchInput(key,true); }, {passive:false});
      el.addEventListener('touchend',   e=>{ e.preventDefault(); if(hold) Game.setTouchInput(key,false); }, {passive:false});
      el.addEventListener('touchcancel',e=>{ if(hold) Game.setTouchInput(key,false); }, {passive:false});
    }
    bind('t-left',  'left');
    bind('t-right', 'right');
    bind('t-up',    'jump');
    bind('t-shoot', 'shoot');
    bind('t-dash',  'dash', false);
    bind('t-grenade','grenade', false);
  }

  // ── Button wiring ─────────────────────────────────────────
  function wireButtons() {
    // Menu
    document.getElementById('btn-play').addEventListener('click', ()=>{
      showScreen('game');
      setTimeout(()=>Game.start(), 50);
    });
    document.getElementById('btn-howto').addEventListener('click', ()=>showScreen('howto'));
    document.getElementById('btn-scores').addEventListener('click', ()=>{
      renderScoreTable();
      showScreen('scores');
    });

    // How to / Back
    document.getElementById('btn-back-menu').addEventListener('click', ()=>showScreen('menu'));
    document.getElementById('btn-back-menu2').addEventListener('click', ()=>showScreen('menu'));

    // Pause
    document.getElementById('btn-resume').addEventListener('click', ()=>Game.togglePause());
    document.getElementById('btn-quit').addEventListener('click', ()=>{
      Game.stop();
      document.getElementById('pause-overlay').classList.add('hidden');
      showScreen('menu');
    });

    // Game over
    document.getElementById('btn-save-score').addEventListener('click', ()=>{
      const name = document.getElementById('player-name').value || 'AGENT_X';
      const score = parseInt(document.getElementById('final-score').textContent.replace(/,/g,''))||0;
      const wave  = parseInt(document.getElementById('final-wave').textContent)||1;
      saveScore(name, score, wave);
      document.getElementById('name-entry').style.display='none';
      document.getElementById('btn-save-score').textContent='✓ SAVED';
    });
    document.getElementById('btn-play-again').addEventListener('click', ()=>{
      document.getElementById('name-entry').style.display='flex';
      document.getElementById('btn-save-score').textContent='SAVE SCORE';
      showScreen('game');
      setTimeout(()=>Game.start(), 50);
    });
    document.getElementById('btn-menu-go').addEventListener('click', ()=>{
      document.getElementById('name-entry').style.display='flex';
      document.getElementById('btn-save-score').textContent='SAVE SCORE';
      showScreen('menu');
    });

    // Keyboard shortcut: Enter from menu
    document.getElementById('player-name').addEventListener('keydown', e=>{
      if (e.key==='Enter') document.getElementById('btn-save-score').click();
    });
  }

  // ── Boot ──────────────────────────────────────────────────
  function boot() {
    wireButtons();
    buildTouchControls();
    showScreen('menu');
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { updateHUD, updateGrenades, setDashReady, showGameOver, showWaveBanner };
})();
