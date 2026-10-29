<script>
  // Snake: steer a line of Eddy tiles around the board. Eating a tile adds it to the tail, and
  // equal neighbours merge into the next Eddy. Rules live in snake.js. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { newSnake, step, isReverse, MAX } from "./snake.js";

  const SIZE = 9, KEY = "snake-v1";

  let g = $state(newSnake(SIZE));
  let gone = $state([]);
  let best = $state(load(KEY + ":best", 0));
  let keepGoing = $state(false);
  let running = $state(false);
  let started = $state(false);
  let photos = $state({});
  let queue = [], timer;

  const tiles = $derived([
    ...g.foods.map(f => ({ ...f, food: true })),
    ...gone,
    ...g.segs.map((s, i) => (i === 0 ? { ...s, head: true } : s)),
  ]);
  const halted = $derived(g.over || (g.won && !keepGoing));
  const delay = () => Math.max(110, 260 - g.eaten * 4);

  function newGame() {
    stop();
    g = newSnake(SIZE);
    gone = []; queue = []; keepGoing = false; started = false;
    persist();
  }

  function tick() {
    if (queue.length) g.dir = queue.shift();
    const res = step(g);
    gone = res.consumed.map(t => ({ ...t, gone: true }));
    if (res.consumed.length) setTimeout(() => (gone = []), 120);
    if (g.score > best) { best = g.score; save(KEY + ":best", best); }
    persist();
    if (g.over || (g.won && !keepGoing)) stop();
    else timer = setTimeout(tick, delay());
  }

  function go() {
    if (running || halted) return;
    started = true; running = true;
    timer = setTimeout(tick, delay());
  }
  function stop() { clearTimeout(timer); running = false; }

  function steer(dir) {
    if (halted) return;
    const last = queue.length ? queue[queue.length - 1] : g.dir;
    // Turning back into your own neck is ignored, like classic Snake.
    if (dir !== last && !isReverse(dir, last) && queue.length < 3) queue.push(dir);
    go();
  }

  function onkeydown(e) {
    if (e.key !== " " || e.target.closest?.("button, input, textarea")) return;
    e.preventDefault();
    running ? stop() : go();
  }

  function persist() {
    const strip = ({ lvl, r, c }) => ({ lvl, r, c });
    save(KEY, { segs: g.segs.map(strip), foods: g.foods.map(strip), dir: g.dir, score: g.score,
      eaten: g.eaten, won: g.won, over: g.over, keepGoing });
  }

  const saved = load(KEY);
  if (saved?.segs?.length) {
    const withId = t => ({ ...t, id: newId() });
    g = { ...saved, size: SIZE, segs: saved.segs.map(withId), foods: saved.foods.map(withId) };
    keepGoing = !!saved.keepGoing;
    started = true;
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

  $effect(() => stop);

  const value = lvl => 2 ** lvl;
</script>

<svelte:window {onkeydown} />
<svelte:document onvisibilitychange={() => document.hidden && stop()} />

<GameHeader title="Snake" score={g.score} {best} onnew={newGame}>
  {#snippet goal()}Eat Eddys, merge your tail, and grow into <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="snake">
  <Board size={SIZE} {tiles} onmove={steer}>
    {#snippet tile(t)}
      <div class="face" class:dark={t.lvl <= 2} class:food={t.food} class:head={t.head} style="background: var(--t{t.lvl})">
        {#if photos[t.lvl]}
          <img src={photos[t.lvl]} alt={t.lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${t.lvl}`} draggable="false" />
        {:else if t.lvl === MAX}
          <span class="final">MIT</span>
        {:else}
          <span class="num" class:d3={value(t.lvl) >= 100} class:d4={value(t.lvl) >= 1000}>{value(t.lvl)}</span>
        {/if}
      </div>
    {/snippet}
    {#snippet overlay()}
      {#if g.won && !keepGoing}
        <Overlay title="You made Eddy Li (MIT)!" won>
          <button onclick={() => { keepGoing = true; persist(); go(); }}>Keep going</button>
          <button onclick={newGame}>Try again</button>
        </Overlay>
      {:else if g.over}
        <Overlay title="Game over!">
          <button onclick={newGame}>Try again</button>
        </Overlay>
      {:else if !running}
        <div class="hint">{started ? "Paused. Press an arrow to keep going." : "Press an arrow or swipe to start."}</div>
      {/if}
    {/snippet}
  </Board>
</div>

<div class="pad" aria-label="Steer">
  <button class="u" aria-label="Up" onpointerdown={e => { e.preventDefault(); steer(0); }}>&uarr;</button>
  <button class="l" aria-label="Left" onpointerdown={e => { e.preventDefault(); steer(3); }}>&larr;</button>
  <button class="d" aria-label="Down" onpointerdown={e => { e.preventDefault(); steer(2); }}>&darr;</button>
  <button class="r" aria-label="Right" onpointerdown={e => { e.preventDefault(); steer(1); }}>&rarr;</button>
</div>

<p class="how">
  <strong>How to play:</strong> Steer with the arrow keys, or swipe. Eating an Eddy adds it to your tail, and when two
  matching Eddys sit side by side they merge into the next one. Hitting a wall or biting yourself ends the game.
  Space pauses.
</p>

<style>
  /* Tighter gaps than the 4x4 board, so a 9x9 grid of tiles stays readable. */
  .snake :global(.board) { --gap: 1.2%; }
  .snake :global(.board .tile) { transition-timing-function: linear; }
  .face {
    position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center; border-radius: 3px;
  }
  .face.dark { color: var(--text); }
  .face.head { box-shadow: inset 0 0 0 3px var(--text); }
  .face.food { transform: scale(0.72); border-radius: 50%; box-shadow: 0 0 0 3px rgba(119, 110, 101, 0.35); }
  .num { font-size: 4.6cqw; line-height: 1; }
  .num.d3 { font-size: 3.7cqw; }
  .num.d4 { font-size: 2.9cqw; }
  .final { font-size: 3.6cqw; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .hint {
    position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); z-index: 50; white-space: nowrap;
    background: rgba(238, 228, 218, 0.9); border-radius: 3px; padding: 8px 14px; font-weight: bold; font-size: 15px;
  }
  .pad { display: none; grid-template-columns: repeat(3, 64px); grid-template-rows: repeat(2, 52px);
    gap: 6px; justify-content: center; margin-top: 16px; }
  .pad button { background: var(--board); color: var(--light-text); border: 0; border-radius: 3px; font-size: 24px;
    font-weight: bold; touch-action: none; }
  .pad .u { grid-column: 2; }
  .pad .l { grid-column: 1; grid-row: 2; }
  .pad .d { grid-column: 2; grid-row: 2; }
  .pad .r { grid-column: 3; grid-row: 2; }
  @media (pointer: coarse) { .pad { display: grid; } }
  .how { margin-top: 28px; line-height: 1.5; }
</style>
