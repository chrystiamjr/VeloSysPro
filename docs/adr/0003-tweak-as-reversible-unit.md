# Treat a Tweak as a First-Class Reversible Unit

Each optimization will be a **Tweak** — an individually selectable unit that knows how to detect, apply, and revert itself — instead of only the four hard-coded Optimization Plans in `Optimizer`. The existing `Quick`, `Full`, and `Gaming` Plans become **Presets**: named, adjustable selections over the Tweak catalog. This is what makes the intermediate selection screen and per-item Revert possible.

## Considered Options

- Keep the fixed Plans and add a separate "Custom" flow beside them.
- Replace the Plans entirely with the catalog.
- Make the Tweak the unit and express the Plans as Presets over it.

## Consequences

`desktop/Features/Tweaks/` owns `ITweak`, its three subtypes, `TweakCatalog`, and `TweakEngine`. Presets are Tweak-id sets keyed by the headless CLI task names, so the scheduled `VeloSysPro.exe --task=…` entries keep working. Every Tweak must implement all three operations — a real per-Tweak cost, accepted because reversibility is the point. `Optimizer` stays for the maintenance operations that are not reversible settings (temp cleanup, SFC, DISM).
