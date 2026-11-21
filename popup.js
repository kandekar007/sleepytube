(async () => {
  'use strict';
  const {
    AUDIO_DEFAULTS, VISUAL_DEFAULTS, PRESETS, LOOKS,
    CONTROLS, VISUAL_CONTROLS, NOISE_TYPES, SLEEP_OPTIONS, normalize
  } = globalThis.SleepyTube;

  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  const sliders = {};
  let settings = normalize((await chrome.storage.local.get('settings')).settings);
  let saveTimer = null;
  let sleepState = { endsAt: null, minutes: 0 };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set({ settings }), 40);
  }

  const visualKeys = new Set(VISUAL_CONTROLS.map((c) => c.key));

  function markCustom(key) {
    if (visualKeys.has(key)) settings.look = 'custom';
    else settings.preset = 'custom';
    renderChoices();
  }

  // ----- Sliders -----

  function paintSlider(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', `${pct}%`);
  }

  function buildSlider(c) {
    const input = el('input', { type: 'range', min: c.min, max: c.max, step: c.step });
    input.setAttribute('aria-label', c.label);
    const val = el('span', { className: 'val' });
    const name = el('span', { className: 'name' });
    if (c.icon) name.append(el('span', { className: 'ico', textContent: c.icon }));
    name.append(c.label);
    const row = el('label', { className: 'ctrl', title: c.hint || '' }, name, input, val);

    input.addEventListener('input', () => {
      settings[c.key] = Number(input.value);
      val.textContent = c.format(settings[c.key]);
      paintSlider(input);
      markCustom(c.key);
      save();
    });
    sliders[c.key] = { input, val, c };
    return row;
  }

  let lastSection = null;
  for (const c of CONTROLS) {
    if (c.main) {
      $('mainControls').append(buildSlider(c));
    } else {
      if (c.section !== lastSection) {
        $('fineControls').append(el('h3', { textContent: c.section }));
        lastSection = c.section;
      }
      $('fineControls').append(buildSlider(c));
    }
  }

  for (const c of VISUAL_CONTROLS) $('visualControls').append(buildSlider(c));

  // ----- Hush type -----

  const noiseButtons = {};
  for (const [key, t] of Object.entries(NOISE_TYPES)) {
    const b = el('button', { type: 'button', title: t.hint, textContent: `${t.icon} ${t.label}` });
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      settings.noiseType = key;
      if (settings.noise === 0) settings.noise = 20;
      markCustom('noiseType');
      render();
      save();
    });
    noiseButtons[key] = b;
    $('noiseType').append(b);
  }

  // ----- Moods & looks -----

  function renderChoiceGrid(box, items, field, customHint) {
    box.textContent = '';
    for (const [key, p] of Object.entries(items)) {
      const b = el('button', { type: 'button', className: 'preset', title: p.hint || p.label },
        el('span', { className: 'emoji', textContent: p.icon }), p.label);
      b.classList.toggle('active', settings[field] === key);
      b.addEventListener('click', () => {
        settings = normalize({ ...settings, ...p.values, [field]: key });
        render();
        save();
      });
      box.append(b);
    }
    const custom = el('div', { className: 'preset custom', title: customHint },
      el('span', { className: 'emoji', textContent: '🎚️' }), 'Custom');
    custom.classList.toggle('active', settings[field] === 'custom');
    box.append(custom);
  }

  function renderChoices() {
    renderChoiceGrid($('presets'), PRESETS, 'preset', 'Your own mix — move any slider');
    renderChoiceGrid($('looks'), LOOKS, 'look', 'Your own look — move any slider');
    const screenOn = settings.blackout || VISUAL_CONTROLS.some((c) => settings[c.key] > 0);
    $('screenBadge').hidden = !screenOn;
  }

  // ----- Tabs -----

  let activeTab = localStorage.getItem('tab') === 'screen' ? 'screen' : 'sound';
  const tabButtons = [...document.querySelectorAll('[data-tab]')];

  function showTab(name) {
    activeTab = name;
    localStorage.setItem('tab', name);
    for (const b of tabButtons) {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    }
    for (const pane of document.querySelectorAll('[data-pane]')) pane.hidden = pane.dataset.pane !== name;
    $('reset').title = name === 'screen' ? 'Reset screen effects' : 'Reset sound to Sleepy';
  }
  for (const b of tabButtons) b.addEventListener('click', () => showTab(b.dataset.tab));

  // ----- Main render -----

  function render() {
    $('enabled').checked = settings.enabled;
    document.body.classList.toggle('off', !settings.enabled);
    for (const { input, val, c } of Object.values(sliders)) {
      input.value = settings[c.key];
      val.textContent = c.format(settings[c.key]);
      paintSlider(input);
    }
    for (const [key, b] of Object.entries(noiseButtons)) {
      const on = key === settings.noiseType;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    }
    $('blackout').checked = settings.blackout;
    renderChoices();
  }

  $('enabled').addEventListener('change', (e) => {
    settings.enabled = e.target.checked;
    render();
    save();
    setTimeout(refreshStatus, 300);
  });

  $('blackout').addEventListener('change', (e) => {
    settings.blackout = e.target.checked;
    render();
    save();
  });

  $('reset').addEventListener('click', () => {
    settings = activeTab === 'screen'
      ? { ...settings, ...VISUAL_DEFAULTS, blackout: false }
      : { ...settings, ...AUDIO_DEFAULTS, preset: 'sleepy' };
    render();
    save();
  });

  // The page's own "Show video" button turns the black screen off.
  chrome.storage.onChanged.addListener((changes, area) => {
    const next = area === 'local' && changes.settings?.newValue;
    if (next && typeof next.blackout === 'boolean' && next.blackout !== settings.blackout) {
      settings.blackout = next.blackout;
      render();
    }
  });

  $('reload').addEventListener('click', () => {
    if (tab) chrome.tabs.reload(tab.id);
    window.close();
  });

  const fine = $('fine');
  fine.open = localStorage.getItem('fineOpen') === '1';
  fine.addEventListener('toggle', () => localStorage.setItem('fineOpen', fine.open ? '1' : '0'));

  // ----- Sleep timer -----

  const sleepButtons = new Map();
  for (const m of [0, ...SLEEP_OPTIONS]) {
    const b = el('button', { type: 'button', textContent: m === 0 ? 'Off' : `${m}m` });
    b.addEventListener('click', async () => {
      const res = await send({ type: 'sleepytube:sleep', minutes: m });
      if (res) applySleep(res);
    });
    sleepButtons.set(m, b);
    $('sleep').append(b);
  }

  function applySleep(st) {
    sleepState = { endsAt: st.sleepEndsAt, minutes: st.sleepMinutes || 0 };
    const active = sleepState.endsAt ? sleepState.minutes : 0;
    for (const [m, b] of sleepButtons) b.classList.toggle('active', m === active);
    renderCountdown();
  }

  function renderCountdown() {
    const { endsAt, minutes } = sleepState;
    $('sleepBar').parentElement.classList.toggle('on', !!endsAt);
    $('sleepLeft').classList.toggle('idle', !endsAt);
    if (!endsAt) {
      $('sleepLeft').textContent = 'Fades out, then pauses';
      $('sleepBar').style.width = '0';
      return;
    }
    const ms = Math.max(0, endsAt - Date.now());
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    $('sleepLeft').textContent = `🌙 ${m}:${String(s).padStart(2, '0')}`;
    $('sleepBar').style.width = `${(ms / (minutes * 60000)) * 100}%`;
  }

  // ----- Tab status -----

  async function send(msg) {
    if (!tab) return null;
    try {
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      return null;
    }
  }

  function setStatus(text, cls = '') {
    $('status').className = `pill ${cls}`;
    $('statusText').textContent = text;
  }

  async function refreshStatus() {
    const st = await send({ type: 'sleepytube:status' });
    if (!st) {
      const onYouTube = !!(tab && /youtube\.com/.test(tab.url || ''));
      $('reload').hidden = !onYouTube;
      setStatus(onYouTube ? 'Needs a reload' : 'Open a YouTube video', 'warn');
      for (const b of sleepButtons.values()) b.disabled = true;
      return;
    }
    $('reload').hidden = true;
    for (const b of sleepButtons.values()) b.disabled = false;
    applySleep(st);

    if (!settings.enabled) setStatus('Effects off');
    else if (!st.hasVideo) setStatus('Waiting for a video…');
    else if (st.attached && st.audioState === 'running') setStatus('Sleepy mode on', 'ok');
    else if (st.needsGesture || st.audioState === 'suspended') setStatus('Click the video page once', 'warn');
    else setStatus('Starting…');
  }

  showTab(activeTab);
  render();
  applySleep({ sleepEndsAt: null });
  refreshStatus();
  setInterval(refreshStatus, 1000);
})();
