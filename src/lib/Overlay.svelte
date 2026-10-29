<script>
  // Message over the board, e.g. "Game over!" with a Try again button.
  let { title, won = false, children } = $props();
</script>

<div class="overlay" class:won>
  <p>{title}</p>
  <div class="actions">{@render children?.()}</div>
</div>

<style>
  .overlay {
    position: absolute; inset: 0; z-index: 100; border-radius: 6px;
    background: rgba(238, 228, 218, 0.73); display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 24px; text-align: center; padding: 16px;
    animation: fade 800ms ease 600ms backwards;
  }
  .overlay.won { background: rgba(237, 194, 46, 0.5); color: var(--light-text); }
  p { margin: 0; font-size: clamp(32px, 11cqw, 60px); font-weight: bold; line-height: 1.1; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .actions :global(button) {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    padding: 0 20px; height: 40px; font-size: 18px; font-weight: bold; cursor: pointer;
  }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .overlay { animation: none; } }
</style>
