// Shared between the content script and the popup.
(function (root) {
  'use strict';

  const NOISE_TYPES = {
    brown: { label: 'Brown', icon: '🌑', hint: 'Deep, soft rumble' },
    pink: { label: 'Pink', icon: '🌸', hint: 'Gentle hush' },
    white: { label: 'Fan', icon: '🌬️', hint: 'White noise, like a fan' },
    rain: { label: 'Rain', icon: '🌧️', hint: 'Soft rainfall' }
  };

  const CONTROLS = [
    { key: 'speed', section: 'Tempo', main: true, icon: '🐢', label: 'Speed', min: 0.5, max: 1, step: 0.01,
      hint: 'Slower playback also lowers the pitch',
      format: (v) => `${Math.round(v * 100)}%` },
    { key: 'muffle', section: 'Tone', main: true, icon: '🧱', label: 'Muffle', min: 0, max: 100, step: 1,
      hint: 'Cuts high frequencies, like hearing it through a wall',
      format: (v) => `${v}%` },
    { key: 'warmth', section: 'Tone', label: 'Warmth', min: 0, max: 100, step: 1,
      hint: 'Boosts bass and softens treble',
      format: (v) => `${v}%` },
    { key: 'reverb', section: 'Space', main: true, icon: '⛰️', label: 'Reverb',
      hint: 'Adds a spacious, washed-out room sound', min: 0, max: 100, step: 1,
      format: (v) => `${v}%` },
    { key: 'roomSize', section: 'Space', label: 'Room size', min: 1, max: 8, step: 0.5,
      format: (v) => `${v}s` },
    { key: 'drift', section: 'Space', label: '8D drift', min: 0, max: 100, step: 1,
      hint: 'Sound slowly drifts between left and right',
      format: (v) => `${v}%` },
    { key: 'echo', section: 'Echo', label: 'Echo', min: 0, max: 100, step: 1,
      format: (v) => `${v}%` },
    { key: 'echoTime', section: 'Echo', label: 'Delay', min: 80, max: 1000, step: 10,
      format: (v) => `${v}ms` },
    { key: 'echoFeedback', section: 'Echo', label: 'Repeats', min: 0, max: 100, step: 1,
      format: (v) => `${v}%` },
    { key: 'noise', section: 'Hush', main: true, icon: '🤫', label: 'Hush', min: 0, max: 100, step: 1,
      hint: 'Soft background noise that only plays with the video',
      format: (v) => `${v}%` },
    { key: 'volume', section: 'Output', label: 'Volume', min: 0, max: 150, step: 1,
      format: (v) => `${v}%` }
  ];

  const pct = (v) => `${v}%`;

  const VISUAL_CONTROLS = [
    { key: 'dim', icon: '🔅', label: 'Dim', min: 0, max: 90, step: 1,
      hint: 'Darkens the whole page', format: pct },
    { key: 'blueCut', icon: '🟠', label: 'Blue cut', min: 0, max: 100, step: 1,
      hint: 'Blue light filter: warmer colours, gentler on sleepy eyes', format: pct },
    { key: 'sepia', icon: '📜', label: 'Sepia', min: 0, max: 100, step: 1,
      hint: 'Old-photo brown tint', format: pct },
    { key: 'mono', icon: '🌗', label: 'B&W', min: 0, max: 100, step: 1,
      hint: 'Fades colour to black and white', format: pct },
    { key: 'soften', icon: '☁️', label: 'Soften', min: 0, max: 100, step: 1,
      hint: 'Gently blurs the video picture', format: pct }
  ];

  const AUDIO_DEFAULTS = {
    speed: 0.88,
    muffle: 45,
    warmth: 45,
    reverb: 40,
    roomSize: 4,
    drift: 0,
    echo: 15,
    echoTime: 380,
    echoFeedback: 35,
    noise: 15,
    noiseType: 'brown',
    volume: 100
  };

  const VISUAL_DEFAULTS = { look: 'off', dim: 0, blueCut: 0, sepia: 0, mono: 0, soften: 0 };

  const DEFAULTS = {
    enabled: true,
    preset: 'sleepy',
    blackout: false,
    ...AUDIO_DEFAULTS,
    ...VISUAL_DEFAULTS
  };

  const PRESETS = {
    sleepy: { label: 'Sleepy', icon: '😴', values: { ...AUDIO_DEFAULTS } },
    slowedReverb: { label: 'Slowed', icon: '🐢', hint: 'Slowed + reverb', values: {
      speed: 0.8, muffle: 15, warmth: 35, reverb: 55, roomSize: 5, drift: 0,
      echo: 10, echoTime: 300, echoFeedback: 25, noise: 0, noiseType: 'brown', volume: 100 } },
    underwater: { label: 'Underwater', icon: '🌊', values: {
      speed: 0.9, muffle: 82, warmth: 65, reverb: 35, roomSize: 3, drift: 15,
      echo: 0, echoTime: 380, echoFeedback: 30, noise: 18, noiseType: 'brown', volume: 115 } },
    nextRoom: { label: 'Next Room', icon: '🚪', values: {
      speed: 1, muffle: 70, warmth: 50, reverb: 45, roomSize: 2, drift: 0,
      echo: 0, echoTime: 380, echoFeedback: 30, noise: 10, noiseType: 'pink', volume: 110 } },
    cathedral: { label: 'Cathedral', icon: '⛪', values: {
      speed: 0.9, muffle: 25, warmth: 30, reverb: 72, roomSize: 8, drift: 0,
      echo: 0, echoTime: 380, echoFeedback: 30, noise: 0, noiseType: 'pink', volume: 100 } },
    lofiRain: { label: 'Lo-fi Rain', icon: '🌧️', values: {
      speed: 0.92, muffle: 40, warmth: 55, reverb: 25, roomSize: 3, drift: 0,
      echo: 10, echoTime: 450, echoFeedback: 25, noise: 35, noiseType: 'rain', volume: 100 } },
    dreamy8d: { label: 'Dreamy 8D', icon: '🎧', values: {
      speed: 0.85, muffle: 30, warmth: 40, reverb: 50, roomSize: 5, drift: 75,
      echo: 25, echoTime: 420, echoFeedback: 40, noise: 8, noiseType: 'pink', volume: 100 } }
  };

  const look = (dim, blueCut, sepia, mono, soften) => ({ dim, blueCut, sepia, mono, soften });
  const LOOKS = {
    off: { label: 'Off', icon: '🎬', hint: 'Normal picture', values: look(0, 0, 0, 0, 0) },
    night: { label: 'Night', icon: '🌙', hint: 'Warm and a little dimmer', values: look(20, 65, 0, 0, 0) },
    candle: { label: 'Candle', icon: '🕯️', hint: 'Very warm, candle-lit', values: look(40, 90, 25, 0, 0) },
    dark: { label: 'Dark', icon: '🌑', hint: 'Much darker, slightly warm', values: look(65, 40, 0, 0, 0) },
    sepia: { label: 'Sepia', icon: '📜', values: look(10, 20, 85, 0, 0) },
    mono: { label: 'B&W', icon: '🌗', hint: 'Black and white', values: look(15, 0, 0, 100, 0) },
    dreamy: { label: 'Dreamy', icon: '☁️', hint: 'Soft, warm and hazy', values: look(20, 35, 10, 0, 45) }
  };

  const SLEEP_OPTIONS = [15, 30, 45, 60, 90];

  function normalize(raw) {
    const out = { ...DEFAULTS };
    if (!raw || typeof raw !== 'object') return out;
    for (const c of [...CONTROLS, ...VISUAL_CONTROLS]) {
      const v = Number(raw[c.key]);
      if (Number.isFinite(v)) out[c.key] = Math.min(c.max, Math.max(c.min, v));
    }
    if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
    if (typeof raw.blackout === 'boolean') out.blackout = raw.blackout;
    if (raw.look === 'custom' || raw.look in LOOKS) out.look = raw.look;
    if (raw.noiseType in NOISE_TYPES) out.noiseType = raw.noiseType;
    if (raw.preset === 'custom' || raw.preset in PRESETS) out.preset = raw.preset;
    return out;
  }

  root.SleepyTube = {
    DEFAULTS, AUDIO_DEFAULTS, VISUAL_DEFAULTS, PRESETS, LOOKS,
    CONTROLS, VISUAL_CONTROLS, NOISE_TYPES, SLEEP_OPTIONS, normalize
  };
})(globalThis);
