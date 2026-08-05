import { describe, expect, it } from 'bun:test';
import { plugin } from 'bun';

import { sveltePlugin } from './svelte-plugin.js';

// Registered once for the whole test process — the runtime plugin API has no
// unregister. Explicit `generate` so the process-global registration cannot
// surprise any other runtime `.svelte` import in this suite.
plugin(sveltePlugin({ generate: 'client', dev: false }));

describe('runtime Bun.plugin registration', () => {
  it('imports a component with a <style> block (external CSS degrades to none at runtime)', async () => {
    // Regression test: the runtime loader strips the `bun-svelte:` namespace
    // prefix from onLoad paths and supports no `css` loader — this import
    // crashed before the registry keyed by bare identifiers and external CSS
    // was degraded for the runtime builder.
    const module = await import('../test/fixtures/counter.svelte');

    expect(typeof module.default).toBe('function');
  });

  it('imports a .svelte.ts rune module at runtime', async () => {
    const module = await import('../test/fixtures/counter-state.svelte.ts');

    const counter = module.createCounter(3);
    counter.increment();

    expect(counter.count).toBe(4);
  });
});
