import { basename } from 'node:path';

import { hashPath } from './options.js';

/** Namespace for virtual CSS modules extracted from component `<style>` blocks. */
export const VIRTUAL_CSS_NAMESPACE = 'bun-svelte';

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
  /** Store a component's CSS and return the virtual import specifier for it. */
  register: (sourcePath: string, code: string) => string;
  /** Consume a registered virtual module, returning a CSS load result for Bun. */
  load: (specifier: string) => VirtualCssLoadResult;
};

/**
 * Create a registry that holds CSS extracted from components compiled in
 * `'external'` mode until the bundler loads the matching virtual
 * `bun-svelte:*.css` import. Entries are consumed on load so a long-lived
 * registry does not accumulate stale CSS across rebuilds.
 */
export function createVirtualCssRegistry(): VirtualCssRegistry {
  const modules = new Map<string, { sourcePath: string; code: string }>();

  return {
    register(sourcePath, code) {
      const identifier = `${basename(sourcePath)}-${hashPath(sourcePath)}-style`.replaceAll(
        '"',
        "'",
      );
      const specifier = `${VIRTUAL_CSS_NAMESPACE}:${identifier}.css`;

      modules.set(specifier, { sourcePath, code });
      return specifier;
    },

    load(specifier) {
      const entry = modules.get(specifier);
      if (entry === undefined) {
        throw new Error(`Virtual CSS module not found: ${specifier}`);
      }

      modules.delete(specifier);

      return {
        contents: entry.code,
        loader: 'css',
        watchFiles: [entry.sourcePath],
      };
    },
  };
}
