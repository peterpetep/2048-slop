// Scrambled controls: a mapping from the direction you press to the direction the tiles slide.
// map[pressed] = actual. After every merge the mapping is reshuffled so every key changes meaning.

export const IDENTITY = [0, 1, 2, 3];

// A random mapping where no key keeps the meaning it had in `prev`.
export function reshuffle(prev = IDENTITY, rand = Math.random) {
  for (;;) {
    const next = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.every((d, i) => d !== prev[i])) return next;
  }
}

// True for a saved mapping that still uses each direction exactly once.
export const valid = m => Array.isArray(m) && m.length === 4 && [...m].sort().every((d, i) => d === i);
