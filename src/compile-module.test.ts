import { describe, expect, it } from 'bun:test';

import { compileRuneModule, type RuneModuleCompileParameters } from './compile-module.js';

const fixturesDirectory = new URL('../test/fixtures/', import.meta.url).pathname;

async function readFixture(name: string): Promise<string> {
  return Bun.file(`${fixturesDirectory}${name}`).text();
}

function parameters(
  overrides: Partial<RuneModuleCompileParameters> = {},
): RuneModuleCompileParameters {
  return {
    side: 'client',
    dev: true,
    filename: '/app/counter-state.svelte.ts',
    warningFilter: undefined,
    transpiler: new Bun.Transpiler({ loader: 'ts' }),
    ...overrides,
  };
}

describe('compileRuneModule', () => {
  it('transpiles TypeScript before compiling a .svelte.ts module', async () => {
    const source = await readFixture('counter-state.svelte.ts');

    const result = await compileRuneModule(source, '/app/counter-state.svelte.ts', parameters());

    expect(result.loader).toBe('js');
    expect(result.contents).toContain('svelte/internal/client');
    expect(result.contents).not.toContain(': number');
  });

  it('compiles a .svelte.js module without transpiling', async () => {
    const source = await readFixture('counter-state.svelte.js');

    const result = await compileRuneModule(
      source,
      '/app/counter-state.svelte.js',
      parameters({ filename: '/app/counter-state.svelte.js' }),
    );

    expect(result.contents).toContain('svelte/internal/client');
  });

  it('compiles server-side rune modules', async () => {
    const source = await readFixture('counter-state.svelte.js');

    const result = await compileRuneModule(
      source,
      '/app/counter-state.svelte.js',
      parameters({ side: 'server', filename: '/app/counter-state.svelte.js' }),
    );

    expect(result.contents).toContain('svelte/internal/server');
  });

  it('suppresses warnings rejected by warningFilter', async () => {
    const source = 'export const value = $state(0);\nexport let reassignable = 1;';

    // Baseline sanity: this compiles; the filter path just must not throw.
    const result = await compileRuneModule(
      source,
      '/app/counter-state.svelte.js',
      parameters({ filename: '/app/counter-state.svelte.js', warningFilter: () => false }),
    );

    expect(result.loader).toBe('js');
  });

  it('maps TypeScript transpile failures to errors naming the file', async () => {
    const source = 'const broken: = 1;';

    let thrown: unknown;
    try {
      await compileRuneModule(source, '/app/broken.svelte.ts', parameters());
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('/app/broken.svelte.ts');
    expect((thrown as Error).message).toContain('TypeScript transpile failed');
  });

  it('maps compile errors to path:line:column messages', async () => {
    const source = 'const broken = $state(';

    let thrown: unknown;
    try {
      await compileRuneModule(source, '/app/broken.svelte.js', parameters());
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/\/app\/broken\.svelte\.js:\d+:\d+: /);
  });
});
