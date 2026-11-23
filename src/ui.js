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
  const crashGlow = get('crash-glow');
  const score = get('score');
  const distance = get('distance');
  const combo = get('combo');
  const speed = get('speed');
  const power = get('power');
  const hud = get('hud');
  const miss = get('near-miss');
  const toasts = get('mission-toasts');
  const missionList = get('missions');
  const chain = get('chain');
  const countdown = get('countdown');
  const notices = [miss, chain, countdown, get('phase-banner'), get('fever-banner')];
  const resultScore = get('result-score');
  const resultRank = get('result-rank');
  const animations = new Map();
  let missAnimation;
  let results;

  function animate(element, frames, options) {
    animations.get(element)?.cancel();
    const animation = element.animate(frames, options);
    animations.set(element, animation);
    return animation;
  }

  function banner(id, message) {
    const element = get(id);
    element.textContent = message;
    animate(element, [
      { opacity: 0, transform: 'translateX(50px)' },
      { opacity: 1, transform: 'translateX(0)', offset: 0.19 },
      { opacity: 1, transform: 'translateX(0)', offset: 0.74 },
      { opacity: 0, transform: 'translateX(-55px)' },
    ], { duration: 1450, fill: 'both' });
  }

  function showChain(count, ended = false) {
    chain.textContent = ended ? `CHAIN ×${count} END` : `CHAIN ×${count}`;
    const size = ended ? 0.78 : Math.min(1.55, 0.95 + count * 0.07);
    chain.style.color = ended ? '#f5ead9' : `color-mix(in srgb, #f5ead9, #ffd94d ${Math.min(100, count * 14)}%)`;
    animate(chain, [
      { opacity: 1, transform: `scale(${size * 1.13})` },
      { opacity: 1, transform: `scale(${size})`, offset: 0.25 },
      { opacity: 0, transform: `translateY(-7px) scale(${size})` },
    ], { duration: ended ? 550 : 760, fill: 'forwards' });
  }

  function count(label) {
    countdown.hidden = false;
    countdown.textContent = label;
    animate(countdown, [
      { opacity: 0, transform: 'scale(.32)' },
      { opacity: 1, transform: 'scale(1.12)', offset: 0.24 },
      { opacity: 1, transform: 'scale(1)', offset: 0.67 },
      { opacity: 0, transform: 'scale(1.18)' },
    ], { duration: label === 'GO!' ? 570 : 900, fill: 'both' });
  }

  function flashScreen(kind) {
    flash.dataset.effect = kind;
    if (kind === 'crash') {
      animate(flash, [
        { opacity: 0.98 },
        { opacity: 0.98, offset: 150 / 400, easing: 'ease-out' },
        { opacity: 0 },
      ], { duration: 400, fill: 'forwards' });
      animate(crashGlow, [
        { opacity: 0.85 },
        { opacity: 0.85, offset: 0.4, easing: 'ease-out' },
        { opacity: 0 },
      ], { duration: 500, fill: 'forwards' });
      return;
    }
    animate(flash, [{ opacity: 0.78 }, { opacity: 0 }], {
      duration: kind === 'gate' ? 510 : 310, easing: 'ease-out', fill: 'forwards',
    });
  }

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function bestText() {
    return `ベスト  ${number(best.score)} 点  /  ${meters(best.distance)}`;
  }

  function show(state) {
    for (const screen of ['title', 'paused', 'results', 'error']) get(screen).hidden = screen !== state;
    hud.hidden = !['countdown', 'playing', 'paused', 'impact', 'crashing'].includes(state);
    if (!['countdown', 'playing'].includes(state)) countdown.hidden = true;
    if (state === 'title') get('title-best').textContent = bestText();
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

  }

  function missionItem(mission) {
    const item = document.createElement('li');
    item.textContent = `${mission.done ? '達成' : '未達成'} · ${mission.label}`;
    item.classList.toggle('completed', mission.done);
    return item;
  }

  function start(run) {
    missAnimation?.cancel();
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
    results = null;
    for (const notice of notices) notice.textContent = '';
    countdown.hidden = true;
    delete flash.dataset.effect;
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
    results = { elapsed: 0, score: run.score, shown: 0, tick: 0, rank: scoreRank(run.score) };
    resultScore.textContent = number(0);
    resultRank.style.opacity = 0;
    get('result-distance').textContent = meters(run.distance);
    get('result-misses').textContent = number(run.nearMisses);
    get('result-best').textContent = bestText();
    resultRank.textContent = '';
    get('result-missions').replaceChildren(...run.missions.map(missionItem));
    get('result-mission-points').textContent = `ミッションボーナス +${number(run.missionPoints)} 点`;
  }

  function updateResults(dt, play, celebrate) {
    if (!results) return;
    results.elapsed += dt;
    const progress = Math.min(1, results.elapsed / 1.15);
    const displayed = Math.floor(results.score * (1 - (1 - progress) ** 2));
    if (displayed !== results.shown) {
      results.shown = displayed;
      resultScore.textContent = number(displayed);
      if (results.elapsed >= results.tick) {
        play('tick');
        results.tick = results.elapsed + 0.065;
      }
    }
    if (results.elapsed < 1.24) return;
    const { rank } = results;
    resultRank.textContent = `ランク ${rank}`;
    resultRank.style.opacity = 1;
    animate(resultRank, [
      { opacity: 0, transform: 'scale(2.4) rotate(-13deg)' },
      { opacity: 1, transform: 'scale(.9) rotate(3deg) translateX(5px)', offset: 0.34 },
      { transform: 'scale(1.04) rotate(-2deg) translateX(-4px)', offset: 0.55 },
      { transform: 'scale(1) rotate(0) translateX(0)' },
    ], { duration: 380, easing: 'ease-out' });
    play('stamp');
    if (rank === 'S' || rank === 'A') celebrate();
    results = null;
  }

  return { finish, show, update, updateResults, start, nearMiss, missionComplete, setMuted,
    count, showChain, banner, flashScreen };
}
