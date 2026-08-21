import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { i18n } from '../../../src/domain/i18n';
import pt_BR from '../../../src/domain/locales/pt_BR.json';
import en_US from '../../../src/domain/locales/en_US.json';

function verifyAlphabeticalOrder(obj: Record<string, unknown>, path = ''): void {
  const keys = Object.keys(obj);
  const sortedKeys = [...keys].sort();
  expect(keys, `Keys at path "${path || 'root'}" are not alphabetically sorted`).toEqual(sortedKeys);

  for (const key of keys) {
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      verifyAlphabeticalOrder(value as Record<string, unknown>, path ? `${path}.${key}` : key);
    }
  }
}

/** Flattens a locale into dot-separated leaf paths, e.g. "scheduling.weekday.mon". */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = String(value);
    }
  }

  return out;
}

/** Interpolation placeholders used by a string, e.g. ["day", "time"]. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
}

const flatPt = flatten(pt_BR as Record<string, unknown>);
const flatEn = flatten(en_US as Record<string, unknown>);

function csharpSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'obj' || entry === 'bin') return [];
    if (statSync(path).isDirectory()) return csharpSources(path);
    return path.endsWith('.cs') ? [path] : [];
  });
}

/** Every "log.*" / "status.*" literal the C# host hands to IStatusSink. */
function hostEmittedKeys(): string[] {
  const source = csharpSources(resolve('../desktop'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  return [...new Set([...source.matchAll(/"((?:log|status)\.[A-Za-z][A-Za-z0-9.]*)"/g)])]
    .map((match) => match[1])
    // A file name, not a message; it is the one literal of this shape that is not a key.
    .filter((key) => key !== 'log.txt')
    .sort();
}

const CATALOG_SOURCE = resolve('../desktop/Features/Tweaks/TweakCatalog.cs');

/**
 * Every Tweak the shipped catalog registers, read from the C# source: its id and its risk tier.
 *
 * Matched by the id literal sitting immediately before its `TweakCategories.` argument, which is
 * the shape every Tweak constructor call takes — so the list follows the catalog rather than a
 * copy of it that would drift. The id pattern is deliberately loose about segment contents
 * (underscores, digits, a third segment) because a stricter one would silently skip an entry it
 * did not anticipate, and skipping is exactly the failure this guard exists to prevent.
 */
function catalogTweaks(): { id: string; advanced: boolean }[] {
  const source = readFileSync(CATALOG_SOURCE, 'utf8');
  const seen = new Map<string, boolean>();

  for (const match of source.matchAll(
    /"([a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)"\s*,\s*TweakCategories\.\w+\s*,\s*RiskTier\.(\w+)/g
  )) {
    seen.set(match[1], match[2] === 'Advanced');
  }

  return [...seen].map(([id, advanced]) => ({ id, advanced })).sort((a, b) => a.id.localeCompare(b.id));
}

/** How many Tweaks the catalog constructs, counted independently of the id pattern. */
function catalogTweakConstructorCount(): number {
  return [...readFileSync(CATALOG_SOURCE, 'utf8').matchAll(/new \w+Tweak\(/g)].length;
}

const DEBLOAT_SOURCE = resolve('../desktop/Features/Debloat/DebloatCatalog.cs');

/**
 * Every entry the shipped removal allow-list registers, read from the C# source.
 *
 * Matched by the id literal sitting immediately before its `DebloatGroup.` argument, which both
 * the `Appx(...)` helper and the explicit `new DebloatEntry(...)` share. Counted independently
 * below for the same reason the Tweak list is: a shape the pattern did not anticipate would drop
 * out silently and take its copy guard with it.
 */
function debloatEntries(): string[] {
  const source = readFileSync(DEBLOAT_SOURCE, 'utf8');
  return [
    ...new Set(
      [...source.matchAll(/"([a-z][A-Za-z0-9]*)"\s*,\s*DebloatGroup\.\w+/g)].map((m) => m[1])
    ),
  ].sort();
}

/** How many entries the allow-list registers, counted independently of the id pattern. */
function debloatEntryCount(): number {
  return [...readFileSync(DEBLOAT_SOURCE, 'utf8').matchAll(/DebloatGroup\.(?:Safe|Optional)\s*,/g)]
    .length;
}

function lookup(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
    return undefined;
  }, locale);
}

describe('i18n locales', () => {
  it('pt_BR and en_US expose the exact same key set', () => {
    const ptKeys = Object.keys(pt_BR).sort();
    const enKeys = Object.keys(en_US).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it('pt_BR and en_US expose the same NESTED key paths', () => {
    // Top-level parity alone lets a nested key (scheduling.weekday.mon, settings.updateTitle,
    // table.range) exist in one locale only, which silently renders the raw key at runtime.
    expect(Object.keys(flatPt).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('resolves every i18n key the C# host actually emits', () => {
    // Locale-to-locale parity cannot catch this: a key can be spelled one way in the host and
    // sit under a different parent in both locales, staying perfectly "in parity" while the
    // console renders the raw key. This happened to log.protection.* during E0.
    const emitted = hostEmittedKeys();
    expect(emitted.length).toBeGreaterThan(0);

    const unresolved = emitted.filter(
      (key) =>
        typeof lookup(pt_BR as Record<string, unknown>, key) !== 'string' ||
        typeof lookup(en_US as Record<string, unknown>, key) !== 'string'
    );

    expect(unresolved).toEqual([]);
  });

  const locales = [
    ['pt_BR', pt_BR],
    ['en_US', en_US],
  ] as const;

  /** Locale names missing `optimize.tweak.<id>.<leaf>`, reported as readable paths. */
  const missingCopy = (id: string, leaf: string): string[] =>
    locales
      .filter(
        ([, locale]) =>
          typeof lookup(locale as Record<string, unknown>, `optimize.tweak.${id}.${leaf}`) !==
          'string'
      )
      .map(([name]) => `${name}: optimize.tweak.${id}.${leaf}`);

  it('reads every Tweak the catalog constructs', () => {
    // The guards below are only worth their assertions if this list is complete. Counting the
    // constructor calls independently of the id pattern is what turns "matched nothing new" from
    // a silent pass into a failure — an id shape the pattern did not anticipate drops out
    // otherwise, and every copy guard goes quiet about it.
    expect(catalogTweaks()).toHaveLength(catalogTweakConstructorCount());
  });

  it('gives every catalog Tweak a title and description in both locales', () => {
    // TweakRow builds its key as `optimize.tweak.${id}` from an id that crosses IPC, so no C#
    // literal ties the two together and the host-emitted-key guard above cannot see them. A new
    // catalog entry with no copy renders the raw key on screen while every other i18n guard
    // stays green.
    const missing = catalogTweaks().flatMap(({ id }) =>
      ['title', 'desc'].flatMap((leaf) => missingCopy(id, leaf))
    );

    expect(missing).toEqual([]);
  });

  it('spells out the risk of every Advanced Tweak in both locales', () => {
    // OptimizePage renders `optimize.tweak.${id}.risk` as the detail line of the Advanced
    // confirmation — the one gate standing between the user and a security-reducing change. An
    // Advanced entry without that copy would show the raw key inside the dialog meant to explain
    // the danger. No Advanced Tweak ships until E5, so this guards the moment one arrives.
    const missing = catalogTweaks()
      .filter(({ advanced }) => advanced)
      .flatMap(({ id }) => missingCopy(id, 'risk'));

    expect(missing).toEqual([]);
  });

  it('reads every entry the removal allow-list registers', () => {
    expect(debloatEntries()).toHaveLength(debloatEntryCount());
  });

  it('gives every removable app a title and description in both locales', () => {
    // DebloatRow builds its key as `debloat.package.${id}` from an id that crosses IPC, so no C#
    // literal ties the two together. An allow-list entry with no copy renders the raw key on the
    // one screen whose whole job is explaining what is about to be uninstalled.
    const missing = debloatEntries().flatMap((id) =>
      ['title', 'desc'].flatMap((leaf) =>
        locales
          .filter(
            ([, locale]) =>
              typeof lookup(locale as Record<string, unknown>, `debloat.package.${id}.${leaf}`) !==
              'string'
          )
          .map(([name]) => `${name}: debloat.package.${id}.${leaf}`)
      )
    );

    expect(missing).toEqual([]);
  });

  it('spells out how every removable app comes back, in both locales', () => {
    // The caveat is the only thing on the screen that says a removal is not reversible in-app. It
    // is keyed by the host's invariant token, so a new token would silently render as a raw key.
    const caveats = [
      ...new Set(
        [...readFileSync(DEBLOAT_SOURCE, 'utf8').matchAll(/\?\s*"(\w+)"\s*:\s*"(\w+)"/g)].flatMap(
          (match) => [match[1], match[2]]
        )
      ),
    ];
    expect(caveats.length).toBeGreaterThan(0);

    const missing = caveats.flatMap((caveat) =>
      locales
        .filter(
          ([, locale]) =>
            typeof lookup(locale as Record<string, unknown>, `debloat.caveat.${caveat}`) !== 'string'
        )
        .map(([name]) => `${name}: debloat.caveat.${caveat}`)
    );

    expect(missing).toEqual([]);
  });

  it('keeps interpolation placeholders identical across locales', () => {
    const mismatches = Object.keys(flatPt)
      .filter((key) => key in flatEn)
      .map((key) => ({
        key,
        pt: placeholders(flatPt[key]),
        en: placeholders(flatEn[key]),
      }))
      .filter(({ pt, en }) => pt.join(',') !== en.join(','));

    expect(mismatches).toEqual([]);
  });

  it('has no untranslated leaves left identical to the other locale by accident', () => {
    // A pt_BR value that is byte-identical to en_US is usually an untranslated leak
    // (nav.restorePoints used to read "Restore Points"). Proper nouns are allowlisted.
    const allowed = new Set(['brand.subtitle', 'settings.langEn', 'settings.langPt']);

    // A Debloat entry's title is the app's own name as Windows shows it — "Clipchamp", "Xbox",
    // "Microsoft 365 (Office Hub)". Those are the same string in every locale by design, and the
    // description beside each one still has to be translated, so it stays covered here.
    const properNoun = (key: string) => /^debloat\.package\.[A-Za-z0-9]+\.title$/.test(key);

    const suspicious = Object.keys(flatPt).filter((key) => {
      if (allowed.has(key) || properNoun(key) || flatPt[key] !== flatEn[key]) return false;
      // Strip placeholders first: pure format strings ("{{frequency}} - {{optimization}}")
      // and passthroughs ("{{text}}") are language neutral, not untranslated.
      const prose = flatPt[key].replace(/\{\{\s*\w+\s*\}\}/g, '');
      return /\p{L}{4,}/u.test(prose);
    });

    expect(suspicious).toEqual([]);
  });

  it('ensures pt_BR JSON keys are sorted alphabetically recursively', () => {
    verifyAlphabeticalOrder(pt_BR as Record<string, unknown>);
  });

  it('ensures en_US JSON keys are sorted alphabetically recursively', () => {
    verifyAlphabeticalOrder(en_US as Record<string, unknown>);
  });

  it('interpolates keyed log messages with {{param}} args', () => {
    i18n.locale('pt_BR');
    const pt = i18n.t('log.backup.created', { file: 'backup_rede_x.reg' });
    expect(pt).toContain('backup_rede_x.reg');
    expect(pt).not.toContain('{{');

    i18n.locale('en_US');
    const en = i18n.t('log.backup.created', { file: 'backup_rede_x.reg' });
    expect(en).toContain('backup_rede_x.reg');
    expect(en).not.toContain('{{');
  });

  it('resolves the raw-passthrough log key', () => {
    i18n.locale('en_US');
    expect(i18n.t('log.raw', { text: 'ipconfig output' })).toBe('ipconfig output');
  });

  it('keeps implementation details out of the user-facing startup log', () => {
    for (const locale of ['pt_BR', 'en_US'] as const) {
      i18n.locale(locale);
      expect(i18n.t('log.appStarted')).not.toMatch(/React|TypeScript|Rosetta/i);
    }
  });
});
