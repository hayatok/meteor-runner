export const lanes = [-2.2, 0, 2.2];
export const initialSpeed = 18;

const obstacles = ['asteroid_a', 'asteroid_b', 'crystal', 'barrier'];
const gateSpacing = 125;
const spawnAhead = 100;
const obstacleSpawnStart = 120;
const firstObstacleRow = obstacleSpawnStart + 30;
const obstacleRampEnd = 600;
const nearMissWidth = 2.6;

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function multiplier(combo) {
  return Math.min(1 + combo * 0.1, 8);
}

export class Runner {
  constructor(world) {
    this.world = world;
    this.active = [];
    this.pool = new Map();
    this.reset();
  }

  reset() {
    while (this.active.length) this.recycle(this.active.length - 1);
    this.distance = 0;
    this.speed = initialSpeed;
    this.bonus = 0;
    this.combo = 0;
    this.nearMisses = 0;
    this.shield = false;
    this.magnet = 0;
    this.flash = 0;
    this.elapsed = 0;
    this.lane = 1;
    this.x = 0;
    this.fromX = 0;
    this.laneTime = 0.12;
    this.jump = 0;
    this.dive = 0;
    this.y = 0.44;
    this.dead = false;
    this.nextRow = 32;
    this.nextGate = gateSpacing;
    this.world.pose(this);
  }

  get score() {
    return Math.floor(this.distance + this.bonus);
  }

  move(direction) {
    const lane = clamp(this.lane + direction, 0, lanes.length - 1);
    if (lane === this.lane) return;
    this.lane = lane;
    this.fromX = this.x;
    this.laneTime = 0;
  }

  leap() {
    if (this.jump > 0 || this.dive > 0) return;
    this.jump = 0.82;
  }

  duck() {
    this.jump = 0;
    this.dive = 0.64;
  }

  spawn(kind, x, y, distance) {
    if (!this.pool.has(kind)) this.pool.set(kind, []);
    const pool = this.pool.get(kind);
    const item = pool.pop() ?? { kind, object: this.world.make(kind) };
    item.distance = distance;
    item.x = x;
    item.y = y;
    item.pull = 0;
    item.nearMiss = false;
    item.hit = false;
    item.object.position.set(x, y, this.distance - distance);
    item.object.rotation.set(0, 0, 0);
    item.object.visible = true;
    this.active.push(item);
  }

  recycle(index) {
    const item = this.active[index];
    item.object.visible = false;
    this.pool.get(item.kind).push(item);
    this.active[index] = this.active[this.active.length - 1];
    this.active.pop();
  }

  spawnRow() {
    const remaining = [...lanes];
    const difficulty = (this.speed - initialSpeed) / (46 - initialSpeed);
    const hasObstacles = this.nextRow >= firstObstacleRow;
    const ramp = clamp((this.nextRow - firstObstacleRow) / (obstacleRampEnd - firstObstacleRow), 0, 1);
    const doubleChance = ramp * (0.16 + difficulty * 0.64);
    const count = hasObstacles ? (Math.random() < doubleChance ? 2 : 1) : 0;
    // Each row has an open lane. The minimum row gap allows two full lane moves.
    for (let i = 0; i < count; i++) {
      const x = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
      this.spawn(pick(obstacles), x, 0, this.nextRow);
    }

    const x = pick(remaining);
    const arc = Math.random() < 0.35;
    for (let i = 0; i < 5; i++) {
      const rise = arc ? Math.sin(i * Math.PI / 4) * 1.15 : 0;
      this.spawn('shard', x, 0.52 + rise, this.nextRow - 4 + i * 2);
    }
    if (Math.random() < 0.24) {
      this.spawn(pick(['shield', 'magnet']), x, 0.35, this.nextRow + 7);
    }
    const normalInterval = 1.65 - difficulty * 1.06;
    const interval = hasObstacles ? 2.75 + (normalInterval - 2.75) * ramp : normalInterval;
    this.nextRow += this.speed * (interval + Math.random() * 0.23);
    if (!hasObstacles) this.nextRow = Math.min(this.nextRow, firstObstacleRow);
  }

  laneX(time) {
    const t = clamp(time / 0.12, 0, 1);
    return this.fromX + (lanes[this.lane] - this.fromX) * t * t * (3 - 2 * t);
  }

  advance(dt) {
    this.elapsed += dt;
    this.speed = Math.min(46, this.speed + 0.35 * dt);
    this.distance += this.speed * dt;
    this.magnet = Math.max(0, this.magnet - dt);
    this.flash = Math.max(0, this.flash - dt);
    const laneTime = this.laneTime + dt;
    this.laneTime = Math.min(0.12, laneTime);
    this.x = this.laneX(laneTime);
    this.jump = Math.max(0, this.jump - dt);
    this.dive = Math.max(0, this.dive - dt);
    const hover = 0.44 + Math.sin(this.elapsed * 8) * 0.035;
    const targetY = this.dive > 0 ? 0.11 : hover + 1.48 * Math.sin(Math.PI * this.jump / 0.82);
    this.y += (targetY - this.y) * Math.min(1, dt * (this.dive > 0 ? 34 : 24));

    while (this.nextRow - this.distance < spawnAhead
      && (this.nextRow < firstObstacleRow || this.distance >= obstacleSpawnStart)) {
      this.spawnRow();
    }
    while (this.nextGate - this.distance < spawnAhead) {
      this.spawn('gate', 0, 0, this.nextGate);
      this.nextGate += gateSpacing;
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      const z = this.distance - item.distance;
      item.object.position.z = z;

      if (obstacles.includes(item.kind)) {
        if (this.passObstacle(item, z, dt, laneTime) || z > 9) this.recycle(i);
        if (this.dead) break;
      } else if (item.kind === 'gate') {
        if (!item.hit && z >= 0) {
          item.hit = true;
          this.bonus += 50;
          this.flash = 0.27;
        }
        if (z > 14) this.recycle(i);
      } else if (this.collect(item, z, dt) || z > 8) {
        this.recycle(i);
      }
    }

    this.world.pose(this);
  }

  passObstacle(item, z, dt, laneTime) {
    if (item.hit) return false;
    const timeSincePass = z / this.speed;
    if (timeSincePass >= 0 && timeSincePass < dt) {
      const passX = this.laneX(laneTime - timeSincePass);
      item.nearMiss = Math.abs(passX - item.x) < nearMissWidth;
    }
    const depth = item.kind === 'asteroid_b' ? 1.12 : item.kind === 'asteroid_a' ? 0.94 : 0.66;
    const width = item.kind === 'asteroid_b' ? 1.16 : 1.08;
    if (Math.abs(z) <= depth) {
      const gap = Math.abs(this.x - item.x);
      const cleared = (item.kind === 'crystal' && this.y >= 0.72)
        || (item.kind === 'barrier' && this.dive > 0 && this.y <= 0.38);
      if (gap < width && !cleared) {
        item.hit = true;
        this.combo = 0;
        if (this.shield) {
          this.shield = false;
          return true;
        }
        this.dead = true;
      }
    } else if (z > depth) {
      // Award only after the collision window closes, using the gap at the crossing.
      item.hit = true;
      if (item.nearMiss) {
        this.nearMisses++;
        this.combo++;
      }
    }
    return false;
  }

  collect(item, z, dt) {
    const position = item.object.position;
    item.object.rotation.y += dt * 2.7;
    if (item.kind === 'shard' && this.magnet > 0 && Math.abs(z) < 7) {
      item.pull = Math.min(1, item.pull + dt * 5);
      position.x += (this.x - position.x) * dt * 16;
      position.y += (this.y + 0.1 - position.y) * dt * 16;
      position.z *= 1 - item.pull;
    }
    const collected = Math.abs(position.z) < 0.85
      && Math.abs(position.x - this.x) < 0.72
      && Math.abs(position.y - this.y) < 0.58;
    if (!collected) return false;
    if (item.kind === 'shard') this.bonus += 25 * multiplier(this.combo);
    if (item.kind === 'shield') this.shield = true;
    if (item.kind === 'magnet') this.magnet = 6;
    return true;
  }
}
