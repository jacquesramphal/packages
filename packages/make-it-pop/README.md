# make-it-pop (draft)

Standard form elements with some life in them, one per post in the *Make it
pop* series. Each element **enhances a real one**: the native input stays in
the page, so keyboards, screen readers, autofill and plain form submission
keep working, and the form still works with the script taken away.

`private: true` until there's enough here to publish.

## What's in it

| | What it does | Status |
|---|---|---|
| `field(form, options)` | The border field: the outline follows the caret, goes jagged when it's wrong, circles while it sends, flies apart when it's sent. Wraps `@jacquesramphal/border-field`. | Shipped on the site |
| `suggestEmail(value)` | "Did you mean …@gmail.com?" for a likely typo in the domain, for asking on send. String distance, no AI. | Draft (also `src/utils/emailSuggest.js`) |
| `checkbox(input, options)` | A hand-drawn box. Checking squashes it, springs it back and draws the tick in with sparks; unchecking rubs it out; a required box left empty jags in red, like the field. | Draft |
| `enhance(root)` | Enhances every `[data-pop]` element inside `root`. | Draft |

Next, in the same language: radio (the dot rolls to the new option), toggle
(the knob squashes as it travels), select (the outline hands over to the
open list), textarea (the field, taller).

## Rules every element follows

- **A real element underneath.** Enhance, never replace.
- **Judge late, reward early.** Nothing goes red while you type. Errors land
  on send or when you leave; valid input can be acknowledged at once.
- **Ask before scolding.** A likely typo gets a question in the ink, not an
  error in red.
- **The page's colours.** `currentColor` for the ink, `--pop-danger` (and the
  field's `--bf-danger`) for an error.
- **Motion is optional.** Everything settles instantly under
  `prefers-reduced-motion`.

## Trying it

Open `example.html` (it loads `../border-field/border-field.js` and
`make-it-pop.js` straight from this folder) with any static server, or the
playground Artifact published from it. Pinned to a commit, the same files load
in CodePen from jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/gh/jacquesramphal/jacquesramphal.github.io@<commit>/packages/border-field/border-field.js"></script>
<script src="https://cdn.jsdelivr.net/gh/jacquesramphal/jacquesramphal.github.io@<commit>/packages/make-it-pop/make-it-pop.js"></script>
```

## Still to decide

- Whether `border-field` folds into this package or stays its own.
- Web Components (`<pop-checkbox>`) on top of the functions, for drop-in use.
- The site's Vue components (`MyInput`, `SubscribeField`) importing from here,
  so `suggestEmail` lives in one place.
