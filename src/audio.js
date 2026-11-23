const muteKey = 'meteor-runner.muted';
const sixteenth = 60 / 132 / 4;
const arp = [0, 7, 12, 15, 12, 7, 3, 7];
const thirds = [0, 1, 1, 1];
const roots = [45, 41, 48, 43];
const frequency = note => 440 * 2 ** ((note - 69) / 12);

export function createAudio() {
  let muted = false;
  try {
    muted = localStorage.getItem(muteKey) === 'true';
  } catch {
    // Audio remains usable if storage is unavailable.
  }

  let context;
  let master;
  let music;
  let noise;
  let timer;
  let beat = 0;
  let nextNote = 0;

  function start() {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.65;
      master.connect(context.destination);
      music = context.createGain();
      music.gain.value = 0;
      music.connect(master);
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.4), context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    if (context.state !== 'running') context.resume().catch(() => {});
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.65, context.currentTime, 0.015);
    try {
      localStorage.setItem(muteKey, String(muted));
    } catch {
      // Keep the setting for this session.
    }
  }

  function envelope(destination, time, duration, volume) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(destination);
    return gain;
  }

  function tone(time, startHz, endHz, duration, type, volume, destination = master) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startHz, time);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, time + duration);
    oscillator.connect(envelope(destination, time, duration, volume));
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  function wind(time, duration, type, startHz, endHz, volume) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    source.buffer = noise;
    filter.type = type;
    filter.frequency.setValueAtTime(startHz, time);
    filter.frequency.exponentialRampToValueAtTime(endHz, time + duration);
    source.connect(filter);
    filter.connect(envelope(master, time, duration, volume));
    source.start(time);
    source.stop(time + duration);
  }

  function schedule() {
    if (context.state !== 'running') return;
    nextNote = Math.max(nextNote, context.currentTime);
    while (nextNote < context.currentTime + 0.1) {
      const chord = Math.floor(beat / 16);
      const root = roots[chord];
      if (beat % 2 === 0) {
        const bass = frequency(root - 12);
        tone(nextNote, bass, bass, 0.16, 'triangle', 0.12, music);
      }
      const interval = arp[beat % arp.length];
      const note = frequency(root + 12 + interval + (interval % 12 === 3 ? thirds[chord] : 0));
      tone(nextNote, note, note, 0.085, 'sine', 0.075, music);
      beat = (beat + 1) % 64;
      nextNote += sixteenth;
    }
  }

  function setMusic(playing) {
    if (!context) return;
    window.clearInterval(timer);
    music.gain.cancelScheduledValues(context.currentTime);
    music.gain.setTargetAtTime(playing ? 0.55 : 0, context.currentTime, 0.025);
    if (playing) {
      nextNote = context.currentTime + 0.105;
      timer = window.setInterval(schedule, 25);
      schedule();
    }
  }

  function play(effect, combo = 0) {
    if (!context || muted) return;
    const now = context.currentTime;
    function chime(notes, type = 'sine') {
      notes.forEach((note, index) => {
        const hz = frequency(note);
        tone(now + index * 0.045, hz, hz, 0.19, type, 0.14);
      });
    }
    switch (effect) {
      case 'shard': chime([74 + Math.min(combo, 24)]); break;
      case 'nearMiss': wind(now, 0.14, 'bandpass', 2700, 500, 0.5); break;
      case 'jump': tone(now, 180, 650, 0.17, 'triangle', 0.16); break;
      case 'dive': tone(now, 480, 100, 0.17, 'triangle', 0.16); break;
      case 'shield': chime([64, 71, 76], 'triangle'); break;
      case 'magnet': chime([72, 67, 79], 'triangle'); break;
      case 'gate': chime([69, 76, 81]); break;
      case 'collision':
        wind(now, 0.34, 'lowpass', 2400, 180, 0.55);
        tone(now, 83, 32, 0.36, 'triangle', 0.35);
        break;
      case 'click': tone(now, 620, 420, 0.055, 'sine', 0.14); break;
    }
  }

  return { start, toggleMute, setMusic, play, get muted() { return muted; } };
}
