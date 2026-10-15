import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL('../Source/' + path, import.meta.url), 'utf8');
const pages = ['index.html', 'lab/index.html', 'projects/index.html', 'services/index.html', 'vps-reviews/index.html'];
const i2p = 'http://bmhbwuvcvdof5aenq2ocow4rsqzfwxttdy4o6tbro2kohzxyytfq.b32.i2p/';
const deployments = [
  ['Clearnet', 'https://www.kgivler.com/'], ['Yggdrasil', 'http://site.ygg.kgivler.com/'],
  ['DN42', 'https://kgivler.dn42/'], ['I2P', i2p],
];
const projects = [
  ['Yggdrasil', 'https://yggdrasil-network.github.io/'], ['DN42', 'https://dn42.dev/Home'], ['I2P', 'https://i2p.net/'],
];
const links = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
  .map(([, href, label]) => [label.trim(), href]);

for (const page of pages) {
  test(page + ': footer separates deployment, source, and network-project navigation', () => {
    const footer = read(page).match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)[1];
    const rows = [...footer.matchAll(/<div\b[^>]*>([\s\S]*?)<\/div>/g)].map(match => match[1]);
    assert.match(rows[0], /Also available on:/);
    assert.deepEqual(links(rows[0]), deployments);
    assert.deepEqual(links(rows[1]), [['Project / Source', 'https://github.com/JoyfulReaper/kgivler_com']]);
    assert.match(rows[2], /Network projects:/);
    assert.deepEqual(links(rows[2]), projects);
    assert.equal(links(footer).filter(([label]) => label === 'Development Services').length, 1);
    assert.equal(links(footer).filter(([label]) => label === 'VPS Reviews').length, page === 'vps-reviews/index.html' ? 0 : 1);
    assert.doesNotMatch(footer, /i2paddresshelper|\b(?:src|srcset|ping)=|<link\b|<script\b|<img\b/);
  });
}

// Walk the actual static markup to check ancestors, including nested disclosures
// and affiliate links. This catches an unmarked promotion outside its container.
function presentationElements(html) {
  const stack = [];
  const promotions = [];
  const notes = [];
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/)[1];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const token of body.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)) {
    const value = token[0];
    if (value.startsWith('</')) {
      const tag = value.match(/^<\/([\w-]+)/)[1];
      assert.equal(stack.pop()?.tag, tag, 'Unbalanced HTML near ' + value);
    } else if (value.startsWith('<')) {
      const tag = value.match(/^<([\w-]+)/)[1];
      const element = { tag, hidden: /\shidden(?:\s|>)/.test(value), promotion: value.includes('data-hosting-promotion') };
      if (element.promotion) promotions.push(element);
      if (value.includes('data-i2p-note')) notes.push(element);
      if (value.includes('greencloudvps.com')) assert.ok(element.promotion || stack.some(parent => parent.promotion), 'Exposed affiliate link');
      if (!voidTags.has(tag)) stack.push(element);
    } else if (/GreenCloud/i.test(value)) {
      assert.ok(stack.some(parent => parent.promotion), 'Exposed GreenCloud copy: ' + value.trim());
    }
  }
  assert.equal(stack.length, 0);
  return { promotions, notes };
}

for (const page of pages) {
  test(page + ': initial HTML hides all GreenCloud content without JavaScript', () => {
    const html = read(page);
    const { promotions, notes } = presentationElements(html);
    assert.ok(promotions.length > 0);
    assert.ok(promotions.every(element => element.hidden));
    assert.equal(notes.length, 1);
    assert.ok(notes[0].hidden);
    assert.match(html, /<script type="module" src="\/js\/network-presentation.js"><\/script>/);
    const styles = [...html.matchAll(/<link[^>]*href="([^"]+\.css)(?:\?[^"]*)?"/g)]
      .map(match => read(new URL(match[1], 'https://test.invalid/' + page).pathname.slice(1))).join('\n');
    assert.match(styles, /\[data-hosting-promotion\]\[hidden\],[\s\S]*?display:\s*none\s*!important/);
  });
}

for (const hostname of ['kgivler.i2p', new URL(i2p).hostname, 'KGIVLER.I2P.', 'www.kgivler.com', 'site.ygg.kgivler.com', '[301:762f:80bd:20e1::40]', 'kgivler.dn42', 'localhost']) {
  test('presentation uses the actual classifier independently of API routing: ' + hostname, async (t) => {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const all = pages.map(page => presentationElements(read(page)));
    const promotions = all.flatMap(page => page.promotions);
    const notes = all.flatMap(page => page.notes);
    const requests = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
    globalThis.window = { location: { hostname } };
    globalThis.document = { querySelectorAll(selector) {
      if (selector === '[data-hosting-promotion]') return promotions;
      if (selector === '[data-i2p-note]') return notes;
      throw new Error('Unexpected selector: ' + selector);
    } };
    try {
      const configUrl = new URL('../Source/js/config.js?presentation=' + encodeURIComponent(hostname), import.meta.url).href;
      const config = await import(configUrl);
      const source = read('js/network-presentation.js').replace('"./config.js"', JSON.stringify(configUrl));
      await import('data:text/javascript,' + encodeURIComponent(source));
      assert.ok(promotions.every(element => element.hidden === config.IS_I2P));
      assert.ok(notes.every(element => element.hidden === !config.IS_I2P));
      assert.equal(requests.mock.callCount(), 0);
      assert.doesNotMatch(source, /API_CONFIG|I2P_SERVICES|getApiConfig/);
    } finally {
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
    }
  });
}
