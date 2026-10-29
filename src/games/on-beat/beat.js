// Timing rules for On Beat, kept free of the DOM so they can be tested.

export const MIN_BPM = 80, MAX_BPM = 168;
export const JUNK_LIFE = 6; // on-beat moves until a junk tile clears

// Tempo climbs with score, quickly at first and then more slowly.
export const bpmFor = score => Math.min(MAX_BPM, Math.round(MIN_BPM + Math.sqrt(score) * 1.25));

// Merge points multiply as the on-beat streak grows.
export const multFor = streak => (streak >= 16 ? 4 : streak >= 8 ? 3 : streak >= 4 ? 2 : 1);

// How far from a beat a press may land and still count, in ms.
export const windowFor = bpm => Math.max(90, (60000 / bpm) * 0.24);

// Judge a press at `now`, given the last beat (number `beatNo` at time `last`) and the next one
// at `next`. Only one press counts per beat, so `used` is the beat already spent.
export function judge(now, { last, next, beatNo, used, bpm }) {
  const dLast = now - last, dNext = next - now;
  const near = dLast <= dNext ? beatNo : beatNo + 1;
  return { near, ok: Math.min(dLast, dNext) <= windowFor(bpm) && near !== used };
}
