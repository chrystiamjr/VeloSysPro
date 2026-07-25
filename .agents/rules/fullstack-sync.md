---
title: Full-Stack Cross-Layer Synchronization
keywords: i18n, IPC, dotnet build, npm run validate, C#, WPF, React, TypeScript
---

# Full-Stack Cross-Layer Synchronization

## Overview
In hybrid desktop applications composed of a C# .NET 8 WPF host and a React WebView2 frontend, any modification to cross-layer boundaries must be synchronized immediately across both stacks.

## Strict Requirements
1. **Event & Payload Schemas**: Any change to i18n keys, IPC event contracts, payload schemas, or pre-commit validation MUST synchronously update both:
   - **C# Backend**: Emitter and handler classes located in `desktop/*.cs`.
   - **React TS Frontend**: Infrastructure handlers and UI components in `src/`.
2. **Double Build Validation**: Never claim success without compiling and validating both layers.
3. **Recursive i18n Parity**: `pt_BR.json` and `en_US.json` must match at **every nesting level**, not
   just the top level. A nested key present in only one locale renders as its raw key at runtime.
   Guard all three of:
   - identical flattened key paths (`scheduling.weekday.mon`, not just `scheduling`);
   - identical `{{placeholder}}` sets per key — a missing `{{time}}` silently drops data;
   - no pt-BR value byte-identical to its en-US counterpart, which is how `nav.restorePoints`
     stayed as `"Restore Points"`. Allowlist genuine proper nouns; strip placeholders before the
     comparison so pure format strings are not flagged.
4. **Alphabetical Insertion**: New keys go in recursive alphabetical order — enforced by
   `tests/unit/domain/i18n.test.ts`.
5. **Locale-Neutral Payloads**: Values crossing the IPC boundary must not be culture-formatted when
   the frontend sorts or branches on them — see
   [locale-neutral-boundary-data.md](./locale-neutral-boundary-data.md).

## Verification Commands
```bash
npm run validate
dotnet build desktop/VeloSysPro.csproj
```

Structural i18n guards must be proven falsifiable per
[falsifiable-test-guards.md](./falsifiable-test-guards.md).
