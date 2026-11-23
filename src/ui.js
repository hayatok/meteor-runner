import { multiplier } from './runner.js';

const key = 'meteor-runner.best';
const get = id => document.getElementById(id);
const number = value => Math.floor(value).toLocaleString('ja-JP');
const meters = value => `${number(value)} m`;

function readBest() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Number.isFinite(saved?.score) && Number.isFinite(saved.distance)) return saved;
  } catch {
    // Storage can be unavailable, including when the page is opened privately.
  }
  return { score: 0, distance: 0 };
}

export function createUI() {
  let best = readBest();
  const flash = get('flash');
  const score = get('score');
  const distance = get('distance');
  const combo = get('combo');
  const speed = get('speed');
  const power = get('power');
  const hud = get('hud');

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function bestText() {
    return `ベスト  ${number(best.score)} 点  /  ${meters(best.distance)}`;
  }

  function show(state) {
    for (const screen of ['title', 'paused', 'results', 'error']) get(screen).hidden = screen !== state;
    hud.hidden = state !== 'playing' && state !== 'paused';
    if (state === 'title') get('title-best').textContent = bestText();
    if (state !== 'playing') flash.style.opacity = 0;
    const button = { paused: 'resume', results: 'restart' }[state];
    if (button) get(button).focus({ preventScroll: true });
  }

  function update(run) {
    setText(score, number(run.score));
    setText(distance, meters(run.distance));
    setText(combo, `×${multiplier(run.combo).toFixed(1)}`);
    setText(speed, `${run.speed.toFixed(1)} m/s`);
    const effects = [];
    if (run.shield) effects.push('シールド');
    if (run.magnet > 0) effects.push(`マグネット ${Math.ceil(run.magnet)} 秒`);
    setText(power, effects.join('　'));
    flash.style.opacity = run.flash / 0.27 * 0.24;
  }

  function finish(run) {
    const next = { score: Math.max(best.score, run.score), distance: Math.max(best.distance, Math.floor(run.distance)) };
    if (next.score !== best.score || next.distance !== best.distance) {
      best = next;
      try {
        localStorage.setItem(key, JSON.stringify(best));
      } catch {
        // The record remains available for the current session.
      }
    }
    get('result-score').textContent = number(run.score);
    get('result-distance').textContent = meters(run.distance);
    get('result-misses').textContent = number(run.nearMisses);
    get('result-best').textContent = bestText();
    show('results');
  }

  return { finish, show, update };
}
