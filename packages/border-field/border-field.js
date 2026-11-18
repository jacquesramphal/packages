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
 *
 * Draft 2 (2026-11-18) added options and changed no defaults:
 *   typing 'cloud'      soft bumps all round, puffed by each key
 *   typing 'wave'       a ripple that only runs right, the way you type
 *   loading 'orbit'     one wave travelling round, the rest of the line calm
 *   error 'spring'      the teeth spring out past their size and settle
 *   error 'drawn'       the first draft 2: uneven teeth that hit at full
 *                       size and settle smaller, no bounce (set uniformity
 *                       to 0 for the hand-drawn look it had)
 *   success 'pieces'    the outline's own segments turn out, fly, spin, fall
 *                       and fade, then the outline draws itself back
 *   success 'ticks'     the segments turn out into ticks, hold, close again
 *   uniformity          1 (default) every tooth, bump and piece alike; lower
 *                       is more hand-drawn
 *   soften              editing after an error drops the teeth but keeps
 *                       the line red until it's valid (default false)
 */
(function (global) {
  const SVGNS = 'http://www.w3.org/2000/svg';

  const DEFAULTS = {
    stroke: 3,
    radius: 16,
    focusStroke: 1.5, // added to the line while the field has focus, so focus shows without a ring
    stiffness: 0.14, // how hard the state shapes pull toward their target
    damping: 0.18, // how fast they stop wobbling

    typing: 'follow', // 'follow' | 'jiggle' | 'ripple' | 'wave' | 'cloud'
    followAmp: 4, // how far the border swells over the caret
    followWidth: 28, // how wide the swell is
    followKick: 5, // the extra nudge a keystroke gives it
    followEase: 0.2, // how quickly it catches up with the caret
    jiggleKick: 5,
    rippleAmp: 11,
    rippleSpeed: 320,
    rippleWay: 'both', // ripple: 'both' ways from the caret; 'forward' is what typing 'wave' does
    cloudSize: 34, // 'cloud': bump length
    cloudAmp: 3.2, // bump height
    cloudKick: 2.6, // added by each key

    loading: 'wave', // 'wave' | 'spinner' | 'orbit'
    waveAmp: 10,
    waveLength: 52,
    waveSpeed: 150,
    spinLength: 0.035, // a share of the perimeter
    spinSpeed: 0.7, // laps a second
    orbitPacket: 0.32, // 'orbit': share of the perimeter the wave covers
    orbitLap: 1.15, // s per lap

    error: 'jagged', // 'jagged' | 'pulse' | 'spring' | 'drawn'
    jagAmp: 12,
    jagLength: 22,
    pulseAmp: 10,
    pulseRate: 1.4,
    shake: true,
    springRate: 24, // 'spring': how fast the teeth spring out
    springBounce: 0.32, // how far past their size (0 none)
    soften: false, // editing after an error: teeth go, red stays till valid
    drawnHit: 13, // 'drawn': tooth height as it lands
    drawnRest: 6, // and once settled
    drawnSettle: 0.7, // s to settle

    success: 'both', // 'sunburst' | 'confetti' | 'both' | 'pieces' | 'ticks'
    rayLength: 38,
    raySpacing: 22,
    confettiSpacing: 14,
    pieceLength: 20, // 'pieces' and 'ticks': px of outline per piece
    flyFar: 34, // 'pieces': px they travel
    fall: 16, // px they drop
    spin: 260, // degrees, at most
    flyTime: 1.1, // s to gone
    redrawAt: 0.95, // s after sent that the outline draws back
    ticksHold: 0.9, // 'ticks': s held open
    ticksDrift: 10, // px they move out

    uniformity: 1, // 1 every tooth, bump and piece alike; 0 hand-drawn

    handoff: 0.22, // s, roughly, for the last state's shape to spring away
    handoffBounce: 0.3, // how far it overshoots on the way (0 none)
    stateDelay: 0.08, // s beat before the new state starts
    errorBounce: 7, // px the border swells out when an error lands, then springs back in (0 none)
    settle: 0, // px the outline breathes out and back once it's whole again (0 none)
  };

  // A repeatable 0..1 per index, so each tooth and piece keeps its shape.
  const rand = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const clamp01 = (k) => Math.min(1, Math.max(0, k));
  // Around 1, spread by r as far as uniformity allows.
  const varyBy = (u, r, spread) => 1 + (1 - clamp01(u)) * spread * (2 * r - 1);
  const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
  const easeOut5 = (k) => 1 - Math.pow(1 - clamp01(k), 5);
  const easeInOut = (k) => { k = clamp01(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  // An underdamped spring from 0 to 1: it overshoots once and settles.
  const springStep = (t, w, bounce) => {
    if (t <= 0) return 0;
    const z = 1 - bounce;
    const wd = w * Math.sqrt(Math.max(0.0001, 1 - z * z));
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
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
    const sp = { wave: spring(), jag: spring(), pulse: spring(), spin: spring(), cloud: spring(), orbit: spring() };
    const jig = { x: 0, v: 0, n: 4, ph: 0 };
    const follow = { x: 0, target: 0, amp: 0, v: 0, on: false };
    const ripples = [];
    let draw = 1;
    let hidden = false;
    let state = 'rest';
    let focused = false;
    const t0 = performance.now();
    let tNow = 0; // s, the last frame's time
    let since = 0; // s, when the state last changed
    let puff = 0; // 'cloud': a key's puff, eased away
    let fixing = false; // soften: editing after an error, still invalid
    let redrawTimer = 0; // the outline drawing back after a send
    let hideTimer = 0; // the outline giving way to the pieces
    let settleAt = -10; // s, when the outline last closed after a send
    let redW = 0; // how red the line is, 0 to 1
    let lastO = []; // the last frame's offset at each point
    let hand = null; // { o, at }: the shape the last state left, easing away
    let drawToken = 0; // which draw-back is current
    const pieces = [];
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
        // Forward: only the front running right. Clockwise is right along
        // the top and left along the bottom, so the bottom one runs back.
        let far = dist(s, r.s);
        if (p.rippleWay === 'forward' || p.typing === 'wave') {
          const cw = (((s - r.s) % P) + P) % P;
          far = r.dir > 0 ? cw : P - cw;
        }
        const d = far - age * p.rippleSpeed;
        o += p.rippleAmp * Math.exp(-age * 2.6) * Math.exp(-(d * d) / (2 * 16 * 16));
      }
      if (Math.abs(sp.wave.x) > 0.005) {
        const n = reps(p.waveLength);
        o += sp.wave.x * p.waveAmp * Math.sin((2 * Math.PI * n * (s - t * p.waveSpeed)) / P);
      }
      if (Math.abs(sp.cloud.x) > 0.005) {
        const n = Math.max(6, Math.round(P / p.cloudSize));
        const u = ((s / P) * n + t * 0.08) % n;
        const i = Math.floor(u), f = u - i;
        const h = varyBy(p.uniformity, rand(i % n), 0.25);
        o += sp.cloud.x * (p.cloudAmp + p.cloudKick * puff) * h * (1 - Math.pow(2 * f - 1, 2));
      }
      if (Math.abs(sp.orbit.x) > 0.005) {
        const head = ((t / p.orbitLap) % 1) * P;
        const d = dist(s, head);
        const half = (P * p.orbitPacket) / 2;
        const env = d < half ? 0.5 + 0.5 * Math.cos((Math.PI * d) / half) : 0;
        o += sp.orbit.x * p.waveAmp * env * Math.sin((2 * Math.PI * (s - (t * P) / p.orbitLap * 0.25)) / p.waveLength);
      }
      const springing = state === 'error' && p.error === 'spring';
      const drawn = state === 'error' && p.error === 'drawn';
      if (Math.abs(sp.jag.x) > 0.005 || springing || drawn) {
        // A tooth's height and where its tip sits vary with uniformity; at 1
        // every tooth is the same, as it always was.
        const n = reps(p.jagLength);
        const u = (n * s) / P;
        const i = Math.floor(u), x = u - i;
        const h = varyBy(p.uniformity, rand(i + 17), 0.45);
        const lean = 0.5 * varyBy(p.uniformity, rand(i + 5), 0.3);
        const tri = (x < lean ? x / lean : (1 - x) / (1 - lean)) * 2 - 1;
        if (drawn) {
          // Grows in fast at full height, then eases down: one hit.
          const a = t - since;
          const amp = p.drawnHit + (p.drawnRest - p.drawnHit) * easeOut(a / p.drawnSettle);
          // It lands on a spring: past full height, back, settled.
          o += springStep(a, 30, 0.35) * amp * h * tri * 0.5;
        } else {
          const k = springing ? springStep(t - since, p.springRate, p.springBounce) : sp.jag.x;
          o += k * p.jagAmp * h * tri;
        }
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
      tNow = (now - t0) / 1000;
      sp.cloud.target = p.typing === 'cloud' && focused && state === 'typing' ? 1 : 0;
      puff *= 0.9;
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

      // The handover: the shape the last state left eases away as the new
      // one comes in, so a change flows rather than cuts.
      // On a spring, so it swings a touch past flat and settles.
      const handA = hand ? t - hand.at : 0;
      const handK = hand && !still ? 1 - springStep(handA, 4.2 / Math.max(0.05, p.handoff), p.handoffBounce) : 0;
      if (hand && handA > p.handoff * 5) hand = null;
      // Once the outline is whole after a send, it breathes out and back.
      const sa = t - settleAt;
      const settleO = sa >= 0 && sa < 1 && !still ? p.settle * Math.exp(-sa * 5) * Math.sin(sa * Math.PI * 2 * 2.2) : 0;
      // The error's bounce: the border swells out, springs back a little
      // past its size, and shrinks into the resting teeth.
      const ea = t - since;
      const bounceO = state === 'error' && p.errorBounce && ea >= 0 && ea < 1.2 && !still ? p.errorBounce * Math.exp(-ea * 5.5) * Math.sin(ea * Math.PI * 2 * 1.9) : 0;
      let d = '';
      let idx = 0;
      for (let s = 0; s < P; s += STEP, idx++) {
        const [x, y, nx, ny] = at(s);
        let o = offset(s, t);
        if (hand) o += (hand.o[idx] || 0) * handK;
        o += settleO + bounceO;
        lastO[idx] = o;
        d += (d ? 'L' : 'M') + (x + nx * o + PAD).toFixed(1) + ' ' + (y + ny * o + PAD).toFixed(1);
      }
      d += 'Z';
      main.setAttribute('d', d);
      const pulseW = sp.pulse.x * 3 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 * p.pulseRate));
      // The red blends in and out rather than switching.
      const redGoal = state === 'error' || fixing ? 1 : 0;
      redW += (redGoal - redW) * (still ? 1 : 0.22);
      if (Math.abs(redGoal - redW) < 0.01) redW = redGoal;
      main.style.stroke = redW >= 1 ? 'var(--bf-danger, #d43a3a)' : redW <= 0 ? 'var(--bf-ink, currentColor)'
        : `color-mix(in srgb, var(--bf-danger, #d43a3a) ${(redW * 100).toFixed(1)}%, var(--bf-ink, currentColor))`;
      main.style.strokeWidth = p.stroke + Math.max(0, pulseW) + (focused ? p.focusStroke : 0);
      main.style.transition = 'stroke-width 0.15s ease';
      main.style.strokeDasharray = draw < 1 ? `${P * 1.2} ${P * 1.2}` : '';
      main.style.strokeDashoffset = draw < 1 ? P * 1.2 * (1 - draw) : '';
      const sw = Math.max(0, Math.min(1, sp.spin.x));
      const age = tNow - since;
      const g = state === 'sent' && p.success === 'ticks' ? ticksOpen(age) : 0;
      main.style.opacity = hidden || g > 0.001 ? 0 : 1 - 0.75 * sw;
      drawPieces(state === 'sent' && p.success === 'pieces' && !still ? age : -1);
      drawTicks(still ? 0 : g);

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

    // 'pieces': the outline's segments stand out from the edge, then fly,
    // spin, fall and fade. age < 0 hides them.
    function drawPieces(age) {
      const p = params;
      const n = Math.round(P / p.pieceLength);
      const live = age >= 0 && age < p.flyTime + 0.1;
      if (!live && !pieces.length) return;
      while (live && pieces.length < n) {
        const l = document.createElementNS(SVGNS, 'line');
        l.setAttribute('stroke-linecap', 'round');
        fx.appendChild(l);
        pieces.push(l);
      }
      const unit = P / n, u = p.uniformity;
      for (let i = 0; i < pieces.length; i++) {
        const l = pieces[i];
        if (!live || i >= n) { l.style.opacity = 0; continue; }
        const r1 = rand(i + 9), r2 = rand(i + 41), r3 = rand(i + 77);
        const k = (age - 0.03 * (i % 4)) / p.flyTime;
        const turn = springStep(k * p.flyTime, 24, 0.35); // stands out, a touch past, back
        const fly = easeOut5(k);
        const [x, y, nx, ny] = at((i + 0.5) * unit);
        const tx = -ny, ty = nx;
        const dir = (1 - u) * (2 * r3 - 1) + u * (i % 2 ? 0.5 : -0.5);
        const ang = turn * (Math.PI / 2) * varyBy(u, r2, 0.1) + (fly * dir * p.spin * Math.PI) / 180;
        const dx = tx * Math.cos(ang) + nx * Math.sin(ang), dy = ty * Math.cos(ang) + ny * Math.sin(ang);
        const half = (unit / 2) * (1 - 0.45 * fly) * (i % 2 ? 0.8 : 1);
        const out = fly * p.flyFar * varyBy(u, r1, 0.45) * (ny < -0.5 ? 0.12 : 1);
        const drop = p.fall * Math.pow(clamp01(k), 2) * varyBy(u, r2, 0.4);
        const cx = x + nx * out + PAD, cy = y + ny * out + drop + PAD;
        l.setAttribute('x1', (cx - dx * half).toFixed(1)); l.setAttribute('y1', (cy - dy * half).toFixed(1));
        l.setAttribute('x2', (cx + dx * half).toFixed(1)); l.setAttribute('y2', (cy + dy * half).toFixed(1));
        l.style.stroke = 'var(--bf-ink, currentColor)';
        l.style.strokeWidth = p.stroke;
        l.style.opacity = (1 - clamp01((k - 0.45) / 0.55)).toFixed(3);
      }
      if (!live) { pieces.forEach((l) => l.remove()); pieces.length = 0; }
    }

    // 'ticks': open, hold, close. 0 is the outline, 1 all ticks.
    function ticksOpen(a) {
      const o = 0.45, h = params.ticksHold, c = 0.6;
      return Math.max(0, a < o ? easeOut(a / o) : a < o + h ? 1 : 1 - easeInOut((a - o - h) / c));
    }
    let tickPath = null;
    function drawTicks(g) {
      if (g <= 0.001) { if (tickPath) tickPath.style.opacity = 0; return; }
      const p = params;
      if (!tickPath) {
        tickPath = document.createElementNS(SVGNS, 'path');
        tickPath.setAttribute('fill', 'none');
        tickPath.setAttribute('stroke-linecap', 'round');
        fx.appendChild(tickPath);
      }
      const n = Math.round(P / Math.max(8, p.pieceLength + 4)), unit = P / n, u = p.uniformity;
      let d = '';
      for (let i = 0; i < n; i++) {
        const [x, y, nx, ny] = at((i + 0.5) * unit);
        const tx = -ny, ty = nx;
        const ang = g * (Math.PI / 2) * varyBy(u, rand(i + 41), 0.12);
        const dx = tx * Math.cos(ang) + nx * Math.sin(ang), dy = ty * Math.cos(ang) + ny * Math.sin(ang);
        const len = (unit * (1 - 0.5 * g) * (i % 2 ? 0.72 : 1) * (1 - 0.15 * g * (1 - u) * rand(i + 3))) / 2;
        const out = g * p.ticksDrift * varyBy(u, rand(i + 9), 0.4) + g * len;
        const cx = x + nx * out + PAD, cy = y + ny * out + PAD;
        d += `M${(cx - dx * len).toFixed(1)} ${(cy - dy * len).toFixed(1)}L${(cx + dx * len).toFixed(1)} ${(cy + dy * len).toFixed(1)}`;
      }
      tickPath.setAttribute('d', d);
      tickPath.style.stroke = 'var(--bf-ink, currentColor)';
      tickPath.style.strokeWidth = p.stroke;
      tickPath.style.opacity = 1;
    }

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
      redrawTimer = setTimeout(redraw, reduced.matches ? 300 : 1100);
    }

    // Draws the outline back in, from nothing to closed.
    function redraw() {
      hidden = false;
      if (reduced.matches) { draw = 1; return; }
      const start = performance.now();
      const token = ++drawToken;
      draw = 0;
      const tick = (now) => {
        if (token !== drawToken) return; // a newer state took over
        // Eases in and out: it gathers, draws, and settles closed.
        const k = Math.min(1, (now - start) / 750);
        draw = easeInOut(k);
        if (k < 1) requestAnimationFrame(tick);
        else settleAt = (now - t0) / 1000;
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
        puff = 1;
        if (x != null) api.caret(x);
        if (p.typing === 'follow') follow.v += p.followKick * 0.35;
        else if (p.typing === 'ripple' || p.typing === 'wave') {
          const now = (performance.now() - t0) / 1000;
          ripples.push({ s: topS(follow.target), t: now, dir: 1 }, { s: bottomS(follow.target), t: now, dir: -1 });
          if (ripples.length > 24) ripples.splice(0, 2);
        } else {
          jig.v += p.jiggleKick + Math.random() * 1.5;
          if (Math.abs(jig.x) < 1) { jig.n = 3 + Math.floor(Math.random() * 4); jig.ph = Math.random() * Math.PI * 2; }
        }
      },
      focus(on) { focused = on; },
      valid() { fixing = false; },
      // Draw the outline in from nothing, as it does after a send.
      drawIn() { hidden = true; redraw(); },
      set(st) {
        const p = params;
        fixing = p.soften && (state === 'error' || fixing) && st === 'typing';
        // A new state waits a beat (stateDelay) before it starts.
        since = tNow + (st !== state ? p.stateDelay : 0);
        // Each state starts clean, so two never play on top of each other:
        // what the last one left moving stops, and the outline is whole.
        if (st !== state) {
          hand = { o: lastO.slice(), at: tNow };
          for (const k in sp) { sp[k].x = 0; sp[k].v = 0; }
          if (st !== 'typing') { ripples.length = 0; follow.amp = 0; follow.v = 0; jig.x = 0; jig.v = 0; puff = 0; }
          clearTimeout(redrawTimer);
          clearTimeout(hideTimer);
          drawToken++;
          draw = 1;
          hidden = false;
          [...fx.children].forEach((el) => { if (el !== tickPath && !pieces.includes(el)) el.remove(); });
          root.classList.remove('is-shaking', 'is-popping');
        }
        state = st;
        root.dataset.state = st;
        sp.wave.target = st === 'loading' && p.loading === 'wave' ? 1 : 0;
        sp.orbit.target = st === 'loading' && p.loading === 'orbit' ? 1 : 0;
        sp.spin.target = st === 'loading' && p.loading === 'spinner' ? 1 : 0;
        sp.jag.target = st === 'error' && p.error === 'jagged' ? 1 : 0;
        sp.pulse.target = st === 'error' && p.error === 'pulse' ? 1 : 0;
        if (st === 'error' && p.error === 'jagged') { sp.jag.v += 0.25; if (p.shake) pulseClass('is-shaking', 600); }
        if (st === 'error' && p.error === 'pulse') sp.pulse.v += 0.2;
        if (st === 'error' && (p.error === 'spring' || p.error === 'drawn') && p.shake) pulseClass('is-shaking', 600);
        if (st === 'sent' && p.success === 'pieces') {
          // The outline gives way to its pieces once the beat is over.
          const beat = p.stateDelay * 1000;
          hideTimer = setTimeout(() => { if (state === 'sent') { hidden = true; hand = null; } }, beat);
          redrawTimer = setTimeout(() => { if (state === 'sent' || hidden) redraw(); }, reduced.matches ? 300 : beat + p.redrawAt * 1000);
        } else if (st === 'sent' && p.success !== 'ticks') {
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
      if (field.state === 'error' && !input.checkValidity() && input.value && !field.params.soften) return;
      if (input.checkValidity()) field.valid();
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
