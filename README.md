# 2048-slop

**Eddy Arcade** is a set of ten tile-merging games. Open `index.html` to pick one. No build step.

## Layout

- `index.html`: the game selector. It reads the game list from `games.js`.
- `games.js`: one entry per game (`slug`, `name`, `rule`, `ready`). Games with `ready: false` show as "Coming soon".
- `games/<slug>/index.html`: each game, as a single self-contained page. It links back to the selector with `../../index.html`.
- `photos/`: shared photos of Eddy.

## Adding a game

1. Create `games/<slug>/index.html`, using the slug already listed in `games.js`.
2. Add a "← All games" link to `../../index.html`.
3. Keep its saved state under its own localStorage key, such as `<slug>-v1`.
4. Set `ready: true` for its entry in `games.js`.

## Adding photos

Drop photos into the `photos/` folder, named by level: `eddy-1.jpg` for the first tile up to `eddy-11.jpg` for the final Eddy Li (MIT) tile. `.png` and `.webp` also work. Eddy Merge picks them up on load, and any level without a photo shows a colored placeholder. See [`photos/README.md`](photos/README.md).

Photos load over HTTP, so serve the folder (for example `python3 -m http.server`) or host it on GitHub Pages. Some browsers block them when the page is opened straight from disk.

Players can also pick their own photos in the "Eddy photos" panel under the board. Those stay in their browser only.
