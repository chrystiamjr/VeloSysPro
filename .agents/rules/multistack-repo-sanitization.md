---
title: Multi-Stack Repository Audit & Sanitization
keywords: cleanup, gitignore, single-executable, VeloSysPro.exe, build artifacts, dotnet test
---

# Multi-Stack Repository Audit & Sanitization

## Overview
When performing workspace structure sanitization, cleanup, or dead-file removal across hybrid multi-stack repositories:

## Strict Requirements
1. **Audit All Layers**: Audit React TS frontend, C# WPF backend, Docusaurus documentation sub-site (`website/`), and build scripts.
2. **Purge Leftovers**: Purge empty leftover template directories and verify pending git index deletions.
3. **Guardrail Compliance**: Ensure build outputs (`ui/`, `dist/`, `VeloSysPro.exe`, `webview_data/`) strictly conform to `.gitignore` and `AGENTS.md` single-executable guardrails.
4. **Full Validation**: Validate compilation across all sub-stacks before declaring completion.

## Verification Commands
```bash
npm run validate
dotnet test
npm --prefix website run build
```
