// Stateline checks that run without a browser: the exports every entry point
// promises, the suggester, the defaults the site and npm share, and that the
// lab copy of border-field is the one npm gets. Run: pnpm stateline:test
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const Stateline = require('./stateline.js');
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok ${n} ${name}`); };
// Two checks look at the website that uses the package. They only run inside
// that repo; anywhere else they're skipped.
const inSite = existsSync(new URL('../../src/utils/emailSuggest.js', import.meta.url));
const siteOk = (name, fn) => (inSite ? ok(name, fn) : console.log(`skip ${name} (not in the site repo)`));

ok('core exports', () => {
  for (const k of ['field', 'checkbox', 'suggestEmail', 'enhance', 'addStyles', 'setValue', 'spring', 'DEFAULTS']) assert.ok(k in Stateline, k);
});

ok('suggests a fix for common typos', () => {
  const cases = {
    'you@gmial.com': 'you@gmail.com',
    'a@hotmial.com': 'a@hotmail.com',
    'a@gmail.con': 'a@gmail.com',
    'a@outlok.com': 'a@outlook.com',
    'a@yahoo.cm': 'a@yahoo.com',
  };
  for (const [typed, want] of Object.entries(cases)) assert.equal(Stateline.suggestEmail(typed)?.address, want, typed);
});

ok('leaves good and unknown addresses alone', () => {
  for (const v of ['a@gmail.com', 'me@ramphal.design', 'x@company.io', 'no-at-sign', '']) assert.equal(Stateline.suggestEmail(v), null, v);
});

ok('the essay look is the default', () => {
  const d = Stateline.DEFAULTS;
  assert.equal(d.typing, 'follow');
  assert.equal(d.error, 'drawn');
  assert.equal(d.loading, 'orbit');
  assert.equal(d.success, 'pieces');
  assert.equal(d.suggest, true);
});

siteOk('the site uses the package, not a copy', () => {
  const site = readFileSync(new URL('../../src/utils/emailSuggest.js', import.meta.url), 'utf8');
  assert.match(site, /from '@jacquesramphal\/stateline'/);
  for (const f of ['../../src/components/blog/SubscribeField.vue', '../../src/components/form/PopCheckbox.vue']) {
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /from '@jacquesramphal\/stateline'/, f);
  }
});

ok('every file in exports is published', () => {
  const files = new Set(pkg.files);
  for (const entry of Object.values(pkg.exports)) {
    for (const p of typeof entry === 'string' ? [entry] : Object.values(entry)) assert.ok(files.has(p.replace('./', '')) || p === './package.json', p);
  }
});

ok('options.json lists every engine option once, defaults inside their ranges', () => {
  const BorderField = require('@jacquesramphal/border-field');
  const { groups } = JSON.parse(readFileSync(new URL('./options.json', import.meta.url)));
  const list = groups.flatMap((g) => g.options);
  const keys = list.map((o) => o.key);
  assert.deepEqual([...keys].sort(), Object.keys(BorderField.DEFAULTS).sort());
  for (const o of list) {
    for (const v of [BorderField.DEFAULTS[o.key], Stateline.DEFAULTS[o.key]]) {
      if (v === undefined) continue;
      if (o.range) assert.ok(v >= o.range[0] && v <= o.range[1], `${o.key}=${v} outside ${o.range}`);
      if (o.choices) assert.ok(o.choices.includes(v), `${o.key}=${v} not in choices`);
      if (o.bool) assert.equal(typeof v, 'boolean', o.key);
    }
  }
});

ok('patterns: every one draws a still, with a clear mask when asked', () => {
  const P = require('./patterns.js');
  for (const [key] of P.LIST) {
    const out = P.svg(key, { width: 600, height: 340 });
    assert.match(out, /^<svg /, key);
    assert.ok((out.match(/<path /g) || []).length > 0, `${key} drew nothing`);
  }
  assert.match(P.svg('travellers', { clear: 'left' }), /mask="url\(#sl-clear\)"/);
  for (const name of Object.keys(P.PRESETS)) assert.ok(P.svg('travellers', { preset: name }).startsWith('<svg'), name);
});

siteOk('the lab runs the package patterns, not a copy', () => {
  const lab = readFileSync(new URL('../../public/lab/line-patterns/patterns.js', import.meta.url), 'utf8');
  assert.equal(lab, readFileSync(new URL('./patterns.js', import.meta.url), 'utf8'));
});

const vue = await import('./vue.mjs').catch((e) => e);
ok('vue entry loads', () => { assert.ok(vue.StatelineField && vue.StatelineCheckbox, vue.message); });
const react = await import('./react.mjs').catch((e) => e);
ok('react entry loads', () => { assert.ok(react.StatelineField && react.StatelineCheckbox, react.message); });

console.log(`\n${n} passed`);
