(() => {
  'use strict';
  if (window.__sleepyTubeLoaded) return;
  window.__sleepyTubeLoaded = true;

  const { DEFAULTS, normalize } = globalThis.SleepyTube;
  const SMOOTH = 0.08; // seconds, time constant for parameter changes

  let settings = { ...DEFAULTS };
  let video = null;
  let engine = null;
  let attaching = false;
  let waitingForGesture = false;
  let rateTouched = false;
  let sleep = null;
  const connected = new WeakSet();

  // ---------- Buffers ----------

  function makeImpulse(ctx, seconds) {
    const rate = ctx.sampleRate;
    const pre = Math.floor(0.025 * rate);
    const tail = Math.max(1, Math.floor(seconds * rate));
    const buf = ctx.createBuffer(2, pre + tail, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < tail; i++) {
        const t = i / tail;
        const env = Math.exp(-6.9 * t) * (1 - t);
        // Damping increases over time so the tail gets darker.
        const alpha = 0.85 - 0.75 * t;
        lp += ((Math.random() * 2 - 1) - lp) * alpha;
        d[pre + i] = lp * env;
      }
    }
    return buf;
  }

  function fillNoise(type, out) {
    const n = out.length;
    if (type === 'white') {
      for (let i = 0; i < n; i++) out[i] = Math.random() * 2 - 1;
    } else if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < n; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        out[i] = last;
      }
    } else {
      // Pink noise (Paul Kellet's refined method); rain adds droplets on top.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      }
      if (type === 'rain') {
        let rms = 0;
        for (let i = 0; i < n; i++) rms += out[i] * out[i];
        rms = Math.sqrt(rms / n) || 1;
        let drop = 0, hp = 0;
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.0012) drop = Math.random() * 2.5 * rms;
          drop *= 0.996;
          const w = (Math.random() * 2 - 1) * drop;
          hp += (w - hp) * 0.3;
          out[i] = out[i] * 0.7 + (w - hp);
        }
      }
    }
  }

  function makeNoise(ctx, type) {
    const rate = ctx.sampleRate;
    const len = rate * 8;
    const fade = Math.floor(rate * 0.5);
    const buf = ctx.createBuffer(2, len, rate);
    const raw = new Float32Array(len + fade);
    for (let ch = 0; ch < 2; ch++) {
      fillNoise(type, raw);
      const d = buf.getChannelData(ch);
      // Crossfade the extra tail into the start so the loop point is seamless.
      for (let i = 0; i < len; i++) d[i] = raw[i];
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] = raw[i] * k + raw[len + i] * (1 - k);
      }
      let mean = 0;
      for (let i = 0; i < len; i++) mean += d[i];
      mean /= len;
      let rms = 0;
      for (let i = 0; i < len; i++) { d[i] -= mean; rms += d[i] * d[i]; }
      rms = Math.sqrt(rms / len) || 1;
      const scale = 0.2 / rms;
      for (let i = 0; i < len; i++) d[i] *= scale;
    }
    return buf;
  }

  // ---------- Engine ----------

  function createEngine() {
    const ctx = new AudioContext();
    const n = {};
    const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const filter = (type, freq, q) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      if (q !== undefined) f.Q.value = q;
      return f;
    };

    n.input = gain(1);
    n.bypass = gain(1);
    n.fxIn = gain(0);
    n.lowShelf = filter('lowshelf', 220);
    n.highShelf = filter('highshelf', 3500);
    n.lowpass = filter('lowpass', 20000, 0.6);
    n.dry = gain(1);
    n.convolver = ctx.createConvolver();
    n.reverbWet = gain(0);
    n.delay = ctx.createDelay(2);
    n.echoTone = filter('lowpass', 2400, 0.5);
    n.echoFeedback = gain(0);
    n.echoWet = gain(0);
    n.panner = ctx.createStereoPanner();
    n.lfo = ctx.createOscillator();
    n.lfoDepth = gain(0);
    n.compressor = ctx.createDynamicsCompressor();
    n.volume = gain(1);
    n.fade = gain(1);
    n.noiseFilter = filter('lowpass', 7000, 0.5);
    n.noiseGain = gain(0);

    n.lfo.frequency.value = 0.06;
    n.compressor.threshold.value = -20;
    n.compressor.knee.value = 20;
    n.compressor.ratio.value = 3;
    n.compressor.attack.value = 0.01;
    n.compressor.release.value = 0.3;

    n.input.connect(n.bypass).connect(n.fade);
    n.input.connect(n.fxIn).connect(n.lowShelf).connect(n.highShelf).connect(n.lowpass);
    n.lowpass.connect(n.dry).connect(n.panner);
    n.lowpass.connect(n.convolver).connect(n.reverbWet).connect(n.panner);
    n.lowpass.connect(n.delay).connect(n.echoTone).connect(n.echoFeedback).connect(n.delay);
    n.echoTone.connect(n.echoWet).connect(n.panner);
    n.lfo.connect(n.lfoDepth).connect(n.panner.pan);
    n.panner.connect(n.compressor).connect(n.volume).connect(n.fade);
    n.noiseFilter.connect(n.noiseGain).connect(n.volume);
    n.fade.connect(ctx.destination);
    n.lfo.start();

    ctx.addEventListener('statechange', () => {
      if (ctx.state !== 'running' && video && !video.paused) ctx.resume().catch(() => {});
    });

    return { ctx, n, roomSize: null, noiseType: null, noiseSrc: null, irTimer: null };
  }

  function isAttached() {
    return !!(engine && video && connected.has(video));
  }

  function resumeContext(ctx) {
    if (ctx.state === 'running') return Promise.resolve();
    // resume() can stay pending until a user gesture, so don't wait forever.
    return Promise.race([
      ctx.resume().catch(() => {}),
      new Promise((r) => setTimeout(r, 400))
    ]);
  }

  async function tryAttach() {
    if (attaching || !settings.enabled || !video || connected.has(video)) return;
    attaching = true;
    try {
      if (!engine) engine = createEngine();
      await resumeContext(engine.ctx);
      if (engine.ctx.state !== 'running') {
        waitForGesture();
        return;
      }
      if (!settings.enabled || !video || connected.has(video)) return;
      const src = engine.ctx.createMediaElementSource(video);
      src.connect(engine.n.input);
      connected.add(video);
    } catch (err) {
      console.warn('[SleepyTube] could not attach audio:', err);
    } finally {
      attaching = false;
    }
    if (isAttached()) applySettings();
  }

  function waitForGesture() {
    if (waitingForGesture) return;
    waitingForGesture = true;
    const onGesture = () => {
      waitingForGesture = false;
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      tryAttach();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
  }

  function setRoomSize(seconds) {
    if (engine.roomSize === seconds) return;
    engine.roomSize = seconds;
    clearTimeout(engine.irTimer);
    const apply = () => { engine.n.convolver.buffer = makeImpulse(engine.ctx, seconds); };
    // Debounce while dragging the slider, but build the first one immediately.
    if (!engine.n.convolver.buffer) apply();
    else engine.irTimer = setTimeout(apply, 200);
  }

  function setNoiseType(type) {
    if (engine.noiseType === type && engine.noiseSrc) return;
    engine.noiseType = type;
    const { ctx, n } = engine;
    if (engine.noiseSrc) {
      const old = engine.noiseSrc;
      old.stop(ctx.currentTime + 0.05);
    }
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(ctx, type);
    src.loop = true;
    src.connect(n.noiseFilter);
    src.start();
    engine.noiseSrc = src;
  }

  function updateNoiseGate() {
    if (!engine) return;
    const playing = isAttached() && settings.enabled && !video.paused;
    const level = playing ? Math.pow(settings.noise / 100, 1.5) * 0.6 : 0;
    engine.n.noiseGain.gain.setTargetAtTime(level, engine.ctx.currentTime, 0.25);
  }

  function applyRate() {
    if (!video) return;
    const want = settings.enabled ? settings.speed : 1;
    if (want !== 1) {
      video.preservesPitch = false;
      if (Math.abs(video.playbackRate - want) > 0.001) video.playbackRate = want;
      rateTouched = true;
    } else if (rateTouched) {
      video.preservesPitch = true;
      video.playbackRate = 1;
      rateTouched = false;
    }
  }

  function applySettings() {
    applyRate();
    applyScreen();
    if (settings.enabled && !isAttached()) {
      tryAttach();
      return;
    }
    if (!engine) return;

    const { ctx, n } = engine;
    const t = ctx.currentTime;
    const set = (param, v) => param.setTargetAtTime(v, t, SMOOTH);
    const s = settings;

    set(n.bypass.gain, s.enabled ? 0 : 1);
    set(n.fxIn.gain, s.enabled ? 1 : 0);
    updateNoiseGate();
    if (!s.enabled) return;

    const w = s.warmth / 100;
    set(n.lowShelf.gain, w * 9);
    set(n.highShelf.gain, -w * 7);
    set(n.lowpass.frequency, 20000 * Math.pow(350 / 20000, s.muffle / 100));

    const r = s.reverb / 100;
    set(n.dry.gain, 1 - 0.55 * r);
    set(n.reverbWet.gain, r * 1.1);
    setRoomSize(s.roomSize);

    set(n.echoWet.gain, (s.echo / 100) * 0.8);
    set(n.delay.delayTime, s.echoTime / 1000);
    set(n.echoFeedback.gain, (s.echoFeedback / 100) * 0.85);

    set(n.lfoDepth.gain, (s.drift / 100) * 0.9);
    set(n.volume.gain, s.volume / 100);

    setNoiseType(s.noiseType);
  }

  // ---------- Screen effects ----------

  const Z = 2147483600;
  const scr = { layers: null, blackout: null, ui: null, softVideo: null, wasBlack: false, idleTimer: null };

  function makeLayer(id, z, css) {
    const d = document.createElement('div');
    d.id = id;
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = `all:initial;position:fixed;inset:0;z-index:${z};pointer-events:none;display:none;${css}`;
    return d;
  }

  function buildBlackout() {
    const host = document.createElement('div');
    host.id = 'sleepytube-blackout';
    host.style.cssText = `all:initial;position:fixed;inset:0;z-index:${Z + 9};display:none;background:#000;`;
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { cursor: none; }
        :host(.awake) { cursor: default; }
        .wrap {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 14px;
          font: 14px/1.4 ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", sans-serif;
          color: rgba(235, 230, 255, 0.75); text-align: center;
          opacity: 0; transition: opacity 0.8s ease; user-select: none;
        }
        :host(.awake) .wrap { opacity: 1; transition-duration: 0.25s; }
        .moon { font-size: 34px; filter: drop-shadow(0 0 18px rgba(240, 228, 170, 0.35)); }
        .sleep { font-variant-numeric: tabular-nums; color: rgba(158, 224, 255, 0.8); min-height: 1.4em; }
        button {
          padding: 10px 20px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: linear-gradient(160deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 8px 24px rgba(0, 0, 0, 0.6);
          color: #f4f2ff; font: inherit; font-size: 14px;
          transition: background 0.2s, transform 0.1s;
        }
        button:hover { background: linear-gradient(160deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08)); }
        button:active { transform: scale(0.97); }
        button:focus-visible { outline: 2px solid #9ee0ff; outline-offset: 2px; }
        small { font-size: 12px; color: rgba(235, 230, 255, 0.45); }
      </style>
      <div class="wrap">
        <div class="moon">🌙</div>
        <div class="sleep"></div>
        <button type="button">☀️ Show video</button>
        <small>Sound keeps playing · move the mouse to see this button</small>
      </div>`;
    const button = root.querySelector('button');
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      setBlackout(false);
    });
    const wake = () => {
      host.classList.add('awake');
      clearTimeout(scr.idleTimer);
      scr.idleTimer = setTimeout(() => host.classList.remove('awake'), 2500);
    };
    for (const type of ['mousemove', 'pointerdown', 'touchstart', 'wheel']) {
      host.addEventListener(type, wake, { passive: true });
    }
    for (const type of ['click', 'dblclick', 'contextmenu']) {
      host.addEventListener(type, (e) => { e.stopPropagation(); if (type === 'contextmenu') e.preventDefault(); });
    }
    scr.ui = { wake, sleepText: root.querySelector('.sleep') };
    return host;
  }

  function setBlackout(on) {
    settings = { ...settings, blackout: on };
    applyScreen();
    try {
      chrome.storage.local.set({ settings }).catch(() => {});
    } catch {
      // Extension was reloaded; the overlay still hides locally.
    }
  }

  function updateBlackoutSleep() {
    if (!scr.ui) return;
    if (!sleep) { scr.ui.sleepText.textContent = ''; return; }
    const ms = Math.max(0, sleep.endsAt - Date.now());
    const m = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    scr.ui.sleepText.textContent = `Pausing in ${m}:${String(sec).padStart(2, '0')}`;
  }

  function applyScreen() {
    const s = settings;
    const on = s.enabled;
    const tint = on && (s.dim > 0 || s.blueCut > 0 || s.sepia > 0 || s.mono > 0);
    const black = on && s.blackout;

    if ((tint || black) && !scr.layers) {
      scr.layers = {
        filter: makeLayer('sleepytube-filter', Z, ''),
        // Multiplying by an amber colour removes blue light (like Night Shift).
        warm: makeLayer('sleepytube-warm', Z + 1, 'mix-blend-mode:multiply;background:rgb(255,140,40);'),
        dim: makeLayer('sleepytube-dim', Z + 2, 'background:#000;')
      };
      scr.blackout = buildBlackout();
    }

    if (scr.layers) {
      // Fullscreen content lives in the top layer, so the overlays must move inside it.
      const host = document.fullscreenElement || document.documentElement;
      for (const el of [...Object.values(scr.layers), scr.blackout]) {
        if (el.parentNode !== host) host.appendChild(el);
      }
      const { filter, warm, dim } = scr.layers;
      const parts = [];
      if (on && s.mono > 0) parts.push(`grayscale(${s.mono / 100})`);
      if (on && s.sepia > 0) parts.push(`sepia(${s.sepia / 100})`);
      filter.style.display = parts.length ? 'block' : 'none';
      filter.style.backdropFilter = parts.join(' ');
      warm.style.display = on && s.blueCut > 0 ? 'block' : 'none';
      warm.style.opacity = String((s.blueCut / 100) * 0.7);
      dim.style.display = on && s.dim > 0 ? 'block' : 'none';
      dim.style.opacity = String(s.dim / 100);
      scr.blackout.style.display = black ? 'block' : 'none';
      if (black && !scr.wasBlack) scr.ui.wake();
      scr.wasBlack = black;
      updateBlackoutSleep();
    }

    const soft = on && video && s.soften > 0 ? `blur(${((s.soften / 100) * 6).toFixed(2)}px)` : '';
    if (scr.softVideo && scr.softVideo !== video) {
      scr.softVideo.style.filter = '';
      scr.softVideo = null;
    }
    if (video && (soft || scr.softVideo === video)) {
      video.style.filter = soft;
      scr.softVideo = soft ? video : null;
    }
  }

  // ---------- Sleep timer ----------

  function setFade(f) {
    const g = Math.max(0, Math.min(1, f)) ** 2;
    if (isAttached()) {
      engine.n.fade.gain.setTargetAtTime(g, engine.ctx.currentTime, 0.2);
    } else if (video) {
      if (sleep.baseVolume == null) sleep.baseVolume = video.volume;
      video.volume = sleep.baseVolume * g;
    }
  }

  function clearSleep() {
    if (!sleep) return;
    clearInterval(sleep.timer);
    if (engine) engine.n.fade.gain.setTargetAtTime(1, engine.ctx.currentTime, 0.2);
    if (video && sleep.baseVolume != null) video.volume = sleep.baseVolume;
    sleep = null;
    updateBlackoutSleep();
  }

  function tickSleep() {
    if (!sleep) return;
    const remaining = sleep.endsAt - Date.now();
    if (remaining <= 0) {
      if (video) video.pause();
      clearSleep();
      return;
    }
    if (remaining < sleep.fadeMs) setFade(remaining / sleep.fadeMs);
    updateBlackoutSleep();
  }

  function setSleep(minutes) {
    clearSleep();
    if (!minutes || minutes <= 0) return;
    const total = minutes * 60000;
    sleep = {
      minutes,
      endsAt: Date.now() + total,
      fadeMs: Math.min(120000, total / 2),
      baseVolume: null,
      timer: setInterval(tickSleep, 500)
    };
  }

  // ---------- Video tracking ----------

  function onPlay() {
    if (engine && engine.ctx.state !== 'running') engine.ctx.resume().catch(() => {});
    applySettings();
  }

  function onPause() {
    updateNoiseGate();
  }

  function onLoaded() {
    applyRate();
  }

  function bindVideo(v) {
    if (v === video) return;
    if (video) {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadeddata', onLoaded);
    }
    video = v;
    rateTouched = false;
    if (!v) return;
    v.addEventListener('play', onPlay);
    v.addEventListener('playing', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('loadeddata', onLoaded);
    applySettings();
  }

  function scan() {
    const v = document.querySelector('video.html5-main-video') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('video');
    if (v) bindVideo(v);
    if (scr.layers) applyScreen();
  }

  // ---------- Wiring ----------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'sleepytube:sleep') setSleep(Number(msg.minutes) || 0);
    if (msg.type === 'sleepytube:status' || msg.type === 'sleepytube:sleep') {
      sendResponse({
        hasVideo: !!video,
        attached: isAttached(),
        audioState: engine ? engine.ctx.state : 'none',
        needsGesture: waitingForGesture,
        sleepEndsAt: sleep ? sleep.endsAt : null,
        sleepMinutes: sleep ? sleep.minutes : 0
      });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      settings = normalize(changes.settings.newValue);
      applySettings();
    }
  });

  chrome.storage.local.get('settings').then(({ settings: stored }) => {
    settings = normalize(stored);
    scan();
    applySettings();
  });

  document.addEventListener('yt-navigate-finish', scan);
  document.addEventListener('fullscreenchange', applyScreen);
  setInterval(scan, 1500);
})();
