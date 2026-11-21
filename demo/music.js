// Composes a short, seamless lofi hip-hop loop in the browser and returns it as a WAV URL.
(() => {
  'use strict';
  const BPM = 80;
  const BEAT = 60 / BPM;
  const BARS = 8;
  const LOOP = BARS * 4 * BEAT; // 24 s
  const TAIL = 2.5;
  const RATE = 44100;
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  // Fmaj9 · Em7 · Dm9 · Cmaj7, two passes
  const CHORDS = [
    [53, 57, 60, 64, 67], [52, 55, 59, 62, 66], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]
  ];
  const MELODY = [
    [[0.5, 76], [1.5, 74], [2, 72], [3, 69]],
    [[0.75, 71], [1.5, 74], [2.5, 76]],
    [[0, 77], [0.75, 76], [1.5, 74], [2.5, 72], [3.25, 69]],
    [[1, 67], [2, 71], [3, 72]],
    [[0.5, 72], [1, 74], [1.5, 76], [2.5, 79], [3.5, 77]],
    [[0, 76], [1, 74], [2, 71]],
    [[0.5, 69], [1.25, 72], [2, 74], [3, 77]],
    [[0, 76], [1.5, 74], [2, 72], [2.75, 71]]
  ];

  function rng(seed) {
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  }

  async function render() {
    const len = Math.ceil((LOOP + TAIL) * RATE);
    const ctx = new OfflineAudioContext(2, len, RATE);
    const rand = rng(42);

    const noise = ctx.createBuffer(1, RATE, RATE);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;

    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);

    // Warm "tape" bus for the musical parts
    const tape = ctx.createBiquadFilter();
    tape.type = 'lowpass';
    tape.frequency.value = 5200;
    tape.Q.value = 0.4;
    tape.connect(master);

    function pan(x) {
      const p = ctx.createStereoPanner();
      p.pan.value = x;
      p.connect(tape);
      return p;
    }

    function rhodes(midi, t, dur, vel, out) {
      const f = hz(midi);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.012);
      g.gain.setTargetAtTime(vel * 0.35, t + 0.02, 0.5);
      g.gain.setTargetAtTime(0, t + dur, 0.25);
      const trem = ctx.createGain();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 4.2;
      depth.gain.value = 0.18;
      lfo.connect(depth).connect(trem.gain);
      trem.gain.value = 0.82;
      g.connect(trem).connect(out);
      const partials = [[1, 1, 'sine'], [2, 0.22, 'sine'], [1.003, 0.4, 'triangle']];
      for (const [mult, amp, type] of partials) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        const a = ctx.createGain();
        a.gain.value = amp;
        o.connect(a).connect(g);
        o.start(t);
        o.stop(t + dur + 1.5);
      }
      // Bell-like tine at the attack
      const tine = ctx.createOscillator();
      const tg = ctx.createGain();
      tine.frequency.value = f * 7.1;
      tg.gain.setValueAtTime(vel * 0.12, t);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      tine.connect(tg).connect(out);
      tine.start(t);
      tine.stop(t + 0.4);
      lfo.start(t);
      lfo.stop(t + dur + 1.5);
    }

    function pluck(midi, t, vel, out) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(midi);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1);
    }

    function bass(midi, t, dur) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(midi);
      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = hz(midi);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.55, t + 0.02);
      g.gain.setTargetAtTime(0.35, t + 0.05, 0.3);
      g.gain.setTargetAtTime(0, t + dur, 0.08);
      o.connect(g);
      o2.connect(lp).connect(g);
      g.connect(master);
      for (const x of [o, o2]) { x.start(t); x.stop(t + dur + 0.6); }
    }

    function kick(t, vel = 1) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.5);
    }

    function noiseHit(t, { type, freq, q = 0.7, decay, vel, panX = 0 }) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
      const p = ctx.createStereoPanner();
      p.pan.value = panX;
      src.connect(f).connect(g).connect(p).connect(master);
      src.start(t, rand() * 0.5);
      src.stop(t + decay + 0.05);
    }

    function snare(t) {
      noiseHit(t, { type: 'bandpass', freq: 1900, q: 0.6, decay: 0.22, vel: 0.55 });
      noiseHit(t, { type: 'highpass', freq: 5000, decay: 0.12, vel: 0.18 });
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 185;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.15);
    }

    const keys = pan(-0.15);
    const lead = pan(0.3);
    const SWING = 0.13 * BEAT;

    for (let bar = 0; bar < BARS; bar++) {
      const t0 = bar * 4 * BEAT;
      const chord = CHORDS[bar % 4];
      const strum = (i) => i * 0.018;
      chord.forEach((m, i) => rhodes(m, t0 + strum(i), 2.3 * BEAT, 0.16, keys));
      chord.slice(1).forEach((m, i) => rhodes(m, t0 + 2.5 * BEAT + SWING + strum(i), 1.2 * BEAT, 0.09, keys));
      for (const [b, m] of MELODY[bar]) pluck(m, t0 + b * BEAT + (b % 1 ? SWING : 0) + 0.01, 0.13, lead);

      const root = chord[0] - 12;
      bass(root, t0, 1.6 * BEAT);
      bass(root, t0 + 2.5 * BEAT + SWING, 0.6 * BEAT);
      bass(root + 7, t0 + 3 * BEAT + SWING * 0.5, 0.9 * BEAT);

      kick(t0);
      kick(t0 + 1.75 * BEAT + SWING, 0.55);
      kick(t0 + 2.5 * BEAT + SWING, 0.85);
      snare(t0 + BEAT);
      snare(t0 + 3 * BEAT);
      for (let e = 0; e < 8; e++) {
        const t = t0 + (e / 2) * BEAT + (e % 2 ? SWING : 0);
        const open = e === 7 && bar % 2 === 1;
        noiseHit(t, {
          type: 'highpass', freq: 7500, decay: open ? 0.35 : 0.05,
          vel: (e % 2 ? 0.1 : 0.17) * (0.8 + rand() * 0.4), panX: 0.25
        });
      }
    }

    // Vinyl crackle and hiss across the whole loop
    const crackle = ctx.createBuffer(2, Math.ceil(LOOP * RATE), RATE);
    for (let ch = 0; ch < 2; ch++) {
      const d = crackle.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        d[i] = (rand() * 2 - 1) * 0.006;
        if (rand() < 0.00035) d[i] += (rand() * 2 - 1) * 0.35;
      }
    }
    const cs = ctx.createBufferSource();
    cs.buffer = crackle;
    const chp = ctx.createBiquadFilter();
    chp.type = 'highpass';
    chp.frequency.value = 1200;
    cs.connect(chp).connect(master);
    cs.start(0);

    const out = await ctx.startRendering();
    return foldLoop(out);
  }

  // Wrap the release tail back onto the start so the loop is seamless.
  function foldLoop(buf) {
    const n = Math.round(LOOP * RATE);
    const chans = [];
    let peak = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const src = buf.getChannelData(ch);
      const d = src.slice(0, n);
      for (let i = n; i < src.length; i++) d[i - n] += src[i];
      for (const v of d) peak = Math.max(peak, Math.abs(v));
      chans.push(d);
    }
    const scale = 0.89 / (peak || 1);
    for (const d of chans) for (let i = 0; i < d.length; i++) d[i] *= scale;
    return chans;
  }

  function wav(chans) {
    const n = chans[0].length;
    const nc = chans.length;
    const view = new DataView(new ArrayBuffer(44 + n * nc * 2));
    const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    view.setUint32(4, 36 + n * nc * 2, true);
    str(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, nc, true);
    view.setUint32(24, RATE, true);
    view.setUint32(28, RATE * nc * 2, true);
    view.setUint16(32, nc * 2, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, n * nc * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let ch = 0; ch < nc; ch++) {
        const v = Math.max(-1, Math.min(1, chans[ch][i]));
        view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        o += 2;
      }
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  window.makeLofi = async () => URL.createObjectURL(wav(await render()));
})();
