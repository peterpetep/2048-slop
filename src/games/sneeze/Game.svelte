<script>
  // Sneeze: hold to build up a sneeze, aim it, and let go to blast every Eddy across the board.
  // A bigger sneeze sends tiles further and scatters them more. Hold too long and it goes off on its own,
  // in a random direction. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { spawn, canMove, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { sneeze } from "./sneeze.js";

  const SIZE = 4, MAX = 11, KEY = "sneeze-v1";
  const CHARGE_SECS = 1.2, BURST_SECS = 2.6, OVERCHARGE = 1.35, BLAST_MS = 300;
  const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
  const ARROWS = ["↑", "→", "↓", "←"];

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let photos = $state({});

  // Charging: aim is a direction (0-3) or null until the player picks one.
  let charging = $state(false);
  let power = $state(0);
  let aim = $state(null);
  let shout = $state(null);
  let hint = $state("");
  let chargeStart = 0, heldKey = null, origin = null, frame = 0, shoutTimer = 0;

  const playing = () => !over && !(won && !keepGoing);

  function newGame() {
    cancel();
    const first = spawn([], SIZE);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false;
    persist();
  }

  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over });
  }

  function startCharge() {
    if (charging || !playing()) return;
    charging = true; power = 0; hint = "";
    chargeStart = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!charging) return;
    const secs = (now - chargeStart) / 1000;
    power = Math.min(1, secs / CHARGE_SECS);
    // Held it too long: the sneeze escapes, extra hard, wherever it wants.
    if (secs >= BURST_SECS) return blow(Math.floor(Math.random() * 4), OVERCHARGE, "Couldn't hold it!");
    frame = requestAnimationFrame(tick);
  }

  function cancel() {
    cancelAnimationFrame(frame);
    charging = false; power = 0; aim = null; heldKey = null; origin = null;
  }

  function release() {
    if (!charging) return;
    if (aim === null) { cancel(); hint = "Drag while you hold to aim the sneeze."; return; }
    blow(aim, Math.max(power, 0.05));
  }

  function blow(dir, strength, msg = "") {
    cancel();
    say(strength >= 1 ? "ACHOO!" : strength >= 0.5 ? "Achoo!" : "achoo", msg);
    if (!playing()) return;
    const live = tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));
    const res = sneeze(live, SIZE, dir, strength, Math.random, MAX);
    if (!res.moved) return;
    const next = res.tiles;
    const extra = spawn(next, SIZE);
    if (extra) next.push({ ...extra, isNew: true });
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), BLAST_MS);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (!canMove(next, SIZE, MAX)) over = true;
    persist();
  }

  function say(word, msg) {
    shout = { word, msg, id: Math.random() };
    clearTimeout(shoutTimer);
    shoutTimer = setTimeout(() => (shout = null), 900);
  }

  // ---- input: hold an arrow key (or WASD), or press and drag on the board ----
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea")) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dir = KEYS[k];
    if (dir === undefined) return;
    e.preventDefault();
    if (e.repeat) return;
    startCharge();
    if (!charging) return;
    aim = dir; heldKey = k;
  }

  function onkeyup(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (charging && k === heldKey) release();
  }

  function down(e) {
    if (e.button > 0) return;
    startCharge();
    if (!charging) return;
    origin = [e.clientX, e.clientY];
    aim = null;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function drag(e) {
    if (!charging || !origin) return;
    const dx = e.clientX - origin[0], dy = e.clientY - origin[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    aim = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  }

  function up() {
    if (origin) release();
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.filter(t => t?.lvl >= 1 && t.lvl <= MAX).map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
  } else {
    newGame();
  }

  // Look for a photo for each level in public/photos.
  for (let lvl = 1; lvl <= MAX; lvl++) {
    const exts = ["jpg", "png", "webp"];
    const tryNext = () => {
      if (!exts.length) return;
      const src = `${import.meta.env.BASE_URL}photos/eddy-${lvl}.${exts.shift()}`;
      const img = new Image();
      img.onload = () => (photos[lvl] = src);
      img.onerror = tryNext;
      img.src = src;
    };
    tryNext();
  }

  const value = lvl => 2 ** lvl;
  const label = $derived(
    !charging ? "Hold to build a sneeze" :
    power < 0.34 ? "Ah…" : power < 0.67 ? "Ah… ah…" : power < 1 ? "Ah… ah… AH…" : "AH… AH… AAAH…"
  );
</script>

<svelte:window {onkeydown} {onkeyup} onblur={cancel} />

<GameHeader title="Sneeze" {score} {best} onnew={newGame}>
  {#snippet goal()}Blow the Eddys together and get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div
  class="wrap"
  class:charging
  class:full={power >= 1}
  style="--amp: {power * 3}px"
  onpointerdown={down}
  onpointermove={drag}
  onpointerup={up}
  onpointercancel={cancel}
  role="application"
  aria-label="Sneeze board. Hold an arrow key to charge a sneeze, then let go."
>
  <Board size={SIZE} {tiles} keys={false}>
    {#snippet tile(t)}
      <div class="face" class:dark={t.lvl <= 2} style="background: var(--t{t.lvl})">
        {#if photos[t.lvl]}
          <img src={photos[t.lvl]} alt={t.lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${t.lvl}`} draggable="false" />
          <span class="badge">{t.lvl === MAX ? "Eddy Li (MIT)" : value(t.lvl)}</span>
        {:else if t.lvl === MAX}
          <span class="final">Eddy Li<small>MIT</small></span>
        {:else}
          <span class="num" class:d3={value(t.lvl) >= 100} class:d4={value(t.lvl) >= 1000}>{value(t.lvl)}</span>
        {/if}
      </div>
    {/snippet}
    {#snippet overlay()}
      {#if charging && aim !== null}
        <div class="aim" style="--s: {0.6 + power * 0.8}" aria-hidden="true">{ARROWS[aim]}</div>
      {/if}
      {#if shout}
        {#key shout.id}
          <div class="shout" aria-live="polite">
            <span>{shout.word}</span>
            {#if shout.msg}<small>{shout.msg}</small>{/if}
          </div>
        {/key}
      {/if}
      {#if won && !keepGoing}
        <Overlay title="You sneezed up Eddy Li (MIT)!" won>
          <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
          <button onclick={newGame}>Try again</button>
        </Overlay>
      {:else if over}
        <Overlay title="Game over!">
          <button onclick={newGame}>Try again</button>
        </Overlay>
      {/if}
    {/snippet}
  </Board>
</div>

<div class="meter" aria-hidden="true">
  <div class="fill" style="width: {power * 100}%"></div>
  <span>{label}</span>
</div>
{#if hint}<p class="hint">{hint}</p>{/if}

<p class="how">
  <strong>How to play:</strong> Hold an arrow key (or WASD) to build up a sneeze, then let go to blast every tile
  that way. On a phone, press and hold the board, drag to aim, and let go. A small sneeze nudges each tile one
  space. A big one throws them across the board, but each tile flies its own distance and some get knocked
  sideways. Matching Eddys merge where they land. Hold it too long and the sneeze goes off on its own, in a
  random direction.
</p>

<style>
  .wrap { position: relative; max-width: 500px; margin: 0 auto; touch-action: none; cursor: grab; }
  .wrap.charging { cursor: grabbing; animation: shake 80ms linear infinite; }
  .wrap.full { animation-duration: 50ms; }
  @keyframes shake {
    25% { transform: translate(var(--amp), calc(var(--amp) * -0.5)); }
    50% { transform: translate(calc(var(--amp) * -0.7), var(--amp)); }
    75% { transform: translate(calc(var(--amp) * 0.4), calc(var(--amp) * -1)); }
  }
  /* Tiles fly slower than a normal slide, and ease out as they land. */
  .wrap :global(.tile) { transition: left 300ms cubic-bezier(0.15, 0.85, 0.3, 1), top 300ms cubic-bezier(0.15, 0.85, 0.3, 1); }

  .face {
    position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center;
  }
  .face.dark { color: var(--text); }
  .num { font-size: 11cqw; line-height: 1; }
  .num.d3 { font-size: 9cqw; }
  .num.d4 { font-size: 7cqw; }
  .final { font-size: 5.4cqw; line-height: 1.05; display: flex; flex-direction: column; }
  .final small { font-size: 3.6cqw; opacity: 0.9; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .badge {
    position: absolute; left: 4px; bottom: 4px; background: rgba(0, 0, 0, 0.45); color: #fff;
    border-radius: 3px; padding: 1px 5px; font-size: 2.6cqw;
  }

  .aim {
    position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
    font-size: 40cqw; font-weight: bold; color: var(--t6); opacity: 0.55; pointer-events: none;
    transform: scale(var(--s));
  }
  .shout {
    position: absolute; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center;
    justify-content: center; pointer-events: none; color: var(--light-text);
    text-shadow: 0 2px 0 var(--t6), 0 0 18px rgba(0, 0, 0, 0.25); animation: boom 900ms ease-out forwards;
  }
  .shout span { font-size: 16cqw; font-weight: bold; line-height: 1; }
  .shout small { font-size: 5cqw; font-weight: bold; margin-top: 6px; }
  @keyframes boom {
    0% { transform: scale(0.4); opacity: 0; }
    15% { transform: scale(1.15); opacity: 1; }
    70% { opacity: 1; }
    100% { transform: scale(1.3); opacity: 0; }
  }

  .meter {
    position: relative; max-width: 500px; height: 34px; margin: 14px auto 0; border-radius: 3px;
    background: var(--board); overflow: hidden; display: flex; align-items: center; justify-content: center;
  }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, var(--t3), var(--t6)); }
  .meter span { position: relative; color: var(--light-text); font-weight: bold; font-size: 16px; }
  .hint { text-align: center; margin: 10px 0 0; font-size: 15px; }
  .how { margin-top: 28px; line-height: 1.5; }

  @media (prefers-reduced-motion: reduce) {
    .wrap.charging, .shout { animation: none; }
    .wrap :global(.tile) { transition: none; }
  }
</style>
