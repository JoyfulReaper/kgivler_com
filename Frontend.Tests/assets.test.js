import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const sourceRoot = fileURLToPath(new URL('../Source/', import.meta.url));
const vendorRoot = path.join(sourceRoot, 'vendor');
const origin = 'https://asset-audit.invalid';
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]
);
const sourceFiles = files(sourceRoot);
const read = file => readFileSync(file, 'utf8');

function localResource(reference, file) {
  const value = reference.trim().replaceAll('&amp;', '&');
  if (/^(?:data:|blob:|#)/i.test(value)) return null;
  const relative = path.relative(sourceRoot, file).split(path.sep).join('/');
  const resolved = new URL(value, origin + '/' + relative);
  assert.equal(resolved.origin, origin, file + ': automatic external resource ' + reference);
  let target = path.join(sourceRoot, decodeURIComponent(resolved.pathname));
  if (resolved.pathname.endsWith('/')) target = path.join(target, 'index.html');
  assert.ok(statSync(target, { throwIfNoEntry: false })?.isFile(), file + ': missing local asset ' + reference);
  return target;
}

// A small scanner for this plain HTML/CSS site, not a browser emulator. Resource
// attributes are checked by tag; URLs in prose, anchors, metadata, and JSON-LD
// are deliberately not treated as automatic loads.
function attributes(text) {
  const result = {};
  for (const match of text.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function auditCss(css, file) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/@import\s+(?:"([^"]+)"|'([^']+)')/gi)) {
    localResource(match[1] ?? match[2], file);
  }
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    localResource(match[1] ?? match[2] ?? match[3], file);
  }
}

function auditHtml(html, file) {
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) auditCss(style[1], file);
  // Script bodies can contain JSON-LD URLs or literal '<' characters. Preserve
  // the opening tag so external script src attributes are still checked.
  html = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1</script>');
  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*?)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = attributes(match[2]);
    const resourceAttrs = [];
    if (['script', 'img', 'iframe', 'source', 'audio', 'video', 'track', 'embed'].includes(tag)) resourceAttrs.push('src');
    if (tag === 'input' && attrs.type?.toLowerCase() === 'image') resourceAttrs.push('src');
    if (tag === 'video') resourceAttrs.push('poster');
    if (tag === 'object') resourceAttrs.push('data');
    if (['image', 'use'].includes(tag)) resourceAttrs.push('href', 'xlink:href');
    if (tag === 'link' && /\b(?:stylesheet|icon|apple-touch-icon|mask-icon|manifest|preload|modulepreload|prefetch|preconnect|dns-prefetch)\b/i.test(attrs.rel ?? '')) resourceAttrs.push('href');
    for (const attr of resourceAttrs) if (attrs[attr] !== undefined) localResource(attrs[attr], file);
    if (['img', 'source', 'link'].includes(tag)) {
      for (const attr of ['srcset', 'imagesrcset']) {
        // Current pages have no srcset. Handle normal relative/HTTP candidates;
        // data URIs are self-contained and may include commas.
        if (attrs[attr] && !attrs[attr].trim().startsWith('data:')) {
          for (const candidate of attrs[attr].split(',')) localResource(candidate.trim().split(/\s+/)[0], file);
        }
      }
    }
    if (attrs.style) auditCss(attrs.style, file);
    if (tag === 'iframe' && attrs.srcdoc) auditHtml(attrs.srcdoc.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>'), file);
    if (tag === 'meta' && attrs['http-equiv']?.toLowerCase() === 'refresh') {
      const target = attrs.content?.match(/\burl\s*=\s*["']?([^"']+)/i);
      if (target) localResource(target[1].trim(), file);
    }
    if (attrs.integrity) {
      const target = localResource(attrs.href ?? attrs.src, file);
      const hashes = attrs.integrity.split(/\s+/);
      assert.ok(hashes.some(hash => {
        const [algorithm, digest] = hash.split('-', 2);
        return ['sha256', 'sha384', 'sha512'].includes(algorithm) && createHash(algorithm).update(readFileSync(target)).digest('base64') === digest;
      }), file + ': stylesheet/script integrity mismatch');
    }
  }
}

test('all HTML automatic resources and inline CSS are local and present', () => {
  const pages = sourceFiles.filter(file => file.endsWith('.html'));
  assert.ok(pages.length > 0);
  for (const file of pages) auditHtml(read(file), file);
});

test('all CSS URLs and imports use existing local assets', () => {
  for (const file of sourceFiles.filter(file => file.endsWith('.css'))) auditCss(read(file), file);
});

test('webmanifest icons and screenshots are local and present', () => {
  for (const file of sourceFiles.filter(file => file.endsWith('.webmanifest'))) {
    const manifest = JSON.parse(read(file));
    for (const resource of [...(manifest.icons ?? []), ...(manifest.screenshots ?? [])]) localResource(resource.src, file);
    for (const shortcut of manifest.shortcuts ?? []) for (const icon of shortcut.icons ?? []) localResource(icon.src, file);
  }
});

test('browser JavaScript imports and resource templates are local; fetch stays centralized', () => {
  for (const file of sourceFiles.filter(file => file.endsWith('.js'))) {
    const js = read(file);
    auditHtml(js, file);
    for (const match of js.matchAll(/\bimport\s+(?:[^;\n]*?\sfrom\s*)?["']([^"']+)["']/g)) localResource(match[1], file);
    for (const match of js.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) localResource(match[1], file);
    // New networking outside api.js needs an explicit review rather than
    // silently bypassing the existing network-aware request guard.
    if (path.relative(sourceRoot, file).split(path.sep).join('/') !== 'js/api.js') {
      assert.doesNotMatch(js, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\.sendBeacon\s*\(/, file);
    }
    assert.doesNotMatch(js, /\.(?:src|srcset|poster)\s*=\s*["'`]\s*(?:https?:)?\/\//i, file);
  }
});

test('vendor manifest paths, provenance URLs, and SHA-256 hashes match local files', () => {
  const manifest = JSON.parse(read(path.join(vendorRoot, 'manifest.json')));
  assert.ok(Array.isArray(manifest) && manifest.length > 0);
  const recorded = new Set();
  for (const entry of manifest) {
    assert.match(entry.file, /^Source\/vendor\//);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(!recorded.has(entry.file), 'Duplicate manifest entry: ' + entry.file);
    recorded.add(entry.file);
    const file = path.resolve(sourceRoot, '..', entry.file);
    assert.ok(file.startsWith(vendorRoot + path.sep), 'Manifest path escapes vendor directory');
    assert.ok(statSync(file).isFile());
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), entry.sha256, entry.file);
    // Parse provenance only; tests never fetch the CDN URLs.
    const provenance = new URL(entry.url);
    assert.equal(provenance.protocol, 'https:');
    assert.ok(['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'].includes(provenance.hostname));
    if (entry.file.includes('bootstrap-5.3.3/')) assert.ok(provenance.pathname.includes('bootstrap@5.3.3/'));
    if (entry.file.includes('fontawesome-6.5.1/')) assert.match(provenance.pathname, /(?:\/6\.5\.1\/|fontawesome-free@6\.5\.1\/)/);
  }
  for (const file of files(vendorRoot)) {
    if (['manifest.json', 'README.md'].includes(path.basename(file))) continue;
    const relative = 'Source/' + path.relative(sourceRoot, file).split(path.sep).join('/');
    assert.ok(recorded.has(relative), 'Vendored file missing from provenance manifest: ' + relative);
  }
});

test('Bootstrap, Font Awesome, all referenced webfonts, licenses, and source map exist', () => {
  const required = [
    'bootstrap-5.3.3/css/bootstrap.min.css', 'bootstrap-5.3.3/css/bootstrap.min.css.map', 'bootstrap-5.3.3/LICENSE',
    'fontawesome-6.5.1/css/all.min.css', 'fontawesome-6.5.1/LICENSE.txt',
  ];
  for (const name of ['fa-brands-400', 'fa-regular-400', 'fa-solid-900', 'fa-v4compatibility']) {
    for (const extension of ['woff2', 'ttf']) required.push('fontawesome-6.5.1/webfonts/' + name + '.' + extension);
  }
  for (const name of required) assert.ok(statSync(path.join(vendorRoot, name))?.isFile(), name);
  const fontCss = path.join(vendorRoot, 'fontawesome-6.5.1/css/all.min.css');
  const references = [...read(fontCss).matchAll(/url\((?:["'])?(\.\.\/webfonts\/[^)"']+)(?:["'])?\)/g)];
  assert.ok(references.length >= 8);
  for (const match of references) localResource(match[1], fontCss);
  const bootstrapCss = path.join(vendorRoot, 'bootstrap-5.3.3/css/bootstrap.min.css');
  const map = read(bootstrapCss).match(/sourceMappingURL=([^\s*]+)/);
  assert.ok(map);
  localResource(map[1], bootstrapCss);
});

test('audit allows external navigation and metadata, while rejecting automatic remote loads', () => {
  const file = path.join(sourceRoot, 'index.html');
  assert.doesNotThrow(() => auditHtml(`
    <a href="https://github.com/JoyfulReaper">Source</a>
    <link rel="canonical" href="https://kgivler.com/">
    <meta property="og:image" content="https://example.com/metadata.png">
    <script type="application/ld+json">{"url":"https://kgivler.com/"}</script>
  `, file));
  for (const html of [
    '<link rel="stylesheet" href="https://cdn.example/style.css">',
    '<script src="//cdn.example/app.js"></script>',
    '<img src="https://example.com/image.png">',
    '<img srcset="https://example.com/image.png 2x">',
    '<iframe src="https://example.com/embed"></iframe>',
    '<video poster="https://example.com/poster.png"></video>',
    '<audio src="https://example.com/audio.ogg"></audio>',
    '<object data="https://example.com/embed"></object>',
    '<link rel="preconnect" href="https://cdn.example">',
    '<div style="background:url(https://example.com/image.png)"></div>',
  ]) assert.throws(() => auditHtml(html, file), /automatic external resource/, html);
  for (const css of [
    '@import "https://cdn.example/style.css";',
    '@import url(//cdn.example/style.css);',
    'body { background: url("https://example.com/image.png"); }',
  ]) assert.throws(() => auditCss(css, file), /automatic external resource/, css);
  assert.doesNotThrow(() => auditCss('body { background: url("data:image/svg+xml,<svg></svg>"); }', file));
});
