import type { BuildConfig, BunPlugin, OnLoadArgs, PluginBuilder } from 'bun';

import { compileComponent } from './compile-component.js';
import { compileRuneModule } from './compile-module.js';
import {
  resolveCompileFilename,
  resolveDev,
  resolveHmr,
  resolveSide,
  validateOptions,
  type DevServerHints,
  type SvelteOptions,
} from './options.js';
import { createVirtualCssRegistry, VIRTUAL_CSS_NAMESPACE } from './virtual-css.js';

/**
 * Append the `svelte` export condition so package resolution prefers raw
 * `.svelte` source from Svelte-aware libraries (which ship uncompiled
 * components) over their `default` entry. Only `Bun.build` consults this —
 * the runtime `Bun.plugin()` builder exposes no config, and the dev server
 * passes plugins a config object it never reads.
 */
function appendSvelteCondition(config: Partial<BuildConfig> | undefined): void {
  if (config === undefined) return;

  const existing =
    typeof config.conditions === 'string' ? [config.conditions] : (config.conditions ?? []);
  if (!existing.includes('svelte')) {
    config.conditions = [...existing, 'svelte'];
  }
}

/**
 * Create a Bun plugin that compiles Svelte 5 `.svelte` components and
 * `.svelte.(js|ts)` rune modules. Works with `Bun.build()`, the runtime
 * `Bun.plugin()`, and Bun's fullstack dev server (`[serve.static]` plugins in
 * `bunfig.toml`), including HMR when the dev server requests client code.
 */
export function sveltePlugin(options: SvelteOptions = {}): BunPlugin {
  validateOptions(options);

  return {
    name: '@lostgradient/bun-plugin-svelte',
    setup(builder: PluginBuilder) {
      // The runtime Bun.plugin() builder has no config; guard every read.
      const config = (builder as { config?: Partial<BuildConfig> }).config;
      appendSvelteCondition(config);

      const target = config?.target;
      const dev = resolveDev(options);
      const cssRegistry = createVirtualCssRegistry();
      const transpiler = new Bun.Transpiler(
        target === undefined ? { loader: 'ts' } : { loader: 'ts', target },
      );

      builder.onLoad({ filter: /\.svelte$/ }, async (args: OnLoadArgs) => {
        const hints = args as OnLoadArgs & DevServerHints;
        const side = resolveSide(options, hints, target);
        const source = await Bun.file(args.path).text();

        return compileComponent(source, args.path, {
          side,
          dev,
          hmr: resolveHmr(options, hints, side, dev),
          cssMode: options.css ?? 'external',
          filename: resolveCompileFilename(options, args.path),
          compilerOptions: options.compilerOptions,
          cssRegistry,
        });
      });

      builder.onLoad({ filter: /\.svelte\.(js|ts)$/ }, async (args: OnLoadArgs) => {
        const hints = args as OnLoadArgs & DevServerHints;
        const source = await Bun.file(args.path).text();

        return compileRuneModule(source, args.path, {
          side: resolveSide(options, hints, target),
          dev,
          filename: resolveCompileFilename(options, args.path),
          transpiler,
        });
      });

      builder.onResolve({ filter: /^bun-svelte:/ }, (args) => ({
        path: args.path,
        namespace: VIRTUAL_CSS_NAMESPACE,
      }));

      builder.onLoad({ filter: /\.css$/, namespace: VIRTUAL_CSS_NAMESPACE }, (args) =>
        cssRegistry.load(args.path),
      );
    },
  };
}
