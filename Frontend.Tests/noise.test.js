import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const event = (minute, extra = {}) => ({
  timestamp: `2026-10-12T20:${String(minute).padStart(2, '0')}:00Z`,
  sensor: 'public-sensor', protocol: 'TCP', destinationPort: 23,
  source: '185.23.xxx.xxx', ...extra,
});

class Element {
  children = [];
  attributes = {};
  listeners = {};
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.children.length ? this.children.map(child => child.textContent).join(' ') : this.text ?? ''; }
  set innerHTML(_) { throw new Error('Untrusted HTML rendering'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
}

async function widget(t, load, present = true) {
  const output = new Element();
  const button = new Element();
  const document = {
    hidden: false, createElement: () => new Element(), addEventListener() {},
    getElementById: id => present ? ({ 'noise-events': output, 'btn-noise-refresh': button }[id] ?? null) : null,
  };
  const oldDocument = globalThis.document;
  const oldLoad = globalThis.__loadNoise;
  globalThis.document = document;
  globalThis.__loadNoise = load;
  t.after(() => { globalThis.document = oldDocument; globalThis.__loadNoise = oldLoad; });
  const stub = 'data:text/javascript,' + encodeURIComponent('export const getNoiseSnapshot = () => globalThis.__loadNoise();');
  const source = (await readFile(new URL('../Source/js/noise.js', import.meta.url), 'utf8'))
    .replace('"./api.js?v=2"', JSON.stringify(stub));
  const module = await import('data:text/javascript,' + encodeURIComponent(source + '\n// ' + t.name));
  return { module, output, button, document };
}

test('noise preview shows the newest five and drops invalid/full-address data', async t => {
  const { module } = await widget(t, () => {});
  const events = module.recentNoiseEvents({ recentEvents: [
    event(1), event(7, { source: '200:abcd:1234:xxx:xxx:xxx:xxx:xxx' }),
    event(3), event(2), event(6), event(5, { payload: 'SECRET', banner: 'SECRET' }), event(4),
    event(9, { source: '185.23.1.2' }), event(9, { source: '2001:db8::1' }),
    event(9, { source: '<script>bad</script>' }), event(9, { source: '999.1.xxx.xxx' }),
    event(9, { timestamp: 'bad' }), event(9, { destinationPort: 70000 }), null,
  ] });
  assert.equal(events.length, 5);
  assert.deepEqual(events.map(value => new Date(value.timestamp).getUTCMinutes()), [7, 6, 5, 4, 3]);
  assert.ok(events.every(value => !('payload' in value) && !('banner' in value)));
  assert.deepEqual(module.recentNoiseEvents({ RecentEvents: [event(1)] }), []);
});

test('noise widget renders literal text, polls at 30 seconds, isolates failures, and avoids overlap', async t => {
  let calls = 0;
  let next = async () => ({ ok: true, snapshot: { recentEvents: [event(1, { sensor: '<img src=x onerror=alert(1)>' })] } });
  const { module, output, button, document } = await widget(t, () => { calls++; return next(); });
  let poll;
  const intervals = t.mock.method(globalThis, 'setInterval', (callback, ms) => {
    assert.equal(ms, 30000); poll = callback; return 42;
  });
  const cleared = t.mock.method(globalThis, 'clearInterval', () => {});
  module.initNoiseObservatory();
  module.initNoiseObservatory();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(intervals.mock.callCount(), 1);
  assert.equal(calls, 1);
  assert.match(output.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(output.textContent, /TCP\/23/);
  assert.match(output.textContent, /185\.23\.xxx\.xxx/);
  assert.equal(output.children[0].children[0].children[1].dateTime, '2026-10-12T20:01:00.000Z');

  document.hidden = true; poll(); assert.equal(calls, 1);
  document.hidden = false;
  let finish;
  next = () => new Promise(resolve => { finish = resolve; });
  const flight = module.refreshNoiseObservatory();
  assert.equal(button.disabled, true);
  poll(); await module.refreshNoiseObservatory();
  assert.equal(calls, 2);
  finish({ ok: true, snapshot: { recentEvents: [] } }); await flight;
  assert.match(output.textContent, /QUIET/);
  assert.equal(button.disabled, false);
  assert.equal(output.attributes['aria-busy'], 'false');

  next = async () => { throw new Error('SECRET upstream diagnostic'); };
  await module.refreshNoiseObservatory();
  assert.match(output.textContent, /UNAVAILABLE/);
  assert.doesNotMatch(output.textContent, /SECRET/);
  assert.equal(button.disabled, false);

  next = async () => ({ ok: false, disabled: true });
  await module.refreshNoiseObservatory();
  assert.match(output.textContent, /Open Noise Observatory/);
  assert.equal(cleared.mock.calls.at(-1).arguments[0], 42);
});

test('pages without the widget do not request noise data or start a timer', async t => {
  const { module } = await widget(t, () => { throw new Error('Unexpected request'); }, false);
  const interval = t.mock.method(globalThis, 'setInterval', () => { throw new Error('Unexpected polling'); });
  module.initNoiseObservatory();
  await module.refreshNoiseObservatory();
  assert.equal(interval.mock.callCount(), 0);
});

async function api(t, origin) {
  const oldWindow = globalThis.window;
  globalThis.window = { location: { origin } };
  t.after(() => { globalThis.window = oldWindow; });
  const source = (await readFile(new URL('../Source/js/api.js', import.meta.url), 'utf8'))
    .replace('"./config.js"', JSON.stringify('data:text/javascript,export const API_CONFIG = {}; export const IS_I2P = false;'))
    .replace('"./markdown.js"', JSON.stringify(new URL('../Source/js/markdown.js', import.meta.url).href));
  return import('data:text/javascript,' + encodeURIComponent(source + '\n// ' + t.name));
}

for (const origin of ['https://kgivler.com', 'https://www.kgivler.com']) {
  test('noise GET uses the public snapshot without credentials: ' + origin, async t => {
    const module = await api(t, origin);
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, 'https://noise.kgivler.com/api/snapshot');
      assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit');
      assert.equal(options.mode, 'cors'); assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store'); assert.equal(options.headers, undefined);
      return { ok: true, json: async () => ({ recentEvents: [event(1)] }) };
    });
    assert.equal((await module.getNoiseSnapshot()).ok, true);
  });
}

for (const origin of ['http://kgivler.i2p', 'https://kgivler.dn42', 'http://site.ygg.kgivler.com', 'http://localhost:5500', 'https://foreign.example']) {
  test('noise preview makes no clearnet request from ' + origin, async t => {
    const module = await api(t, origin);
    const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request'); });
    assert.deepEqual(await module.getNoiseSnapshot(), { ok: false, disabled: true });
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('noise API handles HTTP, malformed JSON, and network failures without raw diagnostics', async t => {
  const module = await api(t, 'https://kgivler.com');
  const fetch = t.mock.method(globalThis, 'fetch');
  for (const implementation of [
    async () => ({ ok: false, json: () => { throw new Error('Must not read errors'); } }),
    async () => ({ ok: true, json: async () => { throw new Error('SECRET'); } }),
    async () => ({ ok: true, json: async () => ({ RecentEvents: [] }) }),
    async () => { throw new Error('SECRET'); },
  ]) {
    fetch.mock.mockImplementation(implementation);
    assert.deepEqual(await module.getNoiseSnapshot(), { ok: false });
  }
});

test('noise timeout covers a stalled response body and aborts after eight seconds', async t => {
  const module = await api(t, 'https://kgivler.com');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Aborted')));
    }) };
  });
  const request = module.getNoiseSnapshot();
  await Promise.resolve();
  t.mock.timers.tick(8000);
  assert.deepEqual(await request, { ok: false });
  assert.equal(signal.aborted, true);
});
