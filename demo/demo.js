(async () => {
  'use strict';
  const { DEFAULTS } = globalThis.SleepyTube;
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const video = document.querySelector('#movie_player video');
  const player = $('movie_player');
  const panel = $('popupPanel');
  const frame = $('popupFrame');

  function seeded(seed) {
    return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  }

  // ---------- Up next ----------

  const UP_NEXT = [
    ['rain on a tin roof for deep sleep, 10 hours', 'Sleep Sounds', '3.1M views', '10:00:00', '#2c3e50, #4c6075'],
    ['cozy cabin fireplace crackle with snow outside', 'Hearth TV', '870K views', '3:00:00', '#3a1f12, #a0522d'],
    ['ambient space music for sleep and dreaming', 'Nebula', '1.4M views', '8:00:00', '#0b1026, #2b3557'],
    ['ocean waves at night, no music', 'Calm Coast', '2.2M views', '5:00:00', '#12303f, #3d7a8a'],
    ['forest night: crickets, owls and a stream', 'Wildwood', '640K views', '2:00:00', '#13241a, #3e5b45'],
    ['sad piano for rainy days', 'Ivory Rain', '990K views', '1:12:40', '#3b3437, #8a7d80']
  ];
  $('upNext').innerHTML = UP_NEXT.map(([title, ch, views, dur, grad]) => `
    <div class="up">
      <div class="thumb" style="background:linear-gradient(160deg, ${grad})"><small>${dur}</small></div>
      <div class="up-text"><b>${title}</b><span>${ch}</span><span>${views}</span></div>
    </div>`).join('');

  // ---------- Theme: the demo page follows the popup's theme picker ----------

  const { THEMES, themeOf } = globalThis.SleepyTube;
  let spectrumColors = [];
  const mix = (hex, to, amt) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${c.map((v) => Math.round(v + (to - v) * amt)).join(',')})`;
  };
  function applyDemoTheme(id) {
    const t = themeOf(id);
    document.documentElement.style.setProperty('--tint', t.tint);
    document.documentElement.style.setProperty('--on-tint', t.onTint);
    spectrumColors = [mix(t.tint, 0, 0.38), mix(t.tint, 255, 0.45)];
  }
  applyDemoTheme(localStorage.getItem('theme') in THEMES ? localStorage.getItem('theme') : null);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.theme) applyDemoTheme(changes.theme.newValue);
  });

  // ---------- The real popup, inside an iframe ----------

  const panelOpen = (on) => {
    panel.classList.toggle('open', on);
    requestAnimationFrame(() => layoutCaption());
    $('extIcon').classList.toggle('on', on);
  };
  $('extIcon').addEventListener('click', () => panelOpen(!panel.classList.contains('open')));

  let popupHtml = null;
  try {
    const res = await fetch('../popup.html');
    if (res.ok) popupHtml = await res.text();
  } catch {
    // Opened from file://, handled below.
  }
  if (!popupHtml) {
    document.querySelector('.intro-card p').innerHTML =
      'This demo needs a local web server.<br>In the extension folder run <code>python3 -m http.server 8000</code><br>then open <b>http://localhost:8000/demo/</b>';
    $('tourBtn').textContent = 'Server needed';
    return;
  }

  let frameId = 0;
  const fdoc = () => frame.contentDocument;
  const q = (sel) => fdoc()?.querySelector(sel);
  const byText = (sel, text) => [...(fdoc()?.querySelectorAll(sel) || [])].find((b) => b.textContent.includes(text));

  async function waitFor(fn, ms = 4000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await wait(50);
    }
    return false;
  }

  async function loadPopup() {
    window.demoChrome.drop(`popup${frameId}`);
    frameId += 1;
    const owner = `popup${frameId}`;
    const inject = `<base href="${new URL('../', location.href).href}">` +
      `<script>Object.defineProperty(window, 'chrome', { value: parent.demoChrome.apiFor('${owner}'), configurable: true, writable: true });</script>`;
    frame.srcdoc = popupHtml.replace('<head>', `<head>${inject}`);
    await new Promise((r) => { frame.onload = r; });
    await waitFor(() => q('#presets .preset') && q('#looks .preset'));
  }
  await loadPopup();

  // ---------- Player ----------

  function togglePlay() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }
  $('playBtn').addEventListener('click', togglePlay);
  $('bigPlay').addEventListener('click', togglePlay);
  $('scene').addEventListener('click', togglePlay);
  const syncPlaying = () => {
    player.classList.toggle('playing', !video.paused);
    $('playBtn').innerHTML = video.paused
      ? '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#fff" d="M8 5.5v13l10.5-6.5z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20"><rect fill="#fff" x="6.5" y="5.5" width="3.6" height="13" rx="1"/><rect fill="#fff" x="13.9" y="5.5" width="3.6" height="13" rx="1"/></svg>';
  };
  video.addEventListener('play', syncPlaying);
  video.addEventListener('pause', syncPlaying);
  syncPlaying();

  // The extension softens the <video>; the picture here is a canvas, so mirror it.
  new MutationObserver(() => { $('scene').style.filter = video.style.filter; })
    .observe(video, { attributes: true, attributeFilter: ['style'] });

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------- Night scene ----------

  const scene = $('scene');
  const g = scene.getContext('2d');
  let W = 0;
  let H = 0;
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = scene.clientWidth;
    H = scene.clientHeight;
    scene.width = Math.round(W * dpr);
    scene.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(scene);
  resize();

  const rnd = seeded(7);
  const stars = Array.from({ length: 80 }, () => ({ x: rnd(), y: rnd() * 0.65, p: rnd() * 6.3, s: 0.4 + rnd() * 1.1 }));
  const buildings = [];
  for (let x = -0.02; x < 1;) {
    const w = 0.05 + rnd() * 0.09;
    const h = 0.16 + rnd() * 0.34;
    const lights = [];
    for (let v = 0.06; v < 0.95; v += 0.11) {
      for (let u = 0.15; u < 0.85; u += 0.28) lights.push({ u, v, seed: rnd(), warm: rnd() > 0.25 });
    }
    buildings.push({ x, w, h, lights });
    x += w + 0.004;
  }
  const drops = Array.from({ length: 170 }, () => ({ x: rnd(), y: rnd(), l: 0.025 + rnd() * 0.05, v: 0.55 + rnd() * 0.7 }));

  function drawScene(t) {
    const wx = W * 0.07; const wy = H * 0.07; const ww = W * 0.6; const wh = H * 0.64;

    let grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#241840');
    grd.addColorStop(1, '#130d24');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    // Lamp light on the wall
    const flick = 1 + Math.sin(t * 7.3) * 0.015 + Math.sin(t * 2.1) * 0.02;
    grd = g.createRadialGradient(W * 0.86, H * 0.5, 0, W * 0.86, H * 0.5, W * 0.42 * flick);
    grd.addColorStop(0, 'rgba(255, 176, 90, 0.42)');
    grd.addColorStop(1, 'rgba(255, 140, 60, 0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    // Through the window
    g.save();
    g.beginPath();
    g.rect(wx, wy, ww, wh);
    g.clip();
    grd = g.createLinearGradient(0, wy, 0, wy + wh);
    grd.addColorStop(0, '#0a0f3a');
    grd.addColorStop(0.55, '#33206a');
    grd.addColorStop(1, '#e0607e');
    g.fillStyle = grd;
    g.fillRect(wx, wy, ww, wh);

    for (const s of stars) {
      g.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.p));
      g.fillStyle = '#fff';
      g.fillRect(wx + s.x * ww, wy + s.y * wh, s.s, s.s);
    }
    g.globalAlpha = 1;

    const mx = wx + ww * 0.76; const my = wy + wh * 0.22; const mr = wh * 0.075;
    grd = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
    grd.addColorStop(0, 'rgba(255, 240, 200, 0.45)');
    grd.addColorStop(1, 'rgba(255, 240, 200, 0)');
    g.fillStyle = grd;
    g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    g.fillStyle = '#fff3d2';
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(200, 180, 140, 0.35)';
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.1, -0.45, 0.1]]) {
      g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); g.fill();
    }

    for (const b of buildings) {
      const bx = wx + b.x * ww; const bw = b.w * ww; const bh = b.h * wh; const by = wy + wh - bh;
      g.fillStyle = '#120b26';
      g.fillRect(bx, by, bw, bh);
      for (const l of b.lights) {
        const on = ((Math.floor(t / 4 + l.seed * 9) * 7919 + l.seed * 1000) % 10) > 4.2;
        if (!on || l.v * bh < 6) continue;
        g.fillStyle = l.warm ? 'rgba(255, 206, 120, 0.85)' : 'rgba(140, 220, 255, 0.8)';
        g.fillRect(bx + l.u * bw, by + l.v * bh, Math.max(2, bw * 0.14), Math.max(2, wh * 0.025));
      }
    }

    g.strokeStyle = 'rgba(190, 205, 255, 0.38)';
    g.lineWidth = 1;
    g.beginPath();
    for (const d of drops) {
      const y = ((d.y + t * d.v * 0.45) % 1.1) - 0.05;
      const x = d.x + y * 0.06;
      g.moveTo(wx + x * ww, wy + y * wh);
      g.lineTo(wx + (x + d.l * 0.12) * ww, wy + (y + d.l) * wh);
    }
    g.stroke();
    g.restore();

    // Window frame and sill
    g.strokeStyle = '#3b2a60';
    g.lineWidth = W * 0.016;
    g.strokeRect(wx, wy, ww, wh);
    g.lineWidth = W * 0.008;
    g.beginPath();
    g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh);
    g.moveTo(wx, wy + wh * 0.45); g.lineTo(wx + ww, wy + wh * 0.45);
    g.stroke();
    g.fillStyle = '#4b3676';
    g.fillRect(wx - W * 0.025, wy + wh, ww + W * 0.05, H * 0.035);

    // Sleeping cat on the sill
    const cx = wx + ww * 0.24; const cy = wy + wh - H * 0.002;
    const breath = 1 + Math.sin(t * 1.7) * 0.05;
    g.fillStyle = '#0b0716';
    g.beginPath();
    g.ellipse(cx, cy - H * 0.045 * breath, W * 0.07, H * 0.05 * breath, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(cx - W * 0.06, cy - H * 0.04, H * 0.045, 0, Math.PI * 2);
    g.fill();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx - W * 0.06 + s * H * 0.035, cy - H * 0.07);
      g.lineTo(cx - W * 0.06 + s * H * 0.012, cy - H * 0.11);
      g.lineTo(cx - W * 0.06 - s * H * 0.006, cy - H * 0.075);
      g.fill();
    }
    g.strokeStyle = '#0b0716';
    g.lineWidth = H * 0.018;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + W * 0.065, cy - H * 0.02);
    g.quadraticCurveTo(cx + W * 0.11, cy - H * 0.01, cx + W * 0.09, cy - H * 0.06);
    g.stroke();
    g.fillStyle = 'rgba(255, 220, 160, 0.9)';
    g.font = `${Math.round(H * 0.04)}px system-ui`;
    const zz = (t * 0.6) % 3;
    g.globalAlpha = Math.max(0, 1 - zz / 3);
    g.fillText('z', cx - W * 0.03 + zz * 6, cy - H * 0.12 - zz * H * 0.04);
    g.globalAlpha = 1;

    // Desk
    const dy = H * 0.8;
    grd = g.createLinearGradient(0, dy, 0, H);
    grd.addColorStop(0, '#3d2645');
    grd.addColorStop(1, '#1a0f20');
    g.fillStyle = grd;
    g.fillRect(0, dy, W, H - dy);
    g.fillStyle = '#6b4a72';
    g.fillRect(0, dy, W, 2);

    // Lamp
    const lx = W * 0.88;
    grd = g.createRadialGradient(lx, dy, 0, lx, dy, W * 0.2);
    grd.addColorStop(0, 'rgba(255, 190, 110, 0.5)');
    grd.addColorStop(1, 'rgba(255, 190, 110, 0)');
    g.fillStyle = grd;
    g.fillRect(lx - W * 0.2, dy, W * 0.4, H * 0.2);
    g.fillStyle = '#2a1a2e';
    g.fillRect(lx - 2, H * 0.5, 4, dy - H * 0.5);
    g.beginPath(); g.ellipse(lx, dy, W * 0.03, H * 0.012, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffcf8a';
    g.shadowColor = 'rgba(255, 190, 100, 0.9)';
    g.shadowBlur = 30 * flick;
    g.beginPath();
    g.moveTo(lx - W * 0.03, H * 0.42); g.lineTo(lx + W * 0.03, H * 0.42);
    g.lineTo(lx + W * 0.05, H * 0.52); g.lineTo(lx - W * 0.05, H * 0.52);
    g.fill();
    g.shadowBlur = 0;

    // Plant
    const px = W * 0.76;
    g.fillStyle = '#c0674a';
    g.fillRect(px - W * 0.018, dy - H * 0.06, W * 0.036, H * 0.06);
    g.fillStyle = '#3fbf7f';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.42 + Math.sin(t * 0.8 + i) * 0.04;
      g.save();
      g.translate(px, dy - H * 0.06);
      g.rotate(a);
      g.beginPath(); g.ellipse(H * 0.06, 0, H * 0.06, H * 0.018, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // Mug with steam
    const mugX = W * 0.66;
    g.fillStyle = '#e9dcc8';
    g.fillRect(mugX - W * 0.016, dy - H * 0.055, W * 0.032, H * 0.055);
    g.strokeStyle = '#e9dcc8';
    g.lineWidth = 3;
    g.beginPath(); g.arc(mugX + W * 0.02, dy - H * 0.03, H * 0.014, -1.4, 1.4); g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      for (let k = 0; k <= 12; k++) {
        const yy = dy - H * 0.07 - k * H * 0.012;
        const xx = mugX + (i - 1) * 6 + Math.sin(t * 1.5 + k * 0.6 + i * 2) * 4;
        if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy);
      }
      g.stroke();
    }

    // Vignette and watermark
    grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
    grd.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grd.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255, 255, 255, 0.4)';
    g.font = `600 ${Math.round(H * 0.032)}px system-ui`;
    g.fillText('LOFI MOON', W - H * 0.27, H * 0.08);
  }

  // ---------- Live spectrum ----------

  const spec = $('spectrum');
  const sg = spec.getContext('2d');
  let freq = null;
  const BARS = 56;

  function drawSpectrum() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = spec.clientWidth; const h = spec.clientHeight;
    if (spec.width !== Math.round(w * dpr)) { spec.width = Math.round(w * dpr); spec.height = Math.round(h * dpr); }
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    sg.clearRect(0, 0, w, h);
    const a = window.demoAnalyser;
    if (!a) {
      sg.fillStyle = '#888';
      sg.font = '12px system-ui';
      sg.fillText('Starts when the video plays', 8, h / 2);
      return;
    }
    if (!freq) freq = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(freq);
    const nyq = a.context.sampleRate / 2;
    const bw = w / BARS;
    const grd = sg.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, spectrumColors[0]);
    grd.addColorStop(1, spectrumColors[1]);
    sg.fillStyle = grd;
    for (let i = 0; i < BARS; i++) {
      const f0 = 40 * (16000 / 40) ** (i / BARS);
      const f1 = 40 * (16000 / 40) ** ((i + 1) / BARS);
      const b0 = Math.floor((f0 / nyq) * freq.length);
      const b1 = Math.max(b0 + 1, Math.floor((f1 / nyq) * freq.length));
      let m = 0;
      for (let b = b0; b < b1; b++) m = Math.max(m, freq[b]);
      const bh = Math.max(1.5, (m / 255) ** 1.6 * h);
      sg.globalAlpha = 0.55 + 0.45 * (m / 255);
      sg.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    }
    sg.globalAlpha = 1;
  }

  // ---------- Frame loop ----------

  let sceneT = 0;
  let last = performance.now();
  function frameLoop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!video.paused) sceneT += dt * video.playbackRate;
    drawScene(sceneT);
    drawSpectrum();

    const rate = video.playbackRate;
    $('rate').textContent = `${rate.toFixed(2)}x`;
    const semis = 12 * Math.log2(rate);
    $('pitch').textContent = Math.abs(rate - 1) < 0.005
      ? 'original speed & pitch'
      : `${rate.toFixed(2)}x speed, ${semis.toFixed(1)} semitones`;
    const s = window.demoChrome.store.settings;
    $('liveFx').classList.toggle('on', !s || s.enabled !== false);
    if (video.duration) {
      $('time').textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
      $('scrubFill').style.width = `${(video.currentTime / video.duration) * 100}%`;
    }
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);

  // ---------- Guided tour ----------

  // Under the popup when there's room, otherwise over the description card so the spectrum stays visible.
  function layoutCaption() {
    const cap = $('caption');
    if (cap.hidden) return;
    cap.removeAttribute('style');
    const pr = panel.getBoundingClientRect();
    const top = Math.min(pr.bottom + 6, innerHeight - cap.offsetHeight - 8);
    if (panel.classList.contains('open') && top >= pr.bottom - 20) {
      cap.style.top = `${top}px`;
      return;
    }
    const d = document.querySelector('.desc').getBoundingClientRect();
    Object.assign(cap.style, {
      top: 'auto', right: 'auto', bottom: '12px',
      left: `${Math.max(12, d.left)}px`,
      width: `${Math.min(innerWidth - 24, Math.max(300, d.width))}px`
    });
  }
  addEventListener('resize', layoutCaption);

  const replayBtn = $('replayBtn');
  replayBtn.addEventListener('click', () => runTour());

  const cursor = $('cursor');
  const STEPS = 12;
  let tourToken = 0;
  const SKIP = Symbol('skip');

  function place(x, y, instant = false) {
    cursor.style.transition = instant ? 'none' : '';
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  function centerOf(el, fx = 0.5, fy = 0.5) {
    const r = el.getBoundingClientRect();
    let ox = 0; let oy = 0;
    if (el.ownerDocument !== document) {
      const fr = frame.getBoundingClientRect();
      ox = fr.left; oy = fr.top;
    }
    return { x: ox + r.left + r.width * fx, y: oy + r.top + r.height * fy };
  }

  function makeTour(token) {
    const alive = () => { if (token !== tourToken) throw SKIP; };
    const pause = async (ms) => { await wait(ms); alive(); };
    const moveTo = async (el, fx, fy) => {
      alive();
      const p = centerOf(el, fx, fy);
      place(p.x, p.y);
      await pause(800);
    };
    const tap = async (el) => {
      if (!el) return;
      await moveTo(el);
      cursor.classList.remove('click');
      void cursor.offsetWidth;
      cursor.classList.add('click');
      el.click();
      fdoc()?.activeElement?.blur();
      await pause(350);
    };
    const drag = async (input, to) => {
      const min = Number(input.min); const max = Number(input.max);
      const from = Number(input.value);
      const at = (v) => {
        const r = input.getBoundingClientRect();
        const fr = frame.getBoundingClientRect();
        return { x: fr.left + r.left + 9 + ((v - min) / (max - min)) * (r.width - 18), y: fr.top + r.top + r.height / 2 };
      };
      let p = at(from);
      place(p.x, p.y);
      await pause(800);
      const steps = 30;
      for (let i = 1; i <= steps; i++) {
        const e = 0.5 - Math.cos((i / steps) * Math.PI) / 2;
        input.value = String(from + (to - from) * e);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        p = at(Number(input.value));
        place(p.x, p.y, true);
        await pause(35);
      }
    };
    const say = (n, title, body) => {
      alive();
      $('capStep').textContent = String(n);
      $('capTitle').textContent = title;
      $('capBody').textContent = body;
      const text = document.querySelector('.cap-text');
      text.classList.remove('swap');
      void text.offsetWidth;
      text.classList.add('swap');
      $('capBar').style.width = `${(n / STEPS) * 100}%`;
      layoutCaption();
    };
    return { alive, pause, moveTo, tap, drag, say };
  }

  async function runTour() {
    const token = ++tourToken;
    const { pause, moveTo, tap, drag, say } = makeTour(token);
    window.demoTourDone = false;
    $('caption').hidden = false;
    replayBtn.hidden = true;
    $('skipBtn').textContent = 'Skip';
    cursor.hidden = false;
    place(innerWidth * 0.4, innerHeight * 0.55, true);

    try {
      await chrome.tabs.sendMessage(1, { type: 'sleepytube:sleep', minutes: 0 });
      await chrome.storage.local.set({ settings: { ...DEFAULTS, enabled: false } });
      localStorage.setItem('tab', 'sound');
      localStorage.setItem('fineOpen', '0');
      await loadPopup();
      panelOpen(true);
      if (video.paused) video.play().catch(() => {});

      say(1, 'A normal YouTube video', 'Plain lofi beats, straight from the page. Have a listen.');
      await moveTo($('scene'), 0.45, 0.4);
      await pause(3800);

      say(2, 'Switch SleepyTube on', 'The "Sleepy" mood slows it down, lowers the pitch, muffles it and adds a soft hush.');
      await tap(q('header .power'));
      await pause(5200);

      say(3, 'One-click moods', 'Underwater: deep, muffled and far away.');
      await tap(byText('#presets .preset', 'Underwater'));
      await pause(4500);

      say(4, 'Slowed + Reverb', 'The classic slowed sound in a big, dreamy room.');
      await tap(byText('#presets .preset', 'Slowed'));
      await pause(5000);

      say(5, 'Muffle', 'Like hearing it through a wall. Watch the treble vanish from the spectrum below the video.');
      await tap(byText('#presets .preset', 'Sleepy'));
      await drag(q('input[aria-label="Muffle"]'), 92);
      await pause(3500);

      say(6, 'Add a hush', 'Brown, pink, fan or rain noise, playing only while the video plays.');
      await tap(byText('#noiseType button', 'Rain'));
      await drag(q('input[aria-label="Hush"]'), 40);
      await pause(3500);

      say(7, 'Now the screen', 'Night look: a blue-light filter that warms the colours, plus a little dimming.');
      await tap(q('[data-tab="screen"]'));
      await tap(byText('#looks .preset', 'Night'));
      await pause(3500);

      say(8, 'Candle', 'Very warm and candle-lit.');
      await tap(byText('#looks .preset', 'Candle'));
      await pause(3200);

      say(9, 'Black & white', 'Or sepia, or mix your own with the sliders.');
      await tap(byText('#looks .preset', 'B&W'));
      await pause(3200);

      say(10, 'Dreamy', 'Soft, warm and hazy. The video picture itself is gently blurred.');
      await tap(byText('#looks .preset', 'Dreamy'));
      await pause(3600);

      say(11, 'Black screen', 'Blacks out the page while the sound keeps playing.');
      await tap(q('label.switch-row'));
      await pause(2200);
      const host = $('sleepytube-blackout');
      const wake = () => host?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      say(11, 'Black screen', 'Move the mouse and a "Show video" button fades in, so it never traps you.');
      await moveTo(host, 0.42, 0.62);
      wake();
      await pause(1300);
      wake();
      await tap(host?.shadowRoot?.querySelector('button'));
      await pause(1500);

      say(12, 'Sleep timer', 'Fades the sound out over the last minutes, then pauses the video.');
      await tap(byText('#sleep button', '30m'));
      await pause(3800);

      say(12, "That's SleepyTube", 'Now it\'s your turn: everything here is live. Install it from chrome://extensions with Load unpacked.');
      await tap(byText('#sleep button', 'Off'));
      await tap(byText('#looks .preset', 'Off'));
      await tap(q('[data-tab="sound"]'));
      cursor.hidden = true;
      $('skipBtn').textContent = 'Close';
      replayBtn.textContent = 'Replay tour';
      replayBtn.hidden = false;
      window.demoTourDone = true;
    } catch (e) {
      if (e !== SKIP) throw e;
    }
  }

  function endTour() {
    tourToken += 1;
    $('caption').hidden = true;
    cursor.hidden = true;
    replayBtn.textContent = 'Replay tour';
    replayBtn.hidden = false;
    window.demoTourDone = true;
    // Don't leave the page blacked out if the tour was skipped mid-step.
    const s = window.demoChrome.store.settings;
    if (s?.blackout) chrome.storage.local.set({ settings: { ...s, blackout: false } });
  }
  $('skipBtn').addEventListener('click', endTour);

  // ---------- Intro ----------

  const start = (tour) => {
    $('intro').classList.add('gone');
    video.play().catch(() => {});
    if (tour) runTour();
    else {
      panelOpen(true);
      replayBtn.textContent = 'Take the tour';
      replayBtn.hidden = false;
    }
  };
  $('tourBtn').addEventListener('click', () => start(true));
  $('exploreBtn').addEventListener('click', () => start(false));
  window.demoStartTour = runTour;

  video.src = await window.makeLofi();
  $('tourBtn').textContent = 'Take the 60-second tour';
  $('tourBtn').disabled = false;
  $('exploreBtn').disabled = false;
})();
