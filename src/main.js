import * as THREE from 'three';
import { createAudio } from './audio.js';
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
    document.getElementById('mute').hidden = true;
    return null;
  }
}

function startGame(renderer) {
  container.prepend(renderer.domElement);
  const world = createWorld(container, renderer);
  const audio = createAudio();
  const run = new Runner(world, onRunEvent);
  const step = 1 / 120;
  const crashDuration = 0.6;
  const crashTimeScale = 0.25;
  let state = 'title';
  let previousTime = null;
  let accumulator = 0;
  let crashRemaining = 0;

  function onRunEvent(event, value, combo) {
    switch (event) {
      case 'shard':
        world.effects.burst(value);
        audio.play(event, combo);
        break;
      case 'nearMiss':
        world.effects.shake(0.08, 0.15);
        ui.nearMiss(value);
        audio.play(event);
        break;
      case 'crash':
        world.effects.shake(0.3, 0.4);
        break;
      case 'mission':
        ui.missionComplete(run, value);
        break;
      default:
        audio.play(event);
    }
  }

  function setState(next) {
    state = next;
    previousTime = null;
    accumulator = 0;
    ui.show(state);
    audio.setMusic(state === 'playing');
    if (state === 'playing') document.activeElement?.blur();
  }

  function startRun() {
    audio.start();
    audio.play('click');
    world.effects.reset();
    run.reset();
    ui.start(run);
    ui.update(run);
    setState('playing');
  }

  function togglePause() {
    if (state === 'playing') {
      audio.play('click');
      setState('paused');
    } else if (state === 'paused' && !document.hidden) {
      audio.play('click');
      setState('playing');
    }
  }

  function toggleMute() {
    audio.toggleMute();
    audio.play('click');
    ui.setMuted(audio.muted);
  }

  document.getElementById('start').addEventListener('click', startRun);
  document.getElementById('restart').addEventListener('click', startRun);
  document.getElementById('pause').addEventListener('click', togglePause);
  document.getElementById('resume').addEventListener('click', togglePause);
  document.getElementById('mute').addEventListener('click', toggleMute);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') setState('paused');
  });

  bindInput(renderer.domElement, {
    left: () => { if (state === 'playing') run.move(-1); },
    right: () => { if (state === 'playing') run.move(1); },
    jump: () => { if (state === 'playing') run.leap(); },
    dive: () => { if (state === 'playing') run.duck(); },
    pause: togglePause,
    mute: toggleMute,
  });

  ui.setMuted(audio.muted);
  ui.show('title');
  renderer.setAnimationLoop(time => {
    const frameTime = (time - (previousTime ?? time)) / 1000;
    previousTime = time;
    if (state === 'playing') {
      const dt = Math.min(0.1, frameTime);
      accumulator += dt;
      while (accumulator >= step && !run.dead) {
        run.advance(step);
        accumulator -= step;
      }
      world.pose(run);
      world.effects.update(run.dead ? 0 : dt, run.speed);
      ui.update(run);
      if (run.dead) {
        crashRemaining = crashDuration;
        setState('crashing');
        previousTime = time;
      }
    } else if (state === 'crashing') {
      const dt = Math.min(crashRemaining, frameTime);
      run.advanceCrash(dt * crashTimeScale);
      world.effects.update(dt * crashTimeScale, run.speed, dt);
      crashRemaining -= dt;
      if (crashRemaining <= 0) {
        ui.finish(run);
        setState('results');
      }
    }
    world.render();
  });
}

const renderer = initializeRenderer();
if (renderer) startGame(renderer);
