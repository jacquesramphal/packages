/* Stateline patterns: backgrounds made of the field's own moves, with no form.
 * By Jacques Ramphal · https://ramphal.design/lab/line-patterns/ · MIT
 *
 * The swell that follows the caret, the hand-drawn jag of an error, the wave
 * that runs round while it sends, and the pieces it flies apart into, drawn
 * as loose lines: squiggling travellers, a school, horizons, islands, strands, waves,
 * pieces, contours and loops.
 *
 *   const bg = StatelinePatterns.mount(canvasOrElement, { pattern: 'travellers' });
 *   bg.set({ pointer: 'chase' });   // change anything live
 *   bg.destroy();
 *
 *   StatelinePatterns.svg('horizons', { width: 1200, height: 630 })  // a still, as SVG
 *
 * Smart defaults: the ink is the element's text colour (currentColor) and
 * follows the theme; the number of lines scales with the area; under
 * prefers-reduced-motion it draws one still frame; it pauses offscreen; the
 * pointer reacts only to a mouse. `clear` keeps part of it empty for text.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StatelinePatterns = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rng = (seed) => {
    let s = seed % 2147483647 || 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  };
  const ease = (u) => u * u * (3 - 2 * u);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const span = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
  const gauss = (x) => Math.exp(-(x * x));
  const tri = (x) => 1 - 4 * Math.abs((((x % 1) + 1) % 1) - 0.5);
  // By the square root of the area, so a card isn't sparse and a full screen
  // isn't crowded.
  const count = (n, o) => Math.max(1, Math.round(n * o.density * Math.sqrt(o.area)));
  // Each element's variety: its own height (h) and its own wavelength (w),
  // drawn separately, so some squiggles are taller and some tighter. 0 all
  // the same, 1 roughly a third to three times. Lengths and the stroke
  // don't vary.
  const sizer = (rand, o) => () => {
    const v = (k) => o.scale * Math.exp((rand() * 2 - 1) * o.variance * k);
    return { h: v(1.1), w: v(0.8) };
  };
  // A few slow sines: the hand-drawn wobble every line carries.
  const wobble = (rand, k) => {
    const a = [0, 1, 2].map(() => [rand() * 2 + 0.5, rand() * TAU, rand() * 1.2 + 0.3]);
    return (x) => a.reduce((s, [f, p, m]) => s + Math.sin((x * f) / 180 + p) * m, 0) * k;
  };

  /* ---------- the pen ----------
   * Patterns draw with canvas-style calls (moveTo, lineTo, save, rotate...).
   * The pen keeps its own transform so every point can be bent by the
   * pointer in screen space, and so the same drawing can be written out as
   * SVG instead of to a canvas. */
  function makePen(target, o, warp) {
    let m = [1, 0, 0, 1, 0, 0];
    const stack = [];
    const map = (x, y) => {
      const sx = m[0] * x + m[2] * y + m[4], sy = m[1] * x + m[3] * y + m[5];
      return warp ? warp(sx, sy) : [sx, sy];
    };
    // A point the warp hides (inside text, with avoidStyle 'break') lifts the
    // pen; the next visible point starts a new stroke.
    let up = false;
    const pen = {
      save() { stack.push(m.slice()); },
      restore() { m = stack.pop() || [1, 0, 0, 1, 0, 0]; },
      translate(x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
      rotate(r) {
        const c = Math.cos(r), s = Math.sin(r), [a, b, cc, d] = m;
        m[0] = a * c + cc * s; m[1] = b * c + d * s; m[2] = cc * c - a * s; m[3] = d * c - b * s;
      },
      beginPath() { target.beginPath(); },
      moveTo(x, y) { const p = map(x, y); up = !!p[2]; if (!up) target.moveTo(p[0], p[1]); },
      lineTo(x, y) {
        const p = map(x, y);
        if (p[2]) { up = true; return; }
        if (up) { target.moveTo(p[0], p[1]); up = false; } else target.lineTo(p[0], p[1]);
      },
      quadraticCurveTo(cx, cy, x, y) {
        const c = map(cx, cy), p = map(x, y);
        if (p[2] || c[2]) { up = true; return; }
        if (up) { target.moveTo(p[0], p[1]); up = false; } else target.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      },
      closePath() { target.closePath(); },
      stroke() { target.stroke(); },
    };
    // One stroke for every line: the patterns' own widths are ignored.
    Object.defineProperty(pen, 'lineWidth', { set() { target.lineWidth = o.stroke; }, get() { return o.stroke; } });
    return pen;
  }

  // An SVG target: records paths instead of drawing them.
  function svgTarget() {
    let d = '', w = 1;
    const out = [];
    const n = (v) => Math.round(v * 10) / 10;
    return {
      out,
      set lineWidth(v) { w = v; }, get lineWidth() { return w; },
      beginPath() { d = ''; },
      moveTo(x, y) { d += `M${n(x)} ${n(y)}`; },
      lineTo(x, y) { d += `L${n(x)} ${n(y)}`; },
      quadraticCurveTo(cx, cy, x, y) { d += `Q${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`; },
      closePath() { d += 'Z'; },
      stroke() { if (d) out.push(`<path d="${d}" stroke-width="${n(w)}"/>`); },
    };
  }

  /* ---------- Horizon: one line that becomes the field ----------
   * Inspired by Osvaldo Cavandoli's La Linea, where a single line becomes
   * everything. Here it rises into the field's box, a swell runs along the
   * top (typing), it jags (error), a wave runs round (sending), the top
   * flies apart (sent) and it settles flat again. */
  function makeHorizon(rand, extra) {
    return Object.assign({
      len: 900, cycle: 10, phase: rand() * 10, fx: 0.25 + rand() * 0.4, fw: 0.24 + rand() * 0.12,
      fh: 46 + rand() * 26, w: wobble(rand, 2.2), lw: 1.6 + rand() * 1.2, seed: Math.floor(rand() * 1e6), sc: 1, sw: 1, fq: 1,
    }, extra);
  }
  function drawHorizon(p, l, t) {
    const u = ((((t + l.phase) % l.cycle) + l.cycle) % l.cycle) / l.cycle;
    const L = l.len, fx = l.fx * L, fw = l.fw * L, sc = l.sc, wl = l.sw / l.fq;
    const rise = ease(span(u, 0.12, 0.24)) * (1 - ease(span(u, 0.72, 0.84)));
    const h = l.fh * sc * rise, r = Math.min(14 * sc, h / 2);
    const swellAt = u < 0.14 ? ((u / 0.14) * 1.4 - 0.2) * L : -1e4;
    const top = (x) => {
      const k = (x - fx) / fw;
      let off = 0;
      if (u > 0.25 && u < 0.42) off -= 9 * sc * gauss((k - span(u, 0.25, 0.42) * 1.2 + 0.1) / 0.12);
      if (u > 0.42 && u < 0.55) off -= Math.sin(span(u, 0.42, 0.55) * Math.PI) * 7 * sc * tri(x / (18 * wl));
      if (u > 0.55 && u < 0.7) off -= Math.sin((x - fx) / (9 * wl) - t * 9) * 6 * sc * gauss((k - span(u, 0.55, 0.7) * 1.4 + 0.2) / 0.25);
      return off;
    };
    const base = (x) => l.w(x) * sc - 9 * sc * gauss((x - swellAt) / (60 * sc));
    const pieces = u > 0.7 && u < 0.86;
    p.lineWidth = l.lw;
    p.beginPath();
    for (let x = 0; x <= fx; x += 4) x ? p.lineTo(x, base(x)) : p.moveTo(x, base(x));
    if (h > 0.5) {
      const y0 = base(fx);
      p.lineTo(fx, y0 - h + r);
      p.quadraticCurveTo(fx, y0 - h, fx + r, y0 - h);
      if (pieces) {
        p.stroke();
        const e = Math.sin(span(u, 0.7, 0.86) * Math.PI), rand = rng(l.seed);
        for (let x = fx + r; x < fx + fw - r; x += 16 * sc) {
          const k = rand(), side = rand() < 0.5 ? -1 : 1;
          const cx = x + 8 * sc + side * e * k * 30 * sc, cy = y0 - h - e * (14 + k * 36) * sc + e * e * 22 * sc, a = e * (k - 0.5) * 3;
          p.beginPath(); p.moveTo(cx - Math.cos(a) * 7 * sc, cy - Math.sin(a) * 7 * sc); p.lineTo(cx + Math.cos(a) * 7 * sc, cy + Math.sin(a) * 7 * sc); p.stroke();
        }
        p.beginPath(); p.moveTo(fx + fw - r, y0 - h);
      } else {
        for (let x = fx + r; x <= fx + fw - r; x += 3) p.lineTo(x, y0 - h + top(x));
      }
      p.quadraticCurveTo(fx + fw, y0 - h, fx + fw, y0 - h + r);
      p.lineTo(fx + fw, base(fx + fw));
    }
    for (let x = fx + fw; x <= L; x += 4) p.lineTo(x, base(x));
    p.stroke();
  }
  // A family of contour lines across a box: calm, wobbling, catching the
  // hand-drawn jag in patches that pass along them.
  function contourFamily(rand, o, n, short) {
    const size = sizer(rand, o), k = count(n / Math.sqrt(o.scale), o);
    return Array.from({ length: short ? n : k }, (_, i) => ({ ...((z) => ({ sc: z.h, sw: z.w }))(size()), y: (i + 0.5) / (short ? n : k), w: wobble(rand, short ? 2 : 6),
      tilt: (rand() - 0.5) * (short ? 0.05 : 0.12), jx: rand(), js: 0.04 + rand() * 0.06, jlen: (short ? 60 : 120) + rand() * (short ? 90 : 200), jl: 16 + rand() * 10 }));
  }
  function drawFamily(p, fam, o, x0, y0, W, H, t, short) {
    const step = 3, pad = short ? 0 : 20;
    fam.forEach((l) => {
      p.beginPath(); p.lineWidth = 1;
      const cx = (((l.jx + t * l.js) % 1.4) - 0.2) * W, pulse = 0.5 + 0.5 * Math.sin(t * 0.9 + l.jx * 9);
      for (let x = -pad; x <= W + pad; x += step) {
        const y = l.y * H + (x - W / 2) * l.tilt + l.w(x + t * 20) * (short ? 0.6 : 1) + tri(x / ((l.jl * l.sw) / o.frequency)) * 9 * l.sc * (short ? 0.6 : 1) * gauss((x - cx) / (l.jlen * o.scale)) * pulse;
        x === -pad ? p.moveTo(x0 + x, y0 + y) : p.lineTo(x0 + x, y0 + y);
      }
      p.stroke();
    });
  }
  const fam2 = (rand, o) => [contourFamily(rand, o, 9), contourFamily(rand, o, 9)];
  const placed = (p, x, y, ang, fn) => { p.save(); p.translate(x, y); p.rotate(ang); fn(); p.restore(); };
  // Rebuild a pattern's parts when the size or density changes.
  const sized = (build) => {
    let key = '', parts = null;
    return (W, H, o) => {
      const k = `${Math.round(W)}x${Math.round(H)}x${o.density}x${o.scale}x${o.variance}x${o.frequency}`;
      if (k !== key) { key = k; parts = build(W, H, o); }
      return parts;
    };
  };

  /* ---------- squiggling travellers ----------
   * Short squiggles, each a packet of the sending wave, wandering with
   * Brownian motion. They steer toward or away from the pointer like fish,
   * squiggle harder where it rubs, and go jagged where it wrinkles. */
  function travellers(school) {
    return (o) => {
      const rand = rng(school ? 53 : 41), size = sizer(rand, o);
      let list = null, key = '', last = 0;
      const step = (W, H, dt, ptr) => {
        list.forEach((v) => {
          v.w += (rand() - 0.5) * 7 * dt; v.w *= Math.pow(0.35, dt); v.a += v.w * dt;
          if (school) {
            let sx = 0, sy = 0;
            list.forEach((n) => { if (n !== v && Math.hypot(n.x - v.x, n.y - v.y) < 90) { sx += Math.cos(n.a); sy += Math.sin(n.a); } });
            if (sx || sy) v.a += Math.sin(Math.atan2(sy, sx) - v.a) * 1.6 * dt;
          }
          if (ptr) ptr.ripples.forEach((rp) => {
            // A ripple pushes the ones it passes outward, fast.
            const dx = v.x - rp.x, dy = v.y - rp.y, d = Math.hypot(dx, dy), k = gauss((d - rp.r) / 60) * rp.k;
            if (k > 0.05) { v.a += Math.sin(Math.atan2(dy, dx) - v.a) * 6 * k * dt; v.boost = Math.min(3, v.boost + k * dt * 8); }
          });
          const mode = ptr ? ptr.mode : 'none';
          if (ptr && ptr.on && (mode === 'chase' || mode === 'avoid')) {
            const dx = ptr.x - v.x, dy = ptr.y - v.y, d = Math.hypot(dx, dy);
            const R = o.pointerRadius;
            if (mode === 'avoid' && d < R * 3) {
              v.a += Math.sin(Math.atan2(dy, dx) + Math.PI - v.a) * 3.5 * dt * (1 - d / (R * 3));
              v.boost = Math.min(2.4, v.boost + dt * 3);
            } else if (mode === 'chase' && d < R * 5) {
              // Swim in, then circle it like fish round food: inside the
              // radius the heading turns to the tangent and they slow down.
              // Each one keeps its own orbit (0.6 to 1.4 of the radius), and
              // past tangent it turns outward, so they swarm loosely.
              const orbit = R * v.orbit, close = clamp(1.7 - d / orbit, 0, 1.7);
              const want = Math.atan2(dy, dx) + v.side * (Math.PI / 2) * close;
              v.a += Math.sin(want - v.a) * (2 + 1.5 * Math.min(1, close)) * dt;
              v.boost = close > 0 ? Math.max(0.6, v.boost - dt * 2) : Math.min(1.8, v.boost + dt * 2);
            }
          }
          if (ptr) for (const r of ptr.obstacles) {
            // Steer round text like a fish round a rock; anything that ends
            // up inside is nudged out.
            const q = nearestOut(r, v.x, v.y);
            if (q.d < 46) {
              const ahead = Math.cos(v.a) * -q.nx + Math.sin(v.a) * -q.ny;
              if (ahead > -0.2 || q.d < 0) v.a += Math.sin(Math.atan2(q.ny, q.nx) - v.a) * 5 * dt * (1 - Math.max(0, q.d) / 46);
              if (q.d < 0) { v.x = q.x + q.nx * 2; v.y = q.y + q.ny * 2; }
            }
          }
          v.boost = 1 + (v.boost - 1) * Math.pow(0.4, dt);
          const sp = v.sp * v.boost;
          v.x += Math.cos(v.a) * sp * dt; v.y += Math.sin(v.a) * sp * dt; v.ph += dt * (6 + sp / 10);
          const m = 40;
          if (v.x < -m || v.x > W + m || v.y < -m || v.y > H + m) {
            v.x = ((v.x + m) % (W + 2 * m) + W + 2 * m) % (W + 2 * m) - m;
            v.y = ((v.y + m) % (H + 2 * m) + H + 2 * m) % (H + 2 * m) - m; v.trail = [];
          }
          v.trail.push([v.x, v.y]);
          while (v.trail.length > 2 && trailLen(v.trail) > v.len) v.trail.shift();
        });
      };
      const trailLen = (tr) => { let s = 0; for (let i = 1; i < tr.length; i++) s += Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1]); return s; };
      const draw = (p, W, H, t, ptr) => {
        const k = `${Math.round(W)}x${Math.round(H)}x${o.density}x${o.scale}x${o.variance}x${o.frequency}`;
        if (k !== key) {
          key = k; last = 0;
          list = Array.from({ length: count(school ? 34 : 26, o) }, () => {
            const z = size();
            return { x: rand() * W, y: rand() * H, a: rand() * TAU, w: 0, sp: (26 + rand() * 40) * Math.sqrt(o.scale), boost: 1, side: rand() < 0.5 ? -1 : 1, orbit: 0.6 + rand() * 0.8, ph: rand() * 9,
              amp: (3 + rand() * 3) * z.h, wl: ((9 + rand() * 6) * z.w) / o.frequency, len: (50 + rand() * 70) * o.scale, trail: [] };
          });
          // Warm up so a still or the first frame already shows squiggles.
          for (let i = 0; i < 90; i++) step(W, H, 1 / 30, null);
        }
        const dt = clamp(t - last, 0, 0.1); last = t;
        if (dt > 0) step(W, H, dt, ptr);
        list.forEach((v) => {
          const tr = v.trail;
          if (tr.length < 3) return;
          const total = trailLen(tr);
          let near = 0;
          if (ptr && ptr.on && (ptr.mode === 'rub' || ptr.mode === 'wrinkle')) near = gauss(Math.hypot(ptr.x - v.x, ptr.y - v.y) / o.pointerRadius) * (ptr.mode === 'rub' ? ptr.speed : 1);
          const amp = v.amp * (1 + 2.2 * near), jag = ptr && ptr.mode === 'wrinkle' ? near : 0;
          p.lineWidth = v.lw;
          p.beginPath();
          let s = 0;
          for (let i = 0; i < tr.length; i++) {
            if (i) s += Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1]);
            const j = Math.min(i + 1, tr.length - 1), q = Math.max(i - 1, 0);
            const ang = Math.atan2(tr[j][1] - tr[q][1], tr[j][0] - tr[q][0]);
            const env = Math.sin(Math.PI * (s / total));
            const wave = (1 - jag) * Math.sin((s / v.wl) * TAU - v.ph) + jag * tri(s / v.wl - v.ph / TAU);
            const off = wave * amp * env, x = tr[i][0] - Math.sin(ang) * off, y = tr[i][1] + Math.cos(ang) * off;
            i ? p.lineTo(x, y) : p.moveTo(x, y);
          }
          p.stroke();
        });
      };
      draw.ownPointer = true;
      draw.simulated = true;
      return draw;
    };
  }

  const PATTERNS = {
    travellers: travellers(false),
    school: travellers(true),

    horizon: () => {
      const rand = rng(11);
      const parts = sized((W, H, o) => makeHorizon(rand, { len: W + 80, fx: 0.42, fw: 0.2 * o.scale, fh: 70, phase: 0, sc: o.scale, sw: o.scale, fq: o.frequency }));
      return (p, W, H, t, ptr, o) => placed(p, -40, H * 0.62, 0, () => drawHorizon(p, parts(W, H, o), t));
    },
    horizons: (o) => {
      const rand = rng(23), size = sizer(rand, o);
      const parts = sized((W, H, o) => {
        const n = clamp(Math.round(4 * o.density * Math.sqrt(o.area)), 1, 9);
        return Array.from({ length: n }, (_, i) => ({ y: (i + 0.5) / n + (rand() - 0.5) * (0.24 / n), ang: (rand() - 0.5) * 0.12,
          l: (() => { const z = size(); return makeHorizon(rand, { len: W * 1.3, cycle: 9 + rand() * 4, phase: i * 2.6, sc: z.h, sw: z.w, fq: o.frequency }); })() }));
      });
      return (p, W, H, t, ptr, o) => parts(W, H, o).forEach((g) => placed(p, -W * 0.15, g.y * H, g.ang, () => drawHorizon(p, g.l, t)));
    },
    islands: (o) => {
      const rand = rng(37), size = sizer(rand, o);
      const parts = sized((W, H, o) => {
        const out = [], g = o.scale * (1 + o.variance * 0.4);
        const cols = Math.max(2, Math.round((W / (330 * g)) * Math.sqrt(o.density))), rows = Math.max(3, Math.round((H / (150 * g)) * Math.sqrt(o.density)));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (rand() < 0.25) continue;
          out.push({ x: (c + (r % 2) * 0.5 - 0.1 + rand() * 0.2) * (W / cols), y: (r + 0.6 + (rand() - 0.5) * 0.4) * (H / rows), ang: (rand() - 0.5) * 0.25,
            l: (() => { const z = size(); return makeHorizon(rand, { len: (170 + rand() * 120) * o.scale * Math.sqrt(z.w), fx: 0.25 + rand() * 0.2, fw: 0.35 + rand() * 0.15, fh: 22 + rand() * 14, cycle: 7 + rand() * 6, sc: z.h, sw: z.w, fq: o.frequency }); })() });
        }
        return out;
      });
      return (p, W, H, t, ptr, o) => parts(W, H, o).forEach((g) => placed(p, g.x, g.y, g.ang, () => drawHorizon(p, g.l, t)));
    },

    strands: (o) => {
      const rand = rng(7), size = sizer(rand, o);
      const E = Array.from({ length: count(6, o) }, () => ({ ...((z) => ({ sc: z.h, sw: z.w }))(size()), x0: rand(), y0: rand(), ang: rand() * TAU, turn: (rand() - 0.5) * 1.4, w1: rand() * 2 + 1, p1: rand() * TAU, w2: rand() * 3 + 2, p2: rand() * TAU, lw: 1.4 + rand() * 1.4, off: rand() * 9, len: 1.1 + rand() * 0.7 }));
      return (p, W, H, t) => E.forEach((l) => {
        const L = Math.hypot(W, H) * l.len, pts = [];
        let x = l.x0 * W - (Math.cos(l.ang) * L) / 2, y = l.y0 * H - (Math.sin(l.ang) * L) / 2, a;
        for (let d = 0; d <= L; d += 4) { const k = d / L; a = l.ang + l.turn * Math.sin(k * l.w1 * 3.14 + l.p1 + t * 0.15) + 0.25 * Math.sin(k * l.w2 * TAU + l.p2); x += Math.cos(a) * 4; y += Math.sin(a) * 4; pts.push([x, y, a, d]); }
        const u = ((t + l.off) % 9) / 9, st = u < 0.3 ? 'swell' : u < 0.55 ? 'jag' : u < 0.75 ? 'pieces' : 'calm';
        p.lineWidth = l.lw;
        if (st === 'pieces') {
          const e = Math.sin(((u - 0.55) / 0.2) * Math.PI);
          for (let i = 0; i < pts.length - 6; i += 8) {
            const [px, py, pa] = pts[i], r = Math.sin(i * 12.9) * 0.5 + 0.5, nx = -Math.sin(pa), ny = Math.cos(pa), s = i % 16 ? 1 : -1;
            const fly = e * (10 + r * 40) * l.sc, rot = e * (r - 0.5) * 2.5, cx = px + nx * fly * s, cy = py + ny * fly * s + e * e * 14 * l.sc, q = 12 * l.sc;
            p.beginPath(); p.moveTo(cx - Math.cos(pa + rot) * q, cy - Math.sin(pa + rot) * q); p.lineTo(cx + Math.cos(pa + rot) * q, cy + Math.sin(pa + rot) * q); p.stroke();
          }
          return;
        }
        p.beginPath();
        pts.forEach(([px, py, pa, d], i) => {
          const nx = -Math.sin(pa), ny = Math.cos(pa);
          let off = 0;
          if (st === 'swell') off = 9 * l.sc * gauss((d - ((u / 0.3) * 1.3 - 0.15) * L) / (70 * l.sw));
          if (st === 'jag') off = Math.sin(((u - 0.3) / 0.25) * Math.PI) * 7 * l.sc * tri(d / ((22 * l.sw) / o.frequency));
          i ? p.lineTo(px + nx * off, py + ny * off) : p.moveTo(px + nx * off, py + ny * off);
        });
        p.stroke();
      });
    },
    waves: (o) => {
      const rand = rng(7), n = count(14 / Math.sqrt(o.scale), o), size = sizer(rand, o);
      const A = Array.from({ length: n }, (_, i) => ({ ...((z) => ({ sc: z.h, sw: z.w }))(size()), y: (i + 0.5) / n, tilt: (rand() - 0.5) * 0.08, w: wobble(rand, 3), sp: 40 + rand() * 90, ph: rand() * 2000, len: 160 + rand() * 220, amp: 5 + rand() * 7, lw: 1.2 + rand() * 1.3, dir: rand() < 0.5 ? 1 : -1 }));
      return (p, W, H, t) => A.forEach((l) => {
        p.beginPath(); p.lineWidth = l.lw;
        const cx = (((l.ph + t * l.sp * l.dir) % (W + 600)) + W + 600) % (W + 600) - 300;
        for (let x = -20; x <= W + 20; x += 4) { const y = l.y * H + (x - W / 2) * l.tilt + l.w(x) + Math.sin((x - cx) / ((9 * l.sw) / o.frequency)) * l.amp * l.sc * gauss((x - cx) / ((l.len * o.scale) / 2)); x < -19 ? p.moveTo(x, y) : p.lineTo(x, y); }
        p.stroke();
      });
    },
    pieces: (o) => {
      const rand = rng(7), size = sizer(rand, o);
      const B = Array.from({ length: count(260 / o.scale, o) }, () => ({ sc: size().h, x: rand(), y: rand(), a: rand() * TAU, va: (rand() - 0.5) * 1.5, vx: (rand() - 0.5) * 12, vy: (rand() - 0.5) * 12, len: 6 + rand() * 12, row: Math.floor(rand() * 7), col: rand() }));
      return (p, W, H, t) => {
        const u = (t % 7) / 7, g = u < 0.35 ? 0 : u < 0.55 ? (u - 0.35) / 0.2 : u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.15), e = ease(g);
        p.lineWidth = 1.8;
        B.forEach((b) => {
          const fx = (((b.x * W + b.vx * t) % W) + W) % W, fy = (((b.y * H + b.vy * t) % H) + H) % H;
          const lx = b.col * W, ly = ((b.row + 0.5) / 7) * H + Math.sin(b.col * 12 + t) * 6;
          const x = fx + (lx - fx) * e, y = fy + (ly - fy) * e, a = (b.a + b.va * t) * (1 - e);
          const q = (b.len * b.sc) / 2;
          p.beginPath(); p.moveTo(x - Math.cos(a) * q, y - Math.sin(a) * q); p.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); p.stroke();
        });
      };
    },
    contours: (o) => {
      const fam = contourFamily(rng(7), o, 11);
      return (p, W, H, t) => drawFamily(p, fam, o, 0, 0, W, H, t);
    },
    // Two families of contours crossing at an angle: a woven lattice.
    lattice: (o) => {
      const rand = rng(19), a = fam2(rand, o);
      return (p, W, H, t) => {
        const D = Math.hypot(W, H);
        [o.angle, -o.angle].forEach((deg, i) => placed(p, W / 2, H / 2, (deg * Math.PI) / 180, () => drawFamily(p, a[i], o, -D / 2, -D / 2, D, D, t + i * 3.7)));
      };
    },
    // A quilt: patches of short contours, some running across, some down.
    patchwork: (o) => {
      const rand = rng(29);
      const parts = sized((W, H, o) => {
        const cell = 230 * o.scale / Math.sqrt(o.density), cols = Math.max(2, Math.round(W / cell)), rows = Math.max(2, Math.round(H / cell));
        const cw = W / cols, ch = H / rows, out = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const vert = (r + c) % 2 === 1 ? rand() < 0.85 : rand() < 0.15;
          out.push({ x: c * cw, y: r * ch, w: cw, h: ch, vert, fam: contourFamily(rand, o, Math.max(3, Math.round((vert ? cw : ch) / 26)), true) });
        }
        return out;
      });
      return (p, W, H, t) => parts(W, H, o).forEach((c, i) => {
        if (c.vert) placed(p, c.x + c.w, c.y, Math.PI / 2, () => drawFamily(p, c.fam, o, 0, 0, c.h, c.w, t + i * 1.3, true));
        else drawFamily(p, c.fam, o, c.x, c.y, c.w, c.h, t + i * 1.3, true);
      });
    },
    loops: (o) => {
      const rand = rng(7), size = sizer(rand, o);
      const D = Array.from({ length: count(9 / o.scale, o) }, () => ({ x: rand(), y: rand(), r: (40 + rand() * 120) * size().h, rot: rand() * TAU, sp: (rand() - 0.5) * 0.2, lw: 1.3 + rand() * 1.2, ecc: 0.55 + rand() * 0.4 }));
      return (p, W, H, t) => {
        const caret = { x: W * (0.5 + 0.42 * Math.sin(t * 0.37)), y: H * (0.5 + 0.38 * Math.sin(t * 0.53 + 1)) };
        D.forEach((c) => {
          p.beginPath(); p.lineWidth = c.lw;
          const cx = c.x * W, cy = c.y * H;
          for (let i = 0; i <= 180; i++) {
            const th = (i / 180) * TAU, an = th + c.rot + t * c.sp;
            let r = c.r * (1 + 0.05 * Math.sin(th * 3 * o.frequency + c.rot + t * 0.7) + 0.03 * Math.sin(th * 5 * o.frequency - t * 0.5));
            r += 18 * o.scale * gauss(Math.hypot(cx + Math.cos(an) * r - caret.x, cy + Math.sin(an) * r * c.ecc - caret.y) / 90);
            const X = cx + Math.cos(an) * r, Y = cy + Math.sin(an) * r * c.ecc;
            i ? p.lineTo(X, Y) : p.moveTo(X, Y);
          }
          p.closePath(); p.stroke();
        });
      };
    },
  };

  const LIST = [
    ['travellers', 'Travellers'], ['school', 'School'], ['horizon', 'Horizon'], ['horizons', 'Horizons'],
    ['islands', 'Islands'], ['strands', 'Strands'], ['waves', 'Waves'], ['pieces', 'Pieces'],
    ['contours', 'Contours'], ['lattice', 'Lattice'], ['patchwork', 'Patchwork'], ['loops', 'Loops'],
  ];

  const DEFAULTS = {
    pattern: 'travellers',
    ink: null,          // null: the element's text colour, following the theme
    bg: null,           // null: transparent
    speed: 1,
    strength: 1,        // opacity of the lines
    density: 1,         // more or fewer lines; also scaled by the area
    stroke: 2,          // line width in px, the same for every line
    scale: 1,           // size of the moves: height, wavelength and length together
    frequency: 1,       // wavelength only: the same size, tighter (>1) or looser (<1)
    variance: 0,        // variety: each squiggle its own height and wavelength, 0 to 1
    pointer: 'none',    // 'none' | 'chase' | 'avoid' | 'rub' | 'wrinkle'
    pointerRadius: 110,
    pointerOnTouch: false,
    ripple: true,       // a tap or click sends out a ripple that clears the lines
    drag: 'horizontal', // finger drags: 'horizontal' (the page still scrolls up and down), true (all ways), false
    clear: null,        // keep part empty for text: 'left' | 'right' | 'top' | 'bottom' | { side, size, feather }
    avoid: null,        // flow round shapes: 'text' (the text inside the element), a selector, or elements
    avoidPadding: 14,   // px kept round each shape
    avoidStyle: 'break', // 'break': lines stop at the shape and pick up past it; 'bend': they bend round it
    angle: 30,          // lattice: degrees each family leans either way
    still: false,       // draw one frame and stop (also under reduced motion)
    time: 3.2,          // the moment a still shows, in seconds
  };
  // Defaults a pattern brings with it, under anything you pass.
  const PATTERN_DEFAULTS = { islands: { variance: 0.6 } };
  const PRESETS = {
    calm: { speed: 0.6, strength: 0.5 },
    lively: { speed: 1.4, density: 1.3 },
    fish: { pattern: 'school', pointer: 'avoid' },
    chase: { pattern: 'travellers', pointer: 'chase' },
    wrinkle: { pattern: 'horizons', pointer: 'wrinkle' },
    beside: { clear: { side: 'left', size: 0.42, feather: 0.14 } },
    mixed: { variance: 0.7 },
    big: { scale: 1.8, density: 0.6 },
  };

  const normClear = (c, o) => {
    if (!c) return null;
    const base = { side: 'left', size: 0.42, feather: 0.14, edge: 'fade', slant: null };
    const out = Object.assign(base, typeof c === 'string' ? { side: c } : c);
    // A slanted break follows the lattice's own angle unless given one.
    if (out.slant == null) out.slant = out.edge === 'break' && o && o.pattern === 'lattice' ? o.angle : 0;
    return out;
  };
  // edge 'break': no fade and no cut. Each line simply ends where it reaches
  // the cleared side, so the ends make a natural edge. The boundary leans by
  // `slant` degrees and wavers a little, so the ends don't line up like a ruler.
  function inClear(c, W, H, x, y) {
    const t = Math.tan((c.slant * Math.PI) / 180);
    if (c.side === 'left' || c.side === 'right') {
      const b = c.size * W + (y - H / 2) * t + Math.sin(y / 41) * 6 + Math.sin(y / 17) * 3;
      return c.side === 'left' ? x < b : x > W - b;
    }
    const b = c.size * H + (x - W / 2) * t + Math.sin(x / 41) * 6 + Math.sin(x / 17) * 3;
    return c.side === 'top' ? y < b : y > H - b;
  }
  // The cleared side, as a gradient from fully clear to fully drawn.
  const clearBox = (c, W, H) => {
    const s = c.side, horiz = s === 'left' || s === 'right', len = horiz ? W : H;
    const a = c.size * len, b = (c.size + c.feather) * len;
    const from = s === 'left' || s === 'top' ? a : len - a, to = s === 'left' || s === 'top' ? b : len - b;
    return horiz ? { x0: from, y0: 0, x1: to, y1: 0, fill: s === 'left' ? [0, 0, b, H] : [len - b, 0, b, H] }
      : { x0: 0, y0: from, x1: 0, y1: to, fill: s === 'top' ? [0, 0, W, b] : [0, len - b, W, b] };
  };

  /* ---------- obstacles: text and other shapes to flow around ----------
   * Each is a rect in canvas pixels, padded. outside(r, x, y) gives the
   * nearest point on its edge and the outward normal, so a point inside
   * can be moved out and a point near it eased away. */
  function nearestOut(r, x, y) {
    const inside = x > r.l && x < r.r && y > r.t && y < r.b;
    if (inside) {
      const dl = x - r.l, dr = r.r - x, dt = y - r.t, db = r.b - y, m = Math.min(dl, dr, dt, db);
      if (m === dt) return { x, y: r.t, nx: 0, ny: -1, d: -dt };
      if (m === db) return { x, y: r.b, nx: 0, ny: 1, d: -db };
      if (m === dl) return { x: r.l, y, nx: -1, ny: 0, d: -dl };
      return { x: r.r, y, nx: 1, ny: 0, d: -dr };
    }
    const cx = clamp(x, r.l, r.r), cy = clamp(y, r.t, r.b), dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
    return { x: cx, y: cy, nx: dx / d, ny: dy / d, d };
  }

  function makeWarp(o, ptr, getT, obstaclesOnly, box) {
    const cut = box && box.clear && box.clear.edge === 'break' ? box.clear : null;
    const bend = (x, y) => {
      const mode = ptr.mode;
      if (!ptr.on || mode === 'none') return [x, y];
      const dx = x - ptr.x, dy = y - ptr.y, d = Math.hypot(dx, dy) || 1, R = o.pointerRadius;
      const k = gauss(d / R) * ptr.fade, nx = dx / d, ny = dy / d;
      if (k < 0.002) return [x, y];
      if (mode === 'avoid') return [x + nx * R * 0.45 * k, y + ny * R * 0.45 * k];
      if (mode === 'chase') { const pull = Math.min(d, R * 0.35) * k; return [x - nx * pull, y - ny * pull]; }
      if (mode === 'wrinkle') { const off = tri((x + y) / 11) * 7 * k; return [x + nx * off, y + ny * off]; }
      if (mode === 'rub') { const off = Math.sin((x + y) / 8 - getT() * 14) * 7 * k * ptr.speed; return [x + nx * off, y + ny * off]; }
      return [x, y];
    };
    // Ripples: a ring running out from a tap pushes the lines it passes
    // outward, then lets them settle back.
    return (x, y) => {
      let [px, py] = obstaclesOnly ? [x, y] : bend(x, y);
      if (!obstaclesOnly) for (const rp of ptr.ripples) {
        const dx = px - rp.x, dy = py - rp.y, d = Math.hypot(dx, dy) || 1;
        const k = gauss((d - rp.r) / 34) * rp.k;
        if (k > 0.002) { px += (dx / d) * 34 * k; py += (dy / d) * 34 * k; }
      }
      // Text and other obstacles: a point inside moves to the edge, and a
      // point just outside eases away, so lines bend round the shapes.
      if (cut && inClear(cut, box.W, box.H, px, py)) return [px, py, true];
      const F = 18, brk = o.avoidStyle !== 'bend';
      for (const r of ptr.obstacles) {
        if (px < r.l - F || px > r.r + F || py < r.t - F || py > r.b + F) continue;
        const q = nearestOut(r, px, py);
        if (q.d < 0 && (brk || obstaclesOnly)) return [px, py, true];
        const push = q.d < 0 ? -q.d + F * 0.5 : Math.max(0, F - q.d) * (obstaclesOnly ? 0 : 0.5);
        px += q.nx * push; py += q.ny * push;
      }
      return [px, py];
    };
  }

  function resolve(opts) {
    const preset = opts && opts.preset ? PRESETS[opts.preset] : null;
    const pattern = (opts && opts.pattern) || (preset && preset.pattern) || DEFAULTS.pattern;
    return Object.assign({}, DEFAULTS, PATTERN_DEFAULTS[pattern], preset, opts);
  }

  /* ---------- mount: a live background ---------- */
  function mount(el, opts) {
    const o = resolve(opts);
    let canvas = el;
    if (!(el instanceof HTMLCanvasElement)) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.prepend(canvas);
    }
    const ctx = canvas.getContext('2d');
    // Let a finger drag the lines: tell the browser which directions are ours.
    // The element under the finger is the host (the canvas itself takes no
    // pointer events when it was added), so the rule goes there.
    const host = canvas === el ? canvas.parentElement || canvas : el;
    const prevTouch = host.style.touchAction;
    // Obstacles: the shapes of the text (each line of it) or of chosen
    // elements, in canvas pixels. Read on resize, when the content changes,
    // and once fonts have loaded.
    const readObstacles = () => {
      ptr.obstacles = [];
      if (!o.avoid) return;
      const c = canvas.getBoundingClientRect(), pad = o.avoidPadding, rects = [];
      if (o.avoid === 'text') {
        const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
        const range = document.createRange();
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          const st = getComputedStyle(n.parentElement);
          if (st.visibility === 'hidden' || st.display === 'none') continue;
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) rects.push(r);
        }
      } else {
        const els = typeof o.avoid === 'string' ? host.querySelectorAll(o.avoid) : [].concat(o.avoid);
        els.forEach((e) => rects.push(e.getBoundingClientRect()));
      }
      rects.forEach((r) => { if (r.width && r.height) ptr.obstacles.push({ l: r.left - c.left - pad, t: r.top - c.top - pad, r: r.right - c.left + pad, b: r.bottom - c.top + pad }); });
    };
    let obstacleTimer = 0;
    const queueObstacles = () => { clearTimeout(obstacleTimer); obstacleTimer = setTimeout(() => { readObstacles(); render(); }, 120); };
    const applyDrag = () => { host.style.touchAction = o.drag === true ? 'none' : o.drag === 'horizontal' ? 'pan-y' : prevTouch; };
    applyDrag();
    const ptr = { x: 0, y: 0, on: false, fade: 0, speed: 0, lx: 0, ly: 0, lt: 0, touch: false, mode: 'none', ripples: [], obstacles: [] };
    let draw = null, W = 0, H = 0, raf = 0, visible = true, t = 0, lastNow = 0, ink = '#000';
    const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const still = () => o.still || reduced();
    const pickInk = () => { ink = o.ink || getComputedStyle(canvas).color || '#000'; };
    const build = () => {
      const make = PATTERNS[o.pattern] || PATTERNS.travellers;
      o.area = Math.max(0.25, (W * H) / (1200 * 675));
      draw = make(o);
    };
    const resize = () => {
      const d = Math.min(2, window.devicePixelRatio || 1), r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const area = (r.width * r.height) / (1200 * 675);
      const rebuild = !draw || Math.abs(area - (o.area || 0)) / Math.max(area, 0.01) > 0.35;
      W = r.width; H = r.height; canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (rebuild) build();
    };
    const render = () => {
      if (!draw) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = o.strength; ctx.strokeStyle = ink;
      // Travellers steer themselves; their pen only hides what crosses text.
      const c = normClear(o.clear, o), box = { W, H, clear: c };
      const needs = ptr.obstacles.length || (c && c.edge === 'break');
      const warp = draw.ownPointer ? (needs ? makeWarp(o, ptr, () => t, true, box) : null) : makeWarp(o, ptr, () => t, false, box);
      draw(makePen(ctx, o, warp), W, H, still() ? o.time : t, ptr, o);
      ctx.globalAlpha = 1;
      if (c && c.edge !== 'break') {
        // feather 0 is a hard edge: a gradient with no length paints nothing,
        // so it's a solid fill instead.
        const b = clearBox(c, W, H);
        let fill = 'rgba(0,0,0,1)';
        if (c.feather > 0) { fill = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1); fill.addColorStop(0, 'rgba(0,0,0,1)'); fill.addColorStop(1, 'rgba(0,0,0,0)'); }
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = fill; ctx.fillRect(...b.fill);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (o.bg) { ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    };
    const frame = (now) => {
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
      lastNow = now; t += dt * o.speed;
      ptr.fade += ((ptr.on ? 1 : 0) - ptr.fade) * Math.min(1, dt * 6);
      ptr.speed *= Math.pow(0.15, dt);
      // A finger dragging uses the pointer mode, or pushes lines aside when there is none.
      ptr.mode = ptr.touch && o.pointer === 'none' ? 'avoid' : o.pointer;
      const now2 = performance.now();
      ptr.ripples = ptr.ripples.filter((rp) => {
        const age = (now2 - rp.t0) / 1000;
        rp.r = age * 520; rp.k = Math.max(0, 1 - age / 1.3);
        return rp.k > 0;
      });
      render();
      raf = !still() && visible ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => { if (!raf) { lastNow = 0; raf = requestAnimationFrame(frame); } };

    const fine = () => o.pointerOnTouch || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches);
    const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };
    // Touch: a tap sends a ripple, and pressing and moving drags the lines
    // like a mouse does. It doesn't block scrolling, so a long drag that
    // turns into a scroll simply ends.
    const onDown = (e) => {
      const [x, y, r] = local(e);
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;
      if (o.ripple) ptr.ripples.push({ x, y, t0: performance.now(), r: 0, k: 1 });
      if (e.pointerType !== 'mouse') Object.assign(ptr, { x, y, lx: x, ly: y, lt: performance.now(), on: true, touch: true });
      kick();
    };
    const onUp = (e) => { if (e.pointerType !== 'mouse') { ptr.on = false; ptr.touch = false; } };
    const onMove = (e) => {
      if (ptr.touch && e.pointerType !== 'mouse') {
        const [x, y] = local(e), now = performance.now(), dt = Math.max(1, now - ptr.lt);
        ptr.speed = Math.min(1, ptr.speed + Math.hypot(x - ptr.lx, y - ptr.ly) / dt / 1.5);
        Object.assign(ptr, { x, y, lx: x, ly: y, lt: now });
        return;
      }
      if (o.pointer === 'none' || !fine() || e.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const inside = x > -o.pointerRadius && y > -o.pointerRadius && x < r.width + o.pointerRadius && y < r.height + o.pointerRadius;
      const now = performance.now(), dt = Math.max(1, now - ptr.lt);
      ptr.speed = Math.min(1, ptr.speed + Math.hypot(x - ptr.lx, y - ptr.ly) / dt / 1.5);
      Object.assign(ptr, { x, y, lx: x, ly: y, lt: now, on: inside });
      if (still()) render();
    };
    const onLeave = () => { ptr.on = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { resize(); readObstacles(); render(); kick(); }) : null;
    const contentWatch = typeof MutationObserver !== 'undefined' ? new MutationObserver(queueObstacles) : null;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }) : null;
    // The ink follows the theme: a class or data attribute on <html>, or the OS setting.
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => { pickInk(); render(); }) : null;
    const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const onScheme = () => { pickInk(); render(); };
    resize(); pickInk(); readObstacles();
    if (contentWatch) contentWatch.observe(host, { subtree: true, childList: true, characterData: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { readObstacles(); render(); });
    if (ro) ro.observe(canvas);
    if (io) io.observe(canvas);
    if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    if (mq && mq.addEventListener) mq.addEventListener('change', onScheme);
    render(); kick();

    return {
      canvas,
      get options() { return Object.assign({}, o); },
      set(next) {
        const prev = o.pattern, prevDensity = o.density;
        Object.assign(o, next.preset ? PRESETS[next.preset] : null, next);
        if (o.pattern !== prev || o.density !== prevDensity) build();
        applyDrag(); pickInk(); readObstacles(); render(); kick();
      },
      destroy() {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.removeEventListener('pointerleave', onLeave);
        if (ro) ro.disconnect(); if (io) io.disconnect(); if (mo) mo.disconnect(); if (contentWatch) contentWatch.disconnect();
        clearTimeout(obstacleTimer);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onScheme);
        host.style.touchAction = prevTouch;
        if (canvas !== el) canvas.remove();
      },
    };
  }

  /* ---------- svg: a still, for a CSS background or a file ---------- */
  function svg(pattern, opts) {
    const o = resolve(Object.assign({ pattern }, opts));
    const W = o.width || 1200, H = o.height || 675;
    o.area = Math.max(0.25, (W * H) / (1200 * 675));
    const target = svgTarget();
    const draw = (PATTERNS[o.pattern] || PATTERNS.travellers)(o);
    const c = normClear(o.clear, o);
    const still = { obstacles: [], ripples: [], mode: 'none', on: false };
    const warp = c && c.edge === 'break' ? makeWarp(o, still, () => o.time, true, { W, H, clear: c }) : null;
    // Simulated patterns (the travellers) step through time to reach the still.
    if (draw.simulated) for (let s = 0; s <= o.time; s += 1 / 30) draw(makePen(target, o, warp), W, H, s, null, o);
    target.out.length = 0;
    draw(makePen(target, o, warp), W, H, o.time, null, o);
    let defs = '', mask = '';
    if (c && c.edge !== 'break') {
      const b = clearBox(c, W, H);
      defs = `<defs><linearGradient id="sl-fade" gradientUnits="userSpaceOnUse" x1="${b.x0}" y1="${b.y0}" x2="${b.x1}" y2="${b.y1}"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>`
        + `<mask id="sl-clear"><rect width="${W}" height="${H}" fill="#fff"/><rect x="${b.fill[0]}" y="${b.fill[1]}" width="${b.fill[2]}" height="${b.fill[3]}" fill="${c.feather > 0 ? 'url(#sl-fade)' : '#000'}"/></mask></defs>`;
      mask = ' mask="url(#sl-clear)"';
    }
    const bg = o.bg ? `<rect width="${W}" height="${H}" fill="${o.bg}"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs}${bg}`
      + `<g fill="none" stroke="${o.ink || 'currentColor'}" stroke-opacity="${o.strength}" stroke-linecap="round" stroke-linejoin="round"${mask}>${target.out.join('')}</g></svg>`;
  }

  return { mount, svg, PATTERNS, LIST, DEFAULTS, PRESETS };
});
