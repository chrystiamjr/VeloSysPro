---
title: Documentation Sub-Site & Theme Standards
keywords: docusaurus, website, package.json, color-mode, dark-mode, icons, typecheck, build
---

# Documentation Sub-Site & Theme Standards

## Overview
When adding, modifying, or maintaining a Docusaurus documentation portal located in `website/`, strict architectural and visual standards must be observed to ensure version alignment and visual harmony with the host desktop application.

## Strict Requirements
1. **Version Alignment**: Always import and mirror the application version from the root `package.json`.
2. **Design Tokens**: Mirror the application's core design tokens (colors, typography, spacing).
3. **Color-Mode Policy**: Explicitly define and enforce a color-mode policy:
   - For dark-only portals: set dark mode as default, disable the theme switch, and ignore operating-system preferences.
   - For multi-theme portals: define and visually validate complete light and dark palettes.
4. **Asset Extraction**: Multi-resolution Windows icons MUST be extracted using stream image decoders to prevent asset corruption.
5. **Verification**: Always run `npm --prefix website run build` (or typecheck) and verify the deployed URL after publication.

## Verification Commands
```bash
npm --prefix website run build
```
