/* global window */
// Shared classic script: both React and the standalone Game Center use this engine.
(function (win) {
  'use strict';
  if (win.family100Audio) return;

  const doc = win.document;
  const STORAGE_KEY = 'family100.audio.v1';
  const defaults = { enabled: true, volume: 65, profile: 'game-show' };
  const listeners = new Set();
  const scenes = new Set();
  const voices = new Set();
  const eventIds = new Set();
  const MAX_VOICES = 64;
  const MAX_EVENT_IDS = 256;
  let settings = { ...defaults };
  let context;
  let master;
  let compressor;
  let noiseBuffer;
  let resumeTask;
  let generation = 0;
  let introPlayed = false;
  let explicitCue = 0;
  let primaryCue = 0;

  function validate(value, base) {
    if (!value || typeof value !== 'object') return { ...base };
    return {
      enabled: typeof value.enabled === 'boolean' ? value.enabled : base.enabled,
      volume: typeof value.volume === 'number' && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(100, Math.round(value.volume))) : base.volume,
      profile: value.profile === 'normal' || value.profile === 'game-show' ? value.profile : base.profile,
    };
  }

  try {
    const saved = win.localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      const legacy = JSON.parse(win.localStorage.getItem('family100.session.v1') || 'null');
      if (legacy && legacy.settings && legacy.settings.sound === false) {
        settings.enabled = false;
        win.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
    } else settings = validate(JSON.parse(saved), defaults);
  } catch { /* Settings remain usable in memory if legacy data or storage is unavailable. */ }

  function audible() {
    return settings.enabled && settings.volume > 0 && !doc.hidden;
  }

  function getSettings() { return { ...settings }; }

  function level() { return Math.pow(settings.volume / 100, 1.35) * .72; }

  function smooth(parameter, value, at, duration) {
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(at);
    else {
      parameter.cancelScheduledValues(at);
      parameter.setValueAtTime(parameter.value, at);
    }
    parameter.linearRampToValueAtTime(value, at + duration);
  }

  function disconnect(node) {
    try { node.disconnect(); } catch { /* Already released or unsupported node. */ }
  }

  function releaseVoice(voice) {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    voice.nodes.forEach(disconnect);
    voice.scene.voices.delete(voice);
    if (voice.scene.voices.size === 0) {
      disconnect(voice.scene.bus);
      scenes.delete(voice.scene);
    }
  }

  function fadeScene(scene) {
    const now = context.currentTime;
    const immediate = context.state !== 'running';
    scene.cancelled = true;
    if (immediate) {
      scene.bus.gain.cancelScheduledValues(now);
      scene.bus.gain.setValueAtTime(0, now);
    } else smooth(scene.bus.gain, 0, now, .035);
    for (const voice of [...scene.voices]) {
      try { voice.source.stop(immediate || voice.start > now ? now : now + .04); } catch { /* May have ended. */ }
      if (immediate || voice.start > now) releaseVoice(voice);
    }
  }

  function stop() {
    generation++;
    if (!context || context.state === 'closed') return;
    for (const scene of [...scenes]) fadeScene(scene);
  }

  function applySettings(partial, persist) {
    const next = validate(partial, settings);
    if (next.enabled === settings.enabled && next.volume === settings.volume && next.profile === settings.profile) return getSettings();
    settings = next;
    if (!audible()) stop();
    if (master && context && context.state !== 'closed') {
      try { smooth(master.gain, audible() ? level() : 0, context.currentTime, .035); } catch { /* Closed during update. */ }
    }
    if (persist) {
      try { win.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Private browsing may reject writes. */ }
    }
    for (const listener of listeners) {
      try { listener(getSettings()); } catch { /* One subscriber cannot break the engine. */ }
    }
    return getSettings();
  }

  function setSettings(partial) { return applySettings(partial, true); }

  function buildContext() {
    const Constructor = win.AudioContext || win.webkitAudioContext;
    if (!Constructor) return false;
    context = new Constructor();
    master = context.createGain();
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 12;
    compressor.ratio.value = 8;
    compressor.attack.value = .003;
    compressor.release.value = .18;
    master.gain.setValueAtTime(level(), context.currentTime);
    master.connect(compressor);
    compressor.connect(context.destination);
    noiseBuffer = undefined;
    resumeTask = undefined;
    return true;
  }

  async function ready(target) {
    if (!target || target.state === 'closed') return false;
    try {
      if (target.state !== 'running') {
        if (!resumeTask) {
          const pending = Promise.resolve(target.resume());
          resumeTask = pending;
          // Always handle rejection and clear for another user interaction to retry.
          pending.then(() => { if (resumeTask === pending) resumeTask = undefined; }, () => { if (resumeTask === pending) resumeTask = undefined; });
        }
        await resumeTask;
      }
      return target === context && target.state === 'running';
    } catch { return false; }
  }

  async function unlock() {
    if (!audible()) return false;
    const ticket = generation;
    try {
      if (!context || context.state === 'closed') {
        for (const voice of [...voices]) releaseVoice(voice);
        if (master) disconnect(master);
        if (compressor) disconnect(compressor);
        if (!buildContext()) return false;
      }
      const unlocked = await ready(context);
      return unlocked && ticket === generation && audible();
    } catch { return false; }
  }

  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .8), context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      // Deterministic noise avoids network assets and keeps rendered checks reproducible.
      let seed = 1973;
      for (let index = 0; index < data.length; index++) {
        seed = (seed * 16807) % 2147483647;
        data[index] = seed / 1073741824 - 1;
      }
    }
    return noiseBuffer;
  }

  function voice(scene, frequency, offset, duration, amplitude, type, endFrequency) {
    if (voices.size >= MAX_VOICES) return;
    const start = scene.start + offset;
    const end = start + duration;
    const source = frequency === null ? context.createBufferSource() : context.createOscillator();
    const envelope = context.createGain();
    const nodes = [source, envelope];
    if (frequency === null) {
      source.buffer = noise();
      const filter = context.createBiquadFilter();
      filter.type = type === 'lowpass' ? 'lowpass' : 'bandpass';
      filter.Q.value = .7;
      filter.frequency.setValueAtTime(endFrequency ? 350 : 1800, start);
      filter.frequency.exponentialRampToValueAtTime(endFrequency || 550, end);
      source.connect(filter);
      filter.connect(envelope);
      nodes.push(filter);
    } else {
      source.type = type || 'sine';
      source.frequency.setValueAtTime(frequency, start);
      if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, end);
      source.connect(envelope);
    }
    // Short attack and a complete release keep every source click-free.
    const attack = Math.min(.012, duration * .18);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.linearRampToValueAtTime(amplitude, start + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, end - .006);
    envelope.gain.linearRampToValueAtTime(0, end);
    envelope.connect(scene.bus);
    const record = { source, nodes, scene, start };
    scene.voices.add(record);
    voices.add(record);
    source.onended = () => releaseVoice(record);
    source.start(start);
    source.stop(end + .005);
    scene.end = Math.max(scene.end, end + .005);
  }

  function compose(scene, name, points) {
    const rich = settings.profile === 'game-show';
    const tone = (hz, at, duration, gain = .12, type = 'sine', end) => voice(scene, hz, at, duration, gain, type, end);
    const sweep = (at = 0, duration = .24, gain = .12) => voice(scene, null, at, duration, gain, 'bandpass', 5200);
    const sequence = (notes, at, step, duration, gain = .12, type = 'sine') => notes.forEach((hz, index) => tone(hz, at + index * step, duration, gain, type));
    const bell = (hz, at, duration = .4, gain = .17) => {
      tone(hz, at, duration, gain);
      if (rich) tone(hz * 2.003, at, duration * .55, gain * .25);
    };
    const coins = (at) => sequence([1318.51, 1567.98, 2093], at, .085, .16, .09);
    const flourish = (at = 0) => {
      sequence([523.25, 659.25, 783.99, 1046.5], at, .09, .3, .1, 'triangle');
      if (rich) {
        tone(261.63, at, .45, .1, 'triangle');
        voice(scene, null, at + .18, .24, .06, 'lowpass');
      }
    };
    const fanfare = (winner) => {
      if (!rich) {
        sequence(winner ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5] : [392, 523.25, 659.25, 783.99], 0, .17, .4, .15, 'triangle');
        return;
      }
      sweep(0, .32, .11);
      const chords = winner ? [[261.63, 329.63, 392], [349.23, 440, 523.25], [392, 493.88, 587.33], [523.25, 659.25, 783.99]]
        : [[261.63, 329.63, 392], [349.23, 440, 523.25], [392, 493.88, 587.33], [261.63, 329.63, 523.25]];
      chords.forEach((chord, index) => {
        const at = .15 + index * .27;
        chord.forEach(hz => tone(hz, at, index === 3 ? .85 : .33, .065, 'triangle'));
        tone(chord[0] / 2, at, .28, .12, 'sine');
        voice(scene, null, at, .08, .06, 'lowpass');
      });
      sequence(winner ? [783.99, 1046.5, 1174.66, 1318.51, 1567.98] : [523.25, 659.25, 783.99, 1046.5], .18, .135, .26, .1, 'triangle');
      bell(winner ? 2093 : 1567.98, 1.05, .65, .11);
    };

    switch (name) {
      case 'intro':
        if (rich) sweep(0, .2, .08);
        sequence([523.25, 659.25, 783.99, 1046.5], .04, .1, .23, .1, 'triangle');
        if (rich) {
          tone(261.63, .04, .4, .09, 'triangle');
          bell(1567.98, .34, .38, .09);
        }
        break;
      case 'opening': fanfare(false); break;
      case 'winner': fanfare(true); break;
      case 'question':
        if (rich) sweep(0, .23, .09);
        sequence([392, 523.25, 659.25], .05, .105, .23, .12, 'triangle');
        bell(880, .38, .22, .065);
        break;
      case 'correct': case 'steal-success':
        if (rich) sweep(0, .16, .075);
        bell(name === 'steal-success' ? 987.77 : 1046.5, .06, .42);
        bell(1567.98, .12, .35, .1);
        if (rich || points > 0) coins(.25);
        if (name === 'steal-success') {
          sequence([659.25, 783.99, 1046.5], .42, .1, .3, .1, 'triangle');
          if (rich) tone(261.63, .42, .4, .09, 'triangle');
        }
        if (points >= 30) flourish(name === 'steal-success' ? .8 : .48);
        break;
      case 'wrong':
        tone(155.56, 0, .34, .14, 'sawtooth', 123.47);
        if (rich) tone(164.81, .01, .3, .075, 'square', 130.81);
        break;
      case 'steal-fail':
        sequence([293.66, 220, 146.83], 0, .12, .24, .14, 'triangle');
        if (rich) voice(scene, null, .12, .24, .055, 'lowpass');
        break;
      case 'reveal':
        if (rich) sweep(0, .17, .08);
        bell(1174.66, .08, .28, .13);
        break;
      case 'score': coins(0); break;
      case 'celebration': flourish(0); break;
      case 'steal':
        if (rich) sweep(0, .3, .1);
        sequence([329.63, 440, 659.25], .06, .13, .3, .12, 'triangle');
        break;
      case 'timeout':
        sequence([440, 349.23, 261.63], 0, .12, .22, .13, 'triangle');
        if (rich) tone(130.81, .24, .35, .12, 'sine');
        break;
      case 'countdown': tone(1100, 0, .065, .07); break;
      case 'turn': sequence([659.25, 880], 0, .1, .18, .11, 'triangle'); break;
      case 'discussion': sequence([523.25, 659.25], 0, .12, .22, .09); break;
      case 'click': tone(760, 0, .035, .045, 'sine', 540); break;
    }
  }

  // One catalog supplies both settings menus; IDs are also used by live game events.
  const effects = [
    { id: 'intro', label: 'Intro aplikasi', description: 'Sapaan game show singkat setelah interaksi pertama.' },
    { id: 'opening', label: 'Mulai permainan', description: 'Fanfare pembuka saat permainan dimulai.' },
    { id: 'question', label: 'Soal berikutnya', description: 'Whoosh dan transisi digital menuju soal baru.' },
    { id: 'correct', label: 'Jawaban benar', description: 'Ding kemenangan saat jawaban dinyatakan benar.' },
    { id: 'wrong', label: 'Jawaban salah', description: 'Buzzer saat guru menandai jawaban salah.' },
    { id: 'reveal', label: 'Buka jawaban', description: 'Sapuan dan bel saat kotak jawaban dibuka.' },
    { id: 'score', label: 'Tambah poin', description: 'Rangkaian bunyi koin saat tim memperoleh poin.' },
    { id: 'celebration', label: 'Bonus / poin tinggi', description: 'Perayaan singkat untuk jawaban bernilai minimal 30 poin.' },
    { id: 'steal', label: 'Final Steal dimulai', description: 'Sting suspense saat kesempatan Final Steal dimulai.' },
    { id: 'steal-success', label: 'Final Steal berhasil', description: 'Bel kemenangan dan fanfare untuk Final Steal berhasil.' },
    { id: 'steal-fail', label: 'Final Steal gagal', description: 'Nada dramatis menurun saat Final Steal gagal.' },
    { id: 'countdown', label: 'Countdown 5 detik', description: 'Satu ketukan dari hitung mundur lima detik terakhir.' },
    { id: 'timeout', label: 'Waktu habis', description: 'Buzzer penutup ketika timer mencapai nol.' },
    { id: 'turn', label: 'Pergantian giliran', description: 'Chime saat giliran berpindah ke tim berikutnya.' },
    { id: 'discussion', label: 'Pembahasan', description: 'Notifikasi lembut ketika pembahasan dibuka.' },
    { id: 'winner', label: 'Pengumuman pemenang', description: 'Fanfare kemenangan utama saat hasil diumumkan.' },
    { id: 'click', label: 'Tombol biasa', description: 'Klik lembut untuk tombol dan navigasi biasa.' },
  ];
  const cueNames = new Set(effects.map(effect => effect.id));
  function getEffects() { return effects.map(effect => ({ ...effect })); }

  async function play(name, options) {
    if (!cueNames.has(name)) return false;
    explicitCue++;
    if (name !== 'click' && name !== 'countdown') primaryCue++;
    if (!audible() || !context || context.state === 'closed') return false;
    const ticket = generation;
    const target = context;
    const id = options && typeof options.id === 'string' && options.id ? options.id : undefined;
    if (id && eventIds.has(id)) return false;
    try {
      if (!await ready(target) || ticket !== generation || !audible()) return false;
      if (id && eventIds.has(id)) return false;
      const now = context.currentTime;
      const lowPriority = name === 'click' || name === 'countdown';
      if (lowPriority && [...scenes].some(scene => !scene.cancelled && scene.primary && scene.end > now)) return false;
      // Each meaningful event is one scene; its layered sounds share a release bus.
      for (const scene of [...scenes]) {
        if (!scene.cancelled && scene.end > now) fadeScene(scene);
      }
      const bus = context.createGain();
      bus.gain.setValueAtTime(.8, now);
      bus.connect(master);
      const scene = { bus, voices: new Set(), start: now + .008, end: now, primary: !lowPriority, cancelled: false };
      scenes.add(scene);
      compose(scene, name, options && Number.isFinite(options.points) ? options.points : 0);
      if (!scene.voices.size) { disconnect(bus); scenes.delete(scene); return false; }
      if (id) {
        eventIds.add(id);
        if (eventIds.size > MAX_EVENT_IDS) eventIds.delete(eventIds.values().next().value);
      }
      return true;
    } catch {
      // Browser audio failures are retryable and must never reject UI handlers.
      stop();
      return false;
    }
  }

  async function preview(name, options) {
    if (!cueNames.has(name)) return false;
    // Explicit previews may replace even a primary fanfare with a quiet click/tick.
    // Advancing the generation also invalidates earlier taps still awaiting resume.
    stop();
    const ticket = generation;
    if (!await unlock() || ticket !== generation) return false;
    return play(name, options);
  }

  async function activate(event) {
    if (!event.isTrusted) return;
    if (event.type === 'keydown' && (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !['Enter', ' ', 'Spacebar'].includes(event.key))) return;
    const issued = primaryCue;
    if (!await unlock() || introPlayed) return;
    introPlayed = true;
    // A first-action answer/question cue already supplies the audible introduction.
    if (issued !== primaryCue) return;
    await play('intro');
  }

  // Capturing keeps ordinary button feedback consistent across both applications.
  // Defer until all click handlers have had a chance to issue their explicit cue.
  function softClick(event) {
    if (!event.isTrusted || event.defaultPrevented) return;
    const target = event.target;
    const button = target && typeof target.closest === 'function' ? target.closest('button, a[href], [role="button"]') : null;
    if (!button || button.disabled || (button.matches && button.matches(':disabled')) || button.getAttribute('aria-disabled') === 'true' || target.closest('[data-audio-silent]')) return;
    const issued = explicitCue;
    const ticket = generation;
    win.setTimeout(() => {
      if (generation === ticket && explicitCue === issued && !event.defaultPrevented) void play('click');
    }, 0);
  }

  win.family100Audio = {
    getEffects,
    getSettings,
    setSettings,
    play,
    preview: (name) => preview(name),
    unlock,
    stop,
    test: () => preview('correct', { points: 35 }),
    subscribe: (listener) => {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  doc.addEventListener('pointerdown', activate, { capture: true, passive: true });
  doc.addEventListener('keydown', activate, { capture: true, passive: true });
  doc.addEventListener('click', softClick, true);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });
  win.addEventListener('pagehide', stop);
  win.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    try { applySettings(validate(JSON.parse(event.newValue), defaults), false); } catch { /* Ignore incomplete storage writes. */ }
  });
})(window);
