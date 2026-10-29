<script>
  // Hex Hive: the classic rules on a 19-cell honeycomb, with six directions to slide in.
  // Tiles use the same 11 Eddy levels and public/photos as Eddy Merge. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { cells, center, inside, slide, spawn, canMove, dirFromSwipe } from "./hex.js";

  const RADIUS = 2, MAX = 11, KEY = "hex-hive-v1";
  const CELLS = cells(RADIUS);
  const H = Math.sqrt(3);

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let photos = $state({});

  function newGame() {
    tiles = [];
    const first = spawn([], RADIUS);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], RADIUS), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false;
    persist();
  }

  function move(dir) {
    if (over || (won && !keepGoing)) return;
    const live = tiles.filter(t => !t.gone).map(({ id, lvl, q, r }) => ({ id, lvl, q, r }));
    const res = slide(live, RADIUS, dir, MAX);
    if (!res.moved) return;
    const next = res.tiles;
    const extra = spawn(next, RADIUS);
    if (extra) next.push({ ...extra, isNew: true });
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (!canMove(next, RADIUS, MAX)) over = true;
    persist();
  }

  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ lvl, q, r }) => ({ lvl, q, r })), score, won, keepGoing, over });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.filter(t => inside(t.q, t.r, RADIUS)).map(t => ({ ...t, id: newId() }));
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

  // The hive is 8 hex-sizes wide and 5·√3 tall; each cell box is 2 wide and √3 tall.
  function pos(q, r) {
    const [x, y] = center(q, r);
    return `left: ${(x + 3) / 8 * 100}%; top: ${(y / H + 2) / 5 * 100}%`;
  }

  // Q W E for the top three directions, A S D for the bottom three.
  const KEYS = { w: 0, e: 1, d: 2, s: 3, a: 4, q: 5, ArrowUp: 0, ArrowDown: 3 };
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (dir === undefined || e.target.closest?.("input, textarea")) return;
    e.preventDefault();
    move(dir);
  }

  let start = null;
  function down(e) { start = [e.clientX, e.clientY]; }
  function up(e) {
    if (!start) return;
    const dx = e.clientX - start[0], dy = e.clientY - start[1];
    start = null;
    if (Math.hypot(dx, dy) < 20) return;
    move(dirFromSwipe(dx, dy));
  }

  const PAD = [
    { dir: 5, label: "Up-left", arrow: "↖", area: "1 / 1" },
    { dir: 0, label: "Up", arrow: "↑", area: "1 / 2" },
    { dir: 1, label: "Up-right", arrow: "↗", area: "1 / 3" },
    { dir: 4, label: "Down-left", arrow: "↙", area: "2 / 1" },
    { dir: 3, label: "Down", arrow: "↓", area: "2 / 2" },
    { dir: 2, label: "Down-right", arrow: "↘", area: "2 / 3" },
  ];

  const value = lvl => 2 ** lvl;
</script>

<svelte:window {onkeydown} />

<GameHeader title="Hex Hive" {score} {best} onnew={newGame}>
  {#snippet goal()}Six ways to slide. Get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="board" onpointerdown={down} onpointerup={up} onpointercancel={() => (start = null)}>
  <div class="hive">
    {#each CELLS as [q, r]}
      <div class="slot" style={pos(q, r)}><div class="hex cell"></div></div>
    {/each}
    {#each tiles as t (t.id)}
      <div class="slot tile" class:new={t.isNew} class:merged={t.merged} class:gone={t.gone} style={pos(t.q, t.r)}>
        <div class="hex face" class:dark={t.lvl <= 2} style="background: var(--t{t.lvl})">
          {#if photos[t.lvl]}
            <img src={photos[t.lvl]} alt={t.lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${t.lvl}`} draggable="false" />
            <span class="badge">{t.lvl === MAX ? "MIT" : value(t.lvl)}</span>
          {:else if t.lvl === MAX}
            <span class="final">Eddy Li<small>MIT</small></span>
          {:else}
            <span class="num" class:d3={value(t.lvl) >= 100} class:d4={value(t.lvl) >= 1000}>{value(t.lvl)}</span>
          {/if}
        </div>
      </div>
    {/each}
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
</div>

<div class="pad">
  {#each PAD as p (p.dir)}
    <button style="grid-area: {p.area}" aria-label="Slide {p.label}" onclick={() => move(p.dir)}>{p.arrow}</button>
  {/each}
</div>

<p class="how">
  <strong>How to play:</strong> Swipe in any of six directions, or use <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> for
  up-left, up and up-right and <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> for down-left, down and down-right. When two
  tiles with the same Eddy touch, they merge into the next one.
</p>

<style>
  .board {
    position: relative; width: 100%; max-width: 500px; margin: 0 auto; padding: 3%;
    background: var(--board); border-radius: 6px; touch-action: none; user-select: none;
    container-type: inline-size;
  }
  .hive { position: relative; width: 100%; aspect-ratio: 8 / 8.66; }
  .slot { position: absolute; width: 25%; height: 20%; }
  .hex {
    position: absolute; inset: 3%;
    clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
  }
  .cell { background: var(--cell); }
  .tile { z-index: 10; transition: left 100ms ease-in-out, top 100ms ease-in-out; }
  .tile.merged { z-index: 20; }
  .tile.gone { z-index: 5; }
  .tile.new .hex { animation: appear 200ms ease 100ms backwards; }
  .tile.merged .hex { animation: pop 200ms ease 100ms backwards; }
  @keyframes appear { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
  @keyframes pop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }

  .face {
    display: flex; align-items: center; justify-content: center; overflow: hidden;
    color: var(--light-text); font-weight: bold; text-align: center;
  }
  .face.dark { color: var(--text); }
  .num { font-size: 9cqw; line-height: 1; }
  .num.d3 { font-size: 7.5cqw; }
  .num.d4 { font-size: 6cqw; }
  .final { font-size: 4.6cqw; line-height: 1.05; display: flex; flex-direction: column; }
  .final small { font-size: 3.2cqw; opacity: 0.9; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .badge {
    position: absolute; bottom: 4%; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.45);
    color: #fff; border-radius: 3px; padding: 1px 5px; font-size: 2.6cqw;
  }

  .pad {
    display: grid; grid-template-columns: repeat(3, 64px); grid-template-rows: repeat(2, 40px);
    gap: 6px; justify-content: center; margin-top: 18px;
  }
  .pad button {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    font-size: 20px; font-weight: bold; cursor: pointer;
  }
  .how { margin-top: 24px; line-height: 1.5; }
  kbd {
    font-family: inherit; font-size: 0.85em; font-weight: bold; background: var(--t1);
    border-radius: 3px; padding: 0 5px;
  }
  @media (prefers-reduced-motion: reduce) {
    .tile { transition: none; }
    .tile .hex { animation: none !important; }
  }
</style>
