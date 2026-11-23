import * as THREE from 'three';
import { bindInput } from './input.js';
import { Runner } from './runner.js';
import { createUI } from './ui.js';
import { createWorld } from './world.js';
import './style.css';

const container = document.getElementById('game');
const ui = createUI();

function initializeRenderer() {
  try {
    return new THREE.WebGLRenderer({ antialias: true });
  } catch {
    ui.show('error');
    return null;
  }
}

function startGame(renderer) {
  container.prepend(renderer.domElement);
  const world = createWorld(container, renderer);
  const run = new Runner(world);
  const step = 1 / 120;
  let state = 'title';
  let previousTime = null;
  let accumulator = 0;

  function setState(next) {
    state = next;
    previousTime = null;
    accumulator = 0;
    ui.show(state);
    if (state === 'playing') document.activeElement?.blur();
  }

  function startRun() {
    run.reset();
    ui.update(run);
    setState('playing');
  }

  function togglePause() {
    if (state === 'playing') setState('paused');
    else if (state === 'paused' && !document.hidden) setState('playing');
  }

  document.getElementById('start').addEventListener('click', startRun);
  document.getElementById('restart').addEventListener('click', startRun);
  document.getElementById('pause').addEventListener('click', togglePause);
  document.getElementById('resume').addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') setState('paused');
  });

  bindInput(renderer.domElement, {
    left: () => { if (state === 'playing') run.move(-1); },
    right: () => { if (state === 'playing') run.move(1); },
    jump: () => { if (state === 'playing') run.leap(); },
    dive: () => { if (state === 'playing') run.duck(); },
    pause: togglePause,
  });

  ui.show('title');
  renderer.setAnimationLoop(time => {
    if (state === 'playing') {
      accumulator += Math.min(0.1, (time - (previousTime ?? time)) / 1000);
      previousTime = time;
      while (accumulator >= step && !run.dead) {
        run.advance(step);
        accumulator -= step;
      }
      ui.update(run);
      if (run.dead) {
        setState('results');
        ui.finish(run);
      }
    }
    world.render();
  });
}

const renderer = initializeRenderer();
if (renderer) startGame(renderer);
