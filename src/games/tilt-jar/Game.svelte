<script>
  // Tilt Jar: Eddys drop into a jar as balls. Tilt the jar so matching balls touch and merge.
  // The game ends when balls stay above the line under the lid for 3 seconds. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { load, save } from "../../lib/storage.js";
  import { W, H, DANGER_Y, MAX_TILT, makeBall, spawnBall, step, shake as kick, overflowing } from "./physics.js";

  const MAX = 11, KEY = "tilt-jar-v1", STEP = 1 / 240, OVERFLOW_SECS = 3;

  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let paused = $state(false);
  let motionOn = $state(false);

  // Physics state is plain (not reactive): the canvas redraws it every frame.
  let balls = [], spawnTimer = 0, spawned = 0, danger = 0, acc = 0;
  let tilt = 0, tiltTarget = 0, shakeCooldown = 0;
  const held = { left: false, right: false };
  let dragTilt = null, motionTilt = null;

  let canvas, board;
  const photos = {};
  const running = () => !paused && !over && !(won && !keepGoing);

  function newGame() {
    balls = [makeBall(60, H - 40, 1), makeBall(150, H - 50, 2), makeBall(240, H - 40, 1)];
    score = 0; won = false; keepGoing = false; over = false; paused = false;
    spawnTimer = 0.4; spawned = 0; danger = 0;
    persist();
  }

  function persist() {
    save(KEY, { balls: balls.map(b => [Math.round(b.x), Math.round(b.y), b.lvl]), score, won, keepGoing, over, spawned });
  }

  function restore() {
    const s = load(KEY);
    if (!Array.isArray(s?.balls)) return false;
    balls = s.balls.filter(a => a?.[2] >= 1 && a[2] <= MAX).map(([x, y, lvl]) => {
      const b = makeBall(+x || W / 2, +y || H / 2, lvl);
      b.age = 2;
      return b;
    });
    ({ score, won, keepGoing, over } = s);
    spawned = s.spawned || 0; spawnTimer = 1.5;
    return true;
  }

  function tick(dt) {
    tilt += (tiltTarget - tilt) * Math.min(1, dt * 8);
    if (shakeCooldown > 0) shakeCooldown -= dt;
    if (!running()) return;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      balls.push(spawnBall());
      spawned++;
      spawnTimer = Math.max(1.25, 2.5 - spawned * 0.012);
    }
    acc += dt;
    while (acc >= STEP) {
      const res = step(balls, STEP, tilt, MAX);
      balls = res.balls;
      for (const b of res.made) {
        score += 2 ** b.lvl;
        if (b.lvl === MAX) won = true;
      }
      acc -= STEP;
    }
    if (score > best) { best = score; save(KEY + ":best", best); }
    danger = overflowing(balls) ? danger + dt : Math.max(0, danger - dt * 2);
    if (danger > OVERFLOW_SECS) { over = true; persist(); }
  }

  function shake() {
    if (!running() || shakeCooldown > 0) return;
    shakeCooldown = 1.2;
    kick(balls, tilt);
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
    colors = { board: v("--board"), cell: v("--cell"), text: v("--text"), light: v("--light-text"),
      danger: v("--t6"), font: v("--font"), tiles: Array.from({ length: MAX }, (_, i) => v(`--t${i + 1}`)) };
  }

  function draw() {
    const ctx = canvas.getContext("2d"), dpr = devicePixelRatio || 1;
    const size = board.clientWidth;
    if (canvas.width !== Math.round(size * dpr)) canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // Fit the jar at full tilt inside the board.
    const span = W * Math.sin(MAX_TILT) + H * Math.cos(MAX_TILT) + 70;
    const s = size / Math.max(span, W * Math.cos(MAX_TILT) + H * Math.sin(MAX_TILT) + 40);
    ctx.translate(size / 2, size / 2 + 8 * s);
    ctx.scale(s, s);
    ctx.rotate(tilt);
    ctx.translate(-W / 2, -H / 2);

    // jar and lid
    ctx.fillStyle = colors.cell;
    roundRect(ctx, -6, -6, W + 12, H + 12, 10); ctx.fill();
    ctx.fillStyle = colors.light; ctx.globalAlpha = 0.55;
    roundRect(ctx, -14, -28, W + 28, 16, 4); ctx.fill();
    ctx.globalAlpha = 1;

    // danger line, flashing as the jar is about to overflow
    const warn = Math.min(1, danger / OVERFLOW_SECS);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3 + warn * 2;
    ctx.strokeStyle = warn ? colors.danger : colors.light;
    ctx.globalAlpha = warn ? 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 120)) : 0.6;
    ctx.beginPath(); ctx.moveTo(6, DANGER_Y); ctx.lineTo(W - 6, DANGER_Y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    for (const b of balls) drawBall(ctx, b);
  }

  function drawBall(ctx, b) {
    const r = b.r * (1 + 0.2 * Math.sin(b.pop * Math.PI));
    ctx.save();
    ctx.translate(b.x, b.y);
    // Keep labels upright on screen while the jar tilts.
    ctx.rotate(-tilt);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.tiles[b.lvl - 1]; ctx.fill();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = b.lvl <= 2 ? colors.text : colors.light;
    const img = photos[b.lvl];
    if (img) {
      ctx.save(); ctx.clip();
      const m = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, -r, -r, r * 2, r * 2);
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
      ctx.font = `bold ${r * (label.length >= 4 ? 0.62 : label.length === 3 ? 0.75 : 0.9)}px ${colors.font}`;
      ctx.fillText(label, 0, r * 0.06);
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---- input: keys, hold buttons, dragging across the jar, phone motion ----
  function syncTilt() {
    if (held.left !== held.right) tiltTarget = held.right ? MAX_TILT : -MAX_TILT;
    else tiltTarget = dragTilt ?? motionTilt ?? 0;
  }

  const LEFT = ["ArrowLeft", "a", "A"], RIGHT = ["ArrowRight", "d", "D"], SHAKE = [" ", "ArrowUp", "w", "W"];
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (LEFT.includes(e.key)) held.left = true;
    else if (RIGHT.includes(e.key)) held.right = true;
    else if (SHAKE.includes(e.key)) { if (!e.repeat) shake(); }
    else if (e.key === "p" || e.key === "P") { togglePause(); return; }
    else return;
    e.preventDefault();
    syncTilt();
  }
  function onkeyup(e) {
    if (LEFT.includes(e.key)) held.left = false;
    if (RIGHT.includes(e.key)) held.right = false;
    syncTilt();
  }
  function onblur() { held.left = held.right = false; dragTilt = null; syncTilt(); }

  function hold(side) {
    return {
      onpointerdown: e => { e.preventDefault(); held[side] = true; syncTilt(); },
      onpointerup: () => { held[side] = false; syncTilt(); },
      onpointerleave: () => { held[side] = false; syncTilt(); },
      onpointercancel: () => { held[side] = false; syncTilt(); },
      oncontextmenu: e => e.preventDefault(),
    };
  }

  let dragId = null;
  function dragTo(e) {
    const rect = board.getBoundingClientRect();
    const f = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2.4));
    dragTilt = f * MAX_TILT;
    syncTilt();
  }
  function down(e) {
    if (e.target !== canvas) return;
    dragId = e.pointerId;
    board.setPointerCapture(e.pointerId);
    dragTo(e);
  }
  function move(e) { if (e.pointerId === dragId) dragTo(e); }
  function up(e) { if (e.pointerId === dragId) { dragId = null; dragTilt = null; syncTilt(); } }

  const canUseMotion = typeof window !== "undefined" && "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches;
  function onorient(e) {
    if (e.gamma == null) return;
    // gamma is the phone's left/right tilt in degrees.
    motionTilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, (e.gamma * Math.PI) / 180 * 1.3));
    syncTilt();
  }
  async function toggleMotion() {
    if (motionOn) {
      removeEventListener("deviceorientation", onorient);
      motionOn = false; motionTilt = null; syncTilt();
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function" &&
          (await DeviceOrientationEvent.requestPermission()) !== "granted") return;
    } catch { return; }
    motionOn = true; motionTilt = 0;
    addEventListener("deviceorientation", onorient);
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
      removeEventListener("deviceorientation", onorient);
      persist();
    };
  });
</script>

<svelte:window {onkeydown} {onkeyup} {onblur} onpagehide={persist} />
<svelte:document {onvisibilitychange} />

<GameHeader title="Tilt Jar" {score} {best} onnew={newGame}>
  {#snippet goal()}Tilt the jar to join the Eddys and get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="board" role="application" aria-label="Tilt Jar board" bind:this={board} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <canvas bind:this={canvas} aria-label="The jar of Eddys"></canvas>
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

<div class="controls">
  <button {...hold("left")} aria-label="Tilt left">&#8630; Tilt</button>
  <button onclick={shake}>Shake</button>
  <button {...hold("right")} aria-label="Tilt right">Tilt &#8631;</button>
</div>
<div class="extras">
  {#if canUseMotion}<button onclick={toggleMotion}>{motionOn ? "Stop phone tilt" : "Tilt with my phone"}</button>{/if}
  <button onclick={togglePause} disabled={over}>{paused ? "Resume" : "Pause"}</button>
</div>

<p class="how">
  <strong>How to play:</strong> Eddys drop into the jar every couple of seconds. Hold the arrow keys or A/D to tilt
  it, or drag across the jar on a phone. When two balls with the same Eddy touch, they merge into the next one.
  Press Space to shake the jar loose. If the Eddys pile up past the dashed line for 3 seconds, the jar overflows.
</p>

<style>
  .board {
    position: relative; width: 100%; max-width: 500px; aspect-ratio: 1; margin: 0 auto;
    background: var(--board); border-radius: 6px; touch-action: none; user-select: none;
    -webkit-user-select: none; container-type: inline-size; cursor: grab;
  }
  .board:active { cursor: grabbing; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .controls { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; max-width: 500px; margin: 12px auto 0; }
  .extras { display: flex; gap: 8px; justify-content: center; margin-top: 8px; flex-wrap: wrap; }
  button {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    height: 44px; padding: 0 16px; font-size: 18px; font-weight: bold; cursor: pointer;
    touch-action: manipulation; user-select: none; -webkit-user-select: none;
  }
  .extras button { height: 36px; font-size: 15px; background: var(--board); }
  button:disabled { opacity: 0.5; cursor: default; }
  .how { margin-top: 28px; line-height: 1.5; }
</style>
