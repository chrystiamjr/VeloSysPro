---
title: Responsive Management Layout Guardrails
keywords: responsive, cards, tables, sidebar, overflow, Tailwind, WPF, WebView2
---

# Responsive Management Layout Guardrails

## Overview
VeloSys Pro runs inside a resizable WPF WebView2 window, so desktop-oriented React layouts must remain usable at narrow window widths. Management screens must share a predictable card hierarchy, preserve access to actions and table data, and keep navigation available without allowing full-width atomic buttons to compete with adjacent content.

## Strict Requirements
1. **Shared Card Hierarchy**: Functional management cards MUST render content in this order: heading, description, controls, then actions. Related screens MUST use consistent spacing and alignment for these regions.
2. **Narrow-Window Actions**: Card actions MUST stack or use a responsive grid at narrow widths. Actions MAY use multiple columns when space permits, but every action MUST remain inside its card without clipping or horizontal page overflow.
3. **Full-Width Button Safety**: The shared `Button` atom defaults to `w-full`. It MUST NOT be placed beside text or controls in a non-wrapping flex row unless its width and shrink behavior are explicitly constrained at the applicable breakpoint.
4. **Scrollable Data Tables**: Tables that can exceed the content width MUST be wrapped in an `overflow-x-auto` container and MUST define a stable minimum width so columns and action buttons remain readable and horizontally reachable.
5. **Accessible Mobile Navigation**: When the sidebar collapses automatically at a narrow breakpoint, its toggle MUST still expand it. The expanded narrow-window sidebar MUST appear above page content as an overlay and MUST close after navigation.
6. **Responsive Regression Coverage**: Changes to management cards, tables, the terminal header, or the application shell MUST include component tests that assert the relevant responsive structure and interaction.

## Code & Architecture Examples
```tsx
<section className="flex flex-col gap-5 rounded-xl border border-borderColor bg-bgCard p-6">
  <div>
    <h3 className="text-lg font-bold text-white">{title}</h3>
    <p className="mt-1 text-xs text-textMuted">{description}</p>
  </div>

  <div className="grid gap-3 sm:grid-cols-2">
    <Button onClick={onPrimaryAction}>Primary action</Button>
    <Button onClick={onSecondaryAction}>Secondary action</Button>
  </div>
</section>

<div className="overflow-x-auto rounded-xl border border-borderColor bg-bgCard">
  <table className="w-full min-w-[640px]">{/* columns and rows */}</table>
</div>
```

## Verification Commands
```bash
npm run validate
dotnet build desktop/VeloSysPro.csproj
```
