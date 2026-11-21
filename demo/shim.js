// A tiny in-page stand-in for the extension APIs, so the real popup and content
// script can talk to each other inside one ordinary web page.
(() => {
  'use strict';
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const later = (fn) => setTimeout(fn, 0);
  const store = {};
  const changeListeners = new Map();
  const messageListeners = new Map();
  const TAB = { id: 1, active: true, url: 'https://www.youtube.com/watch?v=sleepy-demo' };

  function events(map, owner) {
    return {
      addListener: (fn) => map.set(fn, owner),
      removeListener: (fn) => map.delete(fn),
      hasListener: (fn) => map.has(fn)
    };
  }

  function apiFor(owner) {
    return {
      runtime: { id: 'sleepytube-demo', onMessage: events(messageListeners, owner) },
      storage: {
        onChanged: events(changeListeners, owner),
        local: {
          async get(keys) {
            if (keys == null) return clone(store);
            const out = {};
            for (const k of [].concat(keys)) if (k in store) out[k] = clone(store[k]);
            return out;
          },
          async set(items) {
            const changes = {};
            for (const [k, v] of Object.entries(items)) {
              changes[k] = { oldValue: clone(store[k]), newValue: clone(v) };
              store[k] = clone(v);
            }
            later(() => {
              for (const fn of changeListeners.keys()) {
                try { fn(clone(changes), 'local'); } catch (e) { console.warn(e); }
              }
            });
          }
        }
      },
      tabs: {
        async query() { return [{ ...TAB }]; },
        reload() {},
        sendMessage(_id, msg) {
          return new Promise((resolve) => {
            let done = false;
            const respond = (r) => { if (!done) { done = true; resolve(clone(r)); } };
            for (const fn of messageListeners.keys()) {
              try { fn(clone(msg), { id: 'sleepytube-demo' }, respond); } catch (e) { console.warn(e); }
            }
            later(() => respond(undefined));
          });
        }
      }
    };
  }

  window.demoChrome = {
    store,
    apiFor,
    // Forget listeners from a popup frame that has been replaced.
    drop(owner) {
      for (const map of [changeListeners, messageListeners]) {
        for (const [fn, o] of map) if (o === owner) map.delete(fn);
      }
    },
    reset(settings) {
      for (const k of Object.keys(store)) delete store[k];
      if (settings) store.settings = clone(settings);
    }
  };

  Object.defineProperty(window, 'chrome', { value: apiFor('page'), configurable: true, writable: true });

  // Tap whatever the extension sends to the speakers so the demo can draw a live spectrum.
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const ctx = this.context;
    if (dest instanceof AudioDestinationNode && ctx instanceof AudioContext) {
      if (!ctx.demoAnalyser) {
        const a = ctx.createAnalyser();
        a.fftSize = 4096;
        a.smoothingTimeConstant = 0.82;
        ctx.demoAnalyser = a;
        window.demoAnalyser = a;
      }
      connect.call(this, ctx.demoAnalyser);
    }
    return connect.call(this, dest, ...rest);
  };
})();
