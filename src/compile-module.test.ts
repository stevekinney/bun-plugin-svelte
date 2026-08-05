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
