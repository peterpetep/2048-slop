// Physics for Slingshot. The world is a W x H side view (y points down). The sling stands on the
// left, a pit runs under it, and the pile of Eddys sits on a ledge to the right.
// A ball is { id, x, y, vx, vy, lvl, r, age, pop, shot }. `shot` is true while a flung ball has
// not touched anything yet. Touching balls of the same level merge where they meet.

export const W = 400, H = 400;
export const LEDGE_X = 180, LEDGE_Y = 330, DANGER_Y = 96;
export const SLING = { x: 70, y: 262 };
export const MAX_PULL = 80, MAX_SPEED = 720, GRAV = 900;
const DAMP = 0.999, BOUNCE = 0.2, FRICTION = 5, ITERS = 3;

let nextId = 1;
export const radius = lvl => 11 + lvl * 2.7;

export function makeBall(x, y, lvl) {
  return { id: nextId++, x, y, vx: 0, vy: 0, lvl, r: radius(lvl), age: 0, pop: 0, shot: false };
}

// Launch velocity for a pull of (px, py) away from the sling: the ball flies the opposite way.
export function launchVelocity(px, py) {
  const len = Math.hypot(px, py), k = Math.min(len, MAX_PULL) / (len || 1) * (MAX_SPEED / MAX_PULL);
  return { vx: -px * k, vy: -py * k };
}

// Points along the first `secs` seconds of a shot, for the short aiming guide.
export function trajectory(vx, vy, secs, n = 8) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = (secs * i) / n;
    pts.push({ x: SLING.x + vx * t, y: SLING.y + vy * t + 0.5 * GRAV * t * t });
  }
  return pts;
}

export function fire(lvl, px, py) {
  const b = makeBall(SLING.x, SLING.y, lvl), v = launchVelocity(px, py);
  b.vx = v.vx; b.vy = v.vy; b.shot = true;
  return b;
}

// Level for the next ball in the sling: usually one that is already in the pile, so there is
// always something to aim at.
export function nextAmmo(balls, rand = Math.random) {
  const pile = balls.filter(b => !b.shot && b.lvl <= 5);
  if (pile.length && rand() < 0.65) return pile[Math.floor(rand() * pile.length)].lvl;
  return rand() < 0.75 ? 1 : 2;
}

// A new Eddy dropped onto the ledge from above.
export function dropBall(rand = Math.random) {
  const lvl = rand() < 0.8 ? 1 : 2, r = radius(lvl);
  const b = makeBall(LEDGE_X + r + rand() * (W - LEDGE_X - 2 * r), -r, lvl);
  b.pop = 1;
  return b;
}

// Advance the world by dt seconds. Returns the new ball list, the balls made by merges, and the
// balls that fell into the pit.
export function step(balls, dt, maxLvl = Infinity) {
  for (const b of balls) {
    b.vy += GRAV * dt;
    b.vx *= DAMP; b.vy *= DAMP;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.age += dt;
    if (b.pop > 0) b.pop = Math.max(0, b.pop - dt * 5);
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
        a.shot = b.shot = false;
        if (a.lvl === b.lvl && a.lvl < maxLvl) {
          const n = merge(a, b);
          balls.push(n); made.push(n);
          break;
        }
        separate(a, b, dx, dy, rr, d2);
      }
    }
    if (made.length) balls = balls.filter(b => !b.dead);
    for (const b of balls) walls(b, dt / ITERS);
  }
  const lost = balls.filter(b => b.y - b.r > H);
  if (lost.length) balls = balls.filter(b => b.y - b.r <= H);
  return { balls, made, lost };
}

function separate(a, b, dx, dy, rr, d2) {
  const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d, overlap = rr - d;
  // Heavier (bigger) balls move less.
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

function walls(b, dt) {
  if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx *= -BOUNCE; }
  if (b.x > W - b.r) { b.x = W - b.r; if (b.vx > 0) b.vx *= -BOUNCE; }
  // The ledge is a block from (LEDGE_X, LEDGE_Y) to the bottom right corner.
  const cx = Math.max(LEDGE_X, Math.min(W, b.x)), cy = Math.max(LEDGE_Y, b.y);
  const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= b.r * b.r) return;
  b.shot = false;
  let nx, ny, d;
  if (d2 > 0) { d = Math.sqrt(d2); nx = dx / d; ny = dy / d; }
  else { d = 0; nx = 0; ny = -1; } // centre inside the block: push it up
  b.x += nx * (b.r - d); b.y += ny * (b.r - d);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + BOUNCE) * vn * nx; b.vy -= (1 + BOUNCE) * vn * ny; }
  // Rolling friction on the top of the ledge, so the pile settles.
  if (ny < -0.7) b.vx *= Math.max(0, 1 - FRICTION * dt);
}

function merge(a, b) {
  const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb;
  const n = makeBall((a.x * ma + b.x * mb) / m, (a.y * ma + b.y * mb) / m, a.lvl + 1);
  n.vx = (a.vx * ma + b.vx * mb) / m * 0.3;
  n.vy = (a.vy * ma + b.vy * mb) / m * 0.3 - 100;
  n.pop = 1; n.age = 1;
  a.dead = b.dead = true;
  return n;
}

// True when a settled ball on the pile pokes above the danger line.
export const overflowing = balls =>
  balls.some(b => !b.shot && b.age > 1.5 && Math.hypot(b.vx, b.vy) < 80 && b.y - b.r < DANGER_Y);
