/* Make it pop: standard form elements with some life in them.
 * https://ramphal.design · MIT · draft
 *
 * Each element enhances a real one. The native input stays in the page,
 * focusable and submittable, so keyboards, screen readers, autofill and
 * forms all keep working; take the script away and it's a plain form.
 *
 *   MakeItPop.field(formEl, options)     the border field (BorderField.enhance)
 *   MakeItPop.checkbox(inputEl, options) a checkbox that draws its tick
 *   MakeItPop.suggestEmail(value)        "did you mean…?" for a mistyped domain
 *   MakeItPop.enhance(rootEl)            every [data-pop] element inside rootEl
 *
 * Colours come from the page: currentColor for the ink, --pop-danger for an
 * error. Motion is off under prefers-reduced-motion.
 */
(function (root, factory) {
  const BorderField = (typeof module !== 'undefined' && module.exports)
    ? (() => { try { return require('../border-field/border-field.js'); } catch (e) { return null; } })()
    : root.BorderField;
  const api = factory(BorderField);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MakeItPop = api;
})(typeof self !== 'undefined' ? self : this, function (BorderField) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  // A spring: x chases target, overshoots, settles. step(dt) returns true
  // while it's still moving.
  function spring(x, k, damp) {
    const s = { x, v: 0, target: x, k: k || 260, damp: damp || 16 };
    s.step = (dt) => {
      const a = (s.target - s.x) * s.k - s.v * s.damp;
      s.v += a * dt;
      s.x += s.v * dt;
      return Math.abs(s.v) > 0.001 || Math.abs(s.target - s.x) > 0.001;
    };
    return s;
  }

  // ---------- field: the border field ----------
  function field(form, options) {
    if (!BorderField) throw new Error('MakeItPop.field needs border-field.js loaded first.');
    return BorderField.enhance(form, options);
  }

  // ---------- suggestEmail: "did you mean…?" ----------
  // A likely typo in the domain, for asking on send (never while typing).
  // Plain string distance against a short list; no AI.
  const DOMAINS = [
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ca', 'hotmail.com', 'hotmail.ca',
    'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
    'proton.me', 'protonmail.com', 'hey.com', 'fastmail.com', 'zoho.com', 'gmx.com',
    'rogers.com', 'shaw.ca', 'sympatico.ca', 'bell.net', 'telus.net', 'videotron.ca',
  ];
  const TLDS = ['com', 'ca', 'net', 'org', 'co', 'io', 'me', 'design', 'dev', 'app', 'co.uk', 'edu'];
  function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }
  function closest(word, list, max) {
    let best = null;
    let bestD = max + 1;
    for (const w of list) {
      if (w === word) return null;
      const dd = distance(word, w);
      if (dd < bestD) { best = w; bestD = dd; }
    }
    return bestD <= max ? best : null;
  }
  function suggestEmail(value) {
    const v = String(value || '').trim().toLowerCase();
    const at = v.lastIndexOf('@');
    if (at < 1) return null;
    const local = v.slice(0, at);
    const domain = v.slice(at + 1);
    if (!domain || DOMAINS.includes(domain)) return null;
    const known = closest(domain, DOMAINS, domain.length > 6 ? 2 : 1);
    if (known) return { address: local + '@' + known, local, domain: known };
    const dot = domain.indexOf('.');
    if (dot > 0) {
      const name = domain.slice(0, dot);
      const tld = domain.slice(dot + 1);
      if (!TLDS.includes(tld)) {
        const fixed = closest(tld, TLDS, tld.length > 3 ? 2 : 1);
        if (fixed) return { address: local + '@' + name + '.' + fixed, local, domain: name + '.' + fixed };
      }
    }
    return null;
  }

  // ---------- checkbox: the tick draws itself ----------
  // The box is a hand-drawn rounded square (a little uneven, the same every
  // time for the same box). Checking squashes it like a press, springs it
  // back, and draws the tick in with an overshoot; a few sparks fly off the
  // corners. Unchecking rubs the tick out. A required box left unchecked on
  // submit goes jagged in --pop-danger and nudges, the field's error, and
  // smooths again once it's ticked.
  const BOX_CSS = '.pop-cb{position:relative;display:inline-grid;place-items:center;flex:none;vertical-align:middle}'
    + '.pop-cb>input{appearance:none;-webkit-appearance:none;margin:0;width:100%;height:100%;position:absolute;inset:0;cursor:pointer;border-radius:6px;background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;min-width:0!important;min-height:0!important}'
    + '.pop-cb>input:focus-visible{outline:2px solid currentColor;outline-offset:3px}'
    + '.pop-cb>svg{width:100%;height:100%;overflow:visible;pointer-events:none;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}'
    + '.pop-cb .pop-cb__spark{opacity:0}'
    + '.pop-cb.is-wrong>svg .pop-cb__box{stroke:var(--pop-danger,#e74646)}';
  let cssAdded = false;
  function addCss() {
    if (cssAdded || typeof document === 'undefined') return;
    cssAdded = true;
    const style = document.createElement('style');
    style.dataset.makeItPop = '';
    style.textContent = BOX_CSS;
    document.head.appendChild(style);
  }

  function seeded(seed) {
    let s = seed % 2147483647 || 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  // The box outline in a 24-unit square: points round a rounded square,
  // each nudged out by a little hand-drawn wobble and, when it's wrong, by
  // teeth. wobble and teeth are 0..1.
  function boxPath(rand, wobble, teeth, swell) {
    const pts = [];
    const n = 64;
    const half = 8.5 + swell;
    const jit = [];
    for (let i = 0; i < 6; i++) jit.push(rand() * 2 - 1);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      // A superellipse stands in for a rounded square: close enough, and
      // every point has a normal to push along.
      const c = Math.cos(t), s = Math.sin(t);
      // Higher is squarer: 8 reads as a box with the field's corner.
      const p = 8;
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / p) * half;
      const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / p) * half;
      let push = wobble * 0.55 * (jit[0] * Math.sin(t * 2 + jit[1] * 3) + jit[2] * 0.6 * Math.sin(t * 3 + jit[3] * 3));
      if (teeth) push += teeth * 1.9 * (i % 2 ? 1 : -1) * (0.7 + 0.3 * jit[(i >> 2) % 6]);
      const len = Math.hypot(x, y) || 1;
      pts.push([12 + x + (x / len) * push, 12 + y + (y / len) * push]);
    }
    return 'M' + pts.map((q) => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join('L') + 'Z';
  }

  function checkbox(input, options) {
    addCss();
    const opts = Object.assign({ size: 24, line: 2, seed: 0 }, options);
    const wrap = document.createElement('span');
    wrap.className = 'pop-cb';
    wrap.style.width = wrap.style.height = opts.size + 'px';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const s = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    s.style.strokeWidth = (opts.line * 24) / opts.size;
    const box = svg('path', { class: 'pop-cb__box' });
    const tick = svg('path', { class: 'pop-cb__tick', d: 'M7 12.5L10.5 16L17.5 8.5' });
    const sparks = [0, 1, 2, 3].map(() => s.appendChild(svg('line', { class: 'pop-cb__spark' })));
    s.appendChild(box);
    s.appendChild(tick);
    wrap.appendChild(s);

    const seedFrom = opts.seed || [...(input.id || input.name || 'pop')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const TICK_LEN = 16.5;
    tick.style.strokeDasharray = TICK_LEN;

    const squash = spring(1, 420, 14);
    const drawn = spring(input.checked ? 1 : 0, 200, 15);
    const teeth = spring(0, 300, 12);
    const swell = spring(0, 300, 14);
    let sparkAt = -1;
    let raf = 0;
    let last = 0;

    const paint = (now) => {
      const rand = seeded(seedFrom);
      box.setAttribute('d', boxPath(rand, 1, Math.max(0, teeth.x), swell.x));
      tick.style.strokeDashoffset = (TICK_LEN * (1 - Math.max(0, Math.min(1.15, drawn.x)))).toFixed(2);
      tick.style.opacity = drawn.x > 0.02 ? 1 : 0;
      const sq = squash.x;
      s.style.transform = 'scale(' + (1 + (1 - sq) * 0.25).toFixed(3) + ',' + sq.toFixed(3) + ')';
      // Sparks: four short strokes flying out from the corners for a beat.
      const t = sparkAt < 0 ? 1 : Math.min(1, (now - sparkAt) / 420);
      sparks.forEach((l, i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const r0 = 12 + 9 * t, r1 = r0 + 3 * (1 - t);
        l.setAttribute('x1', (12 + Math.cos(a) * r0).toFixed(2));
        l.setAttribute('y1', (12 + Math.sin(a) * r0).toFixed(2));
        l.setAttribute('x2', (12 + Math.cos(a) * r1).toFixed(2));
        l.setAttribute('y2', (12 + Math.sin(a) * r1).toFixed(2));
        l.style.opacity = t < 1 ? (1 - t).toFixed(2) : 0;
      });
    };
    const tick_ = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      let moving = false;
      [squash, drawn, teeth, swell].forEach((sp) => { if (sp.step(dt)) moving = true; });
      paint(now);
      if (moving || (sparkAt >= 0 && now - sparkAt < 420)) raf = requestAnimationFrame(tick_);
      else raf = 0;
    };
    const go = () => {
      if (reduced()) {
        [squash, drawn, teeth, swell].forEach((sp) => { sp.x = sp.target; sp.v = 0; });
        sparkAt = -1;
        paint(0);
        return;
      }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick_); }
    };

    const onChange = () => {
      drawn.target = input.checked ? 1 : 0;
      if (input.checked) {
        squash.x = 0.78; squash.v = 0;
        drawn.v = 6;
        sparkAt = performance.now();
        if (wrap.classList.contains('is-wrong')) { wrap.classList.remove('is-wrong'); teeth.target = 0; input.removeAttribute('aria-invalid'); }
      } else {
        drawn.v = -8;
      }
      go();
    };
    const onDown = () => { squash.target = 0.86; go(); };
    const onUp = () => { squash.target = 1; go(); };
    const onEnter = () => { swell.target = 0.8; go(); };
    const onLeave = () => { swell.target = 0; squash.target = 1; go(); };
    const onInvalid = (e) => {
      e.preventDefault();
      wrap.classList.add('is-wrong');
      input.setAttribute('aria-invalid', 'true');
      teeth.x = 0; teeth.v = 14; teeth.target = 1;
      swell.v = 10;
      go();
    };
    const listeners = [
      [input, 'change', onChange], [input, 'pointerdown', onDown], [input, 'pointerup', onUp],
      [input, 'pointerenter', onEnter], [input, 'pointerleave', onLeave], [input, 'invalid', onInvalid],
    ];
    listeners.forEach(([el, t, fn]) => el.addEventListener(t, fn));
    paint(0);

    return {
      input,
      // 'error' shows the jagged red box; anything else clears it.
      set(state) { if (state === 'error') onInvalid(new Event('invalid')); else { wrap.classList.remove('is-wrong'); teeth.target = 0; go(); } },
      destroy() {
        cancelAnimationFrame(raf);
        listeners.forEach(([el, t, fn]) => el.removeEventListener(t, fn));
        wrap.parentNode.insertBefore(input, wrap);
        wrap.remove();
      },
    };
  }

  // ---------- enhance: everything marked data-pop ----------
  function enhance(rootEl) {
    const scope = rootEl || document;
    const made = [];
    scope.querySelectorAll('input[type=checkbox][data-pop]').forEach((el) => made.push(checkbox(el)));
    return made;
  }

  return { field, checkbox, suggestEmail, enhance, spring };
});
