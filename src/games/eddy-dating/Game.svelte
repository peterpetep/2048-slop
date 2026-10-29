<script>
  // Eddy Dating: the matchmaker shows two Eddys from the board. Swipe right to merge them, left to
  // pass. A mismatch swiped right leaves a heartbroken tile for a few rounds. The matchmaker gets
  // impatient: wait too long and you ghost them, which counts as a pass. Right calls in a row build
  // a streak that multiplies merge points. Rules live in dating.js. Level 11 is Eddy Li (MIT).
  import GameHeader from "../../lib/GameHeader.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { load, save } from "../../lib/storage.js";
  import { newDating, swipe, eddy, curse, propose, isOver, SIZE, MAX } from "./dating.js";

  const KEY = "eddy-dating-v1", DRAG_TO_SWIPE = 90, FLY_MS = 220;
  const JOBS = [
    "", "Aspiring Intern", "Barista & Weekend DJ", "Junior Analyst", "Yoga Instructor", "Startup Founder (pre-seed)",
    "Product Manager", "Data Scientist", "Patent Attorney", "VP of Synergy", "Thought Leader, 500+ connections",
    "Eddy Li (MIT)",
  ];
  const BIOS = [
    "", "Open to work. Open to love.", "Will remember your coffee order.", "Loves spreadsheets and long walks.",
    "Very flexible about first dates.", "Disrupting the dating space.", "Has a roadmap for us.",
    "Our compatibility is statistically significant.", "Will read the fine print of your heart.",
    "Let's circle back over dinner.", "Agree? Like and comment.", "The one.",
  ];

  let g = $state(newDating());
  let best = $state(load(KEY + ":best", 0));
  let keepGoing = $state(false);
  let streak = $state(0);
  let toast = $state(null);
  let flash = $state(null);
  let dx = $state(0);
  let dragging = $state(false);
  let flying = $state(0);
  let photos = $state({});

  // Matchmaker patience, in ms. The clock starts on your first swipe of a game.
  let armed = $state(false);
  let left = $state(1);
  let deadline = 0;
  const patience = () => Math.max(1800, 5000 - streak * 150);
  const mult = $derived(Math.min(4, 1 + Math.floor(streak / 5)));
  const playing = $derived(!g.over && !(g.won && !keepGoing));

  function newGame() {
    g = newDating();
    keepGoing = false; streak = 0; armed = false; toast = null; flash = null; dx = 0; flying = 0;
    persist();
  }

  function persist() {
    save(KEY, {
      cells: g.cells.map(c => (c ? (c.curse ? { curse: c.curse } : { lvl: c.lvl }) : null)),
      score: g.score, top: g.top, won: g.won, over: g.over, pair: g.pair, keepGoing, streak,
    });
  }

  function restore() {
    const s = load(KEY);
    if (!Array.isArray(s?.cells) || s.cells.length !== SIZE * SIZE) return;
    const cells = s.cells.map(c => (c?.curse > 0 ? curse(c.curse) : c?.lvl >= 1 && c.lvl <= MAX ? eddy(c.lvl) : null));
    const next = { cells, score: +s.score || 0, top: +s.top || 1, won: !!s.won, over: false, pair: null };
    const p = s.pair;
    next.pair = Array.isArray(p) && cells[p[0]] && !cells[p[0]].curse && cells[p[1]] && !cells[p[1]].curse ? p : propose(next);
    next.over = !!s.over || isOver(next);
    g = next;
    keepGoing = !!s.keepGoing;
    streak = +s.streak || 0;
  }
  restore();

  const MESSAGES = {
    match: "It's a match! 💞", bad: "Awkward... 💔", pass: "Passed 👋", missed: "You passed on a match 🙈", ghost: "Ghosted ⏰",
  };

  function decide(right, ghosted = false) {
    if (!playing || flying || !g.pair) return;
    flying = right ? 1 : -1;
    setTimeout(() => {
      const res = swipe(g, right);
      flying = 0; dx = 0;
      if (!res) return;
      if (res.correct) streak++;
      else streak = 0;
      if (res.kind === "match" && mult > 1) g.score += res.gained * (mult - 1);
      const key = ghosted ? "ghost" : res.kind === "pass" && !res.correct ? "missed" : res.kind;
      toast = { id: Math.random(), text: MESSAGES[key], good: res.correct };
      flash = res.at == null ? null : { at: res.at, kind: res.kind, id: Math.random() };
      if (g.score > best) { best = g.score; save(KEY + ":best", best); }
      armed = true;
      deadline = performance.now() + patience();
      persist();
    }, FLY_MS);
  }

  // Patience clock.
  $effect(() => {
    if (!armed || !playing) return;
    let raf;
    deadline = performance.now() + patience();
    const frame = () => {
      if (document.hidden) deadline += 16;
      const rest = deadline - performance.now();
      left = Math.max(0, rest / patience());
      if (rest <= 0 && !flying) { decide(false, true); deadline = performance.now() + patience() + FLY_MS; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  // ---- dragging the card ----
  let startX = 0;
  function down(e) {
    if (!playing || flying) return;
    dragging = true; startX = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) { if (dragging) dx = e.clientX - startX; }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(dx) >= DRAG_TO_SWIPE) decide(dx > 0);
    else dx = 0;
  }

  function key(e) {
    if (e.target.closest?.("input, textarea")) return;
    const k = e.key.toLowerCase();
    if (k === "arrowright" || k === "d") { e.preventDefault(); decide(true); }
    else if (k === "arrowleft" || k === "a") { e.preventDefault(); decide(false); }
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
  const offset = $derived(flying ? flying * 600 : dx);
  const lean = $derived(Math.max(-1, Math.min(1, offset / DRAG_TO_SWIPE)));
  const pair = $derived(g.pair ? g.pair.map(i => g.cells[i]) : []);
</script>

<svelte:window onkeydown={key} />

<GameHeader title="Eddy Dating" score={g.score} {best} onnew={newGame}>
  {#snippet goal()}Swipe right on true matches to find <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<div class="stage">
  <div class="status">
    <span class="streak" class:hot={mult > 1}>{streak ? `🔥 ${streak} in a row` : "No streak yet"}{mult > 1 ? ` · ×${mult} points` : ""}</span>
    {#key toast?.id}{#if toast}<span class="toast" class:good={toast.good}>{toast.text}</span>{/if}{/key}
  </div>

  <div class="patience" class:idle={!armed} aria-hidden="true"><div style="width: {armed ? left * 100 : 100}%"></div></div>

  <div class="deck">
    {#if pair.length === 2}
      <div class="card" class:dragging class:flying={!!flying}
        style="transform: translateX({offset}px) rotate({offset / 18}deg)"
        role="group" aria-label="Proposed match: {pair.map(c => JOBS[c.lvl]).join(' and ')}"
        onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
        <span class="stamp yes" style="opacity: {Math.max(0, lean)}">MERGE</span>
        <span class="stamp no" style="opacity: {Math.max(0, -lean)}">PASS</span>
        {#each pair as c, i (c.id)}
          {#if i === 1}<span class="heart" aria-hidden="true">♥</span>{/if}
          <div class="profile">
            <div class="pic" class:dark={c.lvl <= 2} style="background: var(--t{c.lvl})">
              {#if photos[c.lvl]}
                <img src={photos[c.lvl]} alt="" draggable="false" />
              {:else if c.lvl === MAX}
                <span class="final">MIT</span>
              {:else}
                <span class="num">{value(c.lvl)}</span>
              {/if}
            </div>
            <strong>Eddy Li</strong>
            <span class="job">{JOBS[c.lvl]}</span>
            <span class="bio">"{BIOS[c.lvl]}"</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="buttons">
    <button class="no" onclick={() => decide(false)} disabled={!playing} aria-label="Pass">✕ Pass</button>
    <button class="yes" onclick={() => decide(true)} disabled={!playing} aria-label="Merge">♥ Merge</button>
  </div>

  <div class="board">
    {#each g.cells as c, i (i)}
      <div class="cell" class:picked={g.pair?.includes(i)}>
        {#if c?.curse}
          {#key c.id}<div class="tile cursed" title="Heartbroken for {c.curse} more rounds">💔<small>{c.curse}</small></div>{/key}
        {:else if c}
          {#key c.id}
            <div class="tile" class:dark={c.lvl <= 2} class:pop={flash?.at === i} style="background: var(--t{c.lvl})">
              {#if photos[c.lvl]}<img src={photos[c.lvl]} alt="" draggable="false" />{/if}
              <span class:badge={photos[c.lvl]}>{c.lvl === MAX ? "MIT" : value(c.lvl)}</span>
            </div>
          {/key}
        {/if}
      </div>
    {/each}
    {#if g.won && !keepGoing}
      <Overlay title="You found Eddy Li (MIT)!" won>
        <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
        <button onclick={newGame}>Try again</button>
      </Overlay>
    {:else if g.over}
      <Overlay title="Forever single!">
        <button onclick={newGame}>Try again</button>
      </Overlay>
    {/if}
  </div>
</div>

<p class="how">
  <strong>How to play:</strong> The matchmaker suggests two Eddys from the board (outlined below). If they are the same
  Eddy, swipe right (or press →) to merge them into the next one. If they aren't, swipe left (←) to pass. Swiping right
  on a bad match leaves a 💔 tile that blocks its spot for six rounds. Don't keep the matchmaker waiting, and string
  together right calls for bonus points. A new Eddy joins every round.
</p>

<style>
  .stage { display: flex; flex-direction: column; gap: 12px; }
  .status { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 26px; font-size: 15px; }
  .streak { font-weight: bold; opacity: 0.75; }
  .streak.hot { opacity: 1; color: var(--t6); }
  .toast { font-weight: bold; animation: pop 1.6s ease forwards; color: var(--t6); }
  .toast.good { color: #5a9e5a; }
  @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 15% { transform: scale(1.1); opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }

  .patience { height: 6px; background: var(--cell); border-radius: 3px; overflow: hidden; }
  .patience div { height: 100%; background: var(--t4); border-radius: 3px; }
  .patience.idle div { background: var(--board); }

  .deck { min-height: 250px; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 6px 0; }
  .card {
    position: relative; width: 100%; max-width: 440px; display: flex; align-items: stretch; gap: 8px;
    background: white; border-radius: 14px; padding: 14px; box-shadow: 0 6px 18px rgba(119, 110, 101, 0.25);
    cursor: grab; touch-action: none; user-select: none; transition: transform 200ms ease, opacity 200ms ease;
  }
  .card.dragging { cursor: grabbing; transition: none; }
  .card.flying { opacity: 0; }
  .profile { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 3px; }
  .pic {
    position: relative; width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; container-type: inline-size;
    display: flex; align-items: center; justify-content: center; color: var(--light-text); font-weight: bold;
  }
  .pic.dark, .tile.dark { color: var(--text); }
  .pic .num { font-size: 30cqw; }
  .pic .final { font-size: 24cqw; }
  .job { font-size: 13px; font-weight: bold; line-height: 1.2; }
  .bio { font-size: 12px; font-style: italic; line-height: 1.25; opacity: 0.85; }
  .heart { align-self: center; color: var(--t6); font-size: 26px; margin-top: -60px; }
  .stamp {
    position: absolute; top: 18px; z-index: 2; padding: 2px 10px; border: 3px solid; border-radius: 6px;
    font-size: 24px; font-weight: bold; pointer-events: none; background: rgba(255, 255, 255, 0.8);
  }
  .stamp.yes { left: 18px; color: #5a9e5a; transform: rotate(-12deg); }
  .stamp.no { right: 18px; color: var(--t6); transform: rotate(12deg); }

  .buttons { display: flex; justify-content: center; gap: 16px; }
  .buttons button {
    border: 0; border-radius: 24px; height: 46px; padding: 0 24px; font-size: 18px; font-weight: bold;
    cursor: pointer; color: var(--light-text);
  }
  .buttons .no { background: var(--button); }
  .buttons .yes { background: var(--t6); }
  .buttons button:disabled { opacity: 0.5; cursor: default; }

  .board {
    position: relative; width: 100%; max-width: 360px; margin: 8px auto 0; aspect-ratio: 1; container-type: inline-size;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 3%; padding: 3%; background: var(--board); border-radius: 6px;
  }
  .cell { position: relative; background: var(--cell); border-radius: 3px; outline: 0 solid transparent; }
  .cell.picked { outline: 3px solid var(--t6); outline-offset: 2px; }
  .tile {
    position: absolute; inset: 0; border-radius: 3px; overflow: hidden; display: flex; align-items: center;
    justify-content: center; color: var(--light-text); font-weight: bold; font-size: 7cqw; animation: appear 200ms ease;
  }
  .tile.pop { animation: merge 250ms ease; }
  .tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .badge { position: absolute; left: 3px; bottom: 3px; background: rgba(0, 0, 0, 0.45); color: #fff; border-radius: 3px; padding: 0 4px; font-size: 3.5cqw; }
  .cursed { background: #6b5b6e; font-size: 9cqw; flex-direction: column; line-height: 1; }
  .cursed small { font-size: 3.5cqw; color: var(--light-text); }
  @keyframes appear { from { transform: scale(0); } }
  @keyframes merge { 50% { transform: scale(1.18); } }

  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 520px) {
    .card { padding: 10px; }
    .job { font-size: 12px; }
    .bio { font-size: 11px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card, .tile, .toast { transition: none; animation: none; }
  }
</style>
