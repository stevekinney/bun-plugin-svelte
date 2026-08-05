import { describe, expect, it, spyOn } from 'bun:test';

import { compileComponent, type ComponentCompileParameters } from './compile-component.js';
import { createVirtualCssRegistry } from './virtual-css.js';

const fixturesDirectory = new URL('../test/fixtures/', import.meta.url).pathname;

async function readFixture(name: string): Promise<string> {
  return Bun.file(`${fixturesDirectory}${name}`).text();
}

function parameters(
  overrides: Partial<ComponentCompileParameters> = {},
): ComponentCompileParameters {
  return {
    side: 'client',
    dev: true,
    hmr: false,
    cssMode: 'external',
    filename: '/app/counter.svelte',
    compilerOptions: undefined,
    cssRegistry: createVirtualCssRegistry(),
    ...overrides,
  };
}

describe('compileComponent', () => {
  it('compiles a component to client JS', async () => {
    const source = await readFixture('counter.svelte');

    const result = compileComponent(source, '/app/counter.svelte', parameters());

    expect(result.loader).toBe('js');
    expect(result.contents).toContain('svelte/internal/client');
  });

  it('compiles a component to server JS without a CSS import', async () => {
    const source = await readFixture('counter.svelte');
    const cssRegistry = createVirtualCssRegistry();

    const result = compileComponent(
      source,
      '/app/counter.svelte',
      parameters({ side: 'server', cssMode: 'external', cssRegistry }),
    );

    expect(result.contents).toContain('svelte/internal/server');
    expect(result.contents).not.toContain('bun-svelte:');
  });

  it('registers external CSS and appends the virtual import', async () => {
    const source = await readFixture('counter.svelte');
    const cssRegistry = createVirtualCssRegistry();

    const result = compileComponent(source, '/app/counter.svelte', parameters({ cssRegistry }));

    const match = result.contents.match(/import "(bun-svelte:[^"]+\.css)";/);
    expect(match).not.toBeNull();

    const loaded = cssRegistry.load(match![1]!);
    expect(String(loaded.contents)).toContain('rebeccapurple');
  });

  it('does not append a CSS import for a component without styles', async () => {
    const source = await readFixture('plain.svelte');

    const result = compileComponent(source, '/app/plain.svelte', parameters());

    expect(result.contents).not.toContain('bun-svelte:');
  });

  it('injected mode self-injects styles instead of importing CSS', async () => {
    const source = await readFixture('counter.svelte');

    const result = compileComponent(
      source,
      '/app/counter.svelte',
      parameters({ cssMode: 'injected' }),
    );

    expect(result.contents).toContain('append_styles');
    expect(result.contents).not.toContain('bun-svelte:');
  });

  it('emits HMR glue only when requested', async () => {
    const source = await readFixture('plain.svelte');

    const withHmr = compileComponent(source, '/app/plain.svelte', parameters({ hmr: true }));
    const withoutHmr = compileComponent(source, '/app/plain.svelte', parameters({ hmr: false }));

    expect(withHmr.contents).toContain('import.meta.hot');
    expect(withoutHmr.contents).not.toContain('import.meta.hot');
  });

  it('uses the rewritten filename for scoped CSS hashing', async () => {
    const source = await readFixture('counter.svelte');

    const first = compileComponent(
      source,
      '/one/counter.svelte',
      parameters({ filename: 'node_modules/pkg/counter.svelte' }),
    );
    const second = compileComponent(
      source,
      '/two/counter.svelte',
      parameters({ filename: 'node_modules/pkg/counter.svelte' }),
    );
    const different = compileComponent(
      source,
      '/three/counter.svelte',
      parameters({ filename: '/three/counter.svelte' }),
    );

    const scopeClass = (contents: string) => contents.match(/svelte-[a-z0-9]+/)?.[0];
    expect(scopeClass(first.contents)).toBe(scopeClass(second.contents)!);
    expect(scopeClass(different.contents)).not.toBe(scopeClass(first.contents));
  });

  it('forwards compiler warnings with positions', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const source = await readFixture('warning.svelte');

    compileComponent(source, '/app/warning.svelte', parameters());

    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]![0])).toMatch(/^\/app\/warning\.svelte:\d+:\d+: /);
  });

  it('maps compile errors to path:line:column messages', async () => {
    const source = await readFixture('broken.svelte');

    expect(() => compileComponent(source, '/app/broken.svelte', parameters())).toThrow(
      /^\/app\/broken\.svelte:\d+:\d+: /,
    );
  });
});
