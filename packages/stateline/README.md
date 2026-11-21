# Stateline

[npm](https://www.npmjs.com/package/@jacquesramphal/stateline) · [source](https://github.com/jacquesramphal/packages/tree/main/packages/stateline)

Form fields whose border is their state, by [Jacques Ramphal](https://ramphal.design).

While you type, the border follows the caret, and when the address is wrong it goes jagged and trembles. While it sends a wave circles it, and once it's sent the outline flies apart round a check. If the domain looks like a typo it asks "Did you mean you@gmail.com?" before it sends. The checkbox squashes when you press it and draws its tick in.

Every element enhances a real one. The native input stays in the page, so keyboards, screen readers, autofill and plain form submission keep working. Take the script away and it's an ordinary form.

It came out of an essay, [Make it pop](https://ramphal.design/doc/make-it-pop), about what that note from a client actually asks for. You can try every setting in the [sandbox](https://ramphal.design/lab/field).

**Try it:** the [Storybook docs](https://ramphal.design/storybook/?path=/docs/stateline-npm-field--docs) use the published Vue component with a control for every prop, and the [CodePen starter](https://ramphal.design/lab/stateline/pen.html) opens a pen that loads this package from npm.

## Install

```bash
npm install @jacquesramphal/stateline
```

```js
import Stateline from '@jacquesramphal/stateline';
```

It brings [`@jacquesramphal/border-field`](https://www.npmjs.com/package/@jacquesramphal/border-field) with it, which draws the outline. There are no other dependencies.

Without a bundler, load both files. Pin the version so a release doesn't change your page:

```html
<script src="https://cdn.jsdelivr.net/npm/@jacquesramphal/border-field@0.2.0/border-field.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@jacquesramphal/stateline@0.1.0/stateline.js"></script>
<!-- window.Stateline -->
```

### CodePen

Paste this into a pen's HTML. It loads the published package from jsDelivr, so the pen runs exactly what npm ships, and `@0` picks up every 0.x release:

```html
<form>
  <label for="email">Email address</label>
  <div class="box"><input id="email" type="email" required aria-describedby="msg" /><button>Subscribe</button></div>
  <p id="msg" role="status" aria-live="polite"></p>
</form>
<script src="https://cdn.jsdelivr.net/npm/@jacquesramphal/border-field@0/border-field.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@jacquesramphal/stateline@0/stateline.js"></script>
<script>Stateline.field(document.querySelector('form'), { onSubmit: () => new Promise((r) => setTimeout(r, 1200)) });</script>
```

## The field

Start with a normal form. The outline is drawn round `.box`, and messages go to the element the input's `aria-describedby` points at.

```html
<form action="/subscribe" method="post">
  <label for="email">Email address</label>
  <div class="box">
    <input id="email" name="email" type="email" required aria-describedby="email-msg" />
    <button type="submit">Subscribe</button>
  </div>
  <p id="email-msg" role="status" aria-live="polite"></p>
</form>
```

```js
Stateline.field(document.querySelector('form'), {
  onSubmit: (email) => fetch('/subscribe', { method: 'POST', body: new URLSearchParams({ email }) })
    .then((r) => { if (!r.ok) throw new Error(r.statusText); }),
});
```

When `onSubmit` resolves, the field shows sent. When it rejects, it shows the error. Leave it out and, once the input is valid, the form submits the way it always did.

The defaults are the look from the essay. The swell follows the caret. A wrong address lands as a hand-drawn red jag that swells, settles and stays red while it's fixed. The send circles the field, and sent flies the outline apart. They're in `Stateline.DEFAULTS`, any option overrides one, and `look: 'plain'` starts from border-field's own defaults instead.

"Did you mean" is on by default. The first send stops and asks, clicking the suggestion fixes the address, and sending again as typed goes through. Nothing is flagged while someone is still typing. It's plain string distance against a list of common domains. Pass your own function as `suggest`, or `suggest: false` to turn it off.

Give the box a plain border so the field looks right before the script loads. The form gets `bf-ready` once the outline takes over:

```css
form { --bf-ink: currentColor; --bf-danger: #d43a3a; }
.box { border: 2px solid currentColor; border-radius: 8px; }
form.bf-ready .box { border-color: transparent; }
```

Every option is in [Options](#options) below, with its range and default, and typed in `stateline.d.ts`. You can try them all in the [Storybook controls](https://ramphal.design/storybook/?path=/docs/stateline-npm-field--docs) or the [field lab](https://ramphal.design/lab/field).

## The checkbox

```html
<label><input type="checkbox" name="topics" value="essays" data-stateline /> Essays</label>
<label><input type="checkbox" name="human" required data-stateline /> I'm a person, not a bot</label>
```

```js
const boxes = Stateline.enhance(form);    // every [data-stateline] checkbox inside form
// or one at a time
const box = Stateline.checkbox(input, { size: 24, line: 2 });
box.set('error');                         // the jagged red box
box.destroy();                            // the native checkbox, as it was
```

A required box left empty goes jagged and red when the form is sent, the same as the field.

## Vue and React

Same install, nothing else to add. Each framework gets ready-made components with the essay's look, and Vue and React stay optional: you only need the one you use.

### Vue 3

```vue
<script setup>
import { ref } from 'vue';
import { StatelineField, StatelineCheckbox } from '@jacquesramphal/stateline/vue';

const email = ref('');
const human = ref(false);
const send = (email) => fetch('/subscribe', { method: 'POST', body: new URLSearchParams({ email }) });
</script>

<template>
  <StatelineField v-model="email" :on-submit="send" hint="New essays by email." />
  <StatelineCheckbox v-model="human" required>I'm a person, not a bot</StatelineCheckbox>
</template>
```

### React 17+

```jsx
import { useState } from 'react';
import { StatelineField, StatelineCheckbox } from '@jacquesramphal/stateline/react';

export function Subscribe() {
  const [human, setHuman] = useState(false);
  const send = (email) => fetch('/subscribe', { method: 'POST', body: new URLSearchParams({ email }) });
  return (
    <>
      <StatelineField onSubmit={send} hint="New essays by email." />
      <StatelineCheckbox checked={human} onCheckedChange={setHuman} required>I'm a person, not a bot</StatelineCheckbox>
    </>
  );
}
```

They work with server rendering (Next, Nuxt) and enhance once they're in the browser. The React file is marked `'use client'`.

### Field props

| Vue | React | Default | |
|---|---|---|---|
| `v-model` | `value` + `onValueChange` (or `defaultValue`) | `''` | The address. A send clears it |
| `@state` | `onStateChange` | | `rest`, `typing`, `loading`, `error` or `sent` |
| `on-submit` | `onSubmit` | none | `(value) => Promise`. Resolve for sent, reject for the error. Without it the form submits natively |
| `label` | `label` | `'Email address'` | |
| `name`, `type`, `placeholder` | same | `'email'`, `'email'`, `'you@example.com'` | |
| `autocomplete` | `autoComplete` | `'email'` | |
| `required`, `disabled` | same | `true`, `false` | |
| `button-label` | `buttonLabel` | `'Subscribe'` | The button's accessible name, or its text when `arrow` is false |
| `arrow` | `arrow` | `true` | An arrow icon in the button |
| `hint` | `hint` | `''` | A line under the field |
| `action`, `method` | same | none, `'post'` | For a native submit |
| `messages` | `messages` | | `{ empty, invalid, sending, sent, failed }` |
| `suggest` | `suggest` | `true` | "Did you mean", or your own function |
| `look` | `look` | `'essay'` | `'plain'` for border-field's own defaults |
| `options` | `options` | `{}` | Any border-field option: `typing`, `error`, `loading`, `success`, `stroke`, `radius`… |
| `unstyled` | `unstyled` | `false` | Skip the default styles |
| | `className` | | |

A ref gives you `set(state)` to show a state yourself.

### Checkbox props

| Vue | React | Default | |
|---|---|---|---|
| `v-model` | `checked` + `onCheckedChange` (or `defaultChecked`) | `false` | Changing it from outside plays the tick or the rub-out |
| default slot or `label` | `children` or `label` | | |
| `id`, `name`, `value` | same | auto, none, `'on'` | |
| `required`, `disabled` | same | `false` | Required and empty on send, it jags red |
| `state` | `state` | `'rest'` | `'error'` shows the jagged box |
| `size`, `line` | same | `24`, `2` | Box and line in px |
| `unstyled` | `unstyled` | `false` | |

### Plain HTML with the same look

The components render this markup. Write it yourself, call `Stateline.addStyles()`, and you get the same field without a framework:

```html
<form class="stateline-field">
  <label class="stateline-field__label" for="email">Email address</label>
  <div class="stateline-box">
    <input class="stateline-field__input" id="email" type="email" required aria-describedby="email-msg" />
    <button class="stateline-field__send" type="submit">Subscribe</button>
  </div>
  <div class="stateline-field__help">
    <div class="stateline-field__message" id="email-msg" role="status" aria-live="polite"></div>
    <div class="stateline-field__hint">New essays by email. Unsubscribe anytime.</div>
  </div>
</form>
```

## Options

Pass any of these to `Stateline.field(form, { … })`, or as `options` to the Vue and React components. **Default** is the essay's look (`Stateline.DEFAULTS`). **Plain** is where `look: 'plain'` differs, which is border-field's own default. The ranges are the field lab's; values outside them work but haven't been tuned.

#### Behaviour

| Option | Default | |
|---|---|---|
| `onSubmit` | none | `(value, { form, input, field }) => Promise`. Resolve for sent, reject for the error. Without it the form submits natively once it's valid. |
| `suggest` | `true` | "Did you mean" on send. `false` turns it off, or pass `(value) => ({ address, local, domain }) \| null`. |
| `look` | `'essay'` | `'plain'` starts from border-field's defaults instead of the essay's. |
| `messages` | | `{ empty, invalid, sending, sent, failed }`. `invalid: ''` uses the browser's own message. |
| `onState` | none | `(state) => void` on every change: `rest`, `typing`, `loading`, `error`, `sent`. |
| `resetAfter` | `2600` | ms after sent before it goes back to rest. `0` stays sent. |
| `input`, `box`, `message` | found in the form | The input to watch, the element the outline is drawn round, where messages go. |

<!-- options:start (generated by pnpm stateline:docs) -->

#### Typing

| Option | Values | Default | Plain | |
|---|---|---|---|---|
| `typing` | `follow` · `jiggle` · `ripple` · `wave` · `cloud` | `'follow'` |  | What the line does as you type. follow: a swell rides the caret. wave: a ripple that runs forward. cloud: bumps all round. |
| `followAmp` | 0 to 14 | `4` |  | Height of the swell over the caret, px. |
| `followWidth` | 8 to 80 | `28` |  | Width of the swell, px. |
| `followKick` | 0 to 20 | `5` |  | Extra push each keystroke gives the swell, px. |
| `followEase` | 0.03 to 1 | `0.2` |  | How quickly the swell catches the caret. 1 is instant. |
| `jiggleKick` | 0 to 14 | `5` |  | jiggle: how hard each keystroke shakes the line, px. |
| `rippleAmp` | 0 to 24 | `11` |  | ripple and wave: height of each ripple, px. |
| `rippleSpeed` | 60 to 900 | `320` |  | ripple and wave: how fast ripples travel, px/s. |
| `rippleWay` | `both` · `forward` | `'both'` |  | ripple: spread both ways from the caret, or only forward (what wave does). |
| `cloudSize` | 10 to 80 | `34` |  | cloud: width of each bump, px. |
| `cloudAmp` | 0 to 10 | `3.2` |  | cloud: height of the bumps at rest, px. |
| `cloudKick` | 0 to 10 | `2.6` |  | cloud: extra puff each keystroke gives, px. |

#### Sending

| Option | Values | Default | Plain | |
|---|---|---|---|---|
| `loading` | `orbit` · `wave` · `spinner` | `'orbit'` | `'wave'` | What the line does while it sends. orbit: one wave circles the field. |
| `waveAmp` | 0 to 24 | `6` | `10` | Height of the sending wave, px. |
| `waveLength` | 12 to 160 | `22` | `52` | Length of one wave, px. |
| `waveSpeed` | 0 to 600 | `150` |  | wave: how fast it travels, px/s. |
| `orbitPacket` | 0.05 to 1 | `0.32` |  | orbit: share of the outline the wave covers, 0 to 1. |
| `orbitLap` | 0.3 to 4 | `1.15` |  | orbit: seconds per lap. |
| `spinLength` | 0.01 to 0.15 | `0.035` |  | spinner: share of the outline the stroke covers. |
| `spinSpeed` | 0.1 to 2.5 | `0.7` |  | spinner: laps a second. |

#### Error

| Option | Values | Default | Plain | |
|---|---|---|---|---|
| `error` | `drawn` · `jagged` · `spring` · `pulse` | `'drawn'` | `'jagged'` | How a wrong value lands. drawn: a hand-drawn jag that hits and settles smaller. spring: overshoots and settles. |
| `jagAmp` | 0 to 24 | `12` |  | jagged and spring: height of the teeth, px. |
| `jagLength` | 6 to 80 | `18` | `22` | Distance between teeth, px. |
| `drawnHit` | 0 to 24 | `9` | `13` | drawn: teeth height as the error lands, px. |
| `drawnRest` | 0 to 16 | `4.5` | `6` | drawn: teeth height once it settles, px. |
| `drawnSettle` | 0.1 to 2 | `0.7` |  | drawn: seconds from hit to settled. |
| `springRate` | 4 to 60 | `24` |  | spring: how fast the teeth spring. |
| `springBounce` | 0 to 0.9 | `0.32` |  | spring: how much they overshoot. |
| `pulseAmp` | 0 to 24 | `10` |  | pulse: how far the line pulses out, px. |
| `pulseRate` | 0.2 to 5 | `1.4` |  | pulse: pulses a second. |
| `errorBounce` | 0 to 20 | `7` |  | How far the whole border swells when an error lands, then springs back, px. |
| `soften` | boolean | `true` | `false` | Editing after an error drops the teeth but keeps the line red until the value is valid. |
| `shake` | boolean | `false` | `true` | Shake the form when an error lands. |

#### Sent

| Option | Values | Default | Plain | |
|---|---|---|---|---|
| `success` | `pieces` · `ticks` · `both` · `sunburst` · `confetti` | `'pieces'` | `'both'` | What happens once it's sent. pieces: the outline flies apart and draws back. ticks: it turns into ticks and closes. both: sunburst and confetti. |
| `pieceLength` | 8 to 50 | `20` |  | pieces: length of each piece, px. |
| `flyFar` | 0 to 90 | `34` |  | pieces: how far they fly out, px. |
| `fall` | 0 to 60 | `16` |  | pieces: how far they drop, px. |
| `spin` | 0 to 720 | `260` |  | pieces: degrees each one turns. |
| `flyTime` | 0.4 to 2.5 | `1.1` |  | pieces: seconds in the air. |
| `redrawAt` | 0.3 to 2.5 | `0.95` |  | pieces: when the outline starts drawing back. |
| `ticksHold` | 0.2 to 3 | `0.9` |  | ticks: seconds the ticks hold before closing. |
| `ticksDrift` | 0 to 30 | `10` |  | ticks: how far they drift, px. |
| `rayLength` | 6 to 90 | `38` |  | sunburst: length of each ray, px. |
| `raySpacing` | 8 to 80 | `22` |  | sunburst: distance between rays, px. |
| `confettiSpacing` | 6 to 60 | `14` |  | confetti: distance between pieces, px. |
| `settle` | 0 to 8 | `0` |  | How far the outline breathes out and back once it's whole again, px. |

#### The line

| Option | Values | Default | Plain | |
|---|---|---|---|---|
| `stroke` | 1 to 8 | `2` | `3` | Line width, px. |
| `radius` | 0 to 34 | `8` | `16` | Corner radius, px. |
| `focusStroke` | 0 to 4 | `0` | `1.5` | Added to the line width while the field has focus, px. 0 turns it off. |
| `uniformity` | 0 to 1 | `0` | `1` | 1: every tooth, bump and piece alike. 0: hand-drawn. |

#### Transitions

| Option | Values | Default | Plain | |
|---|---|---|---|---|
| `handoff` | 0 to 0.8 | `0.22` |  | Roughly how long the last state's shape takes to spring away. |
| `handoffBounce` | 0 to 0.8 | `0.3` |  | How much it overshoots on the way out. |
| `stateDelay` | 0 to 0.4 | `0.08` |  | A beat before a new state starts. |
| `stiffness` | 0.02 to 0.5 | `0.14` |  | How hard the state shapes pull toward their target. |
| `damping` | 0.02 to 0.6 | `0.18` |  | How quickly they stop wobbling. |

<!-- options:end -->

## Patterns

The same moves, as backgrounds with no form: the swell, the jag, the wave and the pieces, drawn as loose lines. Squiggling travellers wander with Brownian motion, horizon lines rise into the field and settle back (inspired by Osvaldo Cavandoli's *La Linea*), and they can chase, flee, rub or wrinkle under the pointer. Play with every one in the [lab](https://ramphal.design/lab/line-patterns/).

```js
import StatelinePatterns from '@jacquesramphal/stateline/patterns';

// Fills any element (it adds a canvas behind its content), or draws into a canvas.
const bg = StatelinePatterns.mount(document.querySelector('.hero'), {
  pattern: 'travellers',
  pointer: 'chase',
  clear: 'left',       // keep the left side empty for text
});
bg.set({ pattern: 'horizons' });  // change anything live
bg.destroy();
```

Without a bundler: `<script src="https://cdn.jsdelivr.net/npm/@jacquesramphal/stateline@0/patterns.js"></script>` sets `window.StatelinePatterns`.

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

## Limitations

- **Text-like inputs only, for the field.** Email, text, search, url, tel, password and textarea. Selects, radios, ranges and dates aren't drawn yet.
- **One field per form.** `field()` watches one input. A form with several fields needs one `field()` per wrapper, and the send logic is yours.
- **It needs a box.** The outline is drawn round `.box`, `options.box`, or the whole form. The input can't hold the SVG itself.
- **"Did you mean" knows common domains.** Gmail, Outlook, iCloud, Yahoo, Proton, the big Canadian ISPs and a few more. A company domain is never second-guessed, which is deliberate.
- **The browser's validation decides what's wrong.** `type="email"`, `required` and `pattern`. Custom rules go in your `onSubmit`: reject and the field shows the error.
- **A browser, not a server.** The plain functions touch `document`, so call them after mount. The Vue and React components already do.
- **Stateline adds to the markup.** An SVG inside the box, and a span round each checkbox. The components handle that. If you wrap it yourself, enhance once on mount and `destroy()` on unmount.

## Rules every element follows

- **A real element underneath.** Enhance, never replace.
- **Judge late, reward early.** Nothing goes red while you type. Errors land on send or when you leave the field, and valid input can be acknowledged straight away.
- **Ask before scolding.** A likely typo gets a question in the ink, not an error in red.
- **The page's colours.** `currentColor` for the ink, and `--stateline-danger` (`--bf-danger` for the field) for an error.
- **Motion is optional.** Under `prefers-reduced-motion` everything settles at once.

## API

| | |
|---|---|
| `field(form, options)` | The border field. Returns `{ field, set(state), destroy() }`. |
| `checkbox(input, options)` | A checkbox that draws its tick. Returns `{ input, set(state), destroy() }`. |
| `enhance(root)` | Enhances every `input[type=checkbox][data-stateline]` inside `root`. |
| `suggestEmail(value)` | `{ address, local, domain }` for a likely typo in the domain, or `null`. |
| `addStyles()` | The default look for the `.stateline-field` markup. |
| `DEFAULTS` | The essay's look, which `field()` starts from. |

Next, in the same language: a radio whose dot rolls to the new option, a toggle whose knob squashes as it travels, a select whose outline hands over to the open list, and a textarea.

## Origin

I designed and built Stateline, and first showed it in November 2026. It grew out of [border-field](https://www.npmjs.com/package/@jacquesramphal/border-field) and the essay [Make it pop](https://ramphal.design/doc/make-it-pop), and both packages were first published to npm on 19 November 2026. If you write about it or build on the idea, a link back to the essay is the credit I'd most like. To cite it, use [CITATION.cff](CITATION.cff).

## Licence

MIT © Jacques Ramphal. Use it, change it, ship it. Credit is appreciated, and I'd love to see what you make with it: [ramphal.design](https://ramphal.design).
