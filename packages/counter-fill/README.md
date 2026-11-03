# Counter Fill: Colouring the Holes in Your Type

Fills the enclosed counter spaces inside letterforms — the holes in **o, e, a, g, d, b, p** — with a colour, a gradient, or a different colour in each counter, optionally set in from the letter by a ring of background.

Fully generative. Works on any word, any font, any size. No hardcoded letterforms. Real DOM text — accessible, selectable, screen-readable. Fills are drawn as vector paths by default, so they stay sharp at any zoom, with a canvas fallback.

---

## Files

| File | Purpose |
|---|---|
| `counter-fill.js` | The library |
| `index.html` | Working demo of static and variable fonts — open it next to `counter-fill.js` |

---

## Install

```bash
npm install @jacquesramphal/counter-fill
```

```js
import CounterFill from '@jacquesramphal/counter-fill';
```

Or without a bundler, load the file directly; it sets `window.CounterFill`:

```html
<script src="counter-fill.js"></script>
```

It runs in the browser only. It touches `document` when it loads, so in a server-rendered app import it on the client (inside `mounted()` / `useEffect`, or behind a dynamic import).

---

## Usage

Required CSS is injected automatically — no stylesheet needed.

### 1. Load the library

See [Install](#install).

### 2. Mark your elements

Single-line — canvas first (behind text), span.text second (in front):

```html
<h1 class="wrap" id="heading-golden">
  <canvas></canvas>
  <span class="text">Golden</span>
</h1>
```

Multi-line — just write the text, JS splits words automatically:

```html
<h2 class="wrap-multi" id="heading-multi">
  Golden Baroque Obsidian
</h2>
```

### 3. Init with your colours

```js
document.fonts.ready.then(() => {
  CounterFill.init({
    'heading-golden': { stops: ['#f5c842', '#d4820a', '#7a3a08'] },
    'heading-multi':  { cycle: ['#ec9683', '#c48dad', '#be695a'], inset: 'regular' },
  });
});
```

Every option is described under [Fill config](#fill-config).

---

## Framework integration

### Vanilla JS

If the script loads after the DOM exists (e.g. `<script>` at the end of `<body>`), `document.fonts.ready` is all you need — no lifecycle hook required:

```html
<script src="counter-fill.js"></script>
<script>
  document.fonts.ready.then(() => {
    CounterFill.init({
      'my-heading': { stops: ['#f5c842', '#d4820a'] },
    });
  });
</script>
```

---

### Vue

Use `mounted()` — this is Vue's equivalent of "DOM is ready". `document.fonts.ready` is still required inside it.

**Simple case — you control the element in your template:**

```vue
<template>
  <h1 class="wrap" id="my-heading">
    <canvas></canvas>
    <span class="text">Golden</span>
  </h1>
</template>

<script>
import CounterFill from './counter-fill.js';

export default {
  mounted() {
    document.fonts.ready.then(() => {
      CounterFill.init({
        'my-heading': { stops: ['#f5c842', '#d4820a'] },
      });
    });
  },
};
</script>
```

**Edge case — targeting a child component's rendered output:**

If the element is rendered by a child component (you can't add `class`/`id` to it directly), use `$nextTick` to wait for child components to finish rendering:

```js
mounted() {
  this.$nextTick(() => {
    const el = this.$el.querySelector('h1.title');
    if (el) {
      el.id = 'my-heading';
      el.classList.add('wrap-multi');
      document.fonts.ready.then(() => {
        CounterFill.init({
          'my-heading': { stops: ['#f5c842', '#d4820a'] },
        });
      });
    }
  });
},
```

`$nextTick` is only needed in this case. If you control the element in your own template, skip it.

---

### React

Use `useEffect` with an empty dependency array — this runs after the first render, equivalent to `mounted()`:

```jsx
import { useEffect } from 'react';
import CounterFill from './counter-fill.js';

export default function Heading() {
  useEffect(() => {
    document.fonts.ready.then(() => {
      CounterFill.init({
        'my-heading': { stops: ['#f5c842', '#d4820a'] },
      });
    });
  }, []);

  return (
    <h1 className="wrap" id="my-heading">
      <canvas></canvas>
      <span className="text">Golden</span>
    </h1>
  );
}
```

---

## Fill config

Each entry in `FILLS` is keyed by the element's `id`. Every option is optional
and they combine freely.

| Option  | Type                 | What it does |
|---------|----------------------|--------------|
| `stops` | `string[]`           | One colour fills every counter. Two or more become a radial gradient across the word, from the inside out. |
| `cycle` | `string[]`           | Instead of one fill, hand the colours to the counters one at a time, left to right. On multi-line text the cycle carries on from word to word. Takes precedence over `stops`. |
| `inset` | `string` or `number` | Pull each fill back from its letter, leaving a ring of background between stroke and colour. Use a preset, `'none'`, `'light'`, `'regular'` or `'heavy'` (below), or your own width: a number is CSS pixels (`4`), and a string is any CSS length resolved against the element (`'0.03em'`, `'max(3px, 0.045em)'`, `calc()`). `'var(--counter-inset)'` reads a custom property, which can hold a preset name or a length, so the width can live in your stylesheet. The ring edge is antialiased. |
| `insetMin` | `number` | A floor for an `em` inset, in CSS pixels. On small text an em ring can get too thin to see; `inset: '0.03em', insetMin: 2.5` scales with the type but never drops below 2.5px. |
| `insetColor` | `string` | Vector mode: the ring's colour. Defaults to the first solid background behind the element. Any CSS colour works, `var()` included, and it stays live, so `insetColor: 'var(--background)'` follows a theme switch with no repaint. Without a solid background (an image or gradient behind the text), the ring is cut with an SVG mask instead. |
| `vector` | `boolean` | On by default. The fills are drawn as SVG paths, so they stay sharp at any zoom (pinch zoom, print). Each counter's edge is traced from the letter's antialiased raster and smoothed into curves; no font data needed. If a counter can't be traced, or SVG isn't available, that word falls back to the canvas fill on its own. Fill colours are set as CSS, so `var()` colours follow a theme switch with no repaint. Each painted element gets `data-cf-mode="vector"` or `"canvas"`. Set `false` to always use the canvas. |

Colours can be anything CSS accepts, and CSS custom properties are resolved at
paint time, so design tokens work directly.

```js
CounterFill.init({
  // Solid fill
  'my-word':   { stops: ['#f5c842'] },
  // Gradient
  'my-word-2': { stops: ['#ff6060', '#c01020', '#600010'] },
  // Design tokens
  'my-word-3': { stops: ['var(--color-accent)'] },
  // A different colour in each counter
  'my-word-4': { cycle: ['#ec9683', '#c48dad', '#be695a'] },
  // Any fill, inset from its strokes
  'my-word-5': { stops: ['#f5c842'], inset: 4 },
  'my-word-6': { cycle: ['var(--color-a)', 'var(--color-b)'], inset: '0.03em' },
  // Width from the stylesheet: #my-word-7 { --counter-inset: heavy; }
  'my-word-7': { stops: ['currentColor'], inset: 'var(--counter-inset)' },
});
```

### Inset presets

Each one scales with the type and has a floor, so small text keeps an open ring.

| Preset | Width | Feels like |
|---|---|---|
| `none` | `0px` | No ring: the fill meets the stroke (the default when `inset` is left out). Overrides `insetMin` |
| `light` | `max(2.5px, 0.03em)` | A hairline; quiet at display sizes |
| `regular` | `max(3px, 0.045em)` | A clear inline outline |
| `heavy` | `max(3.5px, 0.06em)` | A bold inline; strongest at large sizes |

```js
CounterFill.init({ 'my-heading': { stops: ['currentColor'], inset: 'regular' } });

// or from CSS:  #my-heading { --counter-inset: heavy; }
CounterFill.init({ 'my-heading': { stops: ['currentColor'], inset: 'var(--counter-inset)' } });

CounterFill.insetPresets; // { none, light, regular, heavy } as CSS lengths
```

### Why inset

Without it, the fill runs right up to the stroke (it is grown slightly under
the letter, so no seam shows). That's ideal when the fill contrasts with the
text. When it doesn't, for example pastel fills inside white letters on a dark
background, stroke and fill blur into one shape. A ring of background between
them keeps the letter's edge on any colour.

---

## API

```js
// Paint all .wrap and .wrap-multi elements and start a resize observer,
// which repaints when an element's size changes. Async: resolves to the
// observer once fonts are detected and the first paint has started.
const ro = await CounterFill.init(FILLS);

// Paint one element (e.g. after its text changes). Returns a promise that
// settles when the element is painted.
await CounterFill.paint(document.getElementById('my-word'), FILLS);

// The named inset widths: { none, light, regular, heavy } as CSS lengths.
CounterFill.insetPresets;

// Register a font for SVG rendering (call before init)
// Use for fonts loaded via JS, cross-origin, or CDN-hosted
await CounterFill.registerFont('My Font', '/fonts/my-font.woff2');
await CounterFill.registerFont('My Font', '/fonts/my-font-italic.woff2', { style: 'italic', weight: '700' });
```

---

## Full example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&display=swap" rel="stylesheet">
  <style>
    /* YOUR styles — nothing here is required by counter-fill */
    body { background: #0e0e0e; display: flex; flex-direction: column; align-items: center; gap: 64px; padding: 80px 32px; }
    .heading { font-family: 'Playfair Display', serif; font-size: clamp(64px, 15vw, 140px); font-weight: 900; color: #f0ece4; }
  </style>
</head>
<body>

  <!-- REQUIRED: class="wrap" + unique id + <canvas> + <span class="text"> -->
  <h1 class="wrap heading" id="w1">
    <canvas></canvas>
    <span class="text">Golden</span>
  </h1>

  <!-- Repeat the same structure for each word -->
  <h1 class="wrap heading" id="w2">
    <canvas></canvas>
    <span class="text">Aperture</span>
  </h1>

  <!-- MULTI-LINE: class="wrap-multi" + unique id — just write the text, no inner markup needed -->
  <h2 class="wrap-multi heading" id="wm">Golden Baroque Obsidian</h2>

  <!-- REQUIRED: load the library -->
  <script src="counter-fill.js"></script>
  <script>
    // REQUIRED: wait for fonts, then init with your colours keyed by element id
    document.fonts.ready.then(() => CounterFill.init({
      w1: { stops: ['#f5c842', '#d4820a', '#7a3a08'] }, // YOUR colours
      w2: { stops: ['#e05c5c', '#a01830', '#4a0010'] }, // YOUR colours
      wm: { stops: ['#f5c842', '#d4820a'] },            // multi-line — same config, JS handles the rest
    }));
  </script>
</body>
</html>
```

---

## Links

- [GitHub](https://github.com/jacquesramphal/jacquesramphal.github.io/tree/main/packages/counter-fill)
- [npm](https://www.npmjs.com/package/@jacquesramphal/counter-fill)

---

## How it works

1. Text is drawn onto a canvas at its exact DOM position (measured via a CSS `vertical-align:baseline` probe)
2. A flood fill from every canvas edge marks all *outside* transparent pixels
3. Any unmarked transparent pixel is enclosed — a counter. Wide flat strips (the gap between tight lines of text) are dropped, and the rest are labelled left to right
4. **Vector (default):** each counter's edge is traced at the 50% coverage line of the letter's antialiased raster (marching squares), evened out and smoothed into curves, and drawn as an SVG path. An inset is the same path stroked in the background colour on top of the fill: the stroke's outer half is hidden under the letter and its inner half is the ring. Plain paths stay sharp under pinch zoom (Safari draws a masked group as an image and enlarges it), so a mask is only used when there's no solid background to paint with
5. **Canvas (fallback, or `vector: false`):** counter pixels are grown 2px under the strokes to close antialiasing gaps; an inset is cut with a Euclidean distance field, which gives the ring an antialiased edge
6. The fill layer sits behind the real text via `z-index` — the text renders on top and covers any bleed

If the vector trace can't account for every counter on a word, or SVG isn't available, or it throws, that word is painted with the canvas instead. The SVG is built in full before anything on the page changes, so a failure never leaves a word blank.

---

## Notes

- `letter-spacing` is supported — canvas picks it up from computed style
- DPR-aware — renders at full resolution on retina screens
- Real text node untouched — accessible, selectable, screen-readable
- Multi-line mode gives each word its own layer — counters follow their word when text wraps. A no-break space (`&nbsp;`) keeps two words together, and a link followed by punctuation (`work,`) wraps as one piece
- A `cycle` carries on across the words of a multi-line heading rather than restarting on each word
- CSS variables in `stops`, `cycle` and `inset` are resolved at paint time — design tokens work directly
- Vector is no slower than the canvas: painting 22 display words took 0.7–0.8s against 0.9s on desktop, because the canvas inset's distance field is the expensive step
- Resize is debounced via double `requestAnimationFrame` with a size cache to skip unchanged repaints
- Font must be loaded before init — wrap in `document.fonts.ready.then(...)`

---

## Font sources

Fonts are auto-detected from two sources:

| Source | Auto-detected? | Notes |
|---|---|---|
| Google Fonts `<link>` | Yes | CSS is fetched, font URLs extracted and cached |
| Same-origin `@font-face` | Yes | Read from CSSOM at init time |
| Cross-origin `@font-face` | No | CORS blocks reading stylesheet rules — use `registerFont()` |
| System / local fonts | No | Not fetchable — uses canvas fallback (static fonts work well) |
| Fonts loaded via JS (`new FontFace()`) | No | Not in any stylesheet — use `registerFont()` |

For fonts that can't be auto-detected, register them before calling `init()`:

```js
// Register a CDN-hosted variable font
await CounterFill.registerFont('Inter', 'https://cdn.example.com/inter-variable.woff2');

// Register specific style/weight variants of a static font
await CounterFill.registerFont('Merriweather', '/fonts/merriweather-bold.woff2', { weight: '700' });
await CounterFill.registerFont('Merriweather', '/fonts/merriweather-bold-italic.woff2', { style: 'italic', weight: '700' });

// Then init as usual
document.fonts.ready.then(() => CounterFill.init({ ... }));
```

---

## Variable font support

Three rendering paths, selected automatically via feature detection:

1. **SVG embedded-font** (best) — font is base64-encoded into an SVG `<text>` element drawn to canvas. Supports all axes (`wght`, `wdth`, `opsz`, `SOFT`, custom axes). Used when the font is in the cache (auto-detected or registered).

2. **`ctx.fontVariationSettings`** (Chrome 134+) — native canvas support for all axes. Feature-detected automatically.

3. **Canvas fallback** — `wght` via font-weight, `wdth` via font-stretch keywords with width-scaling correction, probe-canvas drift correction for static fonts. Used when SVG and FVS are unavailable.

### Safari notes

Safari's SVG engine partially applies `font-variation-settings` — standard axes (`wght`, `wdth`) work via their CSS property equivalents, but custom axes (`SOFT`, `GRAD`, etc.) may not be fully applied. Counter fills on Safari use `textLength` for alignment and increased dilation to compensate for glyph shape differences. Results are good but not pixel-identical to Chrome.

---

## Known gaps

> Update later: these are tracked for future improvement.

- **Safari custom axes** — Custom font-variation-settings axes (e.g. `SOFT`, `GRAD`) may not render pixel-perfect in Safari's SVG engine. Fills use increased dilation to compensate but may appear slightly smaller than on Chrome.
- **Cross-origin fonts without registration** — Fonts loaded from cross-origin stylesheets (e.g. CDN `<link>` without CORS headers on the stylesheet) can't be auto-detected. Use `registerFont()` as a workaround.
- **System fonts with variable axes** — Local/system variable fonts can't be fetched for SVG embedding. They fall back to the canvas path, which doesn't support custom axes.
- **Google Fonts subset selection** — Auto-detection picks the last `@font-face` block per family/style/weight (typically latin). Fonts using non-latin characters may load the wrong subset.

---

## Browser support

| | |
|---|---|
| Canvas 2D | All modern browsers |
| SVG paths and masks (vector fill) | All modern browsers |
| SVG embedded-font path | All modern browsers (best variable font support) |
| `ctx.fontVariationSettings` | Chrome 134+ (March 2025) |
| `ctx.letterSpacing` | Chrome 99+, Firefox 116+, Safari 17.2+ |
| `ResizeObserver` | Chrome 64+, Firefox 69+, Safari 13.1+ |

---

## Changelog

0.2.0 to 0.7.1 were built in the site repo and reach npm together as 0.8.0.

**0.8.0** — Vector rings are painted strokes instead of a mask, so they stay sharp under Safari's pinch zoom; a mask is the fallback when there's no solid background. `insetColor`. Vector fill and ring colours stay live as CSS, so `var()` colours follow a theme switch. `data-cf-mode` on each painted element. Carries the fixes published in 0.1.2 and 0.1.3: the variable-font check no longer gives false negatives before a font loads, font downloads retry once, and `init()` repaints once late-loading fonts arrive (embed iframes such as CodePen).

**0.7.1** — `inset: 'none'` preset: no ring, overriding `insetMin`, and usable in a custom property to switch the ring off from CSS.

**0.7.0** — `inset` presets: `'light'`, `'regular'`, `'heavy'`. A lone `var()` in `inset` is read off the element, so a custom property can hold a preset name or a length. `CounterFill.insetPresets`.

**0.6.0** — `inset` accepts any CSS length, resolved against the element: `em`, `var()`, `max()`, `calc()`.

**0.5.0** — Vector fill on by default, with a per-word canvas fallback.

**0.4.0** — `insetMin`, a floor for an `em` inset.

**0.3.0** — `vector` option (opt-in): fills drawn as SVG paths. `paint()` returns a promise.

**0.2.0** — `inset` works with any fill and has an antialiased edge. `cycle` carries on across words in multi-line text.

**0.1.1–0.1.3** — Embed iframe repaint, font fetch retry, simpler variable-font check.

**0.1.0** — First release: `stops`, multi-line text, variable fonts.
