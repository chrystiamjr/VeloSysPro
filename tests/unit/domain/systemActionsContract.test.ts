import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SystemActions } from '../../../src/domain/types';

describe('frontend/desktop IPC action contract', () => {
  it('keeps every TypeScript action synchronized with the C# catalog', () => {
    const source = readFileSync(resolve('desktop/SystemActions.cs'), 'utf8');
    const desktopActions = [...source.matchAll(/const string \w+ = "([^"]+)"/g)]
      .map((match) => match[1])
      .sort();
    const frontendActions = Object.values(SystemActions).sort();

    expect(desktopActions).toEqual(frontendActions);
  });
});
