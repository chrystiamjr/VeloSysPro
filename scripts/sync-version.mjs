/**
 * Stamps a version into every place VeloSys Pro tracks it, so semantic-release
 * (which decides the version from commits) keeps package.json, the C# host, the
 * installer, and the UI in sync.
 *
 * Usage: node scripts/sync-version.mjs <version>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node scripts/sync-version.mjs <version>  (e.g. 0.2.0)');
  process.exit(1);
}

/** @type {[string, (s: string) => string][]} */
const edits = [
  ['package.json', (s) => s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`)],
  ['desktop/VeloSysPro.csproj', (s) => s.replace(/(<Version>)[^<]+(<\/Version>)/, `$1${version}$2`)],
  ['desktop/app.manifest', (s) => s.replace(/(assemblyIdentity version=")[^"]+(")/, `$1${version}.0$2`)],
  ['installer/VeloSysPro.iss', (s) => s.replace(/(#define AppVersion ")[^"]+(")/, `$1${version}$2`)],
  ['src/domain/locales/pt_BR.json', (s) => s.replace(/(Versão )\d+\.\d+\.\d+/, `$1${version}`)],
  ['src/domain/locales/en_US.json', (s) => s.replace(/(Version )\d+\.\d+\.\d+/, `$1${version}`)],
];

let failed = false;
for (const [file, transform] of edits) {
  const original = readFileSync(file, 'utf8');
  const next = transform(original);
  if (next !== original) {
    writeFileSync(file, next);
    console.log(`  ✓ ${file} -> ${version}`);
  } else {
    console.warn(`  ! ${file}: version pattern not found (unchanged)`);
    failed = true;
  }
}

if (failed) {
  console.error('sync-version: at least one file did not update — check the patterns.');
  process.exit(1);
}
console.log(`sync-version: all files set to ${version}`);
