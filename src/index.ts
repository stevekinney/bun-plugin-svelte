import { assertBunRuntime } from './errors.js';
import { sveltePlugin } from './svelte-plugin.js';

assertBunRuntime(globalThis);

export { sveltePlugin } from './svelte-plugin.js';
export type { CssMode, DevServerHints, GenerationSide, SvelteOptions } from './options.js';
export type { VirtualCssLoadResult } from './virtual-css.js';

/**
 * Ready-to-use plugin instance with default options, so bunfig string
 * registration works directly:
 *
 * ```toml
 * [serve.static]
 * plugins = ["@lostgradient/bun-plugin-svelte"]
 * ```
 *
 * Bun resolves that string to this package's default export and expects an
 * already-constructed plugin object, not a factory. Call
 * {@link sveltePlugin} instead when you need options.
 */
export default sveltePlugin();
