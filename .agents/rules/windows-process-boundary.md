---
title: Empirical Windows Process-Boundary Validation
keywords: UTF-8, OEM encoding, stdout, stderr, exit-code, Windows, pwsh, process
---

# Empirical Windows Process-Boundary Validation

## Overview
When changing native Windows command execution, redirected output, logging, or process completion state, NEVER assume UTF-8 or infer success solely from control flow.

## Strict Requirements
1. **OEM Encoding**: Detect the current Windows OEM encoding (e.g., CP850/CP1252) when reading process stdout/stderr.
2. **Preserve Semantics**: Always preserve stdout/stderr separation and true exit-code semantics.
3. **Empirical Boundary Validation**: Validate the process boundary with at least one representative localized Windows command before altering frontend display or parsing logic.
4. **Validation Pipeline**: Run full verification across frontend, backend, and E2E flows.

## Verification Commands
```bash
npm run validate
dotnet build desktop/VeloSysPro.csproj
```
