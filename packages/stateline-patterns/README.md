# Stateline patterns

Line backgrounds made from [Stateline](../stateline)'s moves, by [Jacques Ramphal](https://ramphal.design).

**Not published yet.** This package is marked private while the patterns settle. The site uses it from the workspace (the featured Labs card on home, the [line patterns lab](https://ramphal.design/lab/line-patterns/) and `/lab/cards`), so it can be tried and reviewed without going to npm. [PUBLISHING.md](PUBLISHING.md) has what's left and how to release it.


The same moves, as backgrounds with no form: the swell, the jag, the wave and the pieces, drawn as loose lines. Squiggling travellers wander with Brownian motion, horizon lines rise into the field and settle back (inspired by Osvaldo Cavandoli's *La Linea*), and they can chase, flee, rub or wrinkle under the pointer. Play with every one in the [lab](https://ramphal.design/lab/line-patterns/).

```js
import StatelinePatterns from '@jacquesramphal/stateline-patterns';

// Fills any element (it adds a canvas behind its content), or draws into a canvas.
const bg = StatelinePatterns.mount(document.querySelector('.hero'), {
  pattern: 'travellers',
  pointer: 'chase',
  clear: 'left',       // keep the left side empty for text
});
bg.set({ pattern: 'horizons' });  // change anything live
bg.destroy();
```

Without a bundler: `<script src="https://cdn.jsdelivr.net/npm/@jacquesramphal/stateline-patterns@0/patterns.js"></script>` sets `window.StatelinePatterns`.

**Smart defaults.** The ink is the element's text colour and follows the theme. The number of lines scales with the area. Under `prefers-reduced-motion` it draws one still frame. It pauses offscreen. Hover effects follow a mouse; on a phone, a tap sends a ripple and pressing and dragging a finger moves the lines, without blocking the page's scroll.

| Pattern | |
|---|---|
| `travellers` | Short squiggles, each a packet of the sending wave, wandering with Brownian motion. The default |
| `school` | Travellers that swim together like fish |
| `horizon` | One line that rises into the field, types, jags, sends, flies apart and settles flat |
| `horizons` | A few of those lines, out of step |
| `islands` | Short lines scattered, each forming its own small field, mixed in height and wavelength |
| `strands` | Long lines wandering across, each taking the states in turn |
| `waves` | Loose lines with a wave travelling along each |
| `pieces` | Strokes that drift, gather into lines and fly apart |
| `contours` | Calm lines that catch the jag in patches |
| `crossings` | A handful of long squiggles crossing loosely on the diagonals, swelling and flattening along their length, gathered away from `clear` |
| `lattice` | Two families of contours crossing at an angle (`angle`, default 30) |
| `patchwork` | A quilt of patches, some contours running across, some down |
| `loops` | Loose rings that swell where an unseen caret passes |

| Option | Default | |
|---|---|---|
| `pattern` | `'travellers'` | One of the above |
| `preset` | | `calm`, `lively`, `fish` (school + avoid), `chase`, `wrinkle`, `beside` (clear the left), `mixed`, `big` |
| `ink` | text colour | Line colour |
| `bg` | transparent | Fill behind the lines |
| `speed` | `1` | |
| `strength` | `1` | Opacity of the lines |
| `density` | `1` | More or fewer lines, on top of the area scaling |
| `stroke` | `2` | Line width in px, the same for every line |
| `scale` | `1` | Size of the moves: height, wavelength and length together |
| `frequency` | `1` | Wavelength only: the same size, tighter above 1, looser below |
| `variance` | `0` | Variety: each squiggle its own height and its own wavelength, from `0` (all alike) to `1` (widely mixed). Lengths and the stroke stay the same. Islands starts at `0.6` |
| `pointer` | `'none'` | `chase` (circle it like fish), `avoid` (part around it), `rub` (squiggle where it moves), `wrinkle` (the error jag around it) |
| `pointerRadius` | `110` | px |
| `pointerOnTouch` | `false` | Hover effects for touch pointers too. Pressing and dragging a finger always moves the lines |
| `ripple` | `true` | A tap or click sends out a ripple that clears the lines |
| `bleed` | `0` | px the drawing runs past the element's edges, where the element doesn't clip |
| `drag` | `'horizontal'` | Finger drags move the lines: `'horizontal'` keeps vertical scrolling, `true` takes every direction (full screen), `false` none |
| `clear` | none | `'left'`, `'right'`, `'top'`, `'bottom'`, or `{ side, size: 0.42, feather: 0.14 }`. `feather: 0` clears with a hard edge and no fade. `edge: 'break'` ends each line where it reaches the side instead, a natural edge with no fade or cut, and `slant` leans it (lattice follows its own angle) |
| `avoid` | none | Flow round shapes: `'text'` (each line of text inside the element), a selector, or elements. Lines bend round them and travellers steer round them. Use with `clear` or on its own |
| `avoidPadding` | `14` | px kept round each shape |
| `avoidStyle` | `'break'` | `'break'`: lines stop at a shape and pick up past it. `'bend'`: they bend round it |
| `angle` | `30` | Lattice: degrees each family leans |
| `still` | `false` | One frame, no animation |
| `time` | `3.2` | Which moment a still shows |

**Stills.** `StatelinePatterns.svg('horizons', { width: 1200, height: 630, ink: '#38211c' })` returns the frame as an SVG string, for a CSS background or a file, and works in Node. Every pattern's still is in the lab's [stills folder](https://ramphal.design/lab/line-patterns/stills/travellers-light.svg).

## Licence

MIT © Jacques Ramphal.
