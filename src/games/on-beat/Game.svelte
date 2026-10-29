<script>
  // On Beat: classic rules, but a move only counts on the beat. An off-beat move drops a junk tile
  // that never merges and clears after a few on-beat moves. The tempo climbs with the score.
  import { onDestroy } from "svelte";
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { slide, spawn, canMove, emptyCells, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { bpmFor, multFor, judge, JUNK_LIFE } from "./beat.js";

  const SIZE = 4, MAX = 11, KEY = "on-beat-v1";

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let streak = $state(0);
  let running = $state(false);
  let light = $state(-1);
  let flash = $state("");
  let call = $state(null);
  let sound = $state(load(KEY + ":sound", true));
  let photos = $state({});

  const bpm = $derived(bpmFor(score));
  const mult = $derived(multFor(streak));
  const blocked = $derived(over || (won && !keepGoing));

  // Junk tiles get a unique negative level, so the shared engine never merges them.
  const isJunk = t => t.lvl < 0;
  const junk = (r, c) => ({ id: newId(), lvl: -newId(), ttl: JUNK_LIFE, r, c, isNew: true });

  function newGame() {
    stop();
    const first = spawn([], SIZE);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
    score = 0; streak = 0; won = false; keepGoing = false; over = false;
    persist();
  }

  // ---- the beat ----
  // Beats are tracked on performance.now(); each frame checks whether the next one has arrived.
  let last = 0, next = 0, beatNo = 0, used = -1, raf = 0, lightTimer = 0;
  const interval = () => 60000 / bpm;

  function start() {
    if (blocked) return;
    unlockAudio();
    running = true; beatNo = 0; used = -1;
    next = performance.now() + 600; last = next - interval();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; cancelAnimationFrame(raf); light = -1; }
  function tick(now) {
    if (!running) return;
    if (now >= next) {
      last = next; beatNo++; next = last + interval();
      light = (beatNo - 1) % 4;
      clearTimeout(lightTimer); lightTimer = setTimeout(() => (light = -1), Math.min(140, interval() / 2));
      pulse("pulse"); click(light === 0);
    }
    raf = requestAnimationFrame(tick);
  }
  onDestroy(() => { stop(); clearTimeout(lightTimer); });

  function move(dir) {
    if (blocked) return;
    if (!running) return start();
    const { near, ok } = judge(performance.now(), { last, next, beatNo, used, bpm });
    const live = tiles.filter(t => !t.gone).map(({ id, lvl, ttl, r, c }) => ({ id, lvl, ttl, r, c }));

    if (ok) {
      used = near;
      const res = slide(live, SIZE, dir, MAX);
      if (!res.moved) return; // bumping a wall on the beat costs nothing
      streak++;
      const cleared = res.tiles.filter(t => isJunk(t) && --t.ttl <= 0);
      const nextTiles = res.tiles.filter(t => !cleared.includes(t));
      const extra = spawn(nextTiles, SIZE);
      if (extra) nextTiles.push({ ...extra, isNew: true });
      tiles = [...nextTiles, ...res.consumed.map(t => ({ ...t, gone: true })), ...cleared.map(t => ({ ...t, gone: true, fade: true }))];
      score += res.gained * multFor(streak);
      if (res.topLvl === MAX && !won) { won = true; stop(); }
      shout(multFor(streak) > 1 ? `On beat ×${multFor(streak)}` : "On beat", true);
      pulse("hit");
    } else {
      streak = 0;
      const cells = emptyCells(live, SIZE);
      if (cells.length) {
        const [r, c] = cells[Math.floor(Math.random() * cells.length)];
        tiles = [...live, junk(r, c)];
      }
      shout("Off beat!", false);
      pulse("miss"); buzz();
    }
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 200);
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (!canMove(tiles.filter(t => !t.gone), SIZE, MAX)) { over = true; stop(); }
    persist();
  }

  // ---- feedback ----
  let flashTimer = 0, callTimer = 0;
  function pulse(kind) {
    flash = ""; clearTimeout(flashTimer);
    requestAnimationFrame(() => { flash = kind; flashTimer = setTimeout(() => (flash = ""), 300); });
  }
  function shout(text, good) {
    call = { text, good, id: newId() }; clearTimeout(callTimer);
    callTimer = setTimeout(() => (call = null), 550);
  }

  let actx = null;
  function unlockAudio() {
    if (!sound) return;
    try { actx ??= new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch { actx = null; }
  }
  function tone(freq, dur, type, vol) {
    if (!sound || !actx) return;
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  }
  const click = down => tone(down ? 1320 : 880, 0.05, "square", 0.08);
  const buzz = () => tone(110, 0.18, "sawtooth", 0.12);
  function toggleSound() { sound = !sound; save(KEY + ":sound", sound); if (sound && running) unlockAudio(); }

  // ---- input: our own keys, so held-down keys don't spam junk; Board still handles swipes ----
  const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
  function onkeydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea")) return;
    if (e.key === " " && !e.target.closest?.("button")) {
      e.preventDefault();
      if (!e.repeat) running ? stop() : start();
      return;
    }
    const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (dir === undefined) return;
    e.preventDefault();
    if (!e.repeat) move(dir);
  }
  function onvisibilitychange() { if (document.hidden) stop(); }

  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ lvl, ttl, r, c }) => (lvl < 0 ? { lvl: -1, ttl, r, c } : { lvl, r, c })),
      score, streak, won, keepGoing, over });
  }

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.map(t => (t.lvl < 0 ? { ...junk(t.r, t.c), ttl: t.ttl, isNew: false } : { ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
    streak = saved.streak ?? 0;
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
<svelte:document {onvisibilitychange} />

<GameHeader title="On Beat" {score} {best} onnew={newGame}>
  {#snippet goal()}Move on the beat and get to <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="beat">
  <div class="stat"><span class="label">Tempo</span><span class="value">{bpm}</span></div>
  <div class="lights" aria-hidden="true">
    {#each [0, 1, 2, 3] as i}<span class="light" class:on={light === i} style="--on: var(--t{i === 0 ? 6 : 4})"></span>{/each}
  </div>
  <div class="stat"><span class="label">Streak</span><span class="value">{streak}{#if mult > 1}<small> ×{mult}</small>{/if}</span></div>
  <button class="sound" onclick={toggleSound} aria-pressed={sound}>{sound ? "Sound on" : "Sound off"}</button>
</div>

<div class="stage {flash}">
  <Board size={SIZE} {tiles} onmove={move} keys={false}>
    {#snippet tile(t)}
      {#if isJunk(t)}
        <div class="face junk" class:fade={t.fade}><span class="jn">{t.ttl}</span><small>junk</small></div>
      {:else}
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
      {/if}
    {/snippet}
    {#snippet overlay()}
      {#if call}{#key call.id}<div class="call" class:good={call.good} aria-live="polite">{call.text}</div>{/key}{/if}
      {#if won && !keepGoing}
        <Overlay title="You made Eddy Li (MIT)!" won>
          <button onclick={() => { keepGoing = true; persist(); start(); }}>Keep going</button>
          <button onclick={newGame}>Try again</button>
        </Overlay>
      {:else if over}
        <Overlay title="Game over!">
          <button onclick={newGame}>Try again</button>
        </Overlay>
      {:else if !running}
        <div class="ready">
          <p>{score ? "Paused" : "Ready?"}</p>
          <button onclick={start}>{score ? "Resume" : "Start"}</button>
        </div>
      {/if}
    {/snippet}
  </Board>
</div>

<p class="how">
  <strong>How to play:</strong> Watch the lights and move on the beat with your arrow keys, or swipe. A move off the
  beat drops a grey junk tile that never merges and clears after {JUNK_LIFE} on-beat moves. Keep a streak going for up to
  ×4 points, but the tempo speeds up as you score. Space pauses.
</p>

<style>
  .beat {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    background: var(--board); border-radius: 6px; padding: 8px 14px; margin-bottom: 12px;
  }
  .stat { display: flex; flex-direction: column; min-width: 64px; text-align: center; }
  .label { color: var(--box-label); font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em; }
  .value { color: white; font-size: 22px; font-weight: bold; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .value small { font-size: 15px; }
  .lights { display: flex; gap: 12px; }
  .light { width: 20px; height: 20px; border-radius: 50%; background: var(--cell); transition: transform 80ms ease, background 80ms ease; }
  .light.on { background: var(--on); transform: scale(1.35); }
  .sound {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    padding: 0 12px; height: 32px; font-size: 14px; font-weight: bold; cursor: pointer;
  }

  .stage { border-radius: 6px; max-width: 500px; margin: 0 auto; }
  .stage.pulse { animation: pulse 220ms ease-out; }
  .stage.hit { animation: hit 250ms ease-out; }
  .stage.miss { animation: miss 300ms ease-out; }
  @keyframes pulse { from { box-shadow: 0 0 0 6px var(--t4); } to { box-shadow: 0 0 0 0 transparent; } }
  @keyframes hit { from { box-shadow: 0 0 0 8px var(--t11); } to { box-shadow: 0 0 0 0 transparent; } }
  @keyframes miss { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

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
  .junk {
    flex-direction: column; color: var(--light-text);
    background: repeating-linear-gradient(45deg, #9e948a 0 8px, #8f857b 8px 16px);
  }
  .junk .jn { font-size: 9cqw; line-height: 1; }
  .junk small { font-size: 2.8cqw; text-transform: uppercase; letter-spacing: 0.08em; }
  .junk.fade { animation: fade 200ms ease forwards; }
  @keyframes fade { to { transform: scale(0.3); opacity: 0; } }

  .call {
    position: absolute; left: 0; right: 0; top: 40%; z-index: 90; text-align: center; pointer-events: none;
    font-size: clamp(28px, 8cqw, 44px); font-weight: bold; color: var(--t6);
    text-shadow: 0 2px 0 var(--page); animation: call 550ms ease-out forwards;
  }
  .call.good { color: var(--button); }
  @keyframes call {
    0% { opacity: 0; transform: scale(0.7); } 20% { opacity: 1; transform: scale(1.05); }
    100% { opacity: 0; transform: translateY(-18px); }
  }
  .ready {
    position: absolute; inset: 0; z-index: 100; border-radius: 6px; background: rgba(238, 228, 218, 0.73);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px;
  }
  .ready p { margin: 0; font-size: clamp(32px, 11cqw, 60px); font-weight: bold; }
  .ready button {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    padding: 0 20px; height: 40px; font-size: 18px; font-weight: bold; cursor: pointer;
  }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (prefers-reduced-motion: reduce) {
    .stage, .call, .junk.fade { animation: none !important; }
    .light { transition: none; }
  }
</style>
