// Line icons in the style of SF Symbols: 24px grid, 1.7 stroke, round caps.
(function (root) {
  'use strict';

  const P = {
    moon: '<path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2Z"/>',
    moonFill: '<path fill="currentColor" d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2Z"/>',
    sleepy: '<path d="M17.4 15.8A7.2 7.2 0 0 1 8.2 6.6a7.2 7.2 0 1 0 9.2 9.2Z"/><path d="M14.5 3.5h4l-4 4.5h4"/>',
    gauge: '<path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0"/><path d="m12 15.2-4.2-4.4"/><circle cx="12" cy="15.6" r="1.3" fill="currentColor" stroke="none"/>',
    waves: '<path d="M3 8.5c1.5 0 2.2-1.5 3.8-1.5s2.3 1.5 3.8 1.5 2.2-1.5 3.8-1.5 2.3 1.5 3.8 1.5 2.2-1.5 2.8-1.5"/><path d="M3 13c1.5 0 2.2-1.5 3.8-1.5s2.3 1.5 3.8 1.5 2.2-1.5 3.8-1.5 2.3 1.5 3.8 1.5 2.2-1.5 2.8-1.5"/><path d="M3 17.5c1.5 0 2.2-1.5 3.8-1.5s2.3 1.5 3.8 1.5 2.2-1.5 3.8-1.5 2.3 1.5 3.8 1.5 2.2-1.5 2.8-1.5"/>',
    door: '<path d="M6.5 20.5v-15A2 2 0 0 1 8.5 3.5h7a2 2 0 0 1 2 2v15"/><path d="M4 20.5h16"/><circle cx="14.6" cy="12.5" r="1" fill="currentColor" stroke="none"/>',
    arch: '<path d="M4.5 20.5v-9.8L12 4l7.5 6.7v9.8"/><path d="M3 20.5h18"/><path d="M9.5 20.5v-4a2.5 2.5 0 0 1 5 0v4"/>',
    rain: '<path d="M7.2 14.5h9.6a3.6 3.6 0 0 0 .5-7.2 5.6 5.6 0 0 0-10.7 1.5 2.9 2.9 0 0 0 .6 5.7Z"/><path d="m9 17.5-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.7A3.2 3.2 0 0 0 7 18Z"/>',
    headphones: '<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><path d="M4.5 14.5h2a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-.5a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M19.5 14.5h-2a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1h.5a1.5 1.5 0 0 0 1.5-1.5Z"/>',
    sliders: '<path d="M4 7h9M18 7h2M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15.5" cy="7" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M10.2 9.4v5.2l4.4-2.6Z" fill="currentColor"/>',
    flame: '<path d="M12 20.5c3.2 0 5.6-2.3 5.6-5.4 0-2.7-1.6-4.6-3-6.4-.4 1.5-1.3 2.5-2.2 2.8.2-2.7-.9-5.2-3-7 0 3-3 5.4-3 9.6 0 3.6 2.4 6.4 5.6 6.4Z"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="m3.5 16.5 4.7-4.6 3.8 3.6 2.8-2.7 5.7 5.2"/><circle cx="15.8" cy="9.6" r="1.4"/>',
    halfCircle: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/>',
    sunMin: '<circle cx="12" cy="12" r="3.6"/><path d="M12 4.5v.5M12 19v.5M4.5 12H5M19 12h.5M6.7 6.7l.35.35M16.95 16.95l.35.35M6.7 17.3l.35-.35M16.95 7.05l.35-.35"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/>',
    eye: '<path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    speaker: '<path d="M4 9.5h3.2L11.5 5.5v13L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/><path d="M15.2 9.3a3.8 3.8 0 0 1 0 5.4"/>',
    radiate: '<circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M10 8.5a5 5 0 0 1 0 7M13.5 5.5a9.2 9.2 0 0 1 0 13M17 2.8a13 13 0 0 1 0 18.4"/>',
    wind: '<path d="M3 9.5h11.5a3 3 0 1 0-3-3"/><path d="M3 14.5h14.5a3 3 0 1 1-3 3"/><path d="M3 12h6"/>',
    reset: '<path d="M4.6 13a7.5 7.5 0 1 0 2.1-6.3L4.5 8.9"/><path d="M4.5 4.5v4.4h4.4"/>',
    reload: '<path d="M19.4 13a7.5 7.5 0 1 1-2.1-6.3l2.2 2.2"/><path d="M19.5 4.5v4.4h-4.4"/>',
    cup: '<path d="M5 9.5h11v4.8a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 11h1.4a2.6 2.6 0 0 1 0 5.2H16"/><path d="M8.5 3.5c-.7.9.7 1.8 0 2.8M12.5 3.5c-.7.9.7 1.8 0 2.8"/>',
    chevron: '<path d="m9.5 6 6 6-6 6"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.7-.7 1.7-1.6 0-1.1-.9-1.5-.9-2.5 0-.9.7-1.6 1.6-1.6h2.1a4 4 0 0 0 4-4c0-4-3.8-7.3-8.5-7.3Z"/><circle cx="7.6" cy="11.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="9.6" cy="7.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.4" cy="7.6" r="1.15" fill="currentColor" stroke="none"/>'
  };

  function svg(name, size = 18) {
    return `<svg class="i" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"` +
      ` stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  }

  root.SleepyIcons = { paths: P, svg };
})(globalThis);
