<script>
  // Whack-an-Eddy: Eddys pop out of holes. Whack one, then whack a matching one within a second
  // and they merge into the next Eddy. Wrong pairs cost time; merges add it back. Rules live in
  // whack.js. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { load, save } from "../../lib/storage.js";
  import { newWhack, tick, whack, shift, MAX, COLS, HOLES, WINDOW, MAX_TIME } from "./whack.js";

  const KEY = "whack-an-eddy-v1";
  // One key per hole, laid out like the board: QWER / ASDF / ZXCV.
  const KEYS = "qwerasdfzxcv";

  let g = $state(newWhack(performance.now()));
  let best = $state(load(KEY, {}).best ?? 0);
  let now = $state(performance.now());
  let started = $state(false);
  let running = $state(false);
  let keepGoing = $state(false);
  let fx = $state([]);
  let shake = $state(false);
  let photos = $state({});
  let pausedAt = performance.now(), raf;

  const left = $derived(Math.max(0, g.endAt - now));
  const halted = $derived(g.over || (g.won && !keepGoing));

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
  }

  function newGame() {
    pausedAt = performance.now();
    g = newWhack(pausedAt);
    fx = []; keepGoing = false; running = false;
    resume();
  }

  function hit(i) {
    if (!running) return;
    const t = performance.now();
    const res = whack(g, i, t);
    if (res.kind === "merge") {
      flash(i, `+${res.gained}`, "good");
      flash(i, `+${(res.bonus / 1000).toFixed(1)}s`, "time");
      if (g.score > best) { best = g.score; save(KEY, { best }); }
    } else if (res.kind === "miss") {
      flash(i, `-${res.lost / 1000}s`, "bad");
      shake = true;
      setTimeout(() => (shake = false), 300);
    }
  }

  function flash(i, text, kind) {
    const id = Math.random();
    fx = [...fx, { id, i, text, kind }];
    setTimeout(() => (fx = fx.filter(f => f.id !== id)), 700);
  }

  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea")) return;
    if (e.key === " ") {
      if (e.target.closest?.("button")) return;
      e.preventDefault();
      running ? pause() : started ? resume() : newGame();
      return;
    }
    const i = KEYS.indexOf(e.key.toLowerCase());
    if (i < 0) return;
    e.preventDefault();
    hit(i);
  }

  // Eddys rise out of their hole and sink back in.
  function rise(node, { duration = 120 } = {}) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) duration = 0;
    return { duration, css: t => `transform: translateY(${(1 - t) * 100}%)` };
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
<svelte:document onvisibilitychange={() => document.hidden && pause()} />

<GameHeader title="Whack-an-Eddy" score={g.score} {best} onnew={newGame}>
  {#snippet goal()}Whack matching Eddys within a second to reach <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="clock" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax={MAX_TIME / 1000}
  aria-valuenow={Math.ceil(left / 1000)}>
  <div class="fill" class:low={left < 8000} style="width: {(left / MAX_TIME) * 100}%"></div>
  <span>{Math.ceil(left / 1000)}s</span>
</div>

<div class="board" class:shake style="--cols: {COLS}">
  {#each { length: HOLES } as _, i}
    {@const m = g.holes[i]}
    {@const held = g.held?.i === i}
    <button class="hole" aria-label={m ? `Hole ${i + 1}, ${m.lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${m.lvl}`}` : `Hole ${i + 1}, empty`}
      onpointerdown={e => { e.preventDefault(); hit(i); }}>
      <span class="pit"></span>
      <span class="slot">
        {#if m}
          {#key m.id}
            <span class="eddy" class:held class:dark={m.lvl <= 2} style="background: var(--t{m.lvl})" transition:rise>
              {#if photos[m.lvl]}
                <img src={photos[m.lvl]} alt="" draggable="false" />
              {:else if m.lvl === MAX}
                <span class="final">MIT</span>
              {:else}
                <span class="num" class:d3={value(m.lvl) >= 100} class:d4={value(m.lvl) >= 1000}>{value(m.lvl)}</span>
              {/if}
              {#if held}
                <span class="window" style="width: {Math.max(0, (g.held.until - now) / WINDOW) * 100}%"></span>
              {/if}
            </span>
          {/key}
        {/if}
      </span>
      <span class="key">{KEYS[i].toUpperCase()}</span>
      {#each fx.filter(f => f.i === i) as f (f.id)}
        <span class="fx {f.kind}">{f.text}</span>
      {/each}
    </button>
  {/each}

  {#if g.won && !keepGoing}
    <Overlay title="You made Eddy Li (MIT)!" won>
      <button onclick={() => { keepGoing = true; resume(); }}>Keep going</button>
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if g.over}
    <Overlay title="Time's up!">
      <button onclick={newGame}>Try again</button>
    </Overlay>
  {:else if !running}
    <Overlay title={started ? "Paused" : "Ready?"}>
      <button onclick={started ? resume : newGame}>{started ? "Keep going" : "Start"}</button>
    </Overlay>
  {/if}
</div>

<p class="how">
  <strong>How to play:</strong> Eddys pop out of the holes and duck back in. Click or tap one, or press its letter,
  and it stays dazed for one second. Whack a matching Eddy before that second runs out and the two merge into the
  next Eddy. Each merge adds time to the clock, a wrong pair costs three seconds, and the Eddys get faster as you
  go. Space pauses.
</p>

<style>
  .clock {
    position: relative; height: 26px; max-width: 500px; margin: 0 auto 10px; border-radius: 3px;
    background: var(--board); overflow: hidden;
  }
  .fill { height: 100%; background: var(--t7); transition: width 100ms linear; }
  .fill.low { background: var(--t6); }
  .clock span {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; font-size: 15px; font-variant-numeric: tabular-nums;
  }

  .board {
    --gap: 3%;
    position: relative; display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 12px;
    width: 100%; max-width: 500px; margin: 0 auto; padding: 12px; background: var(--board); border-radius: 6px;
    touch-action: manipulation; user-select: none; container-type: inline-size;
  }
  .board.shake { animation: shake 300ms ease; }
  @keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

  .hole {
    position: relative; aspect-ratio: 1; padding: 0; border: 0; border-radius: 3px; cursor: pointer;
    background: var(--cell); font: inherit; color: inherit; -webkit-tap-highlight-color: transparent;
  }
  .pit {
    position: absolute; left: 10%; right: 10%; bottom: 8%; height: 24%; border-radius: 50%;
    background: rgba(119, 110, 101, 0.45);
  }
  /* The Eddy is clipped at the rim of its hole, so it looks like it pops out of it. */
  .slot { position: absolute; left: 12%; right: 12%; top: 6%; bottom: 20%; overflow: hidden; }
  .eddy {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    border-radius: 3px 3px 0 0; color: var(--light-text); font-weight: bold; overflow: hidden;
  }
  .eddy.dark { color: var(--text); }
  .eddy.held { box-shadow: inset 0 0 0 4px var(--text); }
  .num { font-size: 7cqw; line-height: 1; }
  .num.d3 { font-size: 5.6cqw; }
  .num.d4 { font-size: 4.4cqw; }
  .final { font-size: 5.6cqw; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .window { position: absolute; left: 0; bottom: 0; height: 6px; background: var(--text); }
  .key {
    position: absolute; right: 6%; bottom: 4%; font-size: 2.6cqw; font-weight: bold; opacity: 0.55;
    pointer-events: none;
  }
  @media (pointer: coarse) { .key { display: none; } }

  .fx {
    position: absolute; left: 0; right: 0; top: -8%; z-index: 30; font-weight: bold; font-size: 5cqw;
    pointer-events: none; animation: float 700ms ease-in forwards;
    text-shadow: 0 0 4px var(--page), 0 0 8px var(--page);
  }
  .fx.good { color: var(--text); }
  .fx.time { top: auto; bottom: 0; color: var(--t6); font-size: 4cqw; }
  .fx.bad { color: #c0392b; }
  @keyframes float { to { transform: translateY(-40%); opacity: 0; } }

  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 520px) { .board { gap: 8px; padding: 8px; } }
  @media (prefers-reduced-motion: reduce) {
    .board.shake, .fx { animation: none; }
    .fill { transition: none; }
  }
</style>
