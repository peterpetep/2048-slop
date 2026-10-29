# 2048-slop

**Eddy Merge** is a 4x4 tile-merging game for Eddy. Slide tiles with arrow keys, WASD, or swipes. Two matching Eddys merge into the next level, and the 11th level is **Eddy Li (MIT)**.

Open `index.html` in a browser to play. No build step.

## Adding photos

Drop photos into the `photos/` folder, named by level: `eddy-1.jpg` for the first tile up to `eddy-11.jpg` for the final Eddy Li (MIT) tile. `.png` and `.webp` also work. The game picks them up on load, and any level without a photo shows a colored placeholder. See [`photos/README.md`](photos/README.md).

Photos load over HTTP, so serve the folder (for example `python3 -m http.server`) or host it on GitHub Pages. Some browsers block them when `index.html` is opened straight from disk.

Players can also pick their own photos in the "Eddy photos" panel under the board. Those stay in their browser only.
