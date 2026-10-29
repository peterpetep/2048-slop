<script>
  // Memory: the classic rules, but every tile flips face down a moment after it appears or merges.
  // Peek shows the whole board for a moment, and each peek in a game costs more than the last.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { slide, spawn, canMove, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";

  const SIZE = 4, MAX = 11, KEY = "memory-v1";
  const SHOW_MS = 1200;  // how long a new or merged tile stays face up
  const PEEK_MS = 1500;  // how long a peek shows the whole board
  const PEEK_STEP = 16;  // the first peek costs 16, the second 32, and so on

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let peeks = $state(0);
  let peekUntil = $state(0);
  let now = $state(Date.now());
  let photos = $state({});

  const ended = $derived(over || (won && !keepGoing));
  const peeking = $derived(now < peekUntil);
  const cost = $derived(PEEK_STEP * (peeks + 1));

  // `now` only needs to change when something flips back down.
  function tickAt(ms) { setTimeout(() => (now = Date.now()), ms + 20); }
  const shown = t => ({ ...t, upUntil: Date.now() + SHOW_MS });
  const isUp = t => ended || peeking || now < (t.upUntil ?? 0);

  function newGame() {
    const first = spawn([], SIZE);
    tiles = [shown({ ...first, isNew: true }), shown({ ...spawn([first], SIZE), isNew: true })];
    score = 0; won = false; keepGoing = false; over = false; peeks = 0; peekUntil = 0;
    now = Date.now(); tickAt(SHOW_MS);
    persist();
  }

  function move(dir) {
    if (ended) return;
    const live = tiles.filter(t => !t.gone).map(({ id, lvl, r, c, upUntil }) => ({ id, lvl, r, c, upUntil }));
    const res = slide(live, SIZE, dir, MAX);
    if (!res.moved) return;
    const next = res.tiles.map(t => (t.merged ? shown(t) : t));
    const extra = spawn(next, SIZE);
    if (extra) next.push(shown({ ...extra, isNew: true }));
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    now = Date.now(); tickAt(SHOW_MS);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (!canMove(next, SIZE, MAX)) over = true;
    persist();
  }

  function peek() {
    if (ended || peeking) return;
    score = Math.max(0, score - cost);
    peeks++;
    now = Date.now(); peekUntil = now + PEEK_MS; tickAt(PEEK_MS);
    persist();
  }

  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea, button")) return;
    if (e.key === "p" || e.key === "P" || e.key === " ") { e.preventDefault(); peek(); }
  }

  // Saved games come back face down, so reloading is not a free peek.
  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over, peeks });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
    peeks = saved.peeks ?? 0;
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
</script>

<svelte:window {onkeydown} />

<GameHeader title="Memory" {score} {best} onnew={newGame}>
  {#snippet goal()}Eddys hide after a moment. Merge from memory to reach <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<Board size={SIZE} {tiles} onmove={move}>
  {#snippet tile(t)}
    <div class="card" class:down={!isUp(t)}>
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
      <div class="back" aria-label="Hidden tile">?</div>
    </div>
  {/snippet}
  {#snippet overlay()}
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

<div class="peekbar">
  <span>{peeks === 1 ? "1 peek" : `${peeks} peeks`} this game</span>
  <button class="peek" onclick={peek} disabled={ended || peeking}>Peek (−{cost})</button>
</div>

<p class="how">
  <strong>How to play:</strong> Use your arrow keys, or swipe, to move the tiles. New and merged Eddys show their face
  for a second, then flip over. Two matching Eddys still merge when they touch, even face down. Press
  <strong>Peek</strong> (or P) to see the whole board, but it costs points, and more each time.
</p>

<style>
  .card { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 300ms ease; }
  .card.down { transform: rotateY(180deg); }
  .face, .back {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-weight: bold; text-align: center; backface-visibility: hidden; -webkit-backface-visibility: hidden;
  }
  .face { color: var(--light-text); }
  .face.dark { color: var(--text); }
  .back { transform: rotateY(180deg); background: var(--button); color: var(--light-text); font-size: 12cqw; }
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
  .peekbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
  .peek {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    padding: 0 20px; height: 40px; font-size: 18px; font-weight: bold; cursor: pointer;
  }
  .peek:disabled { opacity: 0.5; cursor: default; }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
</style>
