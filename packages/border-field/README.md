# Border field

[npm](https://www.npmjs.com/package/@jacquesramphal/border-field) · [source](https://github.com/jacquesramphal/packages/tree/main/packages/border-field)

An input whose outline is its state. While you type, the border swells over the letter you're on and follows it. While the form sends, a wave runs round it. When the input is wrong, it goes jagged. When it's sent, the border bursts into a sunburst and confetti made of the line itself.

It's still a real form. The browser's own validation decides what's wrong (`type="email"`, `required`, `pattern`), the label and the message stay as they are, and without JavaScript, or without an `onSubmit`, the form submits the way it always did. The script draws an SVG over the field and redraws it every frame. It has no dependencies and is about 18 KB unminified.

Play with every setting in the [sandbox](https://ramphal.design/lab/expressive-forms/sandbox.html), or see the [lab](https://ramphal.design/lab/expressive-forms/).

## Files

| File | Purpose |
|---|---|
| `border-field.js` | The library |
| `border-field.d.ts` | Types |
| `example.html` | A working form, open it next to `border-field.js` |

## Install

```bash
npm install @jacquesramphal/border-field
```

```js
import BorderField from '@jacquesramphal/border-field';
```

Or without a bundler, load the file directly. It sets `window.BorderField`:

```html
<script src="border-field.js"></script>
```

## Use

Start with a normal form. Put the input in an element the outline will be drawn round (`.box` here), and give the message somewhere to go.

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

Then enhance it:

```js
BorderField.enhance(document.querySelector('form'), {
  onSubmit: (email) => fetch('/subscribe', { method: 'POST', body: new URLSearchParams({ email }) })
    .then((r) => { if (!r.ok) throw new Error(r.statusText); }),
});
```

`onSubmit` gets the value. Resolve and the field shows sent, reject and it shows the error. Leave it out and, once the input is valid, the form submits natively while the border shows loading.

### Styling

The outline takes its colours from two custom properties: `--bf-ink`, which falls back to `currentColor`, and `--bf-danger` for errors. Give the box a plain border so the field looks right before the script runs. The form gets the class `bf-ready` once it has, so the plain border can step aside:

```css
form { --bf-ink: #1f1a17; --bf-danger: #d43a3a; }
.box { border: 3px solid currentColor; border-radius: 16px; }
form.bf-ready .box { border-color: transparent; }
```

The message element gets `data-state` (`error`, `loading` or `sent`), and the form gets `is-shaking` for a moment on an error and `is-popping` on a send, if you want to animate them.

## Options

Pass any of these to `enhance` or `create`. The defaults are in `BorderField.DEFAULTS`.

| Option | Default | What it does |
|---|---|---|
| `typing` | `'follow'` | `follow` (a swell over the caret), `jiggle`, or `ripple` |
| `loading` | `'wave'` | `wave`, or `spinner` (a stroke chasing round the outline) |
| `error` | `'jagged'` | `jagged`, or `pulse` |
| `success` | `'both'` | `sunburst`, `confetti`, or `both` |
| `stroke` | `3` | Line width in px |
| `radius` | `16` | Corner radius in px |
| `focusStroke` | `1.5` | Added to the line while the field has focus, so focus shows without a ring. `0` turns it off |
| `stiffness`, `damping` | `0.14`, `0.18` | How the state shapes spring into place |
| `followAmp`, `followWidth`, `followKick`, `followEase` | `4`, `28`, `5`, `0.2` | The typing swell |
| `waveAmp`, `waveLength`, `waveSpeed` | `10`, `52`, `150` | The loading wave |
| `spinLength`, `spinSpeed` | `0.035`, `0.7` | The spinner's length (share of the outline) and laps a second |
| `jagAmp`, `jagLength`, `shake` | `12`, `22`, `true` | The error teeth |
| `pulseAmp`, `pulseRate` | `10`, `1.4` | The error pulse |
| `rayLength`, `raySpacing`, `confettiSpacing` | `38`, `22`, `14` | The success burst |

`enhance` also takes:

| Option | What it does |
|---|---|
| `onSubmit(value, { form, input, field })` | Send it yourself. Resolve for sent, reject for failed. |
| `messages` | `{ empty, invalid, sending, sent, failed }`. `invalid` left empty uses the browser's own message. |
| `input`, `box`, `message` | Elements, when the defaults don't find the right ones |
| `resetAfter` | Ms after sent before it goes back to rest. `0` stays sent. Default `2600`. |

It returns `{ field, set(state), destroy() }`. `destroy` removes the outline and the listeners and gives the form back its own validation.

## The engine on its own

`BorderField.create(root, options)` is the outline without the form wiring, for when you drive the states yourself:

```js
const field = BorderField.create(document.querySelector('.my-field'));
field.set('loading'); // 'rest' | 'typing' | 'loading' | 'error' | 'sent'
field.focus(true);
field.key(BorderField.caretX(input, box)); // a keystroke at the caret
field.params.waveAmp = 16; // live
```

## Accessibility

- The outline is decoration (`aria-hidden`). Every state also shows in the message, which is a live region, and errors set `aria-invalid` on the input.
- The error shape is a shape, not only a colour, so it reads without red.
- With `prefers-reduced-motion`, nothing moves. The shapes still change, and the bursts show and clear without flying.

## How it works

The outline is a path sampled every 2.5 px round a rounded rectangle. Each frame, every point is pushed out along its normal by whatever the field is doing: a gaussian swell at the caret, a travelling sine for the wave, a triangle wave for the teeth. The state shapes ride springs, so they overshoot and settle. CSS can bend a border's colour, width and radius, but not the line itself, so the drawing is script and the rest is left to CSS.

MIT, by [Jacques Ramphal](https://ramphal.design).
