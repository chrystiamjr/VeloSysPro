---
title: Copy Length Is a Layout Change
keywords: i18n, locale JSON, copy length, Cypress, be.visible, scrollport, overflow, PresetCard, pt_BR
---

# Copy Length Is a Layout Change

## Overview
Editing a value in `frontend/src/domain/locales/{pt_BR,en_US}.json` looks like a text change and is
not one. The Optimize screen renders its Preset cards above a scrolling catalog, so a longer
`optimize.preset.gaming.desc` makes `PresetCard` taller, pushes the category sections down, and can
move one of them out of the scrollport.

This happened on 2026-08-23 during E7. The refreshed `gaming` description grew from 115 to ~210
characters. Every unit test stayed green — `i18n.test.ts` checks parity, ordering and placeholders,
never height — and `tweaks.cy.ts` failed on:

```
expected '<section.overflow-hidden.rounded-xl…>' to be 'visible'
This element is not visible because its content is being clipped by one of its parent elements,
which has a CSS property of overflow: `hidden`, `scroll` or `auto`
```

`should('be.visible')` does not scroll the element into view first. A section that a user could
still reach by scrolling is, to that assertion, not visible — which is the point: the guard pins
"the three category headers fit on screen once the catalog loads", and longer copy broke it. The
fix was to shorten the copy, not to loosen the guard.

The suite runs in **pt_BR** (`i18n.ts` calls `i18n.locale('pt_BR')` at import time), so a Portuguese
value is the one that can fail a visibility guard even when its English counterpart is short.
Portuguese runs roughly 15–20% longer than English for the same sentence, so pt_BR is the binding
constraint, not the translation afterthought.

## Strict Requirements
1. **A locale edit on a guarded screen is a layout change.** Any change to a value rendered on a
   screen with a Cypress `be.visible` assertion MUST run that screen's spec before commit
   (`npx cypress run --spec tests/e2e/<screen>.cy.ts`). `npm run validate` alone does NOT cover it —
   Vitest renders in jsdom, which has no viewport and no scrollport.
2. **pt_BR is the length budget.** Both locales change together, and the Portuguese value is the one
   measured against the layout. A change that fits in en_US and not in pt_BR is a change that does
   not fit.
3. **Never relax a visibility guard to accommodate copy.** Adding `.scrollIntoView()`, swapping
   `be.visible` for `exist`, or raising the timeout converts a real layout regression into a
   silently-passing test — the failure mode `falsifiable-test-guards.md` exists to prevent. Shorten
   the copy, or change the layout on purpose and say so.
4. **Growing the copy makes the layout the deliverable.** If the longer wording is the right wording,
   the accompanying layout change (a `line-clamp`, a collapsed card, a shorter card region) ships in
   the same commit, with the guard still asserting the transition it asserted before.
5. **State the constraint where it bites.** A locale value whose length is load-bearing MUST be
   flagged in the commit body, because nothing in the JSON file itself says so.

## Code & Architecture Examples
```jsonc
// frontend/src/domain/locales/pt_BR.json — the value that failed the guard at ~210 chars
// and passed at ~167. There is no marker in the file saying the length matters.
"preset": {
  "gaming": {
    "desc": "Um ponto de partida curado para jogos, não o catálogo inteiro: prioridade em primeiro plano, rede, tela cheia, Modo Jogo, plano de energia e serviços em segundo plano."
  }
}
```

```ts
// frontend/tests/e2e/tweaks.cy.ts — the guard. It asserts the sections are on screen after the
// catalog loads, which is a claim about height, not about the DOM.
cy.emitHost('tweaksLoaded', tweakCatalog);

cy.getByCy('tweak-category-cpu').should('be.visible');
cy.getByCy('tweak-category-boot').should('be.visible');
cy.getByCy('tweak-category-services').should('be.visible'); // the one that falls off first
```

```tsx
// frontend/src/components/organisms/TweakCatalogList.tsx:119 — the sections being measured.
<section data-cy={`tweak-category-${category}`} className="overflow-hidden rounded-xl …">
```

## Verification Commands
```bash
# The spec that measures the Optimize screen. Needs the dev server on 5173.
cd frontend && npx vite --port 5173 &
cd frontend && npx cypress run --spec tests/e2e/tweaks.cy.ts

# Full sweep before opening the PR.
cd frontend && npm run validate && npx cypress run
```
