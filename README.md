# 2048-slop

**Eddy Merge** is a 4x4 tile-merging game for Eddy. Slide tiles with arrow keys, WASD, or swipes. Two matching Eddys merge into the next level, and the 11th level is **Eddy Li (MIT)**.

Open `index.html` in a browser to play. No build step.

## Adding photos

Each level is an entry in the `LEVELS` array at the top of the script in `index.html`. Put a photo in `photos/` and set that level's `img`, for example `img: "photos/eddy-1.jpg"`. Levels without a photo show a colored placeholder.

Players can also set photos in the "Eddy photos" panel under the board. Those stay in their own browser.
