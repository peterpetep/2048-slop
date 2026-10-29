<script>
  // Magnet: there's no sliding. Every Eddy is a magnet, and the board clumps up on its own.
  // Opposite poles attract and like poles repel, harder for bigger Eddys. Tap an Eddy to flip its pole,
  // tap empty space to blast Eddys apart. The game ends when the table stays too crowded for 3 seconds.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { load, save } from "../../lib/storage.js";
  import { S, makeBall, spawnBall, step, blast, crowding } from "./magnet.js";

  const MAX = 11, KEY = "magnet-v1", STEP = 1 / 240, CROWD_SECS = 3, CROWD_LIMIT = 0.38;
  const SHOVE = 700, BLAST_COOLDOWN = 0.5;
  const POLE = { 1: { name: "N", color: "#d9534f" }, [-1]: { name: "S", color: "#4a7bd0" } };

  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let paused = $state(false);
  let crowd = $state(0);

  // Physics state is plain (not reactive): the canvas redraws it every frame.
  let balls = [], spawnTimer = 0, spawned = 0, danger = 0, acc = 0, cooldown = 0;
  let rings = [];
  const held = { up: false, down: false, left: false, right: false };

  let canvas, board;
  const photos = {};
  const running = () => !paused && !over && !(won && !keepGoing);

  function newGame() {
    balls = [];
    for (let i = 0; i < 5; i++) balls.push(spawnBall(balls));
    score = 0; won = false; keepGoing = false; over = false; paused = false;
    spawnTimer = 1; spawned = 0; danger = 0; rings = [];
    persist();
  }

  function persist() {
    save(KEY, { balls: balls.map(b => [Math.round(b.x), Math.round(b.y), b.lvl, b.pole]), score, won, keepGoing, over, spawned });
  }

  function restore() {
    const s = load(KEY);
    if (!Array.isArray(s?.balls)) return false;
    balls = s.balls.filter(a => a?.[2] >= 1 && a[2] <= MAX).map(([x, y, lvl, pole]) => {
      const b = makeBall(+x || S / 2, +y || S / 2, lvl, pole === -1 ? -1 : 1);
      b.age = 2;
      return b;
    });
    ({ score, won, keepGoing, over } = s);
    spawned = s.spawned || 0; spawnTimer = 1.5;
    return true;
  }

  function tick(dt) {
    rings = rings.filter(r => (r.t += dt) < 0.4);
    if (!running()) return;
    if (cooldown > 0) cooldown -= dt;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      balls.push(spawnBall(balls));
      spawned++;
      spawnTimer = Math.max(1, 2 - spawned * 0.01);
    }
    const nx = (held.right - held.left) * SHOVE, ny = (held.down - held.up) * SHOVE;
    acc += dt;
    while (acc >= STEP) {
      const res = step(balls, STEP, { nx, ny, maxLvl: MAX });
      balls = res.balls;
      for (const b of res.made) {
        score += 2 ** b.lvl;
        if (b.lvl === MAX) won = true;
      }
      acc -= STEP;
    }
    if (score > best) { best = score; save(KEY + ":best", best); }
    crowd = crowding(balls);
    danger = crowd > CROWD_LIMIT ? danger + dt : Math.max(0, danger - dt * 2);
    if (danger > CROWD_SECS) { over = true; persist(); }
  }

  // Tap an Eddy to flip its pole; tap empty table to blast.
  function tap(x, y) {
    if (!running()) return;
    let hit = null;
    for (const b of balls) if (Math.hypot(b.x - x, b.y - y) < b.r + 4 && (!hit || b.r < hit.r)) hit = b;
    if (hit) {
      hit.pole = -hit.pole;
      hit.pop = 0.6;
    } else if (cooldown <= 0) {
      cooldown = BLAST_COOLDOWN;
      blast(balls, x, y);
      rings.push({ x, y, t: 0 });
    }
  }

  function togglePause() {
    if (over) return;
    paused = !paused;
    persist();
  }

  // ---- drawing ----
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    colors = { cell: v("--cell"), text: v("--text"), light: v("--light-text"), danger: v("--t6"), font: v("--font"),
      tiles: Array.from({ length: MAX }, (_, i) => v(`--t${i + 1}`)) };
  }

  function draw() {
    const ctx = canvas.getContext("2d"), dpr = devicePixelRatio || 1;
    const size = board.clientWidth, pad = size * 0.03;
    if (canvas.width !== Math.round(size * dpr)) canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const s = (size - 2 * pad) / S;
    ctx.translate(pad, pad);
    ctx.scale(s, s);

    ctx.fillStyle = colors.cell;
    roundRect(ctx, 0, 0, S, S, 8); ctx.fill();
    const warn = Math.min(1, danger / CROWD_SECS);
    if (warn) {
      ctx.strokeStyle = colors.danger; ctx.lineWidth = 4 + warn * 4;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 120));
      roundRect(ctx, 2, 2, S - 4, S - 4, 8); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Field lines between matching Eddys that are pulling toward each other.
    ctx.setLineDash([6, 6]); ctx.lineWidth = 2.5;
    ctx.lineDashOffset = -performance.now() / 40;
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        if (a.lvl !== b.lvl || a.pole === b.pole || a.lvl >= MAX) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 300) continue;
        ctx.strokeStyle = colors.light; ctx.globalAlpha = 0.85 * (1 - d / 300);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    for (const r of rings) {
      ctx.strokeStyle = colors.light; ctx.lineWidth = 4; ctx.globalAlpha = 1 - r.t / 0.4;
      ctx.beginPath(); ctx.arc(r.x, r.y, 20 + r.t * 320, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const b of balls) drawBall(ctx, b);
  }

  function drawBall(ctx, b) {
    const r = b.r * (1 + 0.2 * Math.sin(b.pop * Math.PI)), pole = POLE[b.pole];
    ctx.save();
    ctx.translate(b.x, b.y);
    // pole ring
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = pole.color; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r - 3.5, 0, Math.PI * 2);
    ctx.fillStyle = colors.tiles[b.lvl - 1]; ctx.fill();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = b.lvl <= 2 ? colors.text : colors.light;
    const img = photos[b.lvl], ir = r - 3.5;
    if (img) {
      ctx.save(); ctx.clip();
      const m = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, -ir, -ir, ir * 2, ir * 2);
      ctx.restore();
      if (b.lvl === MAX) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)"; ctx.fillRect(-r * 0.8, r * 0.35, r * 1.6, r * 0.38);
        ctx.fillStyle = "#fff"; ctx.font = `bold ${r * 0.24}px ${colors.font}`;
        ctx.fillText("Eddy Li (MIT)", 0, r * 0.55);
      }
    } else if (b.lvl === MAX) {
      ctx.font = `bold ${r * 0.42}px ${colors.font}`; ctx.fillText("Eddy Li", 0, -r * 0.12);
      ctx.font = `bold ${r * 0.3}px ${colors.font}`; ctx.fillText("MIT", 0, r * 0.3);
    } else {
      const label = String(2 ** b.lvl);
      ctx.font = `bold ${r * (label.length >= 4 ? 0.58 : label.length === 3 ? 0.7 : 0.82)}px ${colors.font}`;
      ctx.fillText(label, 0, r * 0.06);
    }
    // pole badge
    const br = Math.max(7, r * 0.3), bx = r * 0.68, by = -r * 0.68;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = pole.color; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `bold ${br * 1.3}px ${colors.font}`;
    ctx.fillText(pole.name, bx, by + br * 0.08);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- input: taps on the board, arrow keys to shove everything ----
  function ondown(e) {
    if (e.target !== canvas) return;
    e.preventDefault();
    const rect = board.getBoundingClientRect(), pad = rect.width * 0.03, s = (rect.width - 2 * pad) / S;
    tap((e.clientX - rect.left - pad) / s, (e.clientY - rect.top - pad) / s);
  }

  const KEYS = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "p" || e.key === "P") { togglePause(); return; }
    if (!KEYS[e.key]) return;
    held[KEYS[e.key]] = true;
    e.preventDefault();
  }
  function onkeyup(e) { if (KEYS[e.key]) held[KEYS[e.key]] = false; }
  function onblur() { for (const k in held) held[k] = false; }

  function hold(dir) {
    const off = () => (held[dir] = false);
    return {
      onpointerdown: e => { e.preventDefault(); held[dir] = true; },
      onpointerup: off, onpointerleave: off, onpointercancel: off,
      oncontextmenu: e => e.preventDefault(),
    };
  }

  function onvisibilitychange() {
    if (document.hidden && running()) paused = true;
    persist();
  }

  if (!restore()) newGame();

  // Look for a photo for each level in public/photos.
  for (let lvl = 1; lvl <= MAX; lvl++) {
    const exts = ["jpg", "png", "webp"];
    const tryNext = () => {
      if (!exts.length) return;
      const img = new Image();
      img.onload = () => (photos[lvl] = img);
      img.onerror = tryNext;
      img.src = `${import.meta.env.BASE_URL}photos/eddy-${lvl}.${exts.shift()}`;
    };
    tryNext();
  }

  $effect(() => {
    readColors();
    let raf, last = performance.now();
    const frame = now => {
      tick(Math.min(0.05, (now - last) / 1000));
      last = now;
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const autosave = setInterval(() => running() && persist(), 1500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(autosave);
      persist();
    };
  });
</script>

<svelte:window {onkeydown} {onkeyup} {onblur} onpagehide={persist} />
<svelte:document {onvisibilitychange} />

<GameHeader title="Magnet" {score} {best} onnew={newGame}>
  {#snippet goal()}Flip the poles to pull Eddys together and make <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="board" role="application" aria-label="Magnet board" bind:this={board} onpointerdown={ondown}>
  <canvas bind:this={canvas} aria-label="A table of magnetic Eddys"></canvas>
  {#if won && !keepGoing}
    <Overlay title="You made Eddy Li (MIT)!" won>
      <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if over}
    <Overlay title="Game over!">
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if paused}
    <Overlay title="Paused">
      <button onclick={togglePause}>Resume</button>
    </Overlay>
  {/if}
</div>

<div class="crowd" aria-label="How crowded the table is">
  <span>Crowding</span>
  <div class="bar"><div class="fill" class:hot={crowd > CROWD_LIMIT * 0.8} style="width: {Math.min(100, (crowd / CROWD_LIMIT) * 100)}%"></div></div>
</div>

<div class="controls">
  <span></span><button {...hold("up")} aria-label="Shove up">&uarr;</button><span></span>
  <button {...hold("left")} aria-label="Shove left">&larr;</button>
  <button onclick={togglePause} disabled={over}>{paused ? "Resume" : "Pause"}</button>
  <button {...hold("right")} aria-label="Shove right">&rarr;</button>
  <span></span><button {...hold("down")} aria-label="Shove down">&darr;</button><span></span>
</div>

<p class="how">
  <strong>How to play:</strong> Every Eddy is a magnet with a <span class="n">N</span> or <span class="s">S</span> pole.
  Opposite poles pull together and like poles push apart, and bigger Eddys pull harder. When two of the same
  Eddy touch, they merge into the next one, which gets a random pole. Dashed lines show matching pairs that are
  pulling toward each other. Tap an Eddy to flip its pole, tap empty table to blast Eddys apart, and hold the
  arrow keys or WASD to shove the whole board. New Eddys slide in from the edges, and if the table stays too
  crowded for 3 seconds, the game ends.
</p>

<style>
  .board {
    position: relative; width: 100%; max-width: 500px; aspect-ratio: 1; margin: 0 auto;
    background: var(--board); border-radius: 6px; touch-action: none; user-select: none;
    -webkit-user-select: none; container-type: inline-size; cursor: pointer;
  }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .crowd { display: flex; align-items: center; gap: 10px; max-width: 500px; margin: 12px auto 0; font-size: 14px; font-weight: bold; }
  .bar { flex: 1; height: 10px; background: var(--board); border-radius: 5px; overflow: hidden; }
  .fill { height: 100%; background: var(--t3); transition: width 200ms linear; }
  .fill.hot { background: var(--t6); }
  .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; max-width: 280px; margin: 12px auto 0; }
  button {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    height: 44px; padding: 0 12px; font-size: 20px; font-weight: bold; cursor: pointer;
    touch-action: manipulation; user-select: none; -webkit-user-select: none;
  }
  .controls button:not([aria-label]) { font-size: 15px; background: var(--board); }
  button:disabled { opacity: 0.5; cursor: default; }
  .how { margin-top: 28px; line-height: 1.5; }
  .n, .s { display: inline-block; color: #fff; border-radius: 50%; width: 1.4em; height: 1.4em; line-height: 1.4em;
    text-align: center; font-size: 0.8em; font-weight: bold; }
  .n { background: #d9534f; }
  .s { background: #4a7bd0; }
</style>
