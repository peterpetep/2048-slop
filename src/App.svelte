<script>
  // Arcade shell: the hash picks a game (#eddy-merge); no hash shows the selector.
  import { GAMES } from "./games/index.js";

  let slug = $state(location.hash.slice(1));
  let Game = $state(null);

  $effect(() => {
    const game = GAMES.find(g => g.slug === slug && g.load);
    Game = null;
    document.title = game ? game.name : "Eddy Arcade";
    if (game) game.load().then(m => { if (slug === game.slug) Game = m.default; });
  });
</script>

<svelte:window onhashchange={() => (slug = location.hash.slice(1))} />

<main>
  {#if Game}
    <Game />
  {:else if !GAMES.some(g => g.slug === slug && g.load)}
    <header>
      <h1>Eddy Arcade</h1>
      <p>Ten ways to merge tiles. Pick a game.</p>
    </header>
    <ul class="list">
      {#each GAMES as g, i (g.slug)}
        <li>
          {#if g.load}
            <a class="game" href="#{g.slug}" style="--tile: var(--t{i + 1})">
              <span class="name">{g.name}</span>
              <span class="rule">{g.rule}</span>
              <span class="status">Play</span>
            </a>
          {:else}
            <div class="game soon">
              <span class="name">{g.name}</span>
              <span class="rule">{g.rule}</span>
              <span class="status">Coming soon</span>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main { max-width: 500px; margin: 0 auto; }
  header h1 { font-size: clamp(48px, 13vw, 72px); font-weight: bold; margin: 0; line-height: 1; }
  header p { margin: 10px 0 24px; }
  .list { list-style: none; margin: 0; padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    background: var(--board); border-radius: 6px; }
  .game { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 14px; border-radius: 3px;
    text-decoration: none; background: var(--tile, var(--t1)); min-width: 0; }
  a.game { transition: transform 100ms ease; }
  a.game:hover { transform: scale(1.03); }
  .game.soon { background: var(--cell); }
  .name { font-size: 20px; font-weight: bold; }
  .rule { font-size: 14px; font-weight: normal; line-height: 1.35; }
  .status { margin-top: auto; padding-top: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; }
  .soon .status, .soon .rule { opacity: 0.75; }
  @media (max-width: 420px) { .list { grid-template-columns: 1fr; } }
</style>
