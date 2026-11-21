# Packages by Jacques Ramphal

Small open-source packages I've made for [ramphal.design](https://ramphal.design) and published to npm. Each one started as an experiment on the site and is written up there.

| Package | What it does | npm |
|---|---|---|
| [`@jacquesramphal/stateline`](packages/stateline) | Form fields whose border is their state, and line backgrounds made of the same moves. From the essay [Make it pop](https://ramphal.design/doc/make-it-pop). | [npm](https://www.npmjs.com/package/@jacquesramphal/stateline) |
| [`@jacquesramphal/border-field`](packages/border-field) | The engine under Stateline: an input whose outline follows the caret, waves while it sends and goes jagged when it's wrong. | [npm](https://www.npmjs.com/package/@jacquesramphal/border-field) |
| [`@jacquesramphal/counter-fill`](packages/counter-fill) | Fills the counters inside letterforms (the holes in o, e and a) with a colour, a gradient or a colour each. | [npm](https://www.npmjs.com/package/@jacquesramphal/counter-fill) |
| [`@jacquesramphal/smart-quotes`](packages/smart-quotes) | Curly quotes for any framework, without breaking attribute values. | [npm](https://www.npmjs.com/package/@jacquesramphal/smart-quotes) |
| [`@jacquesramphal/design-guard`](packages/design-guard) | A CLI that flags hardcoded CSS values in staged files, to keep code on design tokens. | [npm](https://www.npmjs.com/package/@jacquesramphal/design-guard) |

Each package has its own README and version in its folder.

## Working on them

```bash
pnpm install
pnpm test
```

## Licence

MIT © Jacques Ramphal. Every package is MIT; see the LICENSE in each folder. If you build on one, a link back is the credit I'd most like.
