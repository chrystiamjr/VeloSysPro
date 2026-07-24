## Summary

Describe the user-visible outcome and why this change is needed.

## Changes

- 

## Validation

- [ ] `npm run validate`
- [ ] `npm run build`
- [ ] `dotnet build desktop/VeloSysPro.csproj -c Release`
- [ ] `dotnet test desktop.Tests/VeloSysPro.Tests.csproj -c Release`

## Risk and rollback

Describe known risks and how to revert or disable the change safely.

## Screenshots

Attach before/after screenshots for UI changes, or write “Not applicable”.

## Checklist

- [ ] The PR title follows Conventional Commits (for example, `feat: improve dashboard grouping`).
- [ ] Tests cover the changed behavior.
- [ ] Cross-layer IPC, payload, and i18n changes are synchronized between TypeScript and C#.
- [ ] UI changes use Tailwind design tokens and follow the Atomic Design structure.
- [ ] No loose build artifacts or launcher scripts were added to the repository root.
