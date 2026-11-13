/* Border field: an input whose outline is its state.
 * https://ramphal.design/lab/expressive-forms/ · MIT
 *
 * The outline is an SVG path sampled every couple of pixels round a rounded
 * rectangle. Each point is pushed out along its normal by whatever the field
 * is doing: a swell that follows the caret while you type (or a jiggle, or
 * ripples), a wave or a spinner while it sends, teeth or a pulse when it's
 * wrong, and a sunburst or confetti when it's sent. The state shapes ride
 * springs, so they overshoot and settle.
 *
 * No dependencies. Plain JS, because the shape is recomputed every frame;
 * CSS only does the colours (--bf-ink, --bf-danger) and the icon.
 *
 * The quick way, on any form with a text or email input:
 *
 *   BorderField.enhance(formEl, { onSubmit: (value) => fetch(...) });
 *
 * It keeps the form a real form: the browser's own validation decides what
 * is wrong (type="email", required, pattern), and without onSubmit the form
 * submits as it always would. The lower-level engine, for wiring it yourself:
 *
 *   const field = BorderField.create(rootEl, { typing: 'follow' });
 *   field.caret(x)   // where the caret is, in px across the field
 *   field.key(x)     // a keystroke at x
 *   field.focus(true|false)
 *   field.set('rest' | 'typing' | 'loading' | 'error' | 'sent')
 *   field.params     // live: change any value and the next frame uses it
 *
 * The outline is drawn round rootEl's .box (or options.box, or rootEl), in an
 * <svg class="edge"> it adds if there isn't one. rootEl gets the class
 * bf-ready, so a CSS border can stand in until then and step aside after.
 */
(function (global) {
  const SVGNS = 'http://www.w3.org/2000/svg';

  const DEFAULTS = {
    stroke: 3,
    radius: 16,
    focusStroke: 1.5, // added to the line while the field has focus, so focus shows without a ring
    stiffness: 0.14, // how hard the state shapes pull toward their target
    damping: 0.18, // how fast they stop wobbling

    typing: 'follow', // 'follow' | 'jiggle' | 'ripple'
    followAmp: 4, // how far the border swells over the caret
    followWidth: 28, // how wide the swell is
    followKick: 5, // the extra nudge a keystroke gives it
    followEase: 0.2, // how quickly it catches up with the caret
    jiggleKick: 5,
    rippleAmp: 11,
    rippleSpeed: 320,

    loading: 'wave', // 'wave' | 'spinner'
    waveAmp: 10,
    waveLength: 52,
    waveSpeed: 150,
    spinLength: 0.035, // a share of the perimeter
    spinSpeed: 0.7, // laps a second

    error: 'jagged', // 'jagged' | 'pulse'
    jagAmp: 12,
    jagLength: 22,
    pulseAmp: 10,
    pulseRate: 1.4,
    shake: true,

    success: 'both', // 'sunburst' | 'confetti' | 'both'
    rayLength: 38,
    raySpacing: 22,
    confettiSpacing: 14,
  };

  // Made on first use, so the file can be imported where there's no DOM.
  let reducedQuery = null;
  const reduced = {
    get matches() {
      if (!reducedQuery) reducedQuery = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
      return reducedQuery.matches;
    },
  };
  let measureCtx = null;
  const measurer = () => measureCtx || (measureCtx = document.createElement('canvas').getContext('2d'));

  // Where the caret is, in px from the left of box.
  function caretX(input, box) {
    const cs = getComputedStyle(input);
    const measure = measurer();
    measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const end = input.selectionStart == null ? input.value.length : input.selectionStart;
    const ir = input.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    return ir.left - br.left + parseFloat(cs.paddingLeft) + measure.measureText(input.value.slice(0, end)).width - input.scrollLeft;
  }

  function create(root, options) {
    const params = Object.assign({}, DEFAULTS, options);
    const box = params.box || root.querySelector('.box') || root;
    delete params.box;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    let svg = box.querySelector('.edge') || root.querySelector('.edge');
    if (!svg) {
      svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'edge');
      svg.setAttribute('aria-hidden', 'true');
      box.prepend(svg);
    }
    root.classList.add('bf-ready');
    const PAD = 60;
    const STEP = 2.5;
    svg.innerHTML = '';
    svg.style.position = 'absolute';
    svg.style.left = -PAD + 'px';
    svg.style.top = -PAD + 'px';
    svg.style.overflow = 'visible';
    svg.style.pointerEvents = 'none';

    const main = document.createElementNS(SVGNS, 'path');
    main.setAttribute('fill', 'none');
    main.setAttribute('stroke-linejoin', 'round');
    main.setAttribute('stroke-linecap', 'round');
    svg.appendChild(main);
    const tails = [];
    for (let k = 0; k < 18; k++) {
      const t = document.createElementNS(SVGNS, 'path');
      t.setAttribute('fill', 'none');
      t.setAttribute('stroke-linecap', 'round');
      t.style.stroke = 'var(--bf-ink, currentColor)';
      svg.appendChild(t);
      tails.push(t);
    }
    const fx = document.createElementNS(SVGNS, 'g');
    svg.appendChild(fx);

    let W = 0, H = 0, R = params.radius, P = 1;
    const resize = () => {
      const r = box.getBoundingClientRect();
      W = r.width;
      H = r.height;
      R = Math.min(params.radius, H / 2, W / 2);
      P = 2 * (W + H - 4 * R) + 2 * Math.PI * R;
      svg.setAttribute('width', W + PAD * 2);
      svg.setAttribute('height', H + PAD * 2);
    };
    new ResizeObserver(resize).observe(box);
    resize();

    // A point s px clockwise round the edge from the end of the top-left
    // corner, with its outward normal.
    function at(s) {
      s = ((s % P) + P) % P;
      const top = W - 2 * R, side = H - 2 * R, arc = (Math.PI * R) / 2;
      const corner = (cx, cy, a0) => (u) => {
        const a = a0 + (R ? u / R : 0);
        return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.cos(a), Math.sin(a)];
      };
      const segs = [
        [top, (u) => [R + u, 0, 0, -1]],
        [arc, corner(W - R, R, -Math.PI / 2)],
        [side, (u) => [W, R + u, 1, 0]],
        [arc, corner(W - R, H - R, 0)],
        [top, (u) => [W - R - u, H, 0, 1]],
        [arc, corner(R, H - R, Math.PI / 2)],
        [side, (u) => [0, H - R - u, -1, 0]],
        [arc, corner(R, R, Math.PI)],
      ];
      for (const [len, f] of segs) {
        if (s <= len) return f(s);
        s -= len;
      }
      return segs[0][1](0);
    }
    const topS = (x) => Math.min(Math.max(x - R, 0), W - 2 * R);
    const bottomS = (x) => 2 * (W - 2 * R) + Math.PI * R + (H - 2 * R) - topS(x);

    const spring = () => ({ x: 0, v: 0, target: 0 });
    const sp = { wave: spring(), jag: spring(), pulse: spring(), spin: spring() };
    const jig = { x: 0, v: 0, n: 4, ph: 0 };
    const follow = { x: 0, target: 0, amp: 0, v: 0, on: false };
    const ripples = [];
    let draw = 1;
    let hidden = false;
    let state = 'rest';
    let focused = false;
    const t0 = performance.now();
    let running = true;

    const reps = (len) => Math.max(1, Math.round(P / len));
    const dist = (a, b) => {
      const d = Math.abs(a - b) % P;
      return Math.min(d, P - d);
    };

    function offset(s, t) {
      const p = params;
      let o = 0;
      if (Math.abs(follow.amp) > 0.01) {
        const w2 = 2 * p.followWidth * p.followWidth;
        const a = dist(s, topS(follow.x));
        const b = dist(s, bottomS(follow.x));
        o += follow.amp * (Math.exp(-(a * a) / w2) + Math.exp(-(b * b) / w2));
      }
      if (Math.abs(jig.x) > 0.01) o += jig.x * Math.sin((2 * Math.PI * jig.n * s) / P + jig.ph);
      for (const r of ripples) {
        const age = t - r.t;
        const d = dist(s, r.s) - age * p.rippleSpeed;
        o += p.rippleAmp * Math.exp(-age * 2.6) * Math.exp(-(d * d) / (2 * 16 * 16));
      }
      if (Math.abs(sp.wave.x) > 0.005) {
        const n = reps(p.waveLength);
        o += sp.wave.x * p.waveAmp * Math.sin((2 * Math.PI * n * (s - t * p.waveSpeed)) / P);
      }
      if (Math.abs(sp.jag.x) > 0.005) {
        const n = reps(p.jagLength);
        const x = ((n * s) / P) % 1;
        o += sp.jag.x * p.jagAmp * (1 - 4 * Math.abs(x - 0.5));
      }
      if (Math.abs(sp.pulse.x) > 0.005) o += sp.pulse.x * p.pulseAmp * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 * p.pulseRate));
      return o;
    }

    function frame(now) {
      if (!running) return;
      if (!root.isConnected) { running = false; return; }
      const p = params;
      const still = reduced.matches;
      const t = still ? 0 : (now - t0) / 1000;
      if (p.radius !== R && Math.min(p.radius, H / 2, W / 2) !== R) resize();

      for (const k in sp) {
        const s = sp[k];
        if (still) { s.x = s.target; s.v = 0; continue; }
        s.v += (s.target - s.x) * p.stiffness - s.v * p.damping;
        s.x += s.v;
      }
      jig.v += -jig.x * 0.22 - jig.v * 0.09;
      jig.x += jig.v;

      // The swell glides after the caret, and settles to its resting size
      // while you're typing; a keystroke bumps it and it springs back.
      follow.x += (follow.target - follow.x) * p.followEase;
      const restAmp = p.typing === 'follow' && focused && state === 'typing' ? p.followAmp : 0;
      follow.v += (restAmp - follow.amp) * 0.2 - follow.v * 0.22;
      follow.amp += follow.v;

      if (still) { jig.x = jig.v = 0; follow.amp = restAmp; follow.v = 0; follow.x = follow.target; ripples.length = 0; }
      for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t > 1.4) ripples.splice(i, 1);

      let d = '';
      for (let s = 0; s < P; s += STEP) {
        const [x, y, nx, ny] = at(s);
        const o = offset(s, t);
        d += (d ? 'L' : 'M') + (x + nx * o + PAD).toFixed(1) + ' ' + (y + ny * o + PAD).toFixed(1);
      }
      d += 'Z';
      main.setAttribute('d', d);
      const pulseW = sp.pulse.x * 3 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 * p.pulseRate));
      main.style.stroke = state === 'error' ? 'var(--bf-danger, #d43a3a)' : 'var(--bf-ink, currentColor)';
      main.style.strokeWidth = p.stroke + Math.max(0, pulseW) + (focused ? p.focusStroke : 0);
      main.style.transition = 'stroke-width 0.15s ease';
      main.style.strokeDasharray = draw < 1 ? `${P * 1.2} ${P * 1.2}` : '';
      main.style.strokeDashoffset = draw < 1 ? P * 1.2 * (1 - draw) : '';
      const sw = Math.max(0, Math.min(1, sp.spin.x));
      main.style.opacity = hidden ? 0 : 1 - 0.75 * sw;

      // The spinner: overlapping dashes, each a little behind and fainter,
      // read as one bold stroke with a fading tail.
      tails.forEach((path, k) => {
        if (sw < 0.01) { path.style.opacity = 0; return; }
        path.setAttribute('d', d);
        const len = P * p.spinLength;
        path.style.strokeDasharray = `${len} ${P * 2}`;
        path.style.strokeDashoffset = -(((t * P * p.spinSpeed - k * len * 0.45) % P) + P) % P;
        path.style.strokeWidth = p.stroke * 2.3 - k * 0.22;
        path.style.opacity = sw * Math.pow(1 - k / tails.length, 1.6);
      });

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function line(x1, y1, x2, y2, colour, width) {
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke-linecap', 'round');
      l.style.stroke = colour;
      l.style.strokeWidth = width;
      l.style.transformBox = 'view-box';
      fx.appendChild(l);
      return l;
    }

    function sunburst() {
      const p = params;
      const n = Math.round(P / p.raySpacing);
      for (let i = 0; i < n; i++) {
        const [x, y, nx, ny] = at((i / n) * P);
        const len = i % 2 ? p.rayLength * 0.58 : p.rayLength;
        const bx = x + PAD + nx * 10, by = y + PAD + ny * 10;
        const l = line(bx, by, bx + nx * len, by + ny * len, 'var(--bf-ink, currentColor)', p.stroke + 1);
        l.style.transformOrigin = `${bx}px ${by}px`;
        if (reduced.matches) { setTimeout(() => l.remove(), 900); continue; }
        l.animate(
          [
            { transform: 'translate(0,0) scale(0)', opacity: 1 },
            { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0.35 },
            { transform: `translate(${nx * 26}px, ${ny * 26}px) scale(0.2)`, opacity: 0 },
          ],
          { duration: 900, delay: (i % 4) * 25, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' },
        ).onfinish = () => l.remove();
      }
    }

    function confetti() {
      const p = params;
      const n = Math.round(P / p.confettiSpacing);
      hidden = true;
      for (let i = 0; i < n; i++) {
        const [x, y, nx, ny] = at((i + Math.random() * 0.5) * (P / n));
        // Each piece starts as a stretch of the border itself.
        const tx = -ny, ty = nx, cx = x + PAD, cy = y + PAD;
        // Same ink and line width as the border, so the pieces read as the
        // outline coming apart.
        const l = line(cx - tx * 6, cy - ty * 6, cx + tx * 6, cy + ty * 6, 'var(--bf-ink, currentColor)', p.stroke);
        l.style.transformOrigin = `${cx}px ${cy}px`;
        if (reduced.matches) { setTimeout(() => l.remove(), 900); continue; }
        const far = 40 + Math.random() * 60;
        const spin = (Math.random() - 0.5) * 720;
        l.animate(
          [
            { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${nx * far * 0.7}px, ${ny * far * 0.7 - 10}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${nx * far}px, ${ny * far + 50}px) rotate(${spin}deg)`, opacity: 0 },
          ],
          { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'forwards' },
        ).onfinish = () => l.remove();
      }
      setTimeout(redraw, reduced.matches ? 300 : 1100);
    }

    // Draws the outline back in, from nothing to closed.
    function redraw() {
      hidden = false;
      if (reduced.matches) { draw = 1; return; }
      const start = performance.now();
      draw = 0;
      const tick = (now) => {
        const k = Math.min(1, (now - start) / 650);
        draw = 1 - Math.pow(1 - k, 3);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    function pulseClass(cls, ms) {
      root.classList.remove(cls);
      void root.offsetWidth;
      root.classList.add(cls);
      setTimeout(() => root.classList.remove(cls), ms);
    }

    const api = {
      params,
      caret(x) {
        follow.target = x;
        if (!follow.on) { follow.x = x; follow.on = true; }
      },
      key(x) {
        const p = params;
        if (x != null) api.caret(x);
        if (p.typing === 'follow') follow.v += p.followKick * 0.35;
        else if (p.typing === 'ripple') {
          const now = (performance.now() - t0) / 1000;
          ripples.push({ s: topS(follow.target), t: now }, { s: bottomS(follow.target), t: now });
          if (ripples.length > 24) ripples.splice(0, 2);
        } else {
          jig.v += p.jiggleKick + Math.random() * 1.5;
          if (Math.abs(jig.x) < 1) { jig.n = 3 + Math.floor(Math.random() * 4); jig.ph = Math.random() * Math.PI * 2; }
        }
      },
      focus(on) { focused = on; },
      set(st) {
        const p = params;
        state = st;
        root.dataset.state = st;
        sp.wave.target = st === 'loading' && p.loading === 'wave' ? 1 : 0;
        sp.spin.target = st === 'loading' && p.loading === 'spinner' ? 1 : 0;
        sp.jag.target = st === 'error' && p.error === 'jagged' ? 1 : 0;
        sp.pulse.target = st === 'error' && p.error === 'pulse' ? 1 : 0;
        if (st === 'error' && p.error === 'jagged') { sp.jag.v += 0.25; if (p.shake) pulseClass('is-shaking', 600); }
        if (st === 'error' && p.error === 'pulse') sp.pulse.v += 0.2;
        if (st === 'sent') {
          pulseClass('is-popping', 600);
          if (p.success !== 'confetti') sunburst();
          if (p.success !== 'sunburst') confetti();
        }
      },
      get state() { return state; },
      stop() { running = false; },
    };
    return api;
  }

  // ---------- enhance: the whole form, wired ----------
  const MESSAGES = {
    empty: 'Add your email address first.',
    invalid: '', // empty: the browser's own validationMessage
    sending: 'Sending…',
    sent: 'On its way.',
    failed: 'That didn’t go through. Try again.',
  };

  function enhance(form, options) {
    const opts = Object.assign({}, options);
    const input = opts.input || form.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]), textarea');
    if (!input) throw new Error('BorderField.enhance: no text input in this form.');
    const box = opts.box || form.querySelector('.box') || input.parentElement;
    const described = input.getAttribute('aria-describedby');
    const message = opts.message || (described && document.getElementById(described.split(' ')[0])) || null;
    const messages = Object.assign({}, MESSAGES, opts.messages);
    const onSubmit = opts.onSubmit;
    const resetAfter = opts.resetAfter == null ? 2600 : opts.resetAfter;
    ['input', 'box', 'message', 'messages', 'onSubmit', 'resetAfter'].forEach((k) => delete opts[k]);

    const field = create(form, Object.assign(opts, { box }));
    let busy = false;
    let timer = 0;
    // The form keeps its rules; it just shows them through the border.
    form.noValidate = true;

    const say = (text, kind) => {
      if (!message) return;
      message.textContent = text || '';
      message.dataset.state = kind || '';
    };
    const caret = () => { if (document.activeElement === input) field.caret(caretX(input, box)); };
    const fromValue = () => {
      if (busy || field.state === 'sent') return;
      if (field.state === 'error' && !input.checkValidity() && input.value) return;
      if (field.state === 'error') { input.removeAttribute('aria-invalid'); say(''); }
      field.set(input.value ? 'typing' : 'rest');
    };

    const listeners = [
      [input, 'input', () => { field.key(caretX(input, box)); fromValue(); }],
      [input, 'focus', () => { field.focus(true); caret(); }],
      [input, 'blur', () => field.focus(false)],
      [input, 'keyup', caret],
      [input, 'click', caret],
      [document, 'selectionchange', caret],
      [form, 'reset', () => { clearTimeout(timer); busy = false; input.removeAttribute('aria-invalid'); say(''); field.set('rest'); }],
      [form, 'submit', async (e) => {
        if (busy) { e.preventDefault(); return; }
        if (!input.checkValidity()) {
          e.preventDefault();
          field.set('error');
          input.setAttribute('aria-invalid', 'true');
          say(input.value ? messages.invalid || input.validationMessage : messages.empty, 'error');
          input.focus();
          return;
        }
        input.removeAttribute('aria-invalid');
        field.set('loading');
        say(messages.sending, 'loading');
        // Without onSubmit it's a plain form: let it go where it was going.
        if (!onSubmit) return;
        e.preventDefault();
        busy = true;
        try {
          await onSubmit(input.value, { form, input, field });
          busy = false;
          field.set('sent');
          say(messages.sent, 'sent');
          input.value = '';
          clearTimeout(timer);
          if (resetAfter) timer = setTimeout(() => { if (field.state === 'sent') { field.set('rest'); say(''); } }, resetAfter);
        } catch (err) {
          busy = false;
          field.set('error');
          say(messages.failed, 'error');
        }
      }],
    ];
    listeners.forEach(([el, type, fn]) => el.addEventListener(type, fn));

    return {
      field,
      set: (state) => field.set(state),
      destroy() {
        listeners.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
        field.stop();
        const svg = box.querySelector('.edge');
        if (svg) svg.remove();
        form.classList.remove('bf-ready');
        form.noValidate = false;
      },
    };
  }

  const BorderField = { create, enhance, DEFAULTS, caretX };
  if (typeof module !== 'undefined' && module.exports) module.exports = BorderField;
  else global.BorderField = BorderField;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {});
