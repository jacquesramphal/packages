/**
 * counter-fill.js
 *
 * Extracted directly from the approved codesandbox.html.
 * Same logic, same class names, same output — guaranteed identical rendering.
 *
 * ─── HTML structure ──────────────────────────────────────────────────
 *
 * Single-line:
 *   <div class="wrap" id="w1"><canvas></canvas><span class="text">Golden</span></div>
 *
 * Multi-line:
 *   <div class="wrap-multi" id="wm">Golden Baroque Obsidian</div>
 *
 * ─── Required CSS ────────────────────────────────────────────────────
 *
 *   Auto-injected by CounterFill.init() — no stylesheet needed.
 *
 * ─── Fill config ─────────────────────────────────────────────────────
 *
 *   Pass a FILLS object keyed by element id:
 *
 *   CounterFill.init({
 *     'my-heading': { stops: ['#f5c842','#d4820a','#7a3a08'] },
 *     'my-multi':   { stops: ['#f5c842','#d4820a','#7a3a08'] },
 *   });
 *
 *   CSS variables are resolved at paint time, so you can use design tokens:
 *
 *   CounterFill.init({
 *     'my-heading': { stops: ['var(--color-accent)'] },
 *     'my-multi':   { stops: ['var(--color-primary)','var(--color-secondary)'] },
 *   });
 *
 *   Options, all optional and combinable:
 *     stops  one colour, or several for a radial gradient across the word
 *     cycle  colours handed to the counters one at a time, left to right
 *     inset  a ring of background between stroke and fill: a preset ('none',
 *            'light', 'regular', 'heavy'), px (4) or any CSS length ('0.03em',
 *            'var(--counter-inset)', 'max(2px, 0.04em)')
 *     insetMin  a floor for an em inset, in px, so small text keeps its ring
 *     insetColor  the ring's colour in vector mode (default: the background
 *            behind the element); var() works, so it can follow a theme
 *     vector  draw the fills as SVG paths (default true); false uses the canvas
 *
 *   CounterFill.init({
 *     'my-heading': { cycle: ['#ec9683','#c48dad','#be695a'], inset: '0.03em' },
 *   });
 *
 * ─── API ─────────────────────────────────────────────────────────────
 *
 *   CounterFill.init(fills)   — paint all .wrap and .wrap-multi elements
 *   CounterFill.paint(el, fills) — paint one element
 *   CounterFill.registerFont(family, url, opts) — register a font for SVG rendering
 */

(function (global) {
  'use strict';

  // ── Auto-inject required CSS (once) ──────────────────────────────────────
  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement('style');
    style.dataset.counterFill = '';
    style.textContent = [
      '.wrap{position:relative;display:inline-block;line-height:1;white-space:nowrap;}',
      '.wrap canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;}',
      '.wrap .text{position:relative;z-index:1;}',
      '.wrap-multi{position:relative;display:block;line-height:1.2;}',
      '.wrap-multi .cf-word{position:relative;z-index:1;display:inline-block;}',
    ].join('');
    document.head.appendChild(style);
  }

  // ── Resolve CSS variables to concrete color values ────────────────────────
  const _colorEl = document.createElement('div');
  _colorEl.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
  document.body.appendChild(_colorEl);

  // A CSS colour (token or literal) as [r, g, b], read back from a 1px canvas.
  let _rgbCtx = null;
  function _toRGB(color) {
    if (!_rgbCtx) { const c = document.createElement('canvas'); c.width = c.height = 1; _rgbCtx = c.getContext('2d', { willReadFrequently: true }); }
    _rgbCtx.clearRect(0, 0, 1, 1);
    _rgbCtx.fillStyle = resolveColor(color);
    _rgbCtx.fillRect(0, 0, 1, 1);
    const d = _rgbCtx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  function resolveColor(color) {
    if (!color.includes('var(')) return color;
    _colorEl.style.color = color;
    return getComputedStyle(_colorEl).color;
  }

  // ── Map wdth axis to CSS font-stretch keyword ─────────────────────────────
  // ctx.fontVariationSettings is not supported in all browsers.
  // font-stretch % values are also rejected by canvas ctx.font parsing.
  // CSS keyword values (ultra-condensed … ultra-expanded) ARE accepted and
  // map to the wdth axis on variable fonts — closest approximation available.
  function _wdthToKeyword(fvs) {
    if (!fvs || fvs === 'normal') return '';
    const m = fvs.match(/"wdth"\s+([\d.]+)/);
    if (!m) return '';
    const v = parseFloat(m[1]);
    if (v < 56.25)  return 'ultra-condensed';
    if (v < 68.75)  return 'extra-condensed';
    if (v < 81.25)  return 'condensed';
    if (v < 93.75)  return 'semi-condensed';
    if (v < 106.25) return '';
    if (v < 118.75) return 'semi-expanded';
    if (v < 137.5)  return 'expanded';
    if (v < 175)    return 'extra-expanded';
    return 'ultra-expanded';
  }

  // ── Feature-test ctx.fontVariationSettings ─────────────────────────────────
  // Chrome 134+ exposes this property when it works. Browsers that expose it
  // but don't implement it haven't shipped — the property check is sufficient.
  // Previous version tried to verify via measureText with Roboto Flex, but that
  // gave false negatives when the font wasn't loaded yet (fell back to Arial
  // which doesn't respond to wdth). The cached false result then persisted for
  // the entire page session, forcing all variable fonts through the SVG path.
  let _fvsWorks = null;
  function _canUseFVS() {
    if (_fvsWorks !== null) return _fvsWorks;
    try {
      const tc = document.createElement('canvas').getContext('2d');
      _fvsWorks = 'fontVariationSettings' in tc;
    } catch(e) { _fvsWorks = false; }
    return _fvsWorks;
  }

  // ── SVG font cache for pixel-accurate variable font rendering ────────────
  // Stores family|style|weight → { dataUrl, mime } for embedding in SVG <text>.
  // SVG <text> supports font-variation-settings natively, and drawing SVG to
  // canvas does NOT taint it (unlike foreignObject), so getImageData works.
  const _fontCache = new Map(); // "family|style|weight" → { dataUrl, mime }

  // Look up the best cached font for a given family/style/weight.
  // Exact match first, then family-only fallback (variable fonts share one file).
  function _getCachedFont(family, style, weight) {
    return _fontCache.get(family + '|' + style + '|' + weight)
        || _fontCache.get(family + '|normal|*')   // variable font wildcard
        || _fontCache.get(family + '|*|*')         // any match for this family
        || null;
  }

  // Helper: fetch a font URL and store as base64 in cache under the given key.
  // Retries once on failure to handle CDN hiccups on page reload.
  async function _fetchAndCache(key, url) {
    if (_fontCache.has(key)) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue; // non-200 — retry once
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const ct = resp.headers.get('content-type') || '';
        const mime = ct.includes('woff2') ? 'font/woff2'
                   : ct.includes('woff')  ? 'font/woff'
                   : ct.includes('ttf') || ct.includes('truetype') ? 'font/ttf'
                   : 'application/octet-stream';
        _fontCache.set(key, { dataUrl: 'data:' + mime + ';base64,' + btoa(bin), mime });
        return; // success
      } catch(e) { /* fetch failed — retry or fall through to fallback path */ }
    }
  }

  // Auto-detect font URLs from same-origin @font-face rules + Google Fonts <link> tags
  async function _autoDetectFonts() {
    const toFetch = []; // [{ key, url }]

    // 1. Same-origin stylesheets — read @font-face src URLs
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSFontFaceRule) {
            const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
            const style  = rule.style.getPropertyValue('font-style') || 'normal';
            const weight = rule.style.getPropertyValue('font-weight') || '400';
            const src = rule.style.getPropertyValue('src');
            const urlMatch = src && src.match(/url\(["']?([^"')]+)["']?\)/);
            if (urlMatch) {
              // Variable fonts use weight ranges like "100 900"
              const isVariable = weight.includes(' ');
              const key = isVariable
                ? family + '|normal|*'
                : family + '|' + style + '|' + weight;
              toFetch.push({ key, url: urlMatch[1] });
            }
          }
        }
      } catch(e) { /* cross-origin sheet — skip */ }
    }

    // 2. Google Fonts <link> tags — fetch CSS, extract font URLs with style/weight
    for (const link of document.querySelectorAll('link[href*="fonts.googleapis.com/css"]')) {
      try {
        const resp = await fetch(link.href);
        if (!resp.ok) continue;
        const css = await resp.text();
        // Parse each @font-face block individually for family, style, weight, src
        const blocks = css.split('@font-face');
        for (const block of blocks) {
          const famMatch = block.match(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/);
          const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);
          if (!famMatch || !srcMatch) continue;
          const family = famMatch[1].trim();
          const styleMatch = block.match(/font-style:\s*(\w+)/);
          const weightMatch = block.match(/font-weight:\s*([\d\s]+)/);
          const style = styleMatch ? styleMatch[1] : 'normal';
          const weight = weightMatch ? weightMatch[1].trim() : '400';
          const isVariable = weight.includes(' ');
          // Google Fonts CSS lists subsets in order: cyrillic-ext … latin.
          // Later entries (latin) overwrite earlier ones for the same key.
          const key = isVariable
            ? family + '|normal|*'
            : family + '|' + style + '|' + weight;
          // Keep last match per key (latin subset)
          const idx = toFetch.findIndex(f => f.key === key);
          if (idx >= 0) toFetch[idx].url = srcMatch[1];
          else toFetch.push({ key, url: srcMatch[1] });
        }
      } catch(e) { /* fetch failed — skip */ }
    }

    // 3. Fetch each font and base64-encode
    await Promise.all(toFetch.map(({ key, url }) => _fetchAndCache(key, url)));
  }

  /**
   * Register a font manually for SVG rendering.
   * Use when fonts are loaded via JS (new FontFace()), cross-origin, or CDN.
   * @param {string} family  - Font family name (must match CSS font-family)
   * @param {string} url     - URL to the font file (woff2/woff/ttf)
   * @param {Object} [opts]  - { style: 'normal', weight: '400' }
   */
  async function registerFont(family, url, opts) {
    const style  = (opts && opts.style)  || 'normal';
    const weight = (opts && opts.weight) || '*';
    const key = family + '|' + style + '|' + weight;
    await _fetchAndCache(key, url);
  }

  // Render text via SVG with embedded font — supports all font-variation-settings axes
  // and vertical writing modes (canvas fillText can't render vertically).
  // Returns a Promise that resolves to true (success) or false (fallback needed).
  async function _renderTextSVG(ctx, word, cs, baselineX, baselineY, pw, ph, dpr, domTextWidth, writingMode) {
    const family = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    const cached = _getCachedFont(family, cs.fontStyle || 'normal', cs.fontWeight || '400');
    if (!cached) return false;

    // getComputedStyle returns axis names in double quotes: "wdth" 100, "opsz" 8
    // Replace with single quotes for valid CSS inside the SVG stylesheet.
    const fvs = (cs.fontVariationSettings || 'normal').replace(/"/g, "'");
    const fontSize = parseFloat(cs.fontSize) * dpr;
    const bx = Math.round(baselineX * dpr);
    const by = Math.round(baselineY * dpr);
    const ls = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const lsVal = parseFloat(ls) * dpr;
    const stretch = cs.fontStretch || 'normal';
    const kerning = cs.fontKerning || 'auto';
    const ffs = (cs.fontFeatureSettings || 'normal').replace(/"/g, "'");

    // Escape text for XML
    const esc = word.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ── Vertical writing mode support ───────────────────────────────────────
    const isVert = writingMode && writingMode.startsWith('vertical');
    const wmCss = isVert ? 'writing-mode:' + writingMode + ';text-orientation:mixed;' : '';
    let tx, ty, extraAttrs;
    if (isVert) {
      tx = Math.round(pw / 2);
      ty = 0;
      extraAttrs = ' dominant-baseline="central"';
    } else {
      tx = bx;
      ty = by;
      extraAttrs = domTextWidth > 0 ? ' textLength="'+Math.round(domTextWidth * dpr)+'" lengthAdjust="spacingAndGlyphs"' : '';
    }

    // All font properties go in <style> block — Safari ignores some font
    // properties in SVG inline styles. Include every property that affects
    // glyph metrics to prevent cumulative horizontal drift across letters.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+pw+'" height="'+ph+'">' +
      '<defs><style>' +
      '@font-face{font-family:CF;src:url("'+cached.dataUrl+'");}' +
      'text{font-family:CF;font-size:'+fontSize+'px;font-weight:'+cs.fontWeight+';' +
      'font-style:'+cs.fontStyle+';font-stretch:'+stretch+';' +
      'font-variation-settings:'+fvs+';' +
      'font-optical-sizing:'+(cs.fontOpticalSizing||'none')+';' +
      'font-kerning:'+kerning+';font-feature-settings:'+ffs+';' +
      'letter-spacing:'+lsVal+'px;' + wmCss + 'fill:white;}' +
      '</style></defs>' +
      '<text x="'+tx+'" y="'+ty+'"' + extraAttrs +
      '>'+esc+'</text></svg>';

    const blob = new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(blob);

    try {
      const img = new Image();
      img.src = url;
      // decode() waits for full render including embedded font loading —
      // fixes Safari where onload fires before the font is ready.
      await img.decode();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      URL.revokeObjectURL(url);
      return true;
    } catch(e) {
      URL.revokeObjectURL(url);
      return false;
    }
  }

  // ── BFS flood-fill + dilate + paint ──────────────────────────────────────
  // ── Squared Euclidean distance transform (Felzenszwalb & Huttenlocher) ──
  // f holds 0 at seed pixels and EDT_FAR elsewhere; on return each entry is the
  // squared distance to the nearest seed. Separable: rows, then columns.
  const EDT_FAR = 1e20;
  function _edt1d(g, len, d, v, z) {
    let k = 0;
    v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < len; q++) {
      let s = ((g[q] + q*q) - (g[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]);
      while (s <= z[k]) {
        k--;
        s = ((g[q] + q*q) - (g[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]);
      }
      k++; v[k] = q; z[k] = s; z[k+1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k+1] < q) k++;
      const dq = q - v[k];
      d[q] = dq*dq + g[v[k]];
    }
  }
  function _edt(f, w, h) {
    const n = Math.max(w, h);
    const g = new Float64Array(n), d = new Float64Array(n);
    const v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) g[x] = f[y*w+x];
      _edt1d(g, w, d, v, z);
      for (let x = 0; x < w; x++) f[y*w+x] = d[x];
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) g[y] = f[y*w+x];
      _edt1d(g, h, d, v, z);
      for (let y = 0; y < h; y++) f[y*w+x] = d[y];
    }
    return f;
  }

  // Steps 1 and 2 of the fill, shared by the canvas and vector paths: find the
  // enclosed regions in a rasterised word and label them left to right.
  // d is the canvas's RGBA data; ink is anything with alpha above 32.
  function _findCounters(d, pw, ph) {
    const N = pw * ph;
    // 1. Everything reachable from the canvas edge without crossing ink is
    //    outside; whatever empty space is left is enclosed by letterforms.
    const outside = new Uint8Array(N);
    const q = [];
    const enq = i => {
      if (i < 0 || i >= N || outside[i] || d[i*4+3] > 32) return;
      outside[i] = 1; q.push(i);
    };
    for (let x = 0; x < pw; x++) { enq(x); enq((ph-1)*pw+x); }
    for (let y = 0; y < ph; y++) { enq(y*pw); enq(y*pw+pw-1); }
    while (q.length) {
      const i = q.pop();
      enq(i-1); enq(i+1); enq(i-pw); enq(i+pw);
    }

    // 2. Label each enclosed region. A wide flat strip is the gap between two
    //    tight lines of text, not a counter, so it is dropped.
    const label = new Int32Array(N);
    const regions = [];
    for (let i = 0; i < N; i++) {
      if (label[i] || outside[i] || d[i*4+3] !== 0) continue;
      const pts = [];
      let minX = pw, maxX = 0, minY = ph, maxY = 0;
      const rq = [i];
      label[i] = -1;
      while (rq.length) {
        const ri = rq.pop();
        pts.push(ri);
        const rx = ri % pw, ry = (ri / pw) | 0;
        if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
        for (const ni of [ri-1, ri+1, ri-pw, ri+pw]) {
          if (ni >= 0 && ni < N && !label[ni] && !outside[ni] && d[ni*4+3] === 0) { label[ni] = -1; rq.push(ni); }
        }
      }
      const rw = maxX - minX, rh = maxY - minY;
      // -2 marks a rejected strip so the scan doesn't flood it again; it is
      // cleared to 0 below.
      if (rh > 0 && rw / rh > 4) { for (const ri of pts) label[ri] = -2; continue; }
      regions.push({ minX, maxX, minY, maxY, pts });
    }
    regions.sort((a, b) => a.minX - b.minX);
    regions.forEach((r, k) => { for (const ri of r.pts) label[ri] = k + 1; });
    for (let i = 0; i < N; i++) if (label[i] < 0) label[i] = 0;

    return { outside, label, regions };
  }

  // ── Fill the counters on a canvas ─────────────────────────────────────────
  //
  // fill: { stops, cycle, inset } (see the Fill config section of the README)
  //   stops  one colour, or several for a radial gradient across the word
  //   cycle  colours handed to the counters one at a time, left to right
  //   inset  ring of background between stroke and fill, in device pixels
  //          (callers convert px / em with _insetPx)
  // opts:  { dilate, offset }
  //   dilate how far an un-inset fill grows under the strokes, hiding seams
  //   offset where in `cycle` the first counter starts
  //
  // Returns the number of counters filled, so a caller can carry a cycle on
  // across several canvases.
  function bfsAndPaint(cv, ctx, pw, ph, fill, opts) {
    fill = fill || {};
    opts = opts || {};
    const N = pw * ph;
    const { outside, label, regions } = _findCounters(ctx.getImageData(0, 0, pw, ph).data, pw, ph);

    // 3. Coverage per pixel, 0 to 1.
    const alpha = new Float32Array(N);
    const owner = new Int32Array(N); // which counter a covered pixel belongs to
    const R = fill.inset > 0 ? fill.inset : 0;
    if (R) {
      // Inset: keep pixels further than R from any non-counter pixel. The
      // distance field is continuous, so the one-pixel ramp at R gives the
      // ring an antialiased edge instead of a stair-stepped one.
      const f = new Float64Array(N);
      for (let i = 0; i < N; i++) f[i] = label[i] ? EDT_FAR : 0;
      _edt(f, pw, ph);
      for (let i = 0; i < N; i++) {
        if (!label[i]) continue;
        const a = Math.sqrt(f[i]) - R;
        if (a <= 0) continue;
        alpha[i] = a >= 1 ? 1 : a;
        owner[i] = label[i];
      }
    } else {
      // No inset: grow each fill under the strokes (the DOM text sits on top
      // and hides it), never into the outside, so no seam shows at the edge.
      const DIL = opts.dilate || 2;
      for (let y = 0; y < ph; y++)
        for (let x = 0; x < pw; x++) {
          const l = label[y*pw+x];
          if (!l) continue;
          for (let dy = -DIL; dy <= DIL; dy++)
            for (let dx = -DIL; dx <= DIL; dx++) {
              const nx = x+dx, ny = y+dy;
              if (nx<0 || nx>=pw || ny<0 || ny>=ph) continue;
              const ni = ny*pw+nx;
              if (outside[ni] || owner[ni]) continue;
              alpha[ni] = 1; owner[ni] = l;
            }
        }
    }

    // 4. Paint.
    ctx.clearRect(0, 0, pw, ph);
    const out = new ImageData(pw, ph);
    const o = out.data;
    if (fill.cycle && fill.cycle.length) {
      const rgb = fill.cycle.map(_toRGB);
      const off = opts.offset || 0;
      for (let i = 0; i < N; i++) {
        if (!alpha[i]) continue;
        const c = rgb[(off + owner[i] - 1) % rgb.length];
        o[i*4] = c[0]; o[i*4+1] = c[1]; o[i*4+2] = c[2]; o[i*4+3] = Math.round(alpha[i] * 255);
      }
      ctx.putImageData(out, 0, 0);
    } else {
      for (let i = 0; i < N; i++) {
        if (!alpha[i]) continue;
        o[i*4] = o[i*4+1] = o[i*4+2] = 255; o[i*4+3] = Math.round(alpha[i] * 255);
      }
      ctx.putImageData(out, 0, 0);
      const resolved = (fill.stops || ['currentColor']).map(resolveColor);
      let paint;
      if (resolved.length === 1) {
        paint = resolved[0];
      } else {
        const cx = pw*0.5, cy = ph*0.48, r = pw*0.6;
        paint = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        resolved.forEach((c, i) => paint.addColorStop(i / (resolved.length - 1), c));
      }
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = paint;
      ctx.fillRect(0, 0, pw, ph);
      ctx.globalCompositeOperation = 'source-over';
    }
    return regions.length;
  }

  // ── Vector fill ───────────────────────────────────────────────────────────
  //
  // Opt in with { vector: true }. Instead of painting pixels, each counter's edge
  // is traced from the letter's own antialiased raster (marching squares at the
  // 50% coverage line, so it lands between pixels), smoothed into curves, and
  // drawn as an SVG path. It stays sharp at any zoom. The inset is a mask: the
  // same path stroked in black, so the ring is exact too. Uses no font data, so
  // it works with any font the canvas can draw.

  // Trace the closed 50% iso-lines of field v inside [x0,x1)×[y0,y1).
  function _isoLoops(v, pw, x0, y0, x1, y1) {
    const T = 0.5;
    const segs = new Map(); // edge key -> [segment ids]
    const pts = [];         // per segment: [keyA, pA, keyB, pB]
    const at = (x, y) => v[y*pw + x];
    const lerp = (a, b) => (T - a) / (b - a);
    for (let y = y0; y < y1 - 1; y++)
      for (let x = x0; x < x1 - 1; x++) {
        const a = at(x, y), b = at(x+1, y), c = at(x+1, y+1), dd = at(x, y+1);
        const idx = (a >= T ? 1 : 0) | (b >= T ? 2 : 0) | (c >= T ? 4 : 0) | (dd >= T ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        // Edge crossing points, in pixel-centre coordinates.
        const E = {
          t: ['h' + (y*pw + x),     [x + 0.5 + lerp(a, b), y + 0.5]],
          r: ['v' + (y*pw + x + 1), [x + 1.5, y + 0.5 + lerp(b, c)]],
          b: ['h' + ((y+1)*pw + x), [x + 0.5 + lerp(dd, c), y + 1.5]],
          l: ['v' + (y*pw + x),     [x + 0.5, y + 0.5 + lerp(a, dd)]],
        };
        let pairs;
        switch (idx) {
          case 1: case 14: pairs = [['l', 't']]; break;
          case 2: case 13: pairs = [['t', 'r']]; break;
          case 3: case 12: pairs = [['l', 'r']]; break;
          case 4: case 11: pairs = [['r', 'b']]; break;
          case 6: case 9:  pairs = [['t', 'b']]; break;
          case 7: case 8:  pairs = [['l', 'b']]; break;
          case 5: case 10: {
            const centre = (a + b + c + dd) / 4 >= T;
            // Ink in the centre joins the two ink corners, so the line cuts off
            // the two empty corners instead; no ink there does the opposite.
            // (5: top-left and bottom-right are ink; 10: the other pair.)
            const cutEmpty = idx === 5 ? [['t', 'r'], ['l', 'b']] : [['l', 't'], ['r', 'b']];
            const cutInk   = idx === 5 ? [['l', 't'], ['r', 'b']] : [['t', 'r'], ['l', 'b']];
            pairs = centre ? cutEmpty : cutInk;
            break;
          }
        }
        for (const [e1, e2] of pairs) {
          const id = pts.length;
          pts.push([E[e1][0], E[e1][1], E[e2][0], E[e2][1]]);
          for (const k of [E[e1][0], E[e2][0]]) {
            const l = segs.get(k); if (l) l.push(id); else segs.set(k, [id]);
          }
        }
      }
    const used = new Uint8Array(pts.length);
    const loops = [];
    for (let s0 = 0; s0 < pts.length; s0++) {
      if (used[s0]) continue;
      used[s0] = 1;
      const loop = [pts[s0][1]];
      const startKey = pts[s0][0];
      let key = pts[s0][2], p = pts[s0][3], closed = false;
      for (let guard = 0; guard < pts.length + 1; guard++) {
        loop.push(p);
        if (key === startKey) { closed = true; break; }
        const next = (segs.get(key) || []).find(id => !used[id]);
        if (next === undefined) break;
        used[next] = 1;
        const sg = pts[next];
        if (sg[0] === key) { key = sg[2]; p = sg[3]; } else { key = sg[0]; p = sg[1]; }
      }
      if (closed && loop.length > 3) { loop.pop(); loops.push(loop); }
    }
    return loops;
  }

  function _area(poly) {
    let s = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(s / 2);
  }
  function _contains(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  // Even out a traced loop before it becomes a curve. Marching squares can put
  // two points almost on top of each other, which kinks a Catmull-Rom curve
  // into a hairline spike; resampling at a fixed spacing along the loop, then
  // averaging each point with its neighbours, removes that without moving the
  // outline by more than a fraction of a pixel.
  function _resample(poly, step) {
    const n = poly.length, lens = [0];
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      lens.push(lens[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = lens[n];
    const count = Math.max(8, Math.round(total / step));
    const out = [];
    let seg = 0;
    for (let k = 0; k < count; k++) {
      const t = (k / count) * total;
      while (lens[seg + 1] < t) seg++;
      const a = poly[seg], b = poly[(seg + 1) % n];
      const u = (t - lens[seg]) / ((lens[seg + 1] - lens[seg]) || 1);
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    return out.map((p, i) => {
      const a = out[(i - 1 + count) % count], c = out[(i + 1) % count];
      return [(a[0] + 2 * p[0] + c[0]) / 4, (a[1] + 2 * p[1] + c[1]) / 4];
    });
  }

  // A closed loop as a smooth SVG path: Catmull-Rom through the points, written
  // as cubic Béziers, so the curve passes through every traced point.
  function _smoothPath(poly) {
    const n = poly.length, f = v => Math.round(v * 100) / 100;
    let d = 'M' + f(poly[0][0]) + ' ' + f(poly[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n], p3 = poly[(i + 2) % n];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' '
             + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' '
             + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + 'Z';
  }

  // A filled path, its colour set as CSS so var() stays live.
  function _fillPath(d, colour, extra) {
    const p = _el('path', Object.assign({ d }, extra || {}));
    p.style.fill = colour;
    if (extra && extra['stroke-width']) p.style.stroke = colour;
    return p;
  }

  let _svgId = 0;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function _el(name, attrs) {
    const e = document.createElementNS(SVG_NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // The colour of the first opaque background at or above el, or null when
  // there's a gradient, an image or a translucent layer in the way.
  function _solidBackground(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean);
      const a = parts.length > 3 ? parseFloat(parts[3]) : 1;
      if (a === 0) continue;
      return a >= 1 ? cs.backgroundColor : null;
    }
    return null;
  }

  // Trace the counters on cv's raster and draw them as an SVG laid over the
  // same box. The canvas is cleared and left in place. Returns the counter
  // count, like bfsAndPaint.
  function vectorPaint(cv, ctx, pw, ph, fill, opts) {
    opts = opts || {};
    const d = ctx.getImageData(0, 0, pw, ph).data;
    const { regions } = _findCounters(d, pw, ph);
    const v = new Float32Array(pw * ph);
    for (let i = 0; i < pw * ph; i++) v[i] = d[i*4+3] / 255;

    const paths = [];
    for (const r of regions) {
      // Search box: the counter as the 50% line sees it, which reaches past
      // the fully empty pixels into the soft edge (a long way, at a sharp tip
      // like the top of an A). Flood from the counter through everything below
      // 50% ink, then pad a pixel either side.
      let bx0 = r.minX, by0 = r.minY, bx1 = r.maxX, by1 = r.maxY;
      const seen = new Uint8Array(pw * ph), fq = r.pts.slice();
      for (const i of fq) seen[i] = 1;
      const cap = r.pts.length * 8 + 4096;
      for (let n = 0; n < fq.length && fq.length < cap; n++) {
        const i = fq[n], x = i % pw, y = (i / pw) | 0;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        for (const ni of [i-1, i+1, i-pw, i+pw]) {
          if (ni < 0 || ni >= pw*ph || seen[ni] || v[ni] >= 0.5) continue;
          seen[ni] = 1; fq.push(ni);
        }
      }
      const x0 = Math.max(0, bx0 - 2), y0 = Math.max(0, by0 - 2);
      const x1 = Math.min(pw, bx1 + 3), y1 = Math.min(ph, by1 + 3);
      // The counter's outline is the loop that contains most of its pixels.
      // Testing a spread of them, not one, matters for slivers like the
      // inside of an A, where a single pixel at the tip can sit on the line.
      const step = Math.max(1, Math.floor(r.pts.length / 24));
      const samples = [];
      for (let k = 0; k < r.pts.length; k += step) samples.push([r.pts[k] % pw + 0.5, ((r.pts[k] / pw) | 0) + 0.5]);
      let best = null, bestHits = 0, bestA = Infinity;
      for (const loop of _isoLoops(v, pw, x0, y0, x1, y1)) {
        let hits = 0;
        for (const [sx, sy] of samples) if (_contains(loop, sx, sy)) hits++;
        if (!hits) continue;
        const a = _area(loop);
        if (hits > bestHits || (hits === bestHits && a < bestA)) { best = loop; bestHits = hits; bestA = a; }
      }
      if (best) paths.push(_smoothPath(_resample(best, 1.5)));
    }

    // Every counter has to trace, or the vector result would drop one the
    // canvas version keeps. Hand back null, with the canvas untouched, and the
    // caller falls back to the canvas fill.
    if (paths.length !== regions.length) return null;

    // The new layer is built in full before anything on the page changes, so
    // an error part way through leaves the canvas raster for the fallback.
    const svg = _el('svg', { class: 'cf-vector', 'aria-hidden': 'true', viewBox: '0 0 ' + pw + ' ' + ph });
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:' + (getComputedStyle(cv).zIndex || '0') + ';';
    const commit = () => {
      const prev = cv.parentNode.querySelector(':scope > svg.cf-vector');
      if (prev) prev.remove();
      cv.after(svg);
      ctx.clearRect(0, 0, pw, ph);
      return paths.length;
    };
    if (!paths.length) return commit();

    const id = 'cf' + (++_svgId);
    const R = fill.inset > 0 ? fill.inset : 0;
    const defs = _el('defs', {});
    svg.appendChild(defs);

    // Paint for each counter: a colour from the cycle, or the stops.
    // Colours stay as written (var() included) and are set as CSS, not
    // resolved now, so the fills follow a theme switch without a repaint.
    let paintFor;
    if (fill.cycle && fill.cycle.length) {
      const cols = fill.cycle, off = opts.offset || 0;
      paintFor = k => cols[(off + k) % cols.length];
    } else {
      const stops = fill.stops || ['currentColor'];
      if (stops.length === 1) paintFor = () => stops[0];
      else {
        // Placed where the canvas fill puts it. The canvas draws its gradient
        // under the context's transform (scaled by the device pixel ratio),
        // so the same transform is applied here and the two look identical.
        const m = ctx.getTransform();
        const g = _el('radialGradient', { id: id + 'g', gradientUnits: 'userSpaceOnUse',
          cx: m.a * pw*0.5 + m.e, cy: m.d * ph*0.48 + m.f, r: m.a * pw*0.6 });
        stops.forEach((c, i) => { const st = _el('stop', { offset: i / (stops.length - 1) }); st.style.stopColor = c; g.appendChild(st); });
        defs.appendChild(g);
        paintFor = () => 'url(#' + id + 'g)';
      }
    }

    const group = _el('g', {});
    // The ring's colour, when it can be painted rather than masked: the
    // fill's insetColor (any CSS colour, var() included, so it follows a
    // theme), or the nearest solid background behind the element.
    const ringColour = R ? (fill.insetColor || _solidBackground(cv.parentNode)) : null;
    if (R && ringColour) {
      // Each fill, then the same edge stroked 2R wide in the background
      // colour. The fill layer sits under the text, so the stroke's outer half
      // is hidden by the letter and its inner half is the ring. Plain paths,
      // so browsers redraw them sharply under pinch zoom; Safari draws a
      // masked group as an image and enlarges it instead.
      paths.forEach((p, k) => group.appendChild(_fillPath(p, paintFor(k))));
      for (const p of paths) {
        const ring = _el('path', { d: p, fill: 'none', 'stroke-width': 2 * R, 'stroke-linejoin': 'round' });
        ring.style.stroke = ringColour;
        group.appendChild(ring);
      }
    } else if (R) {
      // No solid background to paint the ring with (an image or gradient
      // behind the text): cut it with a mask instead.
      // The mask keeps each counter and cuts a band of width R inside its edge
      // (a stroke of 2R centred on the edge; the outer half falls on the
      // letter, where the mask is already black).
      const mask = _el('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: pw, height: ph });
      mask.appendChild(_el('rect', { x: 0, y: 0, width: pw, height: ph, fill: 'black' }));
      for (const p of paths) mask.appendChild(_el('path', { d: p, fill: 'white', stroke: 'black', 'stroke-width': 2 * R, 'stroke-linejoin': 'round' }));
      defs.appendChild(mask);
      group.setAttribute('mask', 'url(#' + id + 'm)');
      paths.forEach((p, k) => group.appendChild(_fillPath(p, paintFor(k))));
    } else {
      // No inset: grow each fill a little under its letter, as the canvas
      // version does, so no hairline of background shows at the seam.
      const grow = opts.dilate || 2;
      paths.forEach((p, k) => group.appendChild(_fillPath(p, paintFor(k), { 'stroke-width': 2 * grow, 'stroke-linejoin': 'round' })));
    }
    svg.appendChild(group);
    return commit();
  }

  // Route to the vector or canvas painter. Vector is the default: it stays
  // sharp at any zoom and is no slower. The canvas fill is the fallback, used
  // when a fill sets vector: false, when SVG can't be drawn, or when vector
  // can't trace every counter or throws.
  function _paint(cv, ctx, pw, ph, fill, opts) {
    fill = fill || {};
    if (fill.vector !== false && typeof document.createElementNS === 'function') {
      try {
        const n = vectorPaint(cv, ctx, pw, ph, fill, opts);
        if (n !== null) { if (cv.parentNode) cv.parentNode.dataset.cfMode = 'vector'; return n; }
      } catch (e) { /* fall through to the canvas fill */ }
    }
    if (cv.parentNode) cv.parentNode.dataset.cfMode = 'canvas';
    // A canvas paint replaces any earlier vector layer on this element.
    const old = cv.parentNode && cv.parentNode.querySelector(':scope > svg.cf-vector');
    if (old) old.remove();
    return bfsAndPaint(cv, ctx, pw, ph, fill, opts);
  }

  // The inset ring width in device pixels. `inset` is a number (CSS px) or any
  // CSS length, resolved against the element itself: '0.03em' scales with its
  // font size, and 'var(--counter-inset)', 'max(2.5px, 0.04em)' and calc()
  // work too, so the width can live in a stylesheet. `insetMin` (CSS px) is a
  // floor, so an em ring on small text stays wide enough to see.
  // Named ring widths, so first use looks right without picking a number. Each
  // scales with the type and has a floor for small text.
  const INSET_PRESETS = {
    none: '0px',
    light: 'max(2.5px, 0.03em)',
    regular: 'max(3px, 0.045em)',
    heavy: 'max(3.5px, 0.06em)',
  };

  function _insetPx(fill, el, dpr) {
    let v = fill && fill.inset;
    if (!v) return 0;
    // A lone var() is read off the element first, so a custom property can
    // hold a preset name as well as a length.
    if (typeof v === 'string') {
      const m = v.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
      if (m) v = getComputedStyle(el).getPropertyValue(m[1]).trim() || (m[2] || '').trim();
      // 'none' turns the ring off outright, insetMin included.
      if (v === 'none') return 0;
      if (INSET_PRESETS[v]) v = INSET_PRESETS[v];
      if (!v) return 0;
    }
    let px;
    if (typeof v === 'number') px = v;
    else {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;padding:0;border:0;';
      probe.style.width = String(v).trim();
      el.appendChild(probe);
      px = probe.getBoundingClientRect().width;
      probe.remove();
    }
    if (fill.insetMin > 0) px = Math.max(px, fill.insetMin);
    return px > 0 ? px * dpr : 0;
  }

  // ── Single-line paint ─────────────────────────────────────────────────────
  async function paintWrap(wrap, FILLS) {
    const cv     = wrap.querySelector('canvas');
    const textEl = wrap.querySelector('.text');
    const fill   = FILLS[wrap.id];
    if (!cv || !textEl || !fill) return;

    const dpr = window.devicePixelRatio || 1;
    const cs  = getComputedStyle(textEl);
    const fvs = cs.fontVariationSettings || 'normal';
    const word = textEl.textContent.trim();

    const sizer = document.createElement('span');
    sizer.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;overflow:visible;';
    wrap.insertBefore(sizer, textEl);
    const wR = wrap.getBoundingClientRect();
    const sR = sizer.getBoundingClientRect();
    wrap.removeChild(sizer);
    const baselineY = sR.bottom - wR.top;
    const baselineX = sR.left   - wR.left;

    const W = wrap.offsetWidth, H = wrap.offsetHeight;
    cv.width  = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.scale(dpr, dpr);

    // ── Vertical writing mode — canvas fillText can't render vertically ────
    const wm = getComputedStyle(wrap).writingMode || 'horizontal-tb';
    const isVertical = wm.startsWith('vertical');
    if (isVertical && _fontCache.size > 0) {
      const ok = await _renderTextSVG(ctx, word, cs, baselineX, baselineY, cv.width, cv.height, dpr, textEl.offsetWidth, wm);
      if (ok) { _paint(cv, ctx, cv.width, cv.height, { ...fill, inset: _insetPx(fill, textEl, dpr) }); return; }
      ctx.clearRect(0, 0, cv.width, cv.height);
    }

    // ── SVG for variable fonts ──────────────────────────────────────────────
    // Use SVG when the element has properties canvas can't honor:
    //   - explicit font-variation-settings (custom axes)
    //   - font-optical-sizing: none (canvas always auto-applies opsz)
    const opsNone = cs.fontOpticalSizing === 'none';
    if ((fvs !== 'normal' || opsNone) && _fontCache.size > 0) {
      const ok = await _renderTextSVG(ctx, word, cs, baselineX, baselineY, cv.width, cv.height, dpr, textEl.offsetWidth);
      if (ok) {
        const svgData = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let hasInk = false;
        for (let i = 3; i < svgData.length; i += 4) {
          if (svgData[i] > 32) { hasInk = true; break; }
        }
        // Browsers without native ctx.fontVariationSettings (Safari) may render
        // SVG glyphs with smaller counters (custom axes like SOFT not applied).
        // Scale dilation with font size — large text needs more expansion.
        // Canvas sits behind DOM text (z-index), so over-dilation into strokes is hidden.
        const svgDilate = _canUseFVS() ? 2 : Math.max(4, Math.round(parseFloat(cs.fontSize) * dpr * 0.03));
        if (hasInk) { _paint(cv, ctx, cv.width, cv.height, { ...fill, inset: _insetPx(fill, textEl, dpr) }, { dilate: svgDilate }); return; }
        ctx.clearRect(0, 0, cv.width, cv.height);
      }
    }

    // ── Canvas fallback: split by font type ──────────────────────────────────

    if (fvs !== 'normal' || opsNone) {
      // Variable font (explicit axes or opsz-sensitive)

      // Path A: ctx.fontVariationSettings (Chrome 134+, verified working)
      const _stretch = (cs.fontStretch && cs.fontStretch !== 'normal' && cs.fontStretch !== '100%')
        ? cs.fontStretch
        : _wdthToKeyword(fvs);
      const fontStr = [
        cs.fontStyle !== 'normal' ? cs.fontStyle : '',
        _stretch,
        cs.fontWeight, cs.fontSize, cs.fontFamily,
      ].filter(Boolean).join(' ');

      ctx.font = fontStr; ctx.letterSpacing = cs.letterSpacing || '0px';
      ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';

      if (_canUseFVS()) {
        ctx.fontVariationSettings = fvs;
        ctx.fillText(word, baselineX, baselineY);
      } else {
        // Path B: Width/height scaling approximation
        const m = ctx.measureText(word);
        const domW = textEl.offsetWidth;
        const scaleX = (m.width > 0 && domW > 0) ? domW / m.width : 1;
        const canvasH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        const domH = wrap.offsetHeight;
        const scaleY = (canvasH > 0 && domH > 0) ? domH / canvasH : 1;
        const needsScale = Math.abs(scaleX - 1) > 0.02 || Math.abs(scaleY - 1) > 0.05;
        if (needsScale) {
          ctx.save();
          ctx.translate(baselineX, baselineY);
          ctx.scale(scaleX, scaleY);
          ctx.fillText(word, 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(word, baselineX, baselineY);
        }
      }
    } else {
      // Static font (or variable font at default axes) — probe-canvas drift correction
      const fontStr = [
        cs.fontStyle !== 'normal' ? cs.fontStyle : '',
        cs.fontWeight, cs.fontSize, cs.fontFamily,
      ].filter(Boolean).join(' ');

      const mc = document.createElement('canvas');
      const mx = mc.getContext('2d');
      mx.font = fontStr;
      const ascent = mx.measureText(word).actualBoundingBoxAscent;

      const probe = document.createElement('canvas');
      probe.width = cv.width; probe.height = cv.height;
      const pCtx = probe.getContext('2d', { willReadFrequently: true });
      pCtx.scale(dpr, dpr);
      pCtx.font = fontStr; pCtx.letterSpacing = cs.letterSpacing || '0px';
      pCtx.textBaseline = 'alphabetic'; pCtx.fillStyle = '#fff';
      pCtx.fillText(word, baselineX, baselineY);

      const td = pCtx.getImageData(0, 0, probe.width, probe.height).data;
      let inkTop = probe.height;
      outer: for (let r = 0; r < probe.height; r++)
        for (let c = 0; c < probe.width; c++)
          if (td[(r * probe.width + c) * 4 + 3] > 32) { inkTop = r; break outer; }
      const drift = inkTop - Math.round((baselineY - ascent) * dpr);
      const finalY = Math.abs(drift) > 1 ? baselineY - drift / dpr : baselineY;

      ctx.font = fontStr; ctx.letterSpacing = cs.letterSpacing || '0px';
      ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
      ctx.fillText(word, baselineX, finalY);
    }

    _paint(cv, ctx, cv.width, cv.height, { ...fill, inset: _insetPx(fill, textEl, dpr) });
  }

  // ── Per-word canvas paint (counter stays inside the span it belongs to) ──
  async function paintWordSpan(span, fill, fontStr, letterSpacing, fontVariationSettings, dpr, offset) {
    const word = span.dataset.cfWord;
    if (!word) return;

    let cv = span.querySelector(':scope > canvas.cf-canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'cf-canvas';
      cv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1;';
      span.insertBefore(cv, span.firstChild);
    }

    const W = span.offsetWidth, H = span.offsetHeight;
    if (!W || !H) return;
    cv.width  = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);

    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.scale(dpr, dpr);

    // Measure baseline within the span's own coordinate space
    const sizer = document.createElement('span');
    sizer.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;overflow:visible;';
    span.insertBefore(sizer, span.firstChild);
    const sR  = sizer.getBoundingClientRect();
    const spR = span.getBoundingClientRect();
    span.removeChild(sizer);

    const bx = sR.left   - spR.left;
    const by = sR.bottom - spR.top;

    // Priority 1: SVG embedded-font rendering — pixel-perfect for ALL axes
    if (fontVariationSettings !== 'normal' && _fontCache.size > 0) {
      const cs = getComputedStyle(span.closest('.wrap-multi') || span);
      const ok = await _renderTextSVG(ctx, word, cs, bx, by, cv.width, cv.height, dpr, span.offsetWidth);
      const mDilate = _canUseFVS() ? 2 : Math.max(4, Math.round(parseFloat(cs.fontSize) * dpr * 0.03));
      if (ok) return _paint(cv, ctx, cv.width, cv.height, fill, { dilate: mDilate, offset });
    }

    ctx.font = fontStr; ctx.letterSpacing = letterSpacing;
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';

    // Priority 2: ctx.fontVariationSettings if verified working
    if (_canUseFVS() && fontVariationSettings !== 'normal') {
      ctx.fontVariationSettings = fontVariationSettings;
      ctx.fillText(word, bx, by);
    } else {
      // Priority 3: width-scaling approximation
      const domW = span.offsetWidth;
      const canvasW = ctx.measureText(word).width;
      const scaleX = (canvasW > 0 && domW > 0) ? domW / canvasW : 1;
      if (Math.abs(scaleX - 1) > 0.02) {
        ctx.save();
        ctx.translate(bx, 0);
        ctx.scale(scaleX, 1);
        ctx.fillText(word, 0, by);
        ctx.restore();
      } else {
        ctx.fillText(word, bx, by);
      }
    }

    return _paint(cv, ctx, cv.width, cv.height, fill, { offset });
  }

  // ── Recursively wrap text-node words in .cf-word spans ───────────────────
  // Preserves inline elements (e.g. <a>) so links inside h1 keep their markup.
  function _wrapWordsInNode(node, container) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Split on breaking whitespace only: a no-break space (U+00A0) binds two
      // words on purpose ("I learned"), so they stay one span and one line.
      node.textContent.split(/([ \t\n\r\f]+)/).forEach(part => {
        if (/^[ \t\n\r\f]+$/.test(part)) {
          container.appendChild(document.createTextNode(part));
        } else if (part.length) {
          const s = document.createElement('span');
          s.className = 'cf-word';
          s.dataset.cfWord = part;
          s.textContent = part;
          container.appendChild(s);
        }
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const clone = node.cloneNode(false);
      container.appendChild(clone);
      Array.from(node.childNodes).forEach(child => _wrapWordsInNode(child, clone));
    }
  }

  // Word spans are inline-blocks, and a line may break between two of them even
  // with no space in between, so a link and the comma after it ("work,") could
  // land on different lines. Wrap each run of touching pieces in a no-wrap span.
  function _glue(container) {
    const isGap = n => n.nodeType === Node.TEXT_NODE && /^[ \t\n\r\f]*$/.test(n.textContent);
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const g = document.createElement('span');
        g.className = 'cf-glue';
        g.style.whiteSpace = 'nowrap';
        run[0].before(g);
        run.forEach(n => g.appendChild(n));
      }
      run = [];
    };
    Array.from(container.childNodes).forEach(n => { if (isGap(n)) flush(); else run.push(n); });
    flush();
  }

  // ── Multi-line paint ──────────────────────────────────────────────────────
  async function paintMulti(wrap, FILLS) {
    const fill = FILLS[wrap.id];
    if (!fill) return;

    const dpr = window.devicePixelRatio || 1;

    // First call: split text nodes into per-word spans, preserving inline elements
    if (!wrap.querySelector('span.cf-word')) {
      const children = Array.from(wrap.childNodes);
      wrap.innerHTML = '';
      children.forEach(child => _wrapWordsInNode(child, wrap));
      _glue(wrap);
    }

    const wordSpans = wrap.querySelectorAll('span.cf-word');
    if (!wordSpans.length) return;

    const cs = getComputedStyle(wrap);
    const _stretch = (cs.fontStretch && cs.fontStretch !== 'normal' && cs.fontStretch !== '100%')
      ? cs.fontStretch
      : _wdthToKeyword(cs.fontVariationSettings || 'normal');
    const fontStr = [
      cs.fontStyle !== 'normal' ? cs.fontStyle : '',
      _stretch,
      cs.fontWeight, cs.fontSize, cs.fontFamily,
    ].filter(Boolean).join(' ');
    const letterSpacing = cs.letterSpacing || '0px';
    const fontVariationSettings = cs.fontVariationSettings || 'normal';

    const resolved = { ...fill, inset: _insetPx(fill, wrap, dpr) };

    // Each word paints its own canvas. A cycle runs on across the words, so
    // they paint in order and each starts where the last one stopped;
    // without one they paint in parallel.
    if (fill.cycle && fill.cycle.length) {
      let offset = 0;
      for (const span of wordSpans) {
        offset += (await paintWordSpan(span, resolved, fontStr, letterSpacing, fontVariationSettings, dpr, offset)) || 0;
      }
    } else {
      await Promise.all([...wordSpans].map(span => paintWordSpan(span, resolved, fontStr, letterSpacing, fontVariationSettings, dpr, 0)));
    }
  }

  // ── Performance: size cache + rAF batching ────────────────────────────────
  const sizeCache = new WeakMap();
  let   rafId     = null;
  const pending   = new Set();

  function scheduleRepaint(el, FILLS) {
    const dpr = window.devicePixelRatio || 1;
    const key = `${Math.round(el.offsetWidth*dpr)}x${Math.round(el.offsetHeight*dpr)}`;
    if (sizeCache.get(el) === key) return;
    pending.add({ el, FILLS });
    if (rafId) return;
    // Double rAF: first frame allows the browser to settle layout after a resize,
    // second frame reads positions and paints — prevents stale getBoundingClientRect
    // reads that cause counters to appear on the wrong line.
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        pending.forEach(({ el: target, FILLS: f }) => {
          const k = `${Math.round(target.offsetWidth*dpr)}x${Math.round(target.offsetHeight*dpr)}`;
          sizeCache.set(target, k);
          target.classList.contains('wrap-multi') ? paintMulti(target, f) : paintWrap(target, f);
        });
        pending.clear();
      });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  const CounterFill = {
    /**
     * Paint all .wrap and .wrap-multi elements.
     * @param {Object} fills - { elementId: { stops: ['#color1', '#color2', ...] } }
     */
    async init(fills) {
      _injectStyles();
      await _autoDetectFonts();
      await document.fonts.ready;

      const allEls = [...document.querySelectorAll('.wrap, .wrap-multi')];
      const paintEl = el => el.classList.contains('wrap-multi') ? paintMulti(el, fills) : paintWrap(el, fills);
      allEls.forEach(paintEl);

      // ResizeObserver with size cache + rAF debounce
      const ro = new ResizeObserver(entries =>
        entries.forEach(e => scheduleRepaint(e.target, fills))
      );
      allEls.forEach(el => ro.observe(el));

      // Deferred verification repaint: in embed iframes (e.g. CodePen),
      // <link> tags in <body> may not trigger font downloads before
      // document.fonts.ready resolves. Wait for any late-loading fonts,
      // then repaint. The size cache is cleared so the repaint isn't skipped.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          setTimeout(() => {
            document.fonts.ready.then(() => {
              allEls.forEach(el => { sizeCache.delete(el); paintEl(el); });
            });
          }, 100);
        });
      }

      return ro;
    },

    /**
     * Paint a single element.
     * @param {Element} el
     * @param {Object} fills
     */
    // Returns a promise that settles when the element is painted.
    paint(el, fills) {
      return el.classList.contains('wrap-multi') ? paintMulti(el, fills) : paintWrap(el, fills);
    },

    /**
     * Register a font for SVG rendering. Use for fonts loaded via JS,
     * cross-origin stylesheets, or CDN-hosted fonts that can't be auto-detected.
     * Call before init().
     * @param {string} family  - Font family name (must match CSS font-family)
     * @param {string} url     - URL to the font file (woff2/woff/ttf)
     * @param {Object} [opts]  - { style: 'normal', weight: '400' }
     */
    registerFont: registerFont,

    /** The named inset widths: { none, light, regular, heavy } as CSS lengths. */
    insetPresets: INSET_PRESETS,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CounterFill;
  else global.CounterFill = CounterFill;

}(typeof window !== 'undefined' ? window : this));
