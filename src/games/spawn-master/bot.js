// The Spawn Master bot: it slides in a fixed rotation (up, right, down, left) and skips
// any slide that would move nothing. The player always knows what it will do next.
import { slide } from "../../lib/engine.js";

export const ORDER = ["up", "right", "down", "left"];

// Returns the slide result plus the direction used, the directions skipped, and the next
// rotation index. When no slide moves anything, `dir` is null and the game is over.
export function botTurn(tiles, size, idx, maxLvl) {
  const skipped = [];
  for (let i = 0; i < 4; i++) {
    const dir = (idx + i) % 4;
    const res = slide(tiles, size, dir, maxLvl);
    if (res.moved) return { ...res, dir, skipped, next: (dir + 1) % 4 };
    skipped.push(dir);
  }
  return { tiles, consumed: [], moved: false, gained: 0, topLvl: 0, dir: null, skipped, next: idx };
}
