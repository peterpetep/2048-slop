// Ball physics for Tilt Jar. The jar is a W x H box in its own frame (y points down to the floor).
// Tilting the jar by `tilt` radians (clockwise) turns gravity toward its right wall.
// A ball is { id, x, y, vx, vy, lvl, r, age, pop }. Touching balls of the same level merge.

export const W = 300, H = 400, DANGER_Y = 64, MAX_TILT = 0.7;
const GRAV = 1500, DAMP = 0.9985, BOUNCE = 0.25, ITERS = 3;

let nextId = 1;
export const radius = lvl => 15 + lvl * 4.4;

export function makeBall(x, y, lvl) {
  return { id: nextId++, x, y, vx: 0, vy: 0, lvl, r: radius(lvl), age: 0, pop: 0 };
}

// Drop a new ball near the top middle of the jar.
export function spawnBall(rand = Math.random) {
  const lvl = rand() < 0.85 ? 1 : 2;
  const b = makeBall(W / 2 + (rand() - 0.5) * 60, radius(lvl) + 2, lvl);
  b.pop = 1;
  return b;
}

// Advance the world by dt seconds. Returns the new ball list and the balls made by merges.
export function step(balls, dt, tilt, maxLvl = Infinity) {
  const gx = GRAV * Math.sin(tilt), gy = GRAV * Math.cos(tilt);
  for (const b of balls) {
    b.vx = (b.vx + gx * dt) * DAMP;
    b.vy = (b.vy + gy * dt) * DAMP;
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
        if (a.lvl === b.lvl && a.lvl < maxLvl) {
          const n = merge(a, b);
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
  // Heavier (bigger) balls move less.
  const ma = a.r * a.r, mb = b.r * b.r, ta = mb / (ma + mb), tb = ma / (ma + mb);
  a.x -= nx * overlap * ta; a.y -= ny * overlap * ta;
  b.x += nx * overlap * tb; b.y += ny * overlap * tb;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0) {
    const k = -1.1 * vn;
    a.vx -= nx * k * ta; a.vy -= ny * k * ta;
    b.vx += nx * k * tb; b.vy += ny * k * tb;
  }
}

function walls(b) {
  if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx *= -BOUNCE; }
  if (b.x > W - b.r) { b.x = W - b.r; if (b.vx > 0) b.vx *= -BOUNCE; }
  if (b.y > H - b.r) { b.y = H - b.r; if (b.vy > 0) b.vy *= -BOUNCE; }
  if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy *= -BOUNCE; }
}

function merge(a, b) {
  const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb;
  const n = makeBall((a.x * ma + b.x * mb) / m, (a.y * ma + b.y * mb) / m, a.lvl + 1);
  n.vx = (a.vx * ma + b.vx * mb) / m;
  n.vy = (a.vy * ma + b.vy * mb) / m - 120;
  n.pop = 1; n.age = 1;
  a.dead = b.dead = true;
  return n;
}

// Kick every ball away from the jar's floor, with some sideways scatter.
export function shake(balls, tilt, rand = Math.random) {
  const ux = -Math.sin(tilt), uy = -Math.cos(tilt);
  for (const b of balls) {
    const k = 380 + rand() * 240, s = (rand() - 0.5) * 300;
    b.vx += ux * k + uy * s; b.vy += uy * k - ux * s;
  }
}

// True when a settled ball pokes above the danger line near the lid.
export const overflowing = balls => balls.some(b => b.age > 1.5 && b.y - b.r < DANGER_Y);
