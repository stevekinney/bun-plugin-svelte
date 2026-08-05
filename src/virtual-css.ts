import { basename } from 'node:path';

import { hashPath } from './options.js';

/** Namespace for virtual CSS modules extracted from component `<style>` blocks. */
export const VIRTUAL_CSS_NAMESPACE = 'bun-svelte';

const NAMESPACE_PREFIX = `${VIRTUAL_CSS_NAMESPACE}:`;

/**
 * Load result for a virtual CSS module. `watchFiles` is honored by Bun's dev
 * server for invalidation but is missing from the published `bun-types`
 * `OnLoadResult`, so this local type carries it; it is structurally assignable
 * where Bun expects a load result.
 */
export type VirtualCssLoadResult = {
  contents: string;
  loader: 'css';
  watchFiles: string[];
};

/** Holds CSS extracted from components compiled in `'external'` mode. */
export type VirtualCssRegistry = {
  /** Store a component's CSS and return the namespaced virtual import specifier for it. */
  register: (sourcePath: string, code: string) => string;
  /** Look up a registered virtual module, returning a CSS load result for Bun. */
  load: (specifier: string) => VirtualCssLoadResult;
};

/**
 * Strip the `bun-svelte:` namespace prefix from a specifier if present.
 *
 * `Bun.build` hands namespaced `onLoad` callbacks the path exactly as returned
 * from `onResolve`, but the runtime `Bun.plugin()` module loader strips the
 * namespace prefix first — so the registry keys by the bare identifier and
 * normalizes whichever form arrives.
 */
export function stripNamespacePrefix(specifier: string): string {
  return specifier.startsWith(NAMESPACE_PREFIX)
    ? specifier.slice(NAMESPACE_PREFIX.length)
    : specifier;
}

/**
 * Create a registry that holds CSS extracted from components compiled in
 * `'external'` mode until the bundler loads the matching virtual
 * `bun-svelte:*.css` import. Entries are keyed by source path (via a stable
 * hash), so recompiling a component overwrites its entry in place; loads are
 * idempotent because the dev server and the runtime loader may request the
 * same module more than once. Size is bounded by the module graph — one entry
 * per distinct component file.
 */
export function createVirtualCssRegistry(): VirtualCssRegistry {
  const modules = new Map<string, { sourcePath: string; code: string }>();

  return {
    register(sourcePath, code) {
      const identifier = `${basename(sourcePath)}-${hashPath(sourcePath)}-style.css`.replaceAll(
        '"',
        "'",
      );

      modules.set(identifier, { sourcePath, code });
      return `${NAMESPACE_PREFIX}${identifier}`;
    },

    load(specifier) {
      const identifier = stripNamespacePrefix(specifier);

      const entry = modules.get(identifier);
      if (entry === undefined) {
        throw new Error(`Virtual CSS module not found: ${specifier}`);
      }

      return {
        contents: entry.code,
        loader: 'css',
        watchFiles: [entry.sourcePath],
      };
    },
  };
}
