# 2048-slop

**Eddy Arcade** is a set of ten tile-merging games built with Svelte 5 and Vite.

```sh
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
npm test         # engine unit tests
```

## Layout

- `src/App.svelte`: the arcade shell. With no hash it shows the game selector, and `#<slug>` opens a game.
- `src/games/index.js`: the list of all games (`slug`, `name`, `rule`). A game becomes playable as soon as `src/games/<slug>/Game.svelte` exists. Until then the selector shows it as "Coming soon".
- `src/games/<slug>/Game.svelte`: one game. Keep everything the game needs in its own folder.
- `src/lib/`: shared pieces, so every game looks the same:
  - `theme.css`: page colors, fonts, and the tile palette (`--t1` … `--t11`).
  - `GameHeader.svelte`: the "All games" link, title, Score and Best boxes, goal line, and New Game button.
  - `Board.svelte`: a square grid with animated tiles, plus arrow keys, WASD, and swipe input. It is optional, so a game with a different board (hex, physics, and so on) can draw its own.
  - `Overlay.svelte`: the "Game over!" or win message over the board.
  - `engine.js`: classic slide and merge rules (`slide`, `spawn`, `canMove`), with tests in `engine.test.js`.
  - `storage.js`: localStorage helpers that never throw.
- `public/photos/`: photos of Eddy, shared by all games.

## Adding a game

1. Create `src/games/<slug>/Game.svelte`, using the slug already listed in `src/games/index.js`.
2. Start it with `<GameHeader>` so it has the same header and back link, and reuse `Board`, `Overlay`, and `engine.js` where they fit.
3. Save its state under its own localStorage key, such as `<slug>-v1`.
4. Run `npm run build` to check that it compiles.

## Adding photos

Drop photos into `public/photos/`, named by level: `eddy-1.jpg` for the first tile up to `eddy-11.jpg` for the final Eddy Li (MIT) tile. `.png` and `.webp` also work. Eddy Merge picks them up on load, and any level without a photo shows its number. See [`public/photos/README.md`](public/photos/README.md).
