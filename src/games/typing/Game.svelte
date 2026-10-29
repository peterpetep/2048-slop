<script>
  // Typing: every Eddy wears a word. Type it and that Eddy fires at the nearest matching Eddy, and
  // the two merge. New Eddys keep landing, faster as you go, until the board fills. Rules live in
  // typing.js. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { load, save } from "../../lib/storage.js";
  import { newTyping, tick, fire, fits, find, shift, spawnEvery, MAX, SIZE, CELLS } from "./typing.js";

  const KEY = "typing-v1";

  let g = $state(newTyping(performance.now()));
  let best = $state(load(KEY, {}).best ?? 0);
  let typed = $state("");
  let now = $state(performance.now());
  let started = $state(false);
  let running = $state(false);
  let keepGoing = $state(false);
  let shots = $state([]);
  let fx = $state([]);
  let shake = $state(false);
  let photos = $state({});
  let field;
  let pausedAt = performance.now(), raf;

  const halted = $derived(g.over || (g.won && !keepGoing));
  const untilSpawn = $derived(Math.max(0, g.nextSpawn - now));

  function frame(t) {
    if (running) {
      tick(g, t);
      now = t;
      if (halted) pause();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  $effect(() => () => cancelAnimationFrame(raf));

  function pause() {
    if (!running) return;
    running = false;
    pausedAt = performance.now();
  }
  function resume() {
    if (running || halted) return;
    const t = performance.now();
    shift(g, t - pausedAt);
    now = t; started = true; running = true;
    field?.focus();
  }

  function newGame() {
    pausedAt = performance.now();
    g = newTyping(pausedAt);
    typed = ""; shots = []; fx = []; keepGoing = false; running = false;
    resume();
  }

  // Keep only the letters typed so far that still spell the start of some word on the board.
  function oninput(e) {
    const raw = e.target.value.toLowerCase().replace(/[^a-z]/g, "");
    if (!running) { e.target.value = typed; return; }
    if (raw.length > typed.length && !fits(g, raw)) {
      e.target.value = typed;
      oops();
      return;
    }
    typed = raw;
    const i = find(g, typed);
    if (i >= 0) shoot(i);
  }

  function onkeydown(e) {
    if (e.key === "Escape" || e.key === " ") {
      e.preventDefault();
      running ? pause() : started ? resume() : newGame();
    } else if (e.key === "Enter") {
      e.preventDefault();
      clear();
    }
  }

  function clear() {
    typed = "";
    if (field) field.value = "";
  }

  function oops() {
    shake = true;
    setTimeout(() => (shake = false), 250);
  }

  function shoot(i) {
    const lvl = g.cells[i].lvl;
    const res = fire(g, i, performance.now());
    clear();
    if (res.kind === "merge") {
      const id = Math.random();
      const dx = (res.to % SIZE) - (i % SIZE), dy = Math.floor(res.to / SIZE) - Math.floor(i / SIZE);
      shots = [...shots, { id, i, lvl, dx, dy }];
      setTimeout(() => (shots = shots.filter(s => s.id !== id)), 220);
      flash(res.to, `+${res.gained}`, "good");
      if (g.score > best) { best = g.score; save(KEY, { best }); }
    } else if (res.kind === "dud") {
      flash(i, "No match!", "bad");
      oops();
    }
  }

  function flash(i, text, kind) {
    const id = Math.random();
    fx = [...fx, { id, i, text, kind }];
    setTimeout(() => (fx = fx.filter(f => f.id !== id)), 700);
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
  const color = lvl => (lvl > MAX ? "var(--t-super)" : `var(--t${lvl})`);
</script>

<svelte:document onvisibilitychange={() => document.hidden && pause()} />

<GameHeader title="Typing" score={g.score} {best} onnew={newGame}>
  {#snippet goal()}Type an Eddy's word to fire it at its match. Reach <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="clock" role="progressbar" aria-label="Next Eddy lands in" aria-valuemin="0"
  aria-valuemax={spawnEvery(g)} aria-valuenow={Math.round(untilSpawn)}>
  <div class="fill" class:low={g.cells.filter(Boolean).length >= CELLS - 3}
    style="width: {Math.min(1, untilSpawn / spawnEvery(g)) * 100}%"></div>
  <span>Next Eddy in {(untilSpawn / 1000).toFixed(1)}s</span>
</div>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="board" role="presentation" style="--size: {SIZE}" onclick={() => field?.focus()}>
  {#each g.cells as t, i}
    <div class="cell">
      {#if t}
        {#key t.id}
          <div class="tile" class:dark={t.lvl <= 2} style="background: {color(t.lvl)}">
            {#if photos[t.lvl]}
              <img src={photos[t.lvl]} alt="" draggable="false" />
            {:else if t.lvl === MAX}
              <span class="final">MIT</span>
            {:else}
              <span class="num" class:d3={value(t.lvl) >= 100} class:d4={value(t.lvl) >= 1000}>{value(t.lvl)}</span>
            {/if}
            <span class="word" class:hot={typed && t.word.startsWith(typed)}
              aria-label={`${t.lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${t.lvl}`}, word ${t.word}`}>
              {#if typed && t.word.startsWith(typed)}<mark>{typed}</mark>{t.word.slice(typed.length)}{:else}{t.word}{/if}
            </span>
          </div>
        {/key}
      {/if}
      {#each fx.filter(f => f.i === i) as f (f.id)}
        <span class="fx {f.kind}">{f.text}</span>
      {/each}
    </div>
  {/each}

  <div class="shots">
    {#each shots as s (s.id)}
      <div class="shot" style="grid-area: {Math.floor(s.i / SIZE) + 1} / {(s.i % SIZE) + 1}; --dx: {s.dx}; --dy: {s.dy};
        background: {color(s.lvl)}"></div>
    {/each}
  </div>

  {#if g.won && !keepGoing}
    <Overlay title="You made Eddy Li (MIT)!" won>
      <button onclick={() => { keepGoing = true; resume(); }}>Keep going</button>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if g.over}
    <Overlay title="Board's full!">
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if !running}
    <Overlay title={started ? "Paused" : "Ready?"}>
      <button onclick={started ? resume : newGame}>{started ? "Keep going" : "Start"}</button>
    </Overlay>
  {/if}
</div>

<label class="typer" class:shake>
  <span class="sr">Type a word</span>
  <input bind:this={field} {oninput} {onkeydown} placeholder={running ? "type a word…" : "press Space to start"}
    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
</label>

<p class="how">
  <strong>How to play:</strong> Every Eddy has a LinkedIn word on it. Type a word and that Eddy flies into the
  nearest Eddy of the same level, and the two merge into the next Eddy. Letters that don't spell any word on the
  board are ignored, and Enter clears what you've typed. Firing an Eddy with no match is a dud and brings the next
  Eddy sooner. A new Eddy lands every couple of seconds, faster as you merge, and bigger Eddys wear longer words.
  The game ends when an Eddy has nowhere to land. Space or Escape pauses.
</p>

<style>
  .clock {
    position: relative; height: 26px; max-width: 500px; margin: 0 auto 10px; border-radius: 3px;
    background: var(--board); overflow: hidden;
  }
  .fill { height: 100%; background: var(--t7); }
  .fill.low { background: var(--t6); }
  .clock span {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; font-size: 15px; font-variant-numeric: tabular-nums;
  }

  .board {
    --gap: 12px;
    position: relative; display: grid; grid-template-columns: repeat(var(--size), 1fr);
    grid-template-rows: repeat(var(--size), 1fr); gap: var(--gap);
    width: 100%; max-width: 500px; margin: 0 auto; padding: var(--gap); background: var(--board); border-radius: 6px;
    user-select: none; container-type: inline-size; cursor: text;
  }
  .cell { position: relative; aspect-ratio: 1; border-radius: 3px; background: var(--cell); }
  .tile {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    border-radius: 3px; color: var(--light-text); font-weight: bold; overflow: hidden;
    animation: pop 180ms ease;
  }
  .tile.dark { color: var(--text); }
  @keyframes pop { from { transform: scale(0.3); } }
  .num { font-size: 8cqw; line-height: 1; margin-bottom: 18%; }
  .num.d3 { font-size: 6.4cqw; }
  .num.d4 { font-size: 5cqw; }
  .final { font-size: 6cqw; margin-bottom: 18%; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .word {
    position: absolute; left: 6%; right: 6%; bottom: 7%; padding: 2px 0; border-radius: 3px;
    background: rgba(249, 246, 242, 0.92); color: var(--text); text-align: center;
    font: bold 3.6cqw/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: 0.02em;
  }
  .word.hot { box-shadow: 0 0 0 3px var(--text); }
  mark { background: none; color: var(--t6); }

  .shots {
    position: absolute; inset: var(--gap); z-index: 20; pointer-events: none; display: grid; gap: var(--gap);
    grid-template-columns: repeat(var(--size), 1fr); grid-template-rows: repeat(var(--size), 1fr);
  }
  .shot { border-radius: 3px; pointer-events: none; opacity: 0.9;
    animation: fly 200ms ease-in forwards;
  }
  @keyframes fly {
    to { transform: translate(calc(var(--dx) * (100% + var(--gap))), calc(var(--dy) * (100% + var(--gap)))) scale(0.6); }
  }

  .fx {
    position: absolute; left: 0; right: 0; top: 10%; z-index: 30; text-align: center; font-weight: bold;
    font-size: 5cqw; pointer-events: none; animation: float 700ms ease-in forwards;
    text-shadow: 0 0 4px var(--page), 0 0 8px var(--page);
  }
  .fx.good { color: var(--text); }
  .fx.bad { color: #c0392b; font-size: 4cqw; }
  @keyframes float { to { transform: translateY(-60%); opacity: 0; } }

  .typer { display: block; max-width: 500px; margin: 14px auto 0; }
  .typer.shake { animation: shake 250ms ease; }
  @keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
  input {
    width: 100%; height: 48px; padding: 0 14px; border: 3px solid var(--board); border-radius: 6px;
    background: white; color: var(--text); font: bold 22px ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    text-align: center;
  }
  input:focus { outline: none; border-color: var(--button); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 520px) {
    .board { --gap: 8px; }
    .word { font-size: 4.2cqw; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tile, .shot, .fx, .typer.shake { animation: none; }
    .shot { display: none; }
  }
</style>
