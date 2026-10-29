<script>
  // Eddy Merge: the classic rules with 11 levels. Each level shows public/photos/eddy-<level>.jpg
  // (or .png/.webp) when present, otherwise its number. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { slide, spawn, canMove, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";

  const SIZE = 4, MAX = 11, KEY = "eddy-merge-v2";

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let photos = $state({});

  function newGame() {
    tiles = [];
    const first = spawn([], SIZE);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false;
    persist();
  }

  function move(dir) {
    if (over || (won && !keepGoing)) return;
    const live = tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));
    const res = slide(live, SIZE, dir, MAX);
    if (!res.moved) return;
    const next = res.tiles;
    const extra = spawn(next, SIZE);
    if (extra) next.push({ ...extra, isNew: true });
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (!canMove(next, SIZE, MAX)) over = true;
    persist();
  }

  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
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
</script>

<GameHeader title="Eddy Merge" {score} {best} onnew={newGame}>
  {#snippet goal()}Join the Eddys and get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

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
  <strong>How to play:</strong> Use your arrow keys, or swipe, to move the tiles. When two tiles with the same Eddy
  touch, they merge into the next one. Drop photos of Eddy into <code>public/photos</code> to put his face on the tiles.
</p>

<style>
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
  .how { margin-top: 28px; line-height: 1.5; }
  code { font-size: 0.85em; }
</style>
