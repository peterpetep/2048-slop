<script>
  // Lasso: there's no sliding. Draw a loop around Eddys with your finger or mouse. If every Eddy inside
  // matches, they all merge into one, and bigger catches jump more levels. A sloppy loop (mixed Eddys,
  // a lone Eddy or nothing at all) wastes the move and lets two new Eddys in instead of one.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { spawn, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { caught, judge, stuck, pathLength } from "./lasso.js";

  const SIZE = 5, MAX = 11, KEY = "lasso-v1", START = 8;
  const MIN_PATH = 0.12;  // shorter scribbles (in board widths) are taps, not loops, and cost nothing

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let misses = $state(0);
  let photos = $state({});
  let loop = $state(null);  // the loop being drawn, as [x, y] points in board units
  let note = $state(null);  // { text, bad } shown under the board after each loop

  const ended = $derived(over || (won && !keepGoing));
  const live = $derived(loop && loop.length > 2 ? caught(tiles.filter(t => !t.gone), loop, SIZE) : []);
  const liveIds = $derived(new Set(live.map(t => t.id)));
  const liveGood = $derived(live.length >= 2 && live.every(t => t.lvl === live[0].lvl));

  function addTiles(list, count) {
    for (let i = 0; i < count; i++) {
      const t = spawn(list, SIZE);
      if (t) list.push({ ...t, isNew: true });
    }
    return list;
  }

  function newGame() {
    tiles = addTiles([], START);
    score = 0; won = false; keepGoing = false; over = false; misses = 0; loop = null; note = null;
    persist();
  }

  function finish(path) {
    if (ended || pathLength(path) < MIN_PATH) return;
    const now = tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));
    const res = judge(now, path, SIZE, MAX);
    let next, gone = [];
    if (res.kind === "merge") {
      const ids = new Set(res.got.map(t => t.id));
      next = now.filter(t => !ids.has(t.id));
      next.push({ id: newId(), lvl: res.lvl, r: res.keep.r, c: res.keep.c, merged: true });
      gone = res.got.map(t => ({ ...t, r: res.keep.r, c: res.keep.c, gone: true }));
      const gained = 2 ** res.lvl;
      score += gained;
      if (score > best) { best = score; save(KEY + ":best", best); }
      if (res.lvl === MAX && !won) won = true;
      note = { text: `${res.got.length} Eddys merged! +${gained}`, bad: false };
      addTiles(next, 1);
    } else {
      misses++;
      next = now;
      note = {
        text: !res.got.length ? "Missed everything! Two Eddys sneak in."
          : res.got.length === 1 ? "Just one Eddy. Two more sneak in."
          : "Sloppy loop, those don't match! Two Eddys sneak in.",
        bad: true,
      };
      addTiles(next, 2);
    }
    tiles = [...next, ...gone];
    if (gone.length) setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    if (stuck(next, SIZE, MAX)) over = true;
    persist();
  }

  // ---- drawing the loop ----
  let layer;
  const point = e => {
    const r = layer.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  function ondown(e) {
    if (ended || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    layer.setPointerCapture?.(e.pointerId);
    loop = [point(e)];
  }
  function onmove(e) {
    if (!loop) return;
    const p = point(e), last = loop[loop.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.006) loop.push(p);
  }
  function onup() {
    if (!loop) return;
    const path = $state.snapshot(loop);
    loop = null;
    finish(path);
  }

  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over, misses });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.filter(t => t.lvl >= 1 && t.lvl <= MAX).map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
    misses = saved.misses ?? 0;
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
  const svgPoints = pts => pts.map(([x, y]) => `${x * 100},${y * 100}`).join(" ");
</script>

<GameHeader title="Lasso" {score} {best} onnew={newGame}>
  {#snippet goal()}Loop matching Eddys to merge them into <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<Board size={SIZE} {tiles} keys={false}>
  {#snippet tile(t)}
    <div class="face" class:dark={t.lvl <= 2} class:in={liveIds.has(t.id)} class:good={liveGood} style="background: var(--t{t.lvl})">
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
    <div
      class="lasso" class:drawing={loop} role="application" aria-label="Draw a loop around matching Eddys"
      bind:this={layer} onpointerdown={ondown} onpointermove={onmove} onpointerup={onup} onpointercancel={() => (loop = null)}
    >
      {#if loop}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={svgPoints(loop)} class:good={liveGood} class:bad={live.length && !liveGood} />
        </svg>
      {/if}
    </div>
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
  {/snippet}
</Board>

<p class="note" class:bad={note?.bad} aria-live="polite">
  {#if note}{note.text}{:else}Draw a loop around two or more matching Eddys.{/if}
  <span class="misses">{misses === 1 ? "1 sloppy loop" : `${misses} sloppy loops`}</span>
</p>

<p class="how">
  <strong>How to play:</strong> Nothing slides here. Press on the board and draw a loop around Eddys, then let go.
  If every Eddy inside the loop matches, they all merge into one. Two or three go up one level, four to seven go
  up two, and eight or more go up three. The loop turns green while it holds a good catch and red when it doesn't.
  A sloppy loop, with mixed Eddys, a single Eddy, or nothing inside, wastes the move and lets two new Eddys in
  instead of one. The game ends when the board is full and no two Eddys match.
</p>

<style>
  .face { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    font-weight: bold; text-align: center; color: var(--light-text); transition: transform 80ms ease, box-shadow 80ms ease; }
  .face.dark { color: var(--text); }
  .face.in { transform: scale(0.9); box-shadow: inset 0 0 0 4px #d9534f; }
  .face.in.good { box-shadow: inset 0 0 0 4px #3c9a5f; }
  .num { font-size: 9cqw; line-height: 1; }
  .num.d3 { font-size: 7.5cqw; }
  .num.d4 { font-size: 6cqw; }
  .final { font-size: 4.4cqw; line-height: 1.05; display: flex; flex-direction: column; }
  .final small { font-size: 3cqw; opacity: 0.9; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .badge {
    position: absolute; left: 3px; bottom: 3px; background: rgba(0, 0, 0, 0.45); color: #fff;
    border-radius: 3px; padding: 1px 4px; font-size: 2.2cqw;
  }
  .lasso { position: absolute; inset: 0; z-index: 50; cursor: crosshair; touch-action: none; border-radius: 6px; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  polygon {
    fill: rgba(249, 246, 242, 0.18); stroke: var(--light-text); stroke-width: 3; stroke-linejoin: round;
    stroke-dasharray: 8 6; vector-effect: non-scaling-stroke;
  }
  polygon.good { stroke: #3c9a5f; fill: rgba(60, 154, 95, 0.18); }
  polygon.bad { stroke: #d9534f; fill: rgba(217, 83, 79, 0.15); }
  .note { display: flex; justify-content: space-between; gap: 12px; max-width: 500px; margin: 14px auto 0;
    font-weight: bold; min-height: 1.4em; }
  .note.bad { color: #c0453f; }
  .misses { font-weight: normal; font-size: 14px; color: var(--text); flex-shrink: 0; align-self: center; }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (prefers-reduced-motion: reduce) { .face { transition: none; } }
</style>
