---
title: Semantic Version Resolution across Process & Release Boundaries
keywords: SemanticVersion, SemVer, GitHub Releases, AssemblyInformationalVersionAttribute, UpdateChecker, version parsing, pre-release
---

# Semantic Version Resolution across Process & Release Boundaries

## Overview

Version resolution in desktop applications spans multiple boundaries:
1. Assembly build attributes (`AssemblyInformationalVersionAttribute`, which attaches Git commit SHAs and build metadata such as `0.2.0+d1a2b3c`).
2. Headless CLI arguments (`VeloSysPro.exe --version`).
3. External web APIs (e.g., GitHub Releases `tag_name` such as `v0.2.0-beta.1`).

Relying on `System.Version.TryParse` fails when encountering `v` prefixes, SemVer 2.0 pre-release identifiers (`-beta.1`), or build metadata (`+build.10`). Ad-hoc string slicing in entry-point files creates divergent version logic between the CLI and update checkers.

## Strict Requirements

1. **Use a dedicated SemVer 2.0 value object.** Encapsulate parsing, component extraction (Major, Minor, Patch, PreRelease, BuildMetadata), and comparison rules inside a deep `SemanticVersion` record.
2. **Support optional 'v' prefixes and pre-release identifiers.** Parsing must gracefully handle `v1.2.3`, `1.2.3`, and `2.0.0-rc.1`.
3. **Enforce SemVer 2.0 comparison precedence.** A full release (`1.0.0`) must have higher precedence than a pre-release of the same version (`1.0.0-beta.1`).
4. **Unify CLI version reporting and update checks.** Both `App.xaml.cs` and `UpdateChecker.cs` must resolve versions through `SemanticVersion.FromAssembly()` and `SemanticVersion.TryParse(tag, out var latest)`.

## Code & Architecture Example

```csharp
// SemanticVersion.cs - Deep SemVer 2.0 value object
public sealed record SemanticVersion : IComparable<SemanticVersion>
{
    public int Major { get; }
    public int Minor { get; }
    public int Patch { get; }
    public string PreRelease { get; }
    public string BuildMetadata { get; }

    public static SemanticVersion FromAssembly(Assembly? assembly = null)
    {
        Assembly target = assembly ?? Assembly.GetEntryAssembly() ?? Assembly.GetExecutingAssembly();
        var infoAttr = target.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
        if (infoAttr != null && TryParse(infoAttr.InformationalVersion.Split('+')[0], out var infoVer))
        {
            return infoVer!;
        }

        Version? asmVer = target.GetName().Version;
        return asmVer != null
            ? new SemanticVersion(asmVer.Major, asmVer.Minor, Math.Max(0, asmVer.Build))
            : new SemanticVersion(1, 0, 0);
    }
}
```
