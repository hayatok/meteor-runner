import { Vector3 } from 'three';
import { multiplier } from './runner.js';

const phaseNames = ['', 'NIGHT', 'DEEP NIGHT', 'DAWN'];
const teal = '#2ec4b6';
const gold = '#ffd94d';

export function createPresentation(world, ui, audio) {
  const { effects } = world;
  const origin = new Vector3();
  let fever = false;
  let ignition = 0;
  let phase = 0;
  let phasePulse = 0;
  let chain = 0;
  let lastShard = -Infinity;
  let nextMagnetRing = Infinity;

  function setFever(active) {
    if (fever === active) return;
    fever = active;
    audio.setFever(fever);
    ui.banner('fever-banner', fever ? 'FEVER' : 'FEVER END');
    if (fever) audio.play('fever');
  }

  function event(run, name, value, combo) {
    origin.set(run.x, run.y + 0.32, 0);
    switch (name) {
      case 'shard':
        effects.burst(value);
        effects.shardTrace(value);
        chain = run.elapsed - lastShard <= 2 ? chain + 1 : 1;
        lastShard = run.elapsed;
        if (chain > 1) ui.showChain(chain);
        audio.play(name, combo);
        break;
      case 'nearMiss':
        effects.shake(0.08, 0.15);
        ui.nearMiss(value);
        setFever(multiplier(run.combo) >= 3);
        audio.play(name);
        break;
      case 'jump':
        origin.y = 0.05;
        effects.ring(origin, teal, 0.95, { floor: true, duration: 0.36 });
        audio.play(name);
        break;
      case 'land':
        origin.y = 0.05;
        effects.ring(origin, teal, 2.5, { floor: true });
        effects.ring(origin, '#f5ead9', 2.1, { floor: true, delay: 0.075 });
        effects.burst(origin, 'dust', 24);
        break;
      case 'gate':
        ui.flashScreen('gate');
        origin.set(0, 1.8, -0.45);
        effects.ring(origin, teal, 9, { duration: 0.72 });
        audio.play(name);
        break;
      case 'shield':
      case 'magnet':
        effects.ring(origin, name === 'shield' ? teal : gold, 2.7);
        if (name === 'magnet') nextMagnetRing = run.elapsed + 0.7;
        audio.play(name);
        break;
      case 'collision':
        setFever(false);
        break;
      case 'shieldBreak':
        effects.burst(origin, 'shield', 38);
        effects.ring(origin, teal, 2.4, { duration: 0.32 });
        audio.play('collision');
        audio.play(name);
        break;
      case 'crash':
        ui.flashScreen('crash');
        effects.burst(origin, 'crash', 90);
        effects.ring(origin, '#fff1cd', 6, { duration: 0.67 });
        effects.shake(0.3, 0.4);
        audio.play('explosion');
        break;
      case 'mission':
        ui.missionComplete(run, value);
        break;
      default:
        audio.play(name);
    }
  }

  function update(run) {
    const cycle = run.distance % 3500;
    const current = cycle < 500 ? 0 : cycle < 1500 ? 1 : cycle < 2500 ? 2 : 3;
    if (current !== phase) {
      phase = current;
      phasePulse = 1;
      if (phaseNames[phase]) ui.banner('phase-banner', phaseNames[phase]);
    }
    if (chain > 0 && run.elapsed - lastShard > 2) {
      if (chain > 1) ui.showChain(chain, true);
      chain = 0;
    }
    if (run.magnet > 0 && run.elapsed >= nextMagnetRing) {
      origin.set(run.x, run.y + 0.28, 0);
      effects.ring(origin, gold, 2.3, { floor: true, duration: 0.51 });
      nextMagnetRing = run.elapsed + 0.7;
    }
  }

  function present(run, dt, idle = false) {
    ignition = Math.max(0, ignition - dt * 2.8);
    phasePulse = Math.max(0, phasePulse - dt * 0.9);
    world.present(run, dt, { idle, fever, ignition, phasePulse });
  }

  function count(index) {
    ui.count(['3', '2', '1', 'GO!'][index]);
    if (index === 3) {
      ignition = 1;
      ui.flashScreen('go');
      audio.play('go');
      return;
    }
    audio.play('riser', index);
  }

  function celebrate() {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        origin.set(side * (2.1 + row * 0.4), 2 + row * 0.75, -1.5 - row * 2.3);
        effects.burst(origin, 'confetti', 16);
      }
    }
  }

  function reset() {
    fever = false;
    audio.setFever(false);
    ignition = phase = phasePulse = chain = 0;
    lastShard = -Infinity;
    nextMagnetRing = Infinity;
    effects.reset();
    world.resetPresentation();
  }

  return { event, update, present, count, celebrate, reset };
}
