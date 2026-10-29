// Magnet physics: a top-down S x S table with no gravity. Every Eddy is a magnet with a pole
// (pole 1 is N, -1 is S). Opposite poles pull together and like poles push apart, harder the higher
// the level, and twice as hard between Eddys of the same level. Friction slows everything, so the
// board clumps up on its own. A ball is { id, x, y, vx, vy, lvl, pole, r, age, pop }.

export const S = 400;
const K = 11000, SOFT = 40, SAME = 2.5, FRICTION = 1.6, MAX_ACC = 1400, MAX_V = 650, BOUNCE = 0.4, ITERS = 3;

let nextId = 1;
export const radius = lvl => 14 + lvl * 3.6;

export function makeBall(x, y, lvl, pole = 1) {
  return { id: nextId++, x, y, vx: 0, vy: 0, lvl, pole, r: radius(lvl), age: 0, pop: 0 };
}

// How hard b pulls a toward it, as an acceleration (negative pushes away).
// Bigger Eddys pull harder and get dragged less.
export function pull(a, b) {
  return (-a.pole * b.pole * K * b.lvl * (a.lvl === b.lvl ? SAME : 1)) / Math.sqrt(a.lvl);
}

// Advance by dt seconds. (nx, ny) is an extra push on every ball from the arrow keys.
// Returns the new ball list and the balls made by merges.
export function step(balls, dt, { nx = 0, ny = 0, maxLvl = Infinity, rand = Math.random } = {}) {
  for (const a of balls) {
    let ax = 0, ay = 0;
    for (const b of balls) {
      if (a === b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const f = pull(a, b) / (d + SOFT);
      ax += (dx / d) * f; ay += (dy / d) * f;
    }
    const m = Math.hypot(ax, ay);
    if (m > MAX_ACC) { ax *= MAX_ACC / m; ay *= MAX_ACC / m; }
    const fr = Math.exp(-FRICTION * dt);
    a.vx = (a.vx + (ax + nx) * dt) * fr;
    a.vy = (a.vy + (ay + ny) * dt) * fr;
    const v = Math.hypot(a.vx, a.vy);
    if (v > MAX_V) { a.vx *= MAX_V / v; a.vy *= MAX_V / v; }
    a.x += a.vx * dt; a.y += a.vy * dt;
    a.age += dt;
    if (a.pop > 0) a.pop = Math.max(0, a.pop - dt * 5);
  }
  const made = [];
  for (let iter = 0; iter < ITERS; iter++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.dead) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        if (a.lvl === b.lvl && a.lvl < maxLvl) {
          const n = merge(a, b, rand);
          balls.push(n); made.push(n);
          break;
        }
        separate(a, b, dx, dy, rr, d2);
      }
    }
    if (made.length) balls = balls.filter(b => !b.dead);
    for (const b of balls) walls(b);
  }
  return { balls, made };
}

function separate(a, b, dx, dy, rr, d2) {
  const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d, overlap = rr - d;
  const ma = a.r * a.r, mb = b.r * b.r, ta = mb / (ma + mb), tb = ma / (ma + mb);
  a.x -= nx * overlap * ta; a.y -= ny * overlap * ta;
  b.x += nx * overlap * tb; b.y += ny * overlap * tb;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) {
    const k = -1.2 * vn;
    a.vx -= nx * k * ta; a.vy -= ny * k * ta;
    b.vx += nx * k * tb; b.vy += ny * k * tb;
  }
}

function walls(b) {
  if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx *= -BOUNCE; }
  if (b.x > S - b.r) { b.x = S - b.r; if (b.vx > 0) b.vx *= -BOUNCE; }
  if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy *= -BOUNCE; }
  if (b.y > S - b.r) { b.y = S - b.r; if (b.vy > 0) b.vy *= -BOUNCE; }
}

// The new Eddy's pole is a coin toss, so the board never settles for good.
function merge(a, b, rand) {
  const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb;
  const n = makeBall((a.x * ma + b.x * mb) / m, (a.y * ma + b.y * mb) / m, a.lvl + 1, rand() < 0.5 ? 1 : -1);
  n.vx = (a.vx * ma + b.vx * mb) / m;
  n.vy = (a.vy * ma + b.vy * mb) / m;
  n.pop = 1; n.age = 1;
  a.dead = b.dead = true;
  return n;
}

// A shockwave at (x, y): balls within `range` are thrown outward, small ones furthest.
export function blast(balls, x, y, range = 150, power = 900) {
  for (const b of balls) {
    const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
    if (d > range + b.r) continue;
    const k = (power * (1 - Math.max(0, d - b.r) / range)) / Math.sqrt(b.lvl);
    const ux = d ? dx / d : Math.cos(b.id), uy = d ? dy / d : Math.sin(b.id);
    b.vx += ux * k; b.vy += uy * k;
  }
}

// A new Eddy slides in from a random edge, at the spot furthest from everything else.
export function spawnBall(balls, rand = Math.random) {
  const lvl = rand() < 0.85 ? 1 : 2, r = radius(lvl);
  let best = null, bestGap = -Infinity;
  for (let t = 0; t < 12; t++) {
    const side = Math.floor(rand() * 4), u = r + rand() * (S - 2 * r);
    const [x, y] = [[u, r], [S - r, u], [u, S - r], [r, u]][side];
    const gap = Math.min(Infinity, ...balls.map(b => Math.hypot(b.x - x, b.y - y) - b.r - r));
    if (gap > bestGap) { bestGap = gap; best = [x, y]; }
  }
  const b = makeBall(best[0], best[1], lvl, rand() < 0.5 ? 1 : -1);
  // Drift toward the middle so it joins the board.
  b.vx = (S / 2 - b.x) * 0.6; b.vy = (S / 2 - b.y) * 0.6;
  b.pop = 1;
  return b;
}

// Share of the table covered by Eddys. The game ends when it stays too high.
export const crowding = balls => balls.reduce((s, b) => s + Math.PI * b.r * b.r, 0) / (S * S);
