import { describe, expect, it } from 'bun:test';

import { createVirtualCssRegistry, VIRTUAL_CSS_NAMESPACE } from './virtual-css.js';

describe('VirtualCssRegistry', () => {
  it('returns a namespaced specifier derived from the source path', () => {
    const registry = createVirtualCssRegistry();

    const specifier = registry.register('/app/counter.svelte', 'button { color: red; }');

    expect(specifier).toStartWith(`${VIRTUAL_CSS_NAMESPACE}:counter.svelte-`);
    expect(specifier).toEndWith('-style.css');
  });

  it('disambiguates different paths with the same basename', () => {
    const registry = createVirtualCssRegistry();

    const first = registry.register('/one/counter.svelte', 'a {}');
    const second = registry.register('/two/counter.svelte', 'b {}');

    expect(first).not.toBe(second);
  });

  it('loads registered CSS with the css loader and watches the source file', () => {
    const registry = createVirtualCssRegistry();
    const specifier = registry.register('/app/counter.svelte', 'button { color: red; }');

    const result = registry.load(specifier);

    expect(result).toEqual({
      contents: 'button { color: red; }',
      loader: 'css',
      watchFiles: ['/app/counter.svelte'],
    });
  });

  it('consumes entries on load', () => {
    const registry = createVirtualCssRegistry();
    const specifier = registry.register('/app/counter.svelte', 'button {}');

    registry.load(specifier);

    expect(() => registry.load(specifier)).toThrow(/not found/);
  });

  it('throws for a specifier that was never registered', () => {
    const registry = createVirtualCssRegistry();

    expect(() => registry.load('bun-svelte:ghost.css')).toThrow(
      'Virtual CSS module not found: bun-svelte:ghost.css',
    );
  });
});
