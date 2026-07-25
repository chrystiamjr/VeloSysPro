---
title: Theming Native Form Controls in WebView2
keywords: color-scheme, WebView2, Chromium, select, appearance-none, calendar-picker-indicator, dark theme
---

# Theming Native Form Controls in WebView2

## Overview

The WPF host renders the UI in WebView2, which is Chromium. Chromium paints native form controls —
`<select>` option popups, the `<input type="time">` clock indicator and its picker panel, spinners,
checkboxes — using the **page's declared color scheme**, not its CSS background. With no
declaration it assumes light.

VeloSys Pro is a dark-only application, and for a long time declared nothing. Two symptoms that
looked unrelated turned out to share one cause:

- the clock indicator on the time field rendered as a **black glyph** on a dark field, effectively
  invisible;
- `<select>` popups opened as **white lists** over dark controls.

The user's instinct was that the time picker was broken and should be replaced by a custom one. It
was not broken — it was unthemed. One declaration fixed both symptoms and made the native picker
perfectly usable, avoiding a hand-rolled component that would have had to re-implement keyboard
handling and accessibility the native input already provides.

## Strict Requirements

1. **Declare `color-scheme: dark` on `:root`** in `src/index.css`, inside `@layer base`. This is the
   single switch that themes every native control.
2. **Also declare it in `index.html`** as `<meta name="color-scheme" content="dark">`, so the first
   paint is correct and the user never sees a light flash before the stylesheet loads.
3. **Theme before replacing.** Never build a custom picker to work around a native control that
   merely looks wrong until requirement 1 is in place and the control has been re-checked. Prefer
   the native input afterwards: it brings keyboard support, locale-aware formatting and
   accessibility for free.
4. **Replace a native control only when its interaction model is genuinely worse.** A 31-option
   `<select>` for a day of the month is a defensible replacement — scrolling a long list to reach a
   number visible at a glance in a grid. A time input is not.
5. **`<select>` needs `appearance-none` plus right padding.** The browser arrow sits flush against
   the border. Suppress it, reserve space with `pr-10`, and position your own chevron absolutely
   with `pointer-events-none` and `aria-hidden` so it cannot swallow clicks.
6. **Only opacity and cursor are yours on `::-webkit-calendar-picker-indicator`.** The glyph itself
   is browser-drawn; do not try to recolour it with filters once the color scheme is correct.
7. **A replacement control must carry its own accessible name.** A `role="radiogroup"` is not a
   labelable element, so `<label for>` cannot name it — pass `aria-label` explicitly.

## Code & Architecture Examples

```css
/* src/index.css — requirement 1 */
@layer base {
  :root {
    color-scheme: dark;
  }

  /* Requirement 6 — the indicator is browser-drawn; only these are ours. */
  input[type='time']::-webkit-calendar-picker-indicator {
    @apply cursor-pointer opacity-70 transition-opacity;
  }
  input[type='time']::-webkit-calendar-picker-indicator:hover {
    @apply opacity-100;
  }
}
```

```tsx
// Requirement 5 — src/components/atoms/Select.tsx
<div className="relative">
  <select className={`${fieldClass} cursor-pointer appearance-none pr-10`} …>
    {/* options */}
  </select>
  <Icon
    name="chevron-down"
    aria-hidden="true"
    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted"
  />
</div>
```

## Verification Commands

```bash
npm run validate
npm run build
```

The symptoms are visual and none of them fail a test. Confirm in the running desktop app, not in a
browser tab: the clock indicator is light, the native time picker panel opens dark, `<select>`
popups are dark, and the chevron is inset from the border.
