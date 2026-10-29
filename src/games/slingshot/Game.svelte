<script>
  // Slingshot: pull back the sling and fling Eddys at the pile on the ledge. A shot merges with the
  // matching Eddy it hits, right where it lands. A new Eddy drops onto the pile after every shot,
  // and the game ends when the pile stays above the dashed line for 3 seconds. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { load, save } from "../../lib/storage.js";
  import { W, H, LEDGE_X, LEDGE_Y, DANGER_Y, SLING, MAX_PULL, makeBall, radius, fire, launchVelocity,
    trajectory, nextAmmo, dropBall, step, overflowing } from "./physics.js";

  const MAX = 11, KEY = "slingshot-v1", STEP = 1 / 240, OVERFLOW_SECS = 3, RELOAD = 0.7, GUIDE_SECS = 0.2;

  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let shots = $state(0);

  // Physics state is plain (not reactive): the canvas redraws it every frame.
  let balls = [], ammo = 1, next = 1, reload = 0, danger = 0, acc = 0;
  // Pull is how far the pouch is drawn back from the sling, in world units. Keys aim by angle and power.
  let pull = null, keyAngle = Math.PI / 4, keyPower = 0.7, keyAim = false;

  let canvas, board;
  const photos = {};
  const running = () => !over && !(won && !keepGoing);

  function newGame() {
    const r = lvl => LEDGE_Y - radius(lvl);
    balls = [makeBall(215, r(1), 1), makeBall(260, r(2), 2), makeBall(315, r(3), 3), makeBall(370, r(1), 1)];
    for (const b of balls) b.age = 2;
    score = 0; won = false; keepGoing = false; over = false; shots = 0;
    ammo = nextAmmo(balls); next = nextAmmo(balls);
    reload = 0; danger = 0; pull = null; keyAim = false;
    persist();
  }

  function persist() {
    save(KEY, { balls: balls.map(b => [Math.round(b.x), Math.round(b.y), b.lvl]), score, won, keepGoing, over, shots, ammo, next });
  }

  function restore() {
    const s = load(KEY);
    if (!Array.isArray(s?.balls)) return false;
    balls = s.balls.filter(a => a?.[2] >= 1 && a[2] <= MAX).map(([x, y, lvl]) => {
      const b = makeBall(+x || 300, +y || 200, lvl);
      b.age = 2;
      return b;
    });
    ({ score, won, keepGoing, over } = s);
    shots = s.shots || 0;
    ammo = s.ammo >= 1 && s.ammo <= MAX ? s.ammo : 1;
    next = s.next >= 1 && s.next <= MAX ? s.next : 1;
    return true;
  }

  function shoot(px, py) {
    if (!running() || reload > 0 || Math.hypot(px, py) < 10) return;
    balls.push(fire(ammo, px, py));
    shots++;
    ammo = next; next = nextAmmo(balls);
    reload = RELOAD;
    setTimeout(() => running() && balls.push(dropBall()), 600);
    persist();
  }

  function tick(dt) {
    if (reload > 0) reload -= dt;
    if (!running()) return;
    acc += dt;
    while (acc >= STEP) {
      const res = step(balls, STEP, MAX);
      balls = res.balls;
      for (const b of res.made) {
        score += 2 ** b.lvl;
        if (b.lvl === MAX) won = true;
      }
      // Knocking Eddys off the ledge costs what they were worth. Clean misses are free.
      for (const b of res.lost) if (!b.shot) score = Math.max(0, score - 2 ** b.lvl);
      acc -= STEP;
    }
    if (!balls.some(b => !b.shot)) balls.push(dropBall());
    if (score > best) { best = score; save(KEY + ":best", best); }
    danger = overflowing(balls) ? danger + dt : Math.max(0, danger - dt * 2);
    if (danger > OVERFLOW_SECS) { over = true; pull = null; persist(); }
  }

  // ---- drawing ----
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    colors = { cell: v("--cell"), text: v("--text"), light: v("--light-text"), wood: v("--button"),
      danger: v("--t6"), font: v("--font"), tiles: Array.from({ length: MAX }, (_, i) => v(`--t${i + 1}`)) };
  }

  const currentPull = () => pull ?? (keyAim ? [-Math.cos(keyAngle) * keyPower * MAX_PULL, Math.sin(keyAngle) * keyPower * MAX_PULL] : null);

  function draw() {
    const ctx = canvas.getContext("2d"), dpr = devicePixelRatio || 1;
    const size = board.clientWidth, s = size / W;
    if (canvas.width !== Math.round(size * dpr)) canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ledge, and a darker pit under the sling
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, LEDGE_Y, LEDGE_X, H - LEDGE_Y);
    ctx.fillStyle = colors.cell;
    roundRect(ctx, LEDGE_X, LEDGE_Y, W - LEDGE_X + 8, H - LEDGE_Y + 8, 8); ctx.fill();

    // danger line over the ledge, flashing as the pile is about to overflow
    const warn = Math.min(1, danger / OVERFLOW_SECS);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3 + warn * 2;
    ctx.strokeStyle = warn ? colors.danger : colors.light;
    ctx.globalAlpha = warn ? 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 120)) : 0.6;
    ctx.beginPath(); ctx.moveTo(LEDGE_X, DANGER_Y); ctx.lineTo(W - 6, DANGER_Y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    drawSling(ctx);
    for (const b of balls) drawBall(ctx, b.x, b.y, b.r * (1 + 0.2 * Math.sin(b.pop * Math.PI)), b.lvl);
  }

  function drawSling(ctx) {
    const p = currentPull(), loaded = running() && reload <= 0;
    const fork = 16, top = SLING.y - 6;
    const pouch = p ? { x: SLING.x + p[0], y: SLING.y + p[1] } : { x: SLING.x, y: SLING.y };

    // post and fork
    ctx.strokeStyle = colors.wood; ctx.lineCap = "round";
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(SLING.x, H); ctx.lineTo(SLING.x, SLING.y + 34);
    ctx.lineTo(SLING.x - fork, top); ctx.moveTo(SLING.x, SLING.y + 34); ctx.lineTo(SLING.x + fork, top); ctx.stroke();

    // aiming guide: only the first moments of the arc, so judging the rest is up to you
    if (p && loaded) {
      const v = launchVelocity(p[0], p[1]);
      ctx.fillStyle = colors.light;
      trajectory(v.vx, v.vy, GUIDE_SECS, 7).forEach((pt, i) => {
        ctx.globalAlpha = 0.9 - i * 0.11;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // bands
    ctx.strokeStyle = colors.text; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(SLING.x - fork, top);
    if (loaded) ctx.lineTo(pouch.x, pouch.y); ctx.lineTo(SLING.x + fork, top); ctx.stroke();
    if (loaded) drawBall(ctx, pouch.x, pouch.y, radius(ammo), ammo);

    // next Eddy, waiting at the foot of the sling
    ctx.globalAlpha = 0.85;
    drawBall(ctx, 26, LEDGE_Y + 40, radius(next) * 0.7, next);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.light; ctx.font = `bold 11px ${colors.font}`; ctx.textAlign = "center";
    ctx.fillText("NEXT", 26, LEDGE_Y + 12);
  }

  function drawBall(ctx, x, y, r, lvl) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.tiles[lvl - 1]; ctx.fill();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = lvl <= 2 ? colors.text : colors.light;
    const img = photos[lvl];
    if (img) {
      ctx.save(); ctx.clip();
      const m = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, -r, -r, r * 2, r * 2);
      ctx.restore();
      if (lvl === MAX) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)"; ctx.fillRect(-r * 0.8, r * 0.35, r * 1.6, r * 0.38);
        ctx.fillStyle = "#fff"; ctx.font = `bold ${r * 0.24}px ${colors.font}`;
        ctx.fillText("Eddy Li (MIT)", 0, r * 0.55);
      }
    } else if (lvl === MAX) {
      ctx.font = `bold ${r * 0.42}px ${colors.font}`; ctx.fillText("Eddy Li", 0, -r * 0.12);
      ctx.font = `bold ${r * 0.3}px ${colors.font}`; ctx.fillText("MIT", 0, r * 0.3);
    } else {
      const label = String(2 ** lvl);
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

  // ---- input: drag anywhere on the board to pull the sling back, or aim with the keys ----
  let dragId = null, dragStart = null;
  const toWorld = e => {
    const rect = board.getBoundingClientRect(), s = W / rect.width;
    return [(e.clientX - rect.left) * s, (e.clientY - rect.top) * s];
  };
  function clampPull(dx, dy) {
    const len = Math.hypot(dx, dy), k = len > MAX_PULL ? MAX_PULL / len : 1;
    return [dx * k, dy * k];
  }
  function down(e) {
    if (e.target !== canvas || !running()) return;
    dragId = e.pointerId; dragStart = toWorld(e);
    board.setPointerCapture(e.pointerId);
    keyAim = false; pull = [0, 0];
  }
  function move(e) {
    if (e.pointerId !== dragId) return;
    const [x, y] = toWorld(e);
    pull = clampPull(x - dragStart[0], y - dragStart[1]);
  }
  function up(e) {
    if (e.pointerId !== dragId) return;
    dragId = null;
    const p = pull;
    pull = null;
    if (p && e.type === "pointerup") shoot(p[0], p[1]);
  }

  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !running()) return;
    const k = e.key;
    if (k === "ArrowUp" || k === "w" || k === "W") keyAngle = Math.min(1.45, keyAngle + 0.03);
    else if (k === "ArrowDown" || k === "s" || k === "S") keyAngle = Math.max(-0.6, keyAngle - 0.03);
    else if (k === "ArrowRight" || k === "d" || k === "D") keyPower = Math.min(1, keyPower + 0.015);
    else if (k === "ArrowLeft" || k === "a" || k === "A") keyPower = Math.max(0.15, keyPower - 0.015);
    else if (k === " " || k === "Enter") {
      // Leave Space and Enter to a focused button or link.
      if (e.target.closest?.("button, a")) return;
      if (!e.repeat) shoot(-Math.cos(keyAngle) * keyPower * MAX_PULL, Math.sin(keyAngle) * keyPower * MAX_PULL);
    } else return;
    keyAim = true;
    e.preventDefault();
  }

  function onvisibilitychange() { persist(); }

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

<svelte:window {onkeydown} onpagehide={persist} />
<svelte:document {onvisibilitychange} />

<GameHeader title="Slingshot" {score} {best} onnew={newGame}>
  {#snippet goal()}Fling Eddys at their twins and get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="board" role="application" aria-label="Slingshot board" tabindex="-1" bind:this={board}
  onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  <canvas bind:this={canvas} aria-label="A slingshot aimed at a pile of Eddys"></canvas>
  {#if won && !keepGoing}
    <Overlay title="You made Eddy Li (MIT)!" won>
      <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if over}
    <Overlay title="Game over!">
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {/if}
</div>

<p class="shots">Shots fired: <strong>{shots}</strong> · a new Eddy drops in after every shot</p>

<p class="how">
  <strong>How to play:</strong> Press anywhere on the board and drag back, away from where you want to shoot,
  then let go. The further you pull, the harder it flies. The dots only show the start of the flight, so judging
  the rest of the arc is up to you. When the Eddy in the sling hits the same Eddy in the pile, they merge where
  they meet. Misses fall into the pit, but any Eddy you knock off the ledge costs you its points. On a keyboard, Up/Down set the angle, Left/Right set the power, and Space
  fires. If the pile stays above the dashed line for 3 seconds, the game is over.
</p>

<style>
  .board {
    position: relative; width: 100%; max-width: 500px; aspect-ratio: 1; margin: 0 auto;
    background: var(--board); border-radius: 6px; touch-action: none; user-select: none;
    -webkit-user-select: none; container-type: inline-size; cursor: crosshair; overflow: hidden;
  }
  .board:focus { outline: none; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .shots { text-align: center; margin: 12px 0 0; font-size: 15px; }
  .how { margin-top: 28px; line-height: 1.5; }
</style>
