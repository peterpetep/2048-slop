<script>
  // Title, score boxes, a one-line goal and the New Game button, laid out like the classic game.
  let { title, score = 0, best = 0, onnew, goal } = $props();

  let bumps = $state([]);
  let last = score;
  $effect(() => {
    const gained = score - last;
    last = score;
    if (gained > 0) {
      const id = Math.random();
      bumps = [...bumps, { id, gained }];
      setTimeout(() => (bumps = bumps.filter(b => b.id !== id)), 600);
    }
  });
</script>

<a class="back" href="#">&larr; All games</a>
<header>
  <h1 class:long={title.length > 6}>{title}</h1>
  <div class="scores">
    <div class="box">
      <span class="label">Score</span>
      <span class="value">{score}</span>
      {#each bumps as b (b.id)}<span class="bump">+{b.gained}</span>{/each}
    </div>
    <div class="box">
      <span class="label">Best</span>
      <span class="value">{best}</span>
    </div>
  </div>
</header>
<div class="intro">
  <p>{@render goal?.()}</p>
  {#if onnew}<button onclick={onnew}>New Game</button>{/if}
</div>

<style>
  .back { font-size: 14px; text-decoration: none; opacity: 0.8; }
  .back:hover { opacity: 1; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }
  h1 { font-size: 80px; font-weight: bold; margin: 0; line-height: 1; }
  h1.long { font-size: clamp(36px, 9vw, 52px); }
  .scores { display: flex; gap: 5px; flex-shrink: 0; }
  .box {
    position: relative; background: var(--board); border-radius: 3px; padding: 6px 18px 4px;
    min-width: 64px; text-align: center; display: flex; flex-direction: column;
  }
  .label { color: var(--box-label); font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em; }
  .value { color: white; font-size: 25px; font-weight: bold; line-height: 1.2; font-variant-numeric: tabular-nums; }
  .bump {
    position: absolute; right: 18px; bottom: 4px; color: rgba(119, 110, 101, 0.9);
    font-size: 25px; font-weight: bold; pointer-events: none; animation: float 600ms ease-in forwards;
  }
  @keyframes float { to { transform: translateY(-50px); opacity: 0; } }
  .intro { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 18px 0 24px; }
  .intro p { margin: 0; line-height: 1.4; }
  button {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    padding: 0 20px; height: 40px; font-size: 18px; font-weight: bold; cursor: pointer; flex-shrink: 0;
  }
  @media (max-width: 520px) {
    h1 { font-size: 56px; }
    .box { padding: 4px 12px 2px; }
    .value { font-size: 20px; }
    .intro { font-size: 15px; }
    button { height: 36px; padding: 0 14px; font-size: 15px; }
  }
  @media (prefers-reduced-motion: reduce) { .bump { display: none; } }
</style>
