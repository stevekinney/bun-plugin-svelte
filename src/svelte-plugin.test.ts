import { describe, expect, it, spyOn } from 'bun:test';
import type { OnLoadArgs, OnLoadResult, OnResolveArgs, OnResolveResult } from 'bun';

import defaultPlugin, { sveltePlugin } from './index.js';
import { VIRTUAL_CSS_NAMESPACE } from './virtual-css.js';

const fixturesDirectory = new URL('../test/fixtures/', import.meta.url).pathname;

function fixture(name: string): string {
  return `${fixturesDirectory}${name}`;
}

type LoadHandler = (args: OnLoadArgs) => OnLoadResult | Promise<OnLoadResult>;
type ResolveHandler = (args: OnResolveArgs) => OnResolveResult | Promise<OnResolveResult>;

/**
 * Minimal stand-in for Bun's PluginBuilder that records registered hooks so
 * tests can invoke them with hand-built arguments — including the dev-server
 * `side`/`hmr` hints that `Bun.build` can never produce.
 */
function stubBuilder(config?: Record<string, unknown>) {
  const loads: { filter: RegExp; namespace?: string; handler: LoadHandler }[] = [];
  const resolves: { filter: RegExp; handler: ResolveHandler }[] = [];

  const builder = {
    config,
    onLoad(constraints: { filter: RegExp; namespace?: string }, handler: LoadHandler) {
      loads.push({ ...constraints, handler });
      return builder;
    },
    onResolve(constraints: { filter: RegExp }, handler: ResolveHandler) {
      resolves.push({ ...constraints, handler });
      return builder;
    },
    onStart() {
      return builder;
    },
  };

  return { builder, loads, resolves };
}

function findLoadHandler(
  loads: { filter: RegExp; namespace?: string; handler: LoadHandler }[],
  path: string,
  namespace?: string,
): LoadHandler {
  const entry = loads.find(
    (candidate) => candidate.filter.test(path) && candidate.namespace === namespace,
  );
  if (!entry) throw new Error(`no onLoad handler matched ${path}`);
  return entry.handler;
}

function loadArguments(path: string, extra: Record<string, unknown> = {}): OnLoadArgs {
  return { path, namespace: 'file', loader: 'js', defer: () => Promise.resolve(), ...extra } as any;
}

describe('sveltePlugin', () => {
  it('rejects invalid options up front', () => {
    expect(() => sveltePlugin({ generate: 'universal' } as any)).toThrow(TypeError);
  });

  it('exports a ready plugin object as the default export', () => {
    expect(typeof defaultPlugin).toBe('object');
    expect(defaultPlugin.name).toBe('@lostgradient/bun-plugin-svelte');
    expect(typeof defaultPlugin.setup).toBe('function');
  });

  describe('svelte export condition', () => {
    it('appends svelte to existing array conditions', () => {
      const { builder } = stubBuilder({ conditions: ['browser'] });
      sveltePlugin().setup(builder as any);
      expect(builder.config!['conditions']).toEqual(['browser', 'svelte']);
    });

    it('normalizes a string condition', () => {
      const { builder } = stubBuilder({ conditions: 'browser' });
      sveltePlugin().setup(builder as any);
      expect(builder.config!['conditions']).toEqual(['browser', 'svelte']);
    });

    it('creates conditions when none exist', () => {
      const { builder } = stubBuilder({});
      sveltePlugin().setup(builder as any);
      expect(builder.config!['conditions']).toEqual(['svelte']);
    });

    it('does not duplicate an existing svelte condition', () => {
      const { builder } = stubBuilder({ conditions: ['svelte'] });
      sveltePlugin().setup(builder as any);
      expect(builder.config!['conditions']).toEqual(['svelte']);
    });

    it('tolerates the runtime builder having no config at all', () => {
      const { builder, loads, resolves } = stubBuilder(undefined);
      expect(() => sveltePlugin().setup(builder as any)).not.toThrow();
      expect(loads.length).toBe(3);
      expect(resolves.length).toBe(1);
    });
  });

  describe('dev server hints', () => {
    it('compiles client code with HMR when the dev server asks for it', async () => {
      const { builder, loads } = stubBuilder({ target: 'browser' });
      sveltePlugin().setup(builder as any);
      const handler = findLoadHandler(loads, 'counter.svelte');

      const result = await handler(
        loadArguments(fixture('plain.svelte'), { side: 'client', hmr: true }),
      );

      expect(String((result as { contents: string }).contents)).toContain('import.meta.hot');
    });

    it('compiles server code without HMR when the dev server asks for the server side', async () => {
      const { builder, loads } = stubBuilder({ target: 'browser' });
      sveltePlugin().setup(builder as any);
      const handler = findLoadHandler(loads, 'counter.svelte');

      const result = await handler(
        loadArguments(fixture('plain.svelte'), { side: 'server', hmr: true }),
      );

      const contents = String((result as { contents: string }).contents);
      expect(contents).toContain('svelte/internal/server');
      expect(contents).not.toContain('import.meta.hot');
    });

    it('routes rune modules through the dev server side hint', async () => {
      const { builder, loads } = stubBuilder({ target: 'browser' });
      sveltePlugin().setup(builder as any);
      const handler = findLoadHandler(loads, 'counter-state.svelte.ts');

      const result = await handler(
        loadArguments(fixture('counter-state.svelte.ts'), { side: 'server' }),
      );

      expect(String((result as { contents: string }).contents)).toContain('svelte/internal/server');
    });
  });

  describe('virtual CSS wiring', () => {
    it('resolves and loads the virtual CSS module a component registers', async () => {
      const { builder, loads, resolves } = stubBuilder({ target: 'browser' });
      sveltePlugin({ dev: false }).setup(builder as any);

      const componentHandler = findLoadHandler(loads, 'counter.svelte');
      const compiled = await componentHandler(loadArguments(fixture('counter.svelte')));
      const specifier = String((compiled as { contents: string }).contents).match(
        /import "(bun-svelte:[^"]+\.css)";/,
      )![1]!;

      const resolved = await resolves[0]!.handler({ path: specifier } as any);
      expect(resolved).toEqual({ path: specifier, namespace: VIRTUAL_CSS_NAMESPACE });

      const cssHandler = findLoadHandler(
        loads,
        `${VIRTUAL_CSS_NAMESPACE}:x.css`,
        VIRTUAL_CSS_NAMESPACE,
      );
      const css = await cssHandler(loadArguments(specifier));
      expect(String((css as { contents: string }).contents)).toContain('rebeccapurple');
    });
  });

  describe('Bun.build integration', () => {
    it('bundles a client component with external CSS as a separate artifact', async () => {
      const result = await Bun.build({
        entrypoints: [fixture('counter.svelte')],
        target: 'browser',
        plugins: [sveltePlugin({ generate: 'client', dev: false })],
        throw: false,
      });

      expect(result.success).toBe(true);

      const javascript = result.outputs.find((output) => output.path.endsWith('.js'));
      const css = result.outputs.find((output) => output.path.endsWith('.css'));
      expect(javascript).toBeDefined();
      expect(css).toBeDefined();
      expect(await css!.text()).toContain('button.svelte-');
    });

    it('bundles injected CSS into the JS with no CSS artifact', async () => {
      const result = await Bun.build({
        entrypoints: [fixture('counter.svelte')],
        target: 'browser',
        plugins: [sveltePlugin({ generate: 'client', css: 'injected', dev: false })],
        throw: false,
      });

      expect(result.success).toBe(true);
      expect(result.outputs.some((output) => output.path.endsWith('.css'))).toBe(false);
      const javascript = result.outputs.find((output) => output.path.endsWith('.js'));
      expect(await javascript!.text()).toContain('append_styles');
    });

    it('bundles server output that imports svelte/internal/server', async () => {
      const result = await Bun.build({
        entrypoints: [fixture('counter.svelte')],
        target: 'bun',
        external: ['svelte', 'svelte/*'],
        plugins: [sveltePlugin({ dev: false })],
        throw: false,
      });

      expect(result.success).toBe(true);
      const javascript = result.outputs.find((output) => output.path.endsWith('.js'));
      expect(await javascript!.text()).toContain('svelte/internal/server');
    });

    it('bundles a .svelte.ts rune module entrypoint', async () => {
      const result = await Bun.build({
        entrypoints: [fixture('counter-state.svelte.ts')],
        target: 'browser',
        plugins: [sveltePlugin({ generate: 'client', dev: false })],
        throw: false,
      });

      expect(result.success).toBe(true);
    });

    it('reports mapped errors for a broken component', async () => {
      const warn = spyOn(console, 'warn').mockImplementation(() => {});
      const error = spyOn(console, 'error').mockImplementation(() => {});

      const result = await Bun.build({
        entrypoints: [fixture('broken.svelte')],
        target: 'browser',
        plugins: [sveltePlugin({ generate: 'client', dev: false })],
        throw: false,
      });

      expect(result.success).toBe(false);
      expect(result.logs.map(String).join('\n')).toMatch(/broken\.svelte:\d+:\d+: /);

      warn.mockRestore();
      error.mockRestore();
    });
  });
});
