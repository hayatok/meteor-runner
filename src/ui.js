import { missionBonus, scoreRank } from './missions.js';
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
  const miss = get('near-miss');
  const toasts = get('mission-toasts');
  const missionList = get('missions');
  let missAnimation;

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function bestText() {
    return `ベスト  ${number(best.score)} 点  /  ${meters(best.distance)}`;
  }

  function show(state) {
    for (const screen of ['title', 'paused', 'results', 'error']) get(screen).hidden = screen !== state;
    hud.hidden = !['playing', 'paused', 'crashing'].includes(state);
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

  function missionItem(mission) {
    const item = document.createElement('li');
    item.textContent = `${mission.done ? '達成' : '未達成'} · ${mission.label}`;
    item.classList.toggle('completed', mission.done);
    return item;
  }

  function start(run) {
    missAnimation?.cancel();
    miss.textContent = '';
    toasts.replaceChildren();
    missionList.replaceChildren(...run.missions.map(missionItem));
  }

  function nearMiss(combo) {
    missAnimation?.cancel();
    miss.textContent = `NEAR MISS ×${combo}`;
    missAnimation = miss.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 1, offset: 0.25 },
      { opacity: 0, transform: 'translateY(-12px)' },
    ], { duration: 800, fill: 'forwards' });
  }

  function missionComplete(run, label) {
    missionList.replaceChildren(...run.missions.map(missionItem));
    const toast = document.createElement('p');
    toast.textContent = `${label} 達成  +${missionBonus} 点`;
    toasts.append(toast);
    toast.animate([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 2400)
      .onfinish = () => toast.remove();
  }

  function setMuted(muted) {
    const button = get('mute');
    button.setAttribute('aria-pressed', String(muted));
    button.textContent = muted ? '消音' : '音あり';
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
    get('result-rank').textContent = `ランク ${scoreRank(run.score)}`;
    get('result-missions').replaceChildren(...run.missions.map(missionItem));
    get('result-mission-points').textContent = `ミッションボーナス +${number(run.missionPoints)} 点`;
  }

  return { finish, show, update, start, nearMiss, missionComplete, setMuted };
}
