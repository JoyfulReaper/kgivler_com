import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Only the hostname is needed to initialize the actual browser configuration.
async function configFor(hostname) {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { hostname } };
  try {
    return await import('../Source/js/config.js?host=' + encodeURIComponent(hostname));
  } finally {
    globalThis.window = previousWindow;
  }
}

const config = await configFor('kgivler.i2p');
const routes = {
  clearnet: ['https://api.kgivler.com', 'https://randomsteam.kgivler.com', 'https://qotd-api.kgivler.com'],
  ygg: ['http://api.ygg.kgivler.com', 'https://steam.ygg.kgivler.com', 'http://qotd.ygg.kgivler.com'],
  dn42: ['https://api.kgivler.dn42', 'https://randomsteam.dn42', 'https://qotd.kgivler.dn42'],
  local: ['http://localhost:5081', 'http://localhost:5182', 'http://localhost:5269'],
  i2p: ['http://i3orcbjjienp2x53tplvjozico73xfhcelqr3lzav5yu5wghk4hq.b32.i2p', 'http://randomsteam.i2p', null],
};
const hosts = [
  ['localhost', 'local'],
  ['127.0.0.1', 'local'],
  ['kgivler.com', 'clearnet'],
  ['www.kgivler.com', 'clearnet'],
  ['site.ygg.kgivler.com', 'ygg'],
  ['[301:762f:80bd:20e1::40]', 'ygg'],
  ['kgivler.dn42', 'dn42'],
  ['api.kgivler.dn42', 'dn42'],
  ['kgivler.i2p', 'i2p'],
  ['api.kgivler.i2p', 'i2p'],
  ['arbitrary.b32.i2p', 'i2p'],
  ['KGIVLER.I2P.', 'i2p'],
];

for (const [hostname, network] of hosts) {
  test('classification, runtime flags, and endpoints: ' + hostname, async () => {
    const current = await configFor(hostname);
    const [site, steam, qotd] = routes[network];
    const expected = { SERVICES: site, TELEMETRY: site, GIT_ACTIVITY: site, STEAM: steam, QOTD: qotd };
    assert.equal(current.classifyNetwork(hostname), network);
    assert.equal(current.IS_LOCAL, network === 'local');
    assert.equal(current.IS_YGG, network === 'ygg');
    assert.equal(current.IS_DN42, network === 'dn42');
    assert.equal(current.IS_I2P, network === 'i2p');
    assert.deepEqual(current.getApiConfig(hostname), expected);
    assert.deepEqual(current.API_CONFIG, expected);
    assert.ok(Object.isFrozen(current.API_CONFIG));
  });
}

test('I2P suffix boundaries do not misclassify clearnet hosts', () => {
  for (const hostname of ['kgivler.i2p.example', 'noti2p', 'i2p']) {
    assert.equal(config.classifyNetwork(hostname), 'clearnet');
  }
});

test('overriding the I2P site API leaves other service routes unchanged', () => {
  const overriddenServices = { ...config.I2P_SERVICES, SITE_API: 'http://api.kgivler.i2p' };
  assert.deepEqual(config.getApiConfig('kgivler.i2p', overriddenServices), {
    SERVICES: 'http://api.kgivler.i2p', TELEMETRY: 'http://api.kgivler.i2p', GIT_ACTIVITY: 'http://api.kgivler.i2p',
    STEAM: 'http://randomsteam.i2p', QOTD: null,
  });
  for (const [hostname, network] of hosts.filter(([, network]) => network !== 'i2p')) {
    assert.deepEqual(config.getApiConfig(hostname, overriddenServices), config.getApiConfig(hostname), network);
  }
  assert.equal(config.I2P_SERVICES.SITE_API, routes.i2p[0]);
  assert.ok(Object.isFrozen(config.I2P_SERVICES));
});

test('missing or explicitly null I2P service settings stay disabled', () => {
  const disabled = { SERVICES: null, TELEMETRY: null, GIT_ACTIVITY: null, STEAM: null, QOTD: null };
  assert.deepEqual(config.getApiConfig('kgivler.i2p', {}), disabled);
  assert.deepEqual(config.getApiConfig('kgivler.i2p', { SITE_API: null, STEAM: null, QOTD: null }), disabled);
});

// Test-only dependency substitution: execute the unchanged API module with the
// real resolver's configuration. No application exports or files are modified.
async function apiFor(hostname, services = config.I2P_SERVICES) {
  const source = await readFile(new URL('../Source/js/api.js', import.meta.url), 'utf8');
  const settings = config.getApiConfig(hostname, services);
  const configuration = 'data:text/javascript,' + encodeURIComponent(
    'export const API_CONFIG = ' + JSON.stringify(settings) + '; export const IS_I2P = ' + (config.classifyNetwork(hostname) === 'i2p') + ';'
  );
  assert.ok(source.includes('"./config.js"') && source.includes('"./markdown.js"'));
  const module = source
    .replace('"./config.js"', JSON.stringify(configuration))
    .replace('"./markdown.js"', JSON.stringify(new URL('../Source/js/markdown.js', import.meta.url).href));
  return import('data:text/javascript,' + encodeURIComponent(module));
}

async function assertSiteUnavailable(api) {
  assert.equal(await api.getSystemData(), null);
  for (const result of await Promise.all([
    api.getHostStatus(), api.getSteamPresence(), api.getRecentGitActivity(), api.getBbsMessages(), api.postBbsMessage('test'),
  ])) {
    assert.equal(result.ok, false);
    assert.equal(result.status, 0);
    assert.match(result.error, /not available on this network/);
  }
}

function terminal() {
  const errors = [];
  const output = [];
  return { errors, output, loadingText() {}, errorText(text) { errors.push(text); }, printTrustedHtml(text) { output.push(text); } };
}

test('explicitly disabled I2P site API and QOTD make zero requests, including retries', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  const api = await apiFor('kgivler.i2p', { ...config.I2P_SERVICES, SITE_API: null, QOTD: null });
  for (let attempt = 0; attempt < 2; attempt++) {
    await assertSiteUnavailable(api);
    assert.deepEqual(await api.getQuoteOfTheDay(), {
      ok: false, disabled: true, error: 'Quote of the Day is not available on this network.', status: 0,
    });
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('explicitly disabling all I2P integrations also prevents Random Steam fetches', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  const api = await apiFor('kgivler.i2p', { SITE_API: null, STEAM: null, QOTD: null });
  await assertSiteUnavailable(api);
  assert.equal((await api.getQuoteOfTheDay()).disabled, true);
  const ctx = terminal();
  await api.fetchRandomGame('Mister_God', ctx);
  assert.match(ctx.errors[0], /not available on this network/);
  assert.deepEqual(ctx.output, []);
  assert.equal(fetch.mock.callCount(), 0);
});

test('enabled I2P site API helpers route reads and BBS writes through the I2P host', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => [] }));
  const api = await apiFor('kgivler.i2p', { ...config.I2P_SERVICES, SITE_API: 'http://api.kgivler.i2p' });
  await api.getSystemData();
  await api.getHostStatus();
  await api.getSteamPresence();
  await api.getRecentGitActivity(3);
  await api.getBbsMessages();
  await api.postBbsMessage('test');
  const calls = fetch.mock.calls.map(call => call.arguments);
  assert.deepEqual(calls.map(([url]) => url), [
    'http://api.kgivler.i2p/api/system/usage', 'http://api.kgivler.i2p/api/system/status',
    'http://api.kgivler.i2p/api/steam/presence', 'http://api.kgivler.i2p/api/github/activity?limit=3',
    'http://api.kgivler.i2p/api/bbs', 'http://api.kgivler.i2p/api/bbs',
  ]);
  assert.ok(calls.every(([, options]) => options.redirect === 'error'));
  assert.equal(calls[5][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[5][1].body), { author: 'Visitor', content: 'test' });
});

test('Random Steam uses I2P and opts out of automatic redirect following', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ name: 'Test game', id: 42 }) }));
  const api = await apiFor('kgivler.i2p');
  const ctx = terminal();
  await api.fetchRandomGame('Mister_God', ctx);
  assert.equal(fetch.mock.callCount(), 1);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'http://randomsteam.i2p/api/steam/random-game/details?vanityUrl=Mister_God');
  assert.equal(options.redirect, 'error');
  assert.deepEqual(ctx.errors, []);
  assert.match(ctx.output[0], /Test game/);
});

for (const destination of ['https://api.kgivler.com', 'http://localhost:5081', 'http://service.i2p.example', 'ftp://service.i2p']) {
  test('I2P helpers reject an invalid configured destination: ' + destination, async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
    const api = await apiFor('kgivler.i2p', { SITE_API: destination, STEAM: destination, QOTD: destination });
    await assertSiteUnavailable(api);
    const quote = await api.getQuoteOfTheDay();
    assert.equal(quote.ok, false);
    assert.match(quote.error, /not available on this network/);
    const ctx = terminal();
    await api.fetchRandomGame('', ctx);
    assert.match(ctx.errors[0], /not available on this network/);
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('a rejected redirect becomes unavailable without a second request or clearnet fallback', async (t) => {
  // Model fetch's redirect:error contract without contacting a real service.
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(new URL(url).hostname.endsWith('.i2p'));
    assert.equal(options.redirect, 'error');
    throw new TypeError('Redirect blocked: Location https://api.kgivler.com/');
  });
  t.mock.method(console, 'error', () => {});
  const api = await apiFor('kgivler.i2p', { ...config.I2P_SERVICES, SITE_API: 'http://api.kgivler.i2p' });
  const result = await api.getHostStatus();
  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
  assert.match(result.error, /currently unavailable/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('clearnet helpers preserve successful requests and normal redirect behavior', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ text: 'A quote' }) }));
  const api = await apiFor('kgivler.com');
  assert.deepEqual(await api.getQuoteOfTheDay(), { ok: true, quote: { text: 'A quote' } });
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://qotd-api.kgivler.com/api/quotes/today');
  assert.equal(options.redirect, undefined);
});

test('QOTD shows its disabled-network state and keeps Refresh disabled', async (t) => {
  const output = { replaceChildren(...children) { this.children = children; } };
  const button = { disabled: false };
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  globalThis.window = { location: { hostname: 'kgivler.i2p' } };
  globalThis.document = {
    getElementById(id) { return id === 'qotd-output' ? output : id === 'btn-qotd-refresh' ? button : null; },
    createElement() { return {}; },
  };
  try {
    const qotd = await import('../Source/js/qotd.js');
    await qotd.refreshQotd();
    assert.equal(button.disabled, true);
    assert.match(output.children[0].textContent, /UNAVAILABLE.*not available on this network/);
    assert.match(output.children[1].textContent, /No Quote of the Day endpoint/);
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
