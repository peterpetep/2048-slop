<script>
  // Scrambled: classic Eddy rules, but the controls reshuffle after every merge. Up might start sliding
  // left. Each key you try reveals what it does now, until the next merge scrambles them all again.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { slide, spawn, canMove, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { reshuffle, valid, IDENTITY } from "./logic.js";

  const SIZE = 4, MAX = 11, KEY = "scrambled-v1";
  const ARROWS = ["↑", "→", "↓", "←"];
  const NAMES = ["Up", "Right", "Down", "Left"];

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let map = $state([...IDENTITY]);
  let known = $state([true, true, true, true]);
  let shuffles = $state(0);
  let flash = $state(0);
  let photos = $state({});

  function newGame() {
    const first = spawn([], SIZE);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false;
    // The first board plays straight, so you learn the rules before the first scramble.
    map = [...IDENTITY]; known = [true, true, true, true]; shuffles = 0;
    persist();
  }

  function move(pressed) {
    if (over || (won && !keepGoing)) return;
    const dir = map[pressed];
    known[pressed] = true;
    const live = tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));
    const res = slide(live, SIZE, dir, MAX);
    if (!res.moved) { persist(); return; }
    const next = res.tiles;
    const extra = spawn(next, SIZE);
    if (extra) next.push({ ...extra, isNew: true });
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (res.gained > 0) {
      map = reshuffle(map);
      known = [false, false, false, false];
      shuffles++;
      flash++;
    }
    if (!canMove(next, SIZE, MAX)) over = true;
    persist();
  }

  function persist() {
    save(KEY, {
      tiles: tiles.filter(t => !t.gone).map(({ lvl, r, c }) => ({ lvl, r, c })),
      score, won, keepGoing, over, map, known, shuffles,
    });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length && valid(saved.map)) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over, map, shuffles } = saved);
    known = Array.isArray(saved.known) && saved.known.length === 4 ? saved.known : [false, false, false, false];
  } else {
    newGame();
  }

  // Look for a photo for each level in public/photos, the same files Eddy Merge uses.
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
  const found = $derived(known.filter(Boolean).length);
</script>

<GameHeader title="Scrambled" {score} {best} onnew={newGame}>
  {#snippet goal()}Every merge scrambles the controls. Get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<section class="controls" aria-live="polite">
  <div class="head">
    {#key flash}
      <span class="status" class:shook={flash > 0}>
        {#if shuffles === 0}Controls are normal, for now.{:else}Scrambled! {found} of 4 keys figured out.{/if}
      </span>
    {/key}
    <small>{shuffles} {shuffles === 1 ? "scramble" : "scrambles"}</small>
  </div>
  <ul>
    {#each ARROWS as arrow, key}
      <li class:known={known[key]}>
        <span class="key" aria-label="{NAMES[key]} key">{arrow}</span>
        <span class="eq">moves</span>
        <span class="to" aria-label={known[key] ? NAMES[map[key]] : "unknown"}>{known[key] ? ARROWS[map[key]] : "?"}</span>
      </li>
    {/each}
  </ul>
</section>

<Board size={SIZE} {tiles} onmove={move}>
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

<p class="how">
  <strong>How to play:</strong> Use your arrow keys, WASD, or swipe. It starts as normal 2048, but every move that
  merges Eddys reshuffles the controls, and no key keeps its old direction. Press a key to find out what it does
  now: the panel above the board fills in each one you try. Swipes are scrambled the same way as keys.
</p>

<style>
  .controls { max-width: 500px; margin: 0 auto 12px; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .status { font-weight: bold; display: inline-block; }
  .status.shook { animation: shake 400ms ease; color: var(--t6); }
  .head small { font-size: 13px; font-weight: bold; opacity: 0.8; white-space: nowrap; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  li {
    background: var(--board); border-radius: 3px; padding: 6px 4px; color: var(--light-text);
    display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: bold;
  }
  li.known { background: var(--button); }
  .key, .to { font-size: 22px; line-height: 1; }
  .eq { font-size: 11px; text-transform: uppercase; opacity: 0.8; }
  li:not(.known) .to { color: var(--box-label); }
  @keyframes shake {
    20% { transform: translateX(-4px) rotate(-2deg); } 40% { transform: translateX(4px) rotate(2deg); }
    60% { transform: translateX(-3px); } 80% { transform: translateX(3px); }
  }
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
    position: absolute; left: 3px; bottom: 3px; background: rgba(0, 0, 0, 0.45); color: #fff;
    border-radius: 3px; padding: 1px 5px; font-size: 2.6cqw;
  }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 420px) {
    .eq { display: none; }
    .head { font-size: 15px; }
  }
  @media (prefers-reduced-motion: reduce) { .status.shook { animation: none; } }
</style>
