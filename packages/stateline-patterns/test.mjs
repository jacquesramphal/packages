// Stateline patterns checks that run without a browser: every pattern draws
// a still, presets resolve, and the lab runs this copy. Run: pnpm patterns:test
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok ${n} ${name}`); };
// The lab check looks at the website that uses the package, so it only runs
// inside that repo.
const inSite = existsSync(new URL('../../public/lab/line-patterns/patterns.js', import.meta.url));
const siteOk = (name, fn) => (inSite ? ok(name, fn) : console.log(`skip ${name} (not in the site repo)`));

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


console.log(`\n${n} passed`);
