// Point & Shoot: which part of the camera picture a tile shows.
// The picture is treated as a square (the centre of the camera frame), split into a size x size grid.
// A level-1 tile shows exactly its own cell. Each level up widens the view, and the top level
// shows the whole picture. Rects are in 0..1 picture coordinates: { x, y, w } (square, so h = w).

// Side of the view as a fraction of the picture: one cell at level 1, the whole picture at `max`,
// growing by the same factor each level (so level 6 of 11 on a 4x4 board shows half the picture).
export function viewSize(lvl, size, max) {
  if (lvl >= max) return 1;
  const cell = 1 / size;
  const t = Math.max(0, lvl - 1) / (max - 1);
  return Math.min(1, cell * size ** t);
}

// The view for a tile at (r, c): centred on that cell, then pushed back inside the picture.
export function viewRect(lvl, r, c, size, max) {
  const w = viewSize(lvl, size, max);
  const cx = (c + 0.5) / size, cy = (r + 0.5) / size;
  const clamp = v => Math.min(1 - w, Math.max(0, v));
  return { x: clamp(cx - w / 2), y: clamp(cy - w / 2), w };
}

// The largest centred square inside a w x h frame, in pixels.
export function centerSquare(w, h) {
  const s = Math.min(w, h);
  return { sx: (w - s) / 2, sy: (h - s) / 2, s };
}
