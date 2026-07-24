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

## Verification Commands
```bash
npm run validate
dotnet build desktop/VeloSysPro.csproj
```
