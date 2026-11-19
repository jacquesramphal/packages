/* Stateline: form fields whose border is their state.
 * By Jacques Ramphal · https://ramphal.design/doc/make-it-pop · MIT
 *
 * Each element enhances a real one. The native input stays in the page,
 * focusable and submittable, so keyboards, screen readers, autofill and
 * forms all keep working; take the script away and it's a plain form.
 *
 *   Stateline.field(formEl, options)     the border field (BorderField.enhance)
 *   Stateline.checkbox(inputEl, options) a checkbox that draws its tick
 *   Stateline.suggestEmail(value)        "did you mean…?" for a mistyped domain
 *   Stateline.enhance(rootEl)            every [data-stateline] element inside rootEl
 *
 * Colours come from the page: currentColor for the ink, --stateline-danger for an
 * error. Motion is off under prefers-reduced-motion.
 */
(function (root, factory) {
  const BorderField = (typeof module !== 'undefined' && module.exports)
    ? (() => {
      try { return require('@jacquesramphal/border-field'); } catch (e) { /* not installed */ }
      try { return require('../border-field/border-field.js'); } catch (e) { return null; }
    })()
    : root.BorderField;
  const api = factory(BorderField);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Stateline = api;
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
    // Small fixed substeps (semi-implicit Euler), so the motion is the same
    // at 60 or 120 Hz and stays stable when a phone drops a frame.
    s.step = (dt) => {
      let left = dt;
      while (left > 0) {
        const h = Math.min(left, 1 / 240);
        s.v += ((s.target - s.x) * s.k - s.v * s.damp) * h;
        s.x += s.v * h;
        left -= h;
      }
      return Math.abs(s.v) > 0.001 || Math.abs(s.target - s.x) > 0.001;
    };
    return s;
  }

  // ---------- field: the border field ----------
  // The defaults are the look from the essay, signed off in the field lab:
  // the swell follows the caret; a wrong address lands as a hand-drawn red
  // jag that swells, settles and stays red while it's fixed; the send
  // circles; sent flies the outline apart. Any option overrides them, and
  // { look: 'plain' } starts from border-field's own defaults instead.
  const DEFAULTS = {
    typing: 'follow',
    error: 'drawn', uniformity: 0, jagLength: 18, drawnHit: 9, drawnRest: 4.5, soften: true, shake: false, errorBounce: 7,
    loading: 'orbit', waveAmp: 6, waveLength: 22,
    success: 'pieces',
    stroke: 2, radius: 8, focusStroke: 0,
    suggest: true,
  };

  // suggest (on by default) asks "Did you mean …?" on send when the domain
  // looks like a typo (you@gmial.com). The first send stops and asks;
  // clicking the suggestion fixes the address, and sending again as typed
  // goes through. suggest: false turns it off.
  function field(form, options) {
    if (!BorderField) throw new Error('Stateline.field needs @jacquesramphal/border-field (in a page, load border-field.js before stateline.js).');
    const plain = options && options.look === 'plain';
    const opts = Object.assign({}, plain ? { suggest: true } : DEFAULTS, options);
    const onState = opts.onState;
    const suggest = opts.suggest;
    ['look', 'onState', 'suggest'].forEach((k) => delete opts[k]);
    if (!suggest) return watchState(BorderField.enhance(form, opts), onState);

    const input = opts.input || form.querySelector('input[type=email]') || form.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea');
    const described = input && input.getAttribute('aria-describedby');
    const message = opts.message || (described && document.getElementById(described.split(' ')[0])) || null;
    const ask = typeof suggest === 'function' ? suggest : suggestEmail;
    let offered = '';
    let made = null;
    const clear = () => { if (message) { message.textContent = ''; message.dataset.state = ''; } };

    // Capture phase, so it runs before the field's own submit handler.
    const onSubmit = (e) => {
      if (!input || !message || !input.checkValidity()) return;
      const s = ask(input.value);
      const typed = input.value.trim().toLowerCase();
      if (!s || offered === typed) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      offered = typed;
      clear();
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'stateline-suggest';
      b.append(s.local + '@');
      const strong = document.createElement('strong');
      strong.textContent = s.domain;
      b.append(strong);
      b.addEventListener('click', () => {
        setValue(input, s.address);
        offered = '';
        clear();
        if (made) made.field.valid();
        input.focus();
      });
      message.append('Did you mean ', b, '?');
      if (made) made.field.key();
    };
    const onInput = () => { if (offered && input.value.trim().toLowerCase() !== offered) { offered = ''; clear(); } };
    form.addEventListener('submit', onSubmit, true);
    if (input) input.addEventListener('input', onInput);

    addCss();
    if (input) opts.input = input;
    if (message) opts.message = message;
    made = watchState(BorderField.enhance(form, opts), onState);
    const destroy = made.destroy;
    made.destroy = () => {
      form.removeEventListener('submit', onSubmit, true);
      if (input) input.removeEventListener('input', onInput);
      destroy();
    };
    return made;
  }

  // onState(state) hears every change: rest, typing, loading, error, sent.
  function watchState(made, onState) {
    if (!onState) return made;
    const set = made.field.set.bind(made.field);
    let last = made.field.state;
    made.field.set = (state) => {
      set(state);
      if (state !== last) { last = state; onState(state); }
    };
    return made;
  }

  // Sets a value the way typing does, so frameworks that track the input
  // (React's onChange, Vue's v-model) hear it.
  function setValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(input, value); else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---------- styles: the essay's look for the ready-made markup ----------
  // Used by the Vue and React components, and by addStyles() for plain HTML
  // that uses the same class names. :where() keeps it easy to override.
  // Measured from the site's subscribe form, so the npm field matches it:
  // label 20px above the box, a 57px box with the text 20px in, and the
  // hint 23px below in a softer, smaller ink. Messages share the hint's
  // line and replace it while they show, so nothing jumps.
  const FIELD_CSS = ':where(.stateline-field){display:grid;--bf-ink:currentColor;--bf-danger:var(--stateline-danger,#e74646)}'
    + ':where(.stateline-field__label){margin:0 0 20px;opacity:.88}'
    + ':where(.stateline-box){box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:57px;padding:0 12px 0 20px;border:2px solid currentColor;border-radius:8px}'
    + '.stateline-field.bf-ready .stateline-box{border-color:transparent}'
    // Portable: the parts that make the look are guarded against a page's
    // own form styles. Pages commonly set input:focus { outline },
    // input:required:valid { background } and p { color !important }. The
    // input's reset uses !important, and the message and hint are divs, not
    // paragraphs, so a page's paragraph rules never reach them.
    + '.stateline-field .stateline-field__input{flex:1;min-width:0;font:inherit;color:inherit;padding:12px 0;margin:0;min-height:0;height:auto;inline-size:auto;'
    + 'background:transparent!important;border:0!important;border-radius:0!important;outline:0!important;box-shadow:none!important}'
    + '.stateline-field .stateline-field__input::placeholder{color:currentColor;opacity:.55}'
    + ':where(.stateline-field__send){display:grid;place-items:center;flex:none;min-width:38px;height:38px;padding:0 8px;font:inherit;font-weight:500;color:inherit;background:none;border:0;border-radius:8px;cursor:pointer}'
    + ':where(.stateline-field__send) svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
    + ':where(.stateline-field__send):focus-visible{outline:2px solid currentColor}'
    + ':where(.stateline-field__help){display:grid;margin:23px 0 0;min-height:1.15em}'
    + '.stateline-field .stateline-field__message,.stateline-field .stateline-field__hint{grid-area:1/1;margin:0;font-size:.82em;line-height:1.4;color:inherit;opacity:1}'
    + '.stateline-field .stateline-field__hint{opacity:.75}'
    + '.stateline-field .stateline-field__help:has(.stateline-field__message:not(:empty)) .stateline-field__hint{visibility:hidden}'
    + '.stateline-field .stateline-field__message[data-state=error]{color:var(--stateline-danger,#e74646)}'
    + ':where(.stateline-check){display:inline-flex;gap:12px;align-items:center;cursor:pointer}';
  let fieldCssAdded = false;
  function addStyles() {
    if (fieldCssAdded || typeof document === 'undefined') return;
    fieldCssAdded = true;
    const style = document.createElement('style');
    style.dataset.stateline = 'field';
    style.textContent = FIELD_CSS;
    document.head.appendChild(style);
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
  // submit goes jagged in --stateline-danger and nudges, the field's error, and
  // smooths again once it's ticked.
  const BOX_CSS = '.stateline-cb{position:relative;display:inline-grid;place-items:center;flex:none;vertical-align:middle}'
    + '.stateline-cb>input{appearance:none;-webkit-appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;margin:0;width:100%;height:100%;position:absolute;inset:0;cursor:pointer;border-radius:6px;background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;min-width:0!important;min-height:0!important}'
    + '.stateline-cb>input:focus-visible{outline:2px solid currentColor;outline-offset:3px}'
    + '.stateline-cb>svg{width:100%;height:100%;overflow:visible;pointer-events:none;transform-origin:50% 50%;will-change:transform;fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round}'
    + '.stateline-cb .stateline-cb__spark{opacity:0}'
    + '.stateline-cb.is-wrong>svg .stateline-cb__box{stroke:var(--stateline-danger,#e74646)}'
    + ':where(.stateline-suggest){font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.2em}'
    + ':where(.stateline-suggest) strong{font-weight:700}';
  let cssAdded = false;
  function addCss() {
    if (cssAdded || typeof document === 'undefined') return;
    cssAdded = true;
    const style = document.createElement('style');
    style.dataset.stateline = '';
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
  // A rounded square sampled evenly along its length (every 0.25 of 24
  // units), each point with its outward normal. Even spacing matters: the
  // jags of an error are spread round the box, not bunched at the corners.
  function outline(half, r, step) {
    const pts = [];
    const e = half - r;
    const corner = (cx, cy, a0) => {
      const k = Math.max(2, Math.round((Math.PI / 2) * r / step));
      for (let j = 0; j < k; j++) {
        const a = a0 + (j / k) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]);
      }
    };
    const edge = (x0, y0, x1, y1, nx, ny) => {
      const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let j = 0; j < k; j++) pts.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k, nx, ny]);
    };
    corner(e, -e, -Math.PI / 2); edge(half, -e, half, e, 1, 0);
    corner(e, e, 0); edge(e, half, -e, half, 0, 1);
    corner(-e, e, Math.PI / 2); edge(-half, e, -half, -e, -1, 0);
    corner(-e, -e, Math.PI); edge(-e, -half, e, -half, 0, -1);
    return pts;
  }
  const JAGS = 14;
  function boxPath(rand, wobble, teeth, swell) {
    const jit = [];
    for (let i = 0; i < 8; i++) jit.push(rand() * 2 - 1);
    const pts = outline(8.5 + swell, 3, 0.25);
    const n = pts.length;
    return 'M' + pts.map(([x, y, nx, ny], i) => {
      const u = i / n;
      const t = u * Math.PI * 2;
      // The hand-drawn wobble, the same every time for the same box.
      let push = wobble * 0.45 * (jit[0] * Math.sin(t * 2 + jit[1] * 3) + jit[2] * 0.6 * Math.sin(t * 3 + jit[3] * 3));
      // The error: even triangle jags, each a little different in height.
      if (teeth) {
        const f = (u * JAGS) % 1;
        push += teeth * 0.9 * (1 - 4 * Math.abs(f - 0.5)) * (0.75 + 0.25 * jit[Math.floor(u * JAGS) % 8]);
      }
      return (12 + x + nx * push).toFixed(2) + ' ' + (12 + y + ny * push).toFixed(2);
    }).join('L') + 'Z';
  }

  function checkbox(input, options) {
    addCss();
    const opts = Object.assign({ size: 24, line: 2, seed: 0 }, options);
    const wrap = document.createElement('span');
    wrap.className = 'stateline-cb';
    wrap.style.width = wrap.style.height = opts.size + 'px';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const s = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    const baseLine = (opts.line * 24) / opts.size;
    s.style.strokeWidth = baseLine;
    const box = svg('path', { class: 'stateline-cb__box' });
    const tick = svg('path', { class: 'stateline-cb__tick', d: 'M7 12.5L10.5 16L17.5 8.5' });
    const sparks = [0, 1, 2, 3].map(() => s.appendChild(svg('line', { class: 'stateline-cb__spark' })));
    s.appendChild(box);
    s.appendChild(tick);
    wrap.appendChild(s);

    const seedFrom = opts.seed || [...(input.id || input.name || 'pop')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const TICK_LEN = 16.5;
    // Dash longer than the gap needs, so an overshoot never shows the gap.
    tick.style.strokeDasharray = TICK_LEN + ' ' + (TICK_LEN * 3);

    const squash = spring(1, 420, 14);
    const drawn = spring(input.checked ? 1 : 0, 200, 15);
    const teeth = spring(0, 300, 12);
    const swell = spring(0, 300, 14);
    let sparkAt = -1;
    let raf = 0;
    let last = 0;

    const paint = (now) => {
      const rand = seeded(seedFrom);
      const te = Math.max(0, teeth.x);
      box.setAttribute('d', boxPath(rand, 1, te, swell.x));
      // The jags draw in a finer line, so the error reads as a shape, not a
      // heavier box.
      box.style.strokeWidth = te > 0.01 ? (baseLine * (1 - 0.25 * Math.min(1, te))).toFixed(3) : '';
      tick.style.strokeDashoffset = (TICK_LEN * (1 - Math.max(0, Math.min(1, drawn.x)))).toFixed(2);
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
      // rAF's timestamp can be a touch earlier than the performance.now()
      // that started the loop; never step backwards.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
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
        // A push, not a jump: the box keeps moving from wherever the press
        // left it, so there's no snap on a phone's quick tap.
        squash.v -= 7;
        drawn.v = 6;
        sparkAt = performance.now();
        if (wrap.classList.contains('is-wrong')) { wrap.classList.remove('is-wrong'); teeth.target = 0; input.removeAttribute('aria-invalid'); }
      } else {
        drawn.v = -8;
      }
      go();
    };
    const onDown = () => { squash.target = 0.88; go(); };
    const onUp = () => { squash.target = 1; go(); };
    // Hover swell for a mouse only: on touch, enter and leave fire around
    // every tap and the swell would twitch.
    const onEnter = (e) => { if (e.pointerType === 'mouse') { swell.target = 0.8; go(); } };
    const onLeave = () => { swell.target = 0; squash.target = 1; go(); };
    const onInvalid = (e) => {
      e.preventDefault();
      wrap.classList.add('is-wrong');
      input.setAttribute('aria-invalid', 'true');
      // The jags hit, overshoot, and settle at a little over half: still
      // clearly wrong while it waits to be ticked.
      teeth.x = 0; teeth.v = 16; teeth.target = 0.6;
      swell.v = 10;
      go();
    };
    const listeners = [
      [input, 'change', onChange], [input, 'pointerdown', onDown], [input, 'pointerup', onUp],
      [input, 'pointercancel', onUp], [input, 'pointerenter', onEnter], [input, 'pointerleave', onLeave],
      [input, 'invalid', onInvalid],
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

  // ---------- enhance: everything marked data-stateline ----------
  function enhance(rootEl) {
    const scope = rootEl || document;
    const made = [];
    scope.querySelectorAll('input[type=checkbox][data-stateline]').forEach((el) => made.push(checkbox(el)));
    return made;
  }

  return { field, checkbox, suggestEmail, enhance, addStyles, setValue, spring, DEFAULTS };
});
