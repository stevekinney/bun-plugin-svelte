import { describe, expect, it } from 'bun:test';

import {
  createVirtualCssRegistry,
  stripNamespacePrefix,
  VIRTUAL_CSS_NAMESPACE,
} from './virtual-css.js';

describe('stripNamespacePrefix', () => {
  it('strips the bun-svelte prefix', () => {
    expect(stripNamespacePrefix('bun-svelte:counter.css')).toBe('counter.css');
  });

  it('leaves bare identifiers untouched', () => {
    expect(stripNamespacePrefix('counter.css')).toBe('counter.css');
  });
});

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

  it('accepts both prefixed and bare specifiers, as Bun.build and the runtime loader differ', () => {
    const registry = createVirtualCssRegistry();
    const specifier = registry.register('/app/counter.svelte', 'button {}');

    const prefixed = registry.load(specifier);
    const bare = registry.load(stripNamespacePrefix(specifier));

    expect(prefixed).toEqual(bare);
  });

  it('is idempotent — repeated loads return the same content', () => {
    const registry = createVirtualCssRegistry();
    const specifier = registry.register('/app/counter.svelte', 'button {}');

    registry.load(specifier);

    expect(registry.load(specifier).contents).toBe('button {}');
  });

  it('overwrites the entry in place when a component recompiles', () => {
    const registry = createVirtualCssRegistry();

    const first = registry.register('/app/counter.svelte', 'button { color: red; }');
    const second = registry.register('/app/counter.svelte', 'button { color: blue; }');

    expect(second).toBe(first);
    expect(registry.load(first).contents).toBe('button { color: blue; }');
  });

  it('throws for a specifier that was never registered', () => {
    const registry = createVirtualCssRegistry();

    expect(() => registry.load('bun-svelte:ghost.css')).toThrow(
      'Virtual CSS module not found: bun-svelte:ghost.css',
    );
  });
});
