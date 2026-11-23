import * as THREE from 'three';
import { createAudio } from './audio.js';
import { bindInput } from './input.js';
import { createPresentation } from './presentation.js';
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
  const presentation = createPresentation(world, ui, audio);
  const run = new Runner(world, (...event) => presentation.event(run, ...event));
  const step = 1 / 120;
  const impactDuration = 0.12;
  const crashDuration = 0.6;
  const crashTimeScale = 0.25;
  let state = 'title';
  let resumeState = 'playing';
  let previousTime = null;
  let accumulator = 0;
  let remaining = 0;
  let countdownTime = 0;
  let countdownIndex = 0;

  function isStartingOrPlaying() {
    return state === 'playing' || state === 'countdown';
  }

  function setState(next) {
    state = next;
    previousTime = null;
    accumulator = 0;
    ui.show(state);
    audio.setMusic(state === 'playing');
    if (state === 'playing' || state === 'countdown') document.activeElement?.blur();
  }

  function startRun() {
    const fromTitle = state === 'title';
    audio.start();
    audio.play('click');
    run.reset();
    presentation.reset();
    ui.start(run);
    ui.update(run);
    countdownTime = countdownIndex = 0;
    setState(fromTitle ? 'countdown' : 'playing');
    presentation.count(fromTitle ? 0 : 3);
  }

  function pause() {
    resumeState = state;
    setState('paused');
  }

  function togglePause() {
    if (state === 'playing' || state === 'countdown') {
      audio.play('click');
      pause();
    } else if (state === 'paused' && !document.hidden) {
      audio.play('click');
      setState(resumeState);
      if (resumeState === 'countdown') presentation.count(countdownIndex);
    }
  }

  function toggleMute() {
    audio.toggleMute();
    audio.play('click');
    ui.setMuted(audio.muted);
  }

  document.getElementById('start').addEventListener('click', startRun);
  document.getElementById('restart').addEventListener('click', startRun);
  document.getElementById('pause').addEventListener('click', event => {
    if (isStartingOrPlaying()) event.currentTarget.blur();
    togglePause();
  });
  document.getElementById('resume').addEventListener('click', togglePause);
  document.getElementById('mute').addEventListener('click', event => {
    if (isStartingOrPlaying()) event.currentTarget.blur();
    toggleMute();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state === 'playing' || state === 'countdown')) pause();
    previousTime = null;
  });

  bindInput(renderer.domElement, {
    left: () => { if (state === 'playing') run.move(-1); },
    right: () => { if (state === 'playing') run.move(1); },
    jump: () => { if (state === 'playing') run.leap(); },
    dive: () => { if (state === 'playing') run.duck(); },
    pause: togglePause,
    mute: toggleMute,
  }, () => state === 'playing');

  ui.setMuted(audio.muted);
  ui.show('title');
  renderer.setAnimationLoop(time => {
    const frameTime = (time - (previousTime ?? time)) / 1000;
    previousTime = time;
    const dt = Math.min(0.1, frameTime);
    if (state !== 'paused' && frameTime > 0 && !document.hidden) world.effects.sampleFrame(frameTime);

    if (state === 'title' || state === 'countdown') {
      const idle = state === 'title';
      if (!idle) {
        countdownTime += dt;
        const index = Math.min(3, Math.floor(countdownTime));
        if (index !== countdownIndex) {
          countdownIndex = index;
          if (index === 3) setState('playing');
          presentation.count(index);
        }
      }
      presentation.present(run, dt, idle);
      world.effects.update(dt, run.speed);
    } else if (state === 'playing') {
      accumulator += dt;
      while (accumulator >= step && !run.dead) {
        run.advance(step);
        accumulator -= step;
      }
      world.pose(run);
      presentation.update(run);
      presentation.present(run, dt);
      world.effects.update(run.dead ? 0 : dt, run.speed);
      ui.update(run);
      if (run.dead) {
        remaining = impactDuration;
        setState('impact');
        previousTime = time;
      }
    } else if (state === 'impact' || state === 'crashing') {
      const elapsed = Math.min(remaining, frameTime);
      const slow = state === 'crashing';
      if (slow) run.advanceCrash(elapsed * crashTimeScale);
      presentation.present(run, elapsed);
      world.effects.update(slow ? elapsed * crashTimeScale : elapsed, run.speed, elapsed);
      remaining -= elapsed;
      if (remaining <= 0) {
        if (slow) {
          ui.finish(run);
          setState('results');
        } else {
          remaining = crashDuration;
          setState('crashing');
          previousTime = time;
        }
      }
    } else if (state === 'results') {
      presentation.present(run, dt);
      ui.updateResults(dt, audio.play, presentation.celebrate);
      world.effects.update(dt, run.speed, dt, false);
    }
    world.render();
  });
}

const renderer = initializeRenderer();
if (renderer) startGame(renderer);
