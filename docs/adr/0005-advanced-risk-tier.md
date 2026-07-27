# Gate Security-Reducing Tweaks Behind an Advanced Tier

Tweaks that reduce security or carry elevated risk — Memory Integrity off, Nagle off, a fixed pagefile, disabling `Spooler` or the Xbox services — will carry the `Advanced` **Risk Tier**: unchecked by default, never included in any Preset, shown with a risk badge, and requiring an explicit extra confirmation before they are applied. This keeps the largest documented gain available while making its cost a conscious choice.

## Considered Options

- Exclude security-reducing Tweaks entirely.
- Treat them like any other Tweak.
- Ship them behind an opt-in Advanced tier.

## Consequences

`RiskTier` is part of the Tweak contract from the start, even though the Advanced Tweaks themselves land later: `TweakCatalog` rejects at construction any Preset that references an `Advanced` Tweak, so the invariant cannot be broken silently by a future catalog entry. Risk copy must be translated in both `pt_BR` and `en_US`.
