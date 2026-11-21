# Publishing stateline-patterns

The patterns came out of Stateline 0.2 before it was published, so that
Stateline could ship without them. This package is `"private": true`, which
makes npm refuse to publish it until that line comes out.

## Where it's used now

The site takes it from the workspace, not npm:

- **Home:** the featured Labs card runs `crossings` live (`coverPattern` on
  the Stateline entry in `src/assets/data/library.json`).
- **The line patterns lab:** `/lab/line-patterns/`, a control for every option
  and Save SVG. It runs a copy of `patterns.js`; `pnpm stateline:patterns`
  refreshes the copy and the stills, and CI fails if they drift.
- **`/lab/cards`:** every pattern in the featured card, four ways each.
- **Storybook:** *Stateline patterns (unpublished)/Patterns*.

## The drafts and review material

- **`docs/review/patterns/`:** screenshots of every pattern in the card, the
  home card in light, dark and phone, with an index in its README.
- **`public/lab/line-patterns/stills/`:** a still of every pattern as SVG, in
  currentColor and in the site's light and dark ink.

## Before it's ready

Decide, then tick:

- [ ] **Which patterns ship.** Thirteen are in the file. Fewer, chosen ones may
      be a better first release than all of them.
- [ ] **The name.** `@jacquesramphal/stateline-patterns`, or something that
      stands on its own.
- [ ] **Crossings' distribution.** Every line is currently long enough to cross
      the whole card. Earlier versions had varied lengths.
- [ ] **The options worth keeping.** Anything in `DEFAULTS` that only exists for
      one experiment can go before it's public, when removing it is free.
- [ ] **Mobile.** Tap ripple and drag were checked in emulation only.
- [ ] **The README** reads as a finished page, with a short example first.

## To publish

1. In `package.json`, remove `"private": true` and set `"version"` (start at
   `0.1.0`, or `1.0.0` if the API is settled).
2. Run the checks: `pnpm patterns:test` and `pnpm stateline:patterns --check`.
3. See what would go out:
   `cd packages/stateline-patterns && npm publish --dry-run --access public`
4. Publish, logged in to npm: `npm publish --access public`
5. Copy the change to the public repo, `jacquesramphal/packages`, and add the
   package to the table in its root README.
6. Add an npm link under this README's title, like the other packages have.
7. Rename the Storybook title from *(unpublished)* and link the package from
   Stateline's README.

Stateline doesn't depend on this package, so the two release separately.
