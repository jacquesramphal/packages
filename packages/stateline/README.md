# Stateline

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

Every option is listed in the [border-field README](https://www.npmjs.com/package/@jacquesramphal/border-field#options) and typed in `stateline.d.ts`.

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

## Licence

MIT © Jacques Ramphal. Use it, change it, ship it. Credit is appreciated, and I'd love to see what you make with it: [ramphal.design](https://ramphal.design).
