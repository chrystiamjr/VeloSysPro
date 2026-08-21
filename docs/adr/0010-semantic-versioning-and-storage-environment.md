# Semantic Versioning and Storage Environment Seams

Version resolution and storage path topology are encapsulated in deep value objects (`SemanticVersion`) and substitutable environment seams (`IAppEnvironment` / `AppEnvironment`).

## Considered Options

- Split string slicing in `App.xaml.cs` and ad-hoc `System.Version.TryParse` in `UpdateChecker.cs`.
- Static `%LOCALAPPDATA%` properties in `AppPaths.cs` requiring custom path overrides in tests.
- Unified `SemanticVersion` SemVer 2.0 parser and substitutable `IAppEnvironment` seam.

## Consequences

- CLI `--version` output and GitHub Releases API update checks share identical SemVer 2.0 comparison logic.
- Full support for semantic-release tags (e.g. `v0.2.0-beta.1`).
- Clean test and sandbox isolation by supplying custom root directories to `AppEnvironment`.
