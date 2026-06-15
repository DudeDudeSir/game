// ============================================================
//  CLAUDE'S ARENA — game.js
//  Core engine: physics, entities, input, rendering
// ============================================================

const Game = (() => {
  // ── Canvas / context ──────────────────────────────────────
  let canvas, ctx, W, H;

  // ── State ─────────────────────────────────────────────────
  let running = false;
  let paused  = false;
  let rafId   = null;
  let lastTime = 0;

  const state = {
    score: 0, wave: 1, streak: 0, maxStreak: 0,
    kills: 0, grenades: 3, dashReady: true, dashCooldown: 0,
    waveEnemies: 0, waveKills: 0, waveTransition: false
  };

  // ── Input ─────────────────────────────────────────────────
  const keys = {};
  const input = { left:false, right:false, jump:false, shoot:false, dash:false, grenade:false };
  let shootCooldown = 0;

  // ── Particles / Projectiles / Enemies / Pickups ──────────
  let particles = [], bullets = [], enemyBullets = [], enemies = [], pickups = [];

  // ── Player ────────────────────────────────────────────────
  const player = {
    x:0, y:0, w:40, h:56,
    vx:0, vy:0,
    speed:220, jumpPower:480,
    hp:100, maxHp:100,
    onGround:false,
    invincible:0,    // frames remaining
    dashing:0,
    facing:1,        // 1=right -1=left
    animFrame:0, animTimer:0
  };

  // ── World ─────────────────────────────────────────────────
  let platforms = [];
  const GRAVITY = 900;

  // ── Color palette ─────────────────────────────────────────
  const COL = {
    neonBlue:'#00d4ff', neonPurple:'#bf00ff',
    neonPink:'#ff00aa', neonOrange:'#ff8c00',
    neonGreen:'#00ff88', neonRed:'#ff3030',
    bg1:'#05080f', bg2:'#090d1a',
    platform:'#1a2240', platformEdge:'#203060'
  };

  // ─────────────────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
  }

  function resize() {
    const container = document.getElementById('screen-game');
    W = canvas.width  = container.clientWidth  || window.innerWidth;
    H = canvas.height = container.clientHeight || window.innerHeight;
    if (H < 300) H = canvas.height = 300;
    buildLevel();
  }

  // ─────────────────────────────────────────────────────────
  //  LEVEL / PLATFORMS
  // ─────────────────────────────────────────────────────────
  function buildLevel() {
    const gh = H;   // ground y = H - platform thickness
    platforms = [
      // ground
      { x:0, y:gh-30, w:W, h:30, isGround:true },
      // mid platforms
      { x: W*0.05, y: gh-140, w:120, h:14 },
      { x: W*0.30, y: gh-200, w:140, h:14 },
      { x: W*0.55, y: gh-150, w:120, h:14 },
      { x: W*0.75, y: gh-240, w:100, h:14 },
      { x: W*0.15, y: gh-310, w:110, h:14 },
      { x: W*0.50, y: gh-320, w:130, h:14 },
      // top rail
      { x: W*0.0,  y: gh-420, w: W*0.35, h:14 },
      { x: W*0.60, y: gh-420, w: W*0.40, h:14 },
    ];
    // reset player to ground center
    player.x = W/2 - player.w/2;
    player.y = gh - 30 - player.h;
    player.vx = 0; player.vy = 0;
    player.onGround = true;
  }

  // ─────────────────────────────────────────────────────────
  //  INPUT
  // ─────────────────────────────────────────────────────────
  function onKeyDown(e) {
    keys[e.code] = true;
    if ((e.code==='KeyP'||e.code==='Escape') && running) togglePause();
    // consume space to prevent scroll
    if (e.code==='Space') e.preventDefault();
  }
  function onKeyUp(e)   { keys[e.code] = false; }

  function readInput() {
    input.left    = keys['ArrowLeft']  || keys['KeyA'];
    input.right   = keys['ArrowRight'] || keys['KeyD'];
    input.jump    = keys['ArrowUp']    || keys['KeyW'] || keys['Space'];
    input.shoot   = keys['Space']      || keys['KeyF'];
    input.dash    = keys['ShiftLeft']  || keys['ShiftRight'];
    input.grenade = keys['KeyQ'];
  }

  // Touch API (called from ui.js)
  function setTouchInput(k, v) { input[k] = v; }

  // ─────────────────────────────────────────────────────────
  //  START / STOP / PAUSE
  // ─────────────────────────────────────────────────────────
  function start() {
    // reset everything
    Object.assign(state, {
      score:0, wave:1, streak:0, maxStreak:0,
      kills:0, grenades:3, dashReady:true, dashCooldown:0,
      waveEnemies:0, waveKills:0, waveTransition:false
    });
    player.hp = player.maxHp;
    player.invincible = 0;
    player.facing = 1;
    particles = []; bullets = []; enemyBullets = []; enemies = []; pickups = [];
    shootCooldown = 0;
    buildLevel();
    spawnWave();
    running = true; paused = false; lastTime = 0;
    UI.updateHUD(state, player);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function togglePause() {
    paused = !paused;
    document.getElementById('pause-overlay').classList.toggle('hidden', !paused);
    if (!paused) { lastTime = 0; rafId = requestAnimationFrame(loop); }
  }

  // ─────────────────────────────────────────────────────────
  //  GAME LOOP
  // ─────────────────────────────────────────────────────────
  function loop(ts) {
    if (!running || paused) return;
    const dt = lastTime ? Math.min((ts - lastTime)/1000, 0.05) : 0.016;
    lastTime = ts;

    update(dt);
    render();

    rafId = requestAnimationFrame(loop);
  }

  // ─────────────────────────────────────────────────────────
  //  UPDATE
  // ─────────────────────────────────────────────────────────
  function update(dt) {
    readInput();
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemyBullets(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    checkWaveProgress();
    UI.updateHUD(state, player);
  }

  // ── Player update ─────────────────────────────────────────
  function updatePlayer(dt) {
    // dash
    if (state.dashCooldown > 0) state.dashCooldown -= dt;
    if (state.dashCooldown <= 0 && !state.dashReady) {
      state.dashReady = true;
      UI.setDashReady(true);
    }

    if (player.dashing > 0) {
      player.dashing -= dt;
    } else {
      // normal movement
      let moved = false;
      if (input.left)  { player.vx = -player.speed; player.facing = -1; moved = true; }
      if (input.right) { player.vx =  player.speed; player.facing =  1; moved = true; }
      if (!moved) player.vx *= 0.6;

      // jump
      if (input.jump && player.onGround) {
        player.vy = -player.jumpPower;
        player.onGround = false;
        spawnParticles(player.x+player.w/2, player.y+player.h, COL.neonBlue, 6, 0.3);
      }

      // dash
      if (input.dash && state.dashReady) {
        player.vx = player.facing * player.speed * 4;
        player.dashing = 0.18;
        player.invincible = Math.max(player.invincible, 22);
        state.dashReady = false;
        state.dashCooldown = 1.2;
        UI.setDashReady(false);
        spawnParticles(player.x+player.w/2, player.y+player.h/2, COL.neonOrange, 12, 0.35);
      }
    }

    // shoot
    if (shootCooldown > 0) shootCooldown -= dt;
    if (input.shoot && shootCooldown <= 0) {
      fireBullet();
      shootCooldown = 0.18;
    }

    // grenade (one-time trigger per press)
    if (input.grenade && !keys._grenadeUsed && state.grenades > 0) {
      keys._grenadeUsed = true;
      throwGrenade();
    }
    if (!input.grenade) keys._grenadeUsed = false;

    // gravity
    if (!player.onGround) player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // platform collision
    player.onGround = false;
    for (const p of platforms) {
      if (rectOverlap(player, p)) {
        const overlapX = Math.min(player.x+player.w, p.x+p.w) - Math.max(player.x, p.x);
        const overlapY = Math.min(player.y+player.h, p.y+p.h) - Math.max(player.y, p.y);
        if (overlapY < overlapX) {
          if (player.vy >= 0 && player.y+player.h-player.vy*dt <= p.y+2) {
            player.y = p.y - player.h;
            player.vy = 0;
            player.onGround = true;
          } else if (player.vy < 0) {
            player.y = p.y + p.h;
            player.vy = 0;
          }
        } else {
          if (player.vx > 0) player.x = p.x - player.w;
          else player.x = p.x + p.w;
          player.vx = 0;
        }
      }
    }

    // screen clamp
    player.x = Math.max(0, Math.min(W - player.w, player.x));
    if (player.y > H + 50) {
      player.y = platforms[0].y - player.h;
      player.vy = 0;
      takeDamage(20);
    }

    if (player.invincible > 0) player.invincible--;

    // animation
    player.animTimer += dt;
    if (player.animTimer > 0.1) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 4;
    }
  }

  function fireBullet() {
    const bx = player.facing === 1 ? player.x + player.w : player.x;
    const by = player.y + player.h * 0.35;
    bullets.push({
      x:bx, y:by, vx: player.facing * 700, vy: 0,
      w:18, h:6, life:1.2, hit:false
    });
    spawnParticles(bx, by, COL.neonBlue, 3, 0.2);
  }

  function throwGrenade() {
    state.grenades--;
    UI.updateGrenades(state.grenades);
    const gx = player.x + player.w/2;
    const gy = player.y;
    // find nearest enemy
    let target = null, best = Infinity;
    for (const e of enemies) {
      const d = dist(gx, gy, e.x+e.w/2, e.y+e.h/2);
      if (d < best) { best = d; target = e; }
    }
    let angle = target
      ? Math.atan2((target.y+target.h/2) - gy, (target.x+target.w/2) - gx)
      : Math.atan2(-1, player.facing);
    bullets.push({
      x:gx, y:gy,
      vx: Math.cos(angle)*380, vy: Math.sin(angle)*380 - 200,
      w:12, h:12, life:2, hit:false, isGrenade:true, gravity:true
    });
  }

  // ── Bullets ───────────────────────────────────────────────
  function updateBullets(dt) {
    for (let i = bullets.length-1; i >= 0; i--) {
      const b = bullets[i];
      if (b.gravity) b.vy += GRAVITY*0.5*dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > W) {
        if (b.isGrenade) explode(b.x, b.y);
        bullets.splice(i,1); continue;
      }
      // platform bounce for grenade
      if (b.isGrenade) {
        for (const p of platforms) {
          if (rectContains(p, b.x, b.y)) {
            b.vy *= -0.5;
            b.y = p.y - b.h;
            if (Math.abs(b.vy) < 50) { explode(b.x, b.y); bullets.splice(i,1); break; }
          }
        }
        if (!bullets[i]) continue;
      }
      // hit enemies
      for (let j = enemies.length-1; j >= 0; j--) {
        const e = enemies[j];
        if (rectOverlapPt(e, b.x, b.y, b.w, b.h)) {
          if (b.isGrenade) { explode(b.x, b.y); bullets.splice(i,1); break; }
          hitEnemy(e, j, b.isGrenade ? 60 : 25);
          spawnParticles(b.x, b.y, COL.neonOrange, 6, 0.3);
          bullets.splice(i,1); break;
        }
      }
    }
  }

  function explode(x, y) {
    spawnParticles(x, y, COL.neonOrange, 25, 0.7);
    spawnParticles(x, y, COL.neonRed, 15, 0.5);
    for (let j = enemies.length-1; j >= 0; j--) {
      const e = enemies[j];
      if (dist(x,y, e.x+e.w/2, e.y+e.h/2) < 120) {
        hitEnemy(e, j, 80);
      }
    }
  }

  // ── Enemy bullets ──────────────────────────────────────────
  function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length-1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > W || b.y > H) {
        enemyBullets.splice(i,1); continue;
      }
      if (player.invincible <= 0 && rectOverlapPt(player, b.x, b.y, b.w, b.h)) {
        takeDamage(b.dmg || 10);
        spawnParticles(player.x+player.w/2, player.y+player.h/2, COL.neonRed, 8, 0.4);
        enemyBullets.splice(i,1);
      }
    }
  }

  // ── Enemies ────────────────────────────────────────────────
  const ENEMY_TYPES = {
    grunt:  { w:34, h:48, hp:40,  speed:80,  color:COL.neonPurple, shootInterval:2.2, dmg:10, score:100 },
    runner: { w:28, h:40, hp:25,  speed:160, color:COL.neonPink,   shootInterval:3.5, dmg:8,  score:150 },
    heavy:  { w:48, h:58, hp:120, speed:50,  color:COL.neonOrange, shootInterval:1.5, dmg:18, score:300 },
    sniper: { w:30, h:50, hp:35,  speed:60,  color:'#ff6600',      shootInterval:1.0, dmg:25, score:200 },
  };

  function spawnEnemy(type='grunt') {
    const t = ENEMY_TYPES[type];
    const side = Math.random() < 0.5 ? 0 : W - t.w;
    const platY = platforms[Math.floor(Math.random()*platforms.length)].y;
    enemies.push({
      ...t,
      x:side, y:platY - t.h,
      vx:0, vy:0,
      onGround:false,
      hp:t.hp, maxHp:t.hp,
      type, shootTimer:Math.random()*2,
      dir: side===0 ? 1 : -1,
      alive:true,
      animFrame:0, animTimer:0,
      hurtTimer:0
    });
  }

  function spawnWave() {
    const w = state.wave;
    const count = 4 + w*2;
    state.waveEnemies = count; state.waveKills = 0;
    const types = w<=1 ? ['grunt']
                : w<=3 ? ['grunt','runner']
                : w<=5 ? ['grunt','runner','heavy']
                : ['grunt','runner','heavy','sniper'];
    for (let i=0; i<count; i++) {
      setTimeout(()=>{
        const t = types[Math.floor(Math.random()*types.length)];
        spawnEnemy(t);
      }, i * 600);
    }
  }

  function updateEnemies(dt) {
    const speedMult = 1 + (state.wave-1)*0.1;
    for (let i = enemies.length-1; i >= 0; i--) {
      const e = enemies[i];
      if (e.hurtTimer > 0) e.hurtTimer -= dt;

      // AI: move toward player, stay on ground
      const px = player.x + player.w/2;
      const ex = e.x + e.w/2;
      e.dir = px < ex ? -1 : 1;
      e.vx = e.dir * e.speed * speedMult;

      // gravity
      e.vy += GRAVITY * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // platform collision for enemies
      e.onGround = false;
      for (const p of platforms) {
        if (rectOverlap(e, p)) {
          const overlapY = Math.min(e.y+e.h, p.y+p.h) - Math.max(e.y, p.y);
          const overlapX = Math.min(e.x+e.w, p.x+p.w) - Math.max(e.x, p.x);
          if (overlapY < overlapX && e.vy >= 0) {
            e.y = p.y - e.h;
            e.vy = 0;
            e.onGround = true;
          }
        }
      }
      if (e.y > H + 40) { e.y = platforms[0].y - e.h; e.vy = 0; }
      e.x = Math.max(0, Math.min(W-e.w, e.x));

      // shoot
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = e.shootInterval / speedMult;
        fireEnemyBullet(e);
      }

      // melee contact
      if (player.invincible <= 0 && rectOverlap(player, e)) {
        takeDamage(e.dmg * 0.5 * dt * 60);
      }

      // animation
      e.animTimer += dt;
      if (e.animTimer > 0.12) { e.animTimer=0; e.animFrame=(e.animFrame+1)%4; }
    }
  }

  function fireEnemyBullet(e) {
    const ex = e.x + e.w/2, ey = e.y + e.h*0.35;
    const tx = player.x + player.w/2, ty = player.y + player.h*0.35;
    const angle = Math.atan2(ty-ey, tx-ex);
    const spd = e.type==='sniper' ? 500 : 260;
    enemyBullets.push({
      x:ex, y:ey,
      vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd,
      w:10, h:5, life:2.5, dmg:e.dmg
    });
  }

  function hitEnemy(e, idx, dmg) {
    e.hp -= dmg;
    e.hurtTimer = 0.12;
    spawnParticles(e.x+e.w/2, e.y+e.h/2, e.color, 5, 0.25);
    if (e.hp <= 0) {
      killEnemy(e, idx);
    }
  }

  function killEnemy(e, idx) {
    state.kills++;
    state.waveKills++;
    state.streak++;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;
    const mult = Math.min(state.streak, 8);
    state.score += (e.score || 100) * mult;
    spawnParticles(e.x+e.w/2, e.y+e.h/2, e.color, 20, 0.6);
    // chance to drop pickup
    if (Math.random() < 0.3) spawnPickup(e.x+e.w/2, e.y+e.h/2);
    enemies.splice(idx, 1);
  }

  // ── Pickups ────────────────────────────────────────────────
  function spawnPickup(x, y) {
    const type = Math.random() < 0.6 ? 'health' : (Math.random()<0.5 ? 'shield' : 'grenade');
    pickups.push({ x:x-12, y:y-12, w:24, h:24, type, life:8 });
  }

  function updatePickups(dt) {
    for (let i = pickups.length-1; i >= 0; i--) {
      const pk = pickups[i];
      pk.life -= dt;
      if (pk.life <= 0) { pickups.splice(i,1); continue; }
      if (rectOverlap(player, pk)) {
        if (pk.type==='health') {
          player.hp = Math.min(player.maxHp, player.hp + 30);
          spawnParticles(pk.x+12, pk.y+12, COL.neonGreen, 10, 0.5);
        } else if (pk.type==='shield') {
          player.invincible = 180;
          spawnParticles(pk.x+12, pk.y+12, COL.neonBlue, 10, 0.5);
        } else if (pk.type==='grenade') {
          state.grenades = Math.min(5, state.grenades+1);
          UI.updateGrenades(state.grenades);
        }
        pickups.splice(i,1);
      }
    }
  }

  // ── Particles ─────────────────────────────────────────────
  function spawnParticles(x, y, color, count, life) {
    for (let i=0; i<count; i++) {
      const angle = Math.random()*Math.PI*2;
      const speed = 60 + Math.random()*200;
      particles.push({
        x, y, color,
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed - 50,
        life, maxLife:life,
        size:2+Math.random()*4
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length-1; i >= 0; i--) {
      const p = particles[i];
      p.vy += GRAVITY*0.2*dt;
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.life -= dt;
      p.vx *= 0.96;
      if (p.life <= 0) particles.splice(i,1);
    }
  }

  // ── Wave progress ─────────────────────────────────────────
  function checkWaveProgress() {
    if (state.waveTransition) return;
    if (state.waveKills >= state.waveEnemies && enemies.length === 0) {
      state.waveTransition = true;
      state.streak = 0;
      UI.showWaveBanner(state.wave + 1);
      setTimeout(()=>{
        state.wave++;
        state.waveTransition = false;
        state.grenades = Math.min(5, state.grenades+1);
        player.hp = Math.min(player.maxHp, player.hp + 25);
        UI.updateGrenades(state.grenades);
        spawnWave();
      }, 2500);
    }
  }

  // ── Damage ────────────────────────────────────────────────
  function takeDamage(dmg) {
    if (player.invincible > 0) return;
    player.hp -= dmg;
    player.invincible = 30;
    state.streak = 0;
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
  }

  function gameOver() {
    stop();
    UI.showGameOver(state);
  }

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  function render() {
    ctx.clearRect(0,0,W,H);
    drawBackground();
    drawPlatforms();
    drawPickups();
    drawParticles();
    drawBullets();
    drawEnemyBullets();
    drawEnemies();
    drawPlayer();
  }

  // ── Background ────────────────────────────────────────────
  function drawBackground() {
    // sky gradient
    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0, '#050810');
    sky.addColorStop(0.6,'#090d1e');
    sky.addColorStop(1, '#0e1530');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,W,H);

    // city silhouette
    ctx.fillStyle = '#080d1a';
    drawCityLine(W, H);

    // distant neon glow streaks
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i=0; i<8; i++) {
      ctx.fillStyle = i%2===0 ? COL.neonBlue : COL.neonPurple;
      ctx.fillRect(i*(W/8)+W/16-1, 0, 2, H*0.75);
    }
    ctx.restore();
  }

  function drawCityLine(W, H) {
    // simple procedural buildings
    ctx.beginPath();
    ctx.moveTo(0, H);
    let bx = 0;
    while (bx < W) {
      const bw = 30 + Math.floor(bx/17)%3*20;
      const bh = 60 + (Math.floor(bx/23)%4)*40;
      ctx.lineTo(bx, H - bh);
      ctx.lineTo(bx+bw*0.6, H - bh);
      ctx.lineTo(bx+bw*0.6, H - bh - 15);
      ctx.lineTo(bx+bw*0.8, H - bh - 15);
      ctx.lineTo(bx+bw*0.8, H - bh);
      ctx.lineTo(bx+bw, H - bh);
      ctx.lineTo(bx+bw, H);
      bx += bw + 4;
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Platforms ─────────────────────────────────────────────
  function drawPlatforms() {
    for (const p of platforms) {
      if (p.isGround) {
        ctx.fillStyle = '#0d1628';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = COL.platformEdge;
        ctx.fillRect(p.x, p.y, p.w, 2);
        // grid lines
        ctx.strokeStyle = 'rgba(30,60,100,0.3)';
        ctx.lineWidth = 1;
        for (let gx=0; gx<W; gx+=60) {
          ctx.beginPath(); ctx.moveTo(gx,p.y); ctx.lineTo(gx,H); ctx.stroke();
        }
      } else {
        ctx.fillStyle = COL.platform;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // glowing edge
        ctx.shadowBlur = 8; ctx.shadowColor = COL.neonBlue;
        ctx.fillStyle = COL.neonBlue;
        ctx.fillRect(p.x, p.y, p.w, 2);
        ctx.shadowBlur = 0;
      }
    }
  }

  // ── Player ────────────────────────────────────────────────
  function drawPlayer() {
    const p = player;
    if (p.invincible > 0 && Math.floor(p.invincible/4)%2 === 0) return; // blink

    ctx.save();
    if (p.facing === -1) {
      ctx.translate(p.x + p.w, p.y);
      ctx.scale(-1,1);
      drawPlayerSprite(0, 0, p.w, p.h, p.animFrame, p.dashing>0);
    } else {
      drawPlayerSprite(p.x, p.y, p.w, p.h, p.animFrame, p.dashing>0);
    }
    ctx.restore();

    // health bar above player
    const bw = p.w+10, bh=4;
    const bx = p.x-5, by = p.y-10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    const hpPct = p.hp/p.maxHp;
    ctx.fillStyle = hpPct>0.5 ? COL.neonGreen : hpPct>0.25 ? COL.neonOrange : COL.neonRed;
    ctx.fillRect(bx, by, bw*hpPct, bh);

    // dash trail
    if (p.dashing > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = COL.neonOrange;
      ctx.fillRect(p.x - p.facing*20, p.y+5, p.w, p.h-10);
      ctx.globalAlpha = 1;
    }
  }

  function drawPlayerSprite(x, y, w, h, frame, dashing) {
    // Body (armored suit)
    ctx.fillStyle = dashing ? COL.neonOrange : '#1a2560';
    ctx.fillRect(x+4, y+12, w-8, h-24);

    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(x+8, y+2, w-16, 14);

    // Hair (purple)
    ctx.fillStyle = '#8b00cc';
    ctx.fillRect(x+6, y, w-12, 6);
    ctx.fillRect(x+6, y, 6, 10);

    // Visor
    ctx.fillStyle = COL.neonBlue;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x+8, y+5, w-16, 5);
    ctx.globalAlpha = 1;

    // Armor details
    ctx.fillStyle = '#0a1840';
    ctx.fillRect(x+4, y+12, 6, h-26);
    ctx.fillStyle = COL.neonBlue;
    ctx.fillRect(x+4, y+15, 3, 10);

    // Legs
    const legOffset = [0,2,0,-2][frame];
    ctx.fillStyle = '#111830';
    ctx.fillRect(x+4,  y+h-18, (w-12)/2, 18+legOffset);
    ctx.fillRect(x+8+(w-12)/2, y+h-18, (w-12)/2, 18-legOffset);

    // Boots (glowing)
    ctx.shadowBlur=6; ctx.shadowColor=COL.neonBlue;
    ctx.fillStyle = COL.neonBlue;
    ctx.fillRect(x+3, y+h-5, (w-12)/2+2, 5);
    ctx.fillRect(x+7+(w-12)/2, y+h-5, (w-12)/2+2, 5);
    ctx.shadowBlur=0;

    // Gun
    ctx.fillStyle = '#2a3550';
    ctx.fillRect(x+w-10, y+18, 16, 7);
    ctx.fillStyle = COL.neonOrange;
    ctx.fillRect(x+w+4, y+19, 4, 5);

    // Shoulder neon accent
    ctx.shadowBlur=8; ctx.shadowColor=COL.neonPurple;
    ctx.fillStyle=COL.neonPurple;
    ctx.fillRect(x+w-12, y+12, 8, 3);
    ctx.shadowBlur=0;
  }

  // ── Enemies ────────────────────────────────────────────────
  function drawEnemies() {
    for (const e of enemies) {
      ctx.save();
      if (e.dir === -1) {
        ctx.translate(e.x+e.w, e.y);
        ctx.scale(-1,1);
        drawEnemySprite(0,0,e.w,e.h,e.type,e.animFrame,e.hurtTimer>0);
      } else {
        drawEnemySprite(e.x,e.y,e.w,e.h,e.type,e.animFrame,e.hurtTimer>0);
      }
      ctx.restore();

      // enemy HP bar
      const bw=e.w, bh=3;
      ctx.fillStyle='rgba(0,0,0,0.4)';
      ctx.fillRect(e.x,e.y-7,bw,bh);
      ctx.fillStyle=e.color;
      ctx.fillRect(e.x,e.y-7,bw*(e.hp/e.maxHp),bh);
    }
  }

  function drawEnemySprite(x,y,w,h,type,frame,hurt) {
    const col = ENEMY_TYPES[type].color;
    const flash = hurt ? '#ffffff' : col;

    ctx.shadowBlur=6; ctx.shadowColor=col;

    // body
    ctx.fillStyle = hurt ? 'rgba(255,100,100,0.8)' : `rgba(${hexToRgb(col)},0.15)`;
    ctx.fillRect(x+2,y+8,w-4,h-18);

    // armor plates
    ctx.fillStyle=flash;
    ctx.fillRect(x+2,y+8,w-4,4);
    ctx.fillRect(x+2,y+20,w-4,3);

    // head
    ctx.fillStyle='#1a1a2e';
    ctx.fillRect(x+6,y,w-12,10);
    ctx.fillStyle=col;
    ctx.fillRect(x+6,y+2,w-12,4);

    // eyes (glow)
    ctx.fillStyle='#ff0000';
    ctx.fillRect(x+7,y+3,4,3);
    ctx.fillRect(x+w-11,y+3,4,3);

    // legs
    const lo = [0,2,0,-2][frame];
    ctx.fillStyle='#0a0a18';
    ctx.fillRect(x+3, y+h-14, (w-10)/2, 14+lo);
    ctx.fillRect(x+5+(w-10)/2, y+h-14, (w-10)/2, 14-lo);

    ctx.shadowBlur=0;
  }

  // ── Bullets ────────────────────────────────────────────────
  function drawBullets() {
    for (const b of bullets) {
      if (b.isGrenade) {
        ctx.shadowBlur=10; ctx.shadowColor=COL.neonPink;
        ctx.fillStyle=COL.neonPink;
        ctx.beginPath();
        ctx.arc(b.x,b.y,b.w/2,0,Math.PI*2);
        ctx.fill();
        ctx.shadowBlur=0;
      } else {
        ctx.shadowBlur=8; ctx.shadowColor=COL.neonBlue;
        ctx.fillStyle=COL.neonBlue;
        ctx.fillRect(b.x-b.w/2, b.y-b.h/2, b.w, b.h);
        ctx.shadowBlur=0;
      }
    }
  }

  function drawEnemyBullets() {
    for (const b of enemyBullets) {
      ctx.shadowBlur=6; ctx.shadowColor=COL.neonRed;
      ctx.fillStyle=COL.neonRed;
      ctx.fillRect(b.x-b.w/2, b.y-b.h/2, b.w, b.h);
      ctx.shadowBlur=0;
    }
  }

  // ── Particles ─────────────────────────────────────────────
  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4; ctx.shadowColor = p.color;
      ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  // ── Pickups ────────────────────────────────────────────────
  function drawPickups() {
    const t = performance.now()/1000;
    for (const pk of pickups) {
      const bob = Math.sin(t*3)*3;
      const flash = pk.life < 2 && Math.floor(t*6)%2===0;
      ctx.globalAlpha = flash ? 0.4 : 1;
      const col = pk.type==='health' ? COL.neonGreen
                : pk.type==='shield' ? COL.neonBlue
                : COL.neonPink;
      ctx.shadowBlur=12; ctx.shadowColor=col;
      ctx.fillStyle=col;
      ctx.fillRect(pk.x, pk.y+bob, pk.w, pk.h);
      // icon
      ctx.fillStyle='#000';
      ctx.font='bold 14px monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(pk.type==='health'?'♥':pk.type==='shield'?'◈':'💥', pk.x+12, pk.y+12+bob);
      ctx.shadowBlur=0; ctx.globalAlpha=1;
    }
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  // ─────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────
  function rectOverlap(a, b) {
    return a.x < b.x+b.w && a.x+a.w > b.x
        && a.y < b.y+b.h && a.y+a.h > b.y;
  }
  function rectOverlapPt(r, x,y,w,h) {
    return x < r.x+r.w && x+w > r.x && y < r.y+r.h && y+h > r.y;
  }
  function rectContains(r, x, y) {
    return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;
  }
  function dist(x1,y1,x2,y2) { return Math.hypot(x2-x1,y2-y1); }
  function hexToRgb(hex) {
    const r=parseInt(hex.slice(1,3),16);
    const g=parseInt(hex.slice(3,5),16);
    const b=parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }

  // ─────────────────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────────────────
  return { init, start, stop, togglePause, setTouchInput };
})();

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => Game.init());
