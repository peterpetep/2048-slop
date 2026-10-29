<script>
  // A square grid of cells with absolutely placed tiles. Each tile is { id, lvl, r, c } plus
  // optional flags: isNew (pop in), merged (bump), gone (slides to its target, then is removed).
  // `tile` renders a tile's face; `overlay` draws over the board (win / game over).
  let { size = 4, tiles = [], tile, overlay, onmove, keys = true } = $props();

  const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };

  function onkeydown(e) {
    if (!keys || e.altKey || e.ctrlKey || e.metaKey) return;
    const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (dir === undefined || e.target.closest?.("input, textarea")) return;
    e.preventDefault();
    onmove?.(dir);
  }

  let start = null;
  function down(e) { start = [e.clientX, e.clientY]; }
  function up(e) {
    if (!start) return;
    const dx = e.clientX - start[0], dy = e.clientY - start[1];
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    onmove?.(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  }
</script>

<svelte:window {onkeydown} />

<div class="board" style="--n: {size}" onpointerdown={down} onpointerup={up} onpointercancel={() => (start = null)}>
  {#each { length: size * size } as _, i}
    <div class="cell" style="--r: {Math.floor(i / size)}; --c: {i % size}"></div>
  {/each}
  {#each tiles as t (t.id)}
    <div class="tile" class:new={t.isNew} class:merged={t.merged} class:gone={t.gone} style="--r: {t.r}; --c: {t.c}">
      <div class="inner">{@render tile(t)}</div>
    </div>
  {/each}
  {#if overlay}{@render overlay()}{/if}
</div>

<style>
  .board {
    --gap: 3%;
    --cell-size: calc((100% - (var(--n) + 1) * var(--gap)) / var(--n));
    position: relative; width: 100%; max-width: 500px; aspect-ratio: 1; margin: 0 auto;
    background: var(--board); border-radius: 6px; touch-action: none; user-select: none;
    container-type: inline-size;
  }
  .cell, .tile {
    position: absolute; width: var(--cell-size); height: var(--cell-size);
    left: calc(var(--gap) + var(--c) * (var(--cell-size) + var(--gap)));
    top: calc(var(--gap) + var(--r) * (var(--cell-size) + var(--gap)));
  }
  .cell { background: var(--cell); border-radius: 3px; }
  .tile { z-index: 10; transition: left 100ms ease-in-out, top 100ms ease-in-out; }
  .tile.merged { z-index: 20; }
  .tile.gone { z-index: 5; }
  .inner { width: 100%; height: 100%; border-radius: 3px; overflow: hidden; }
  .tile.new .inner { animation: appear 200ms ease 100ms backwards; }
  .tile.merged .inner { animation: pop 200ms ease 100ms backwards; }
  @keyframes appear { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
  @keyframes pop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) {
    .tile { transition: none; }
    .tile .inner { animation: none !important; }
  }
</style>
