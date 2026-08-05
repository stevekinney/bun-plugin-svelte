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
import {
  createVirtualCssRegistry,
  stripNamespacePrefix,
  VIRTUAL_CSS_NAMESPACE,
} from './virtual-css.js';

/**
 * Create a Bun plugin that compiles Svelte 5 `.svelte` components and
 * `.svelte.(js|ts)` rune modules. Works with `Bun.build()`, the runtime
 * `Bun.plugin()`, and Bun's fullstack dev server (`[serve.static]` plugins in
 * `bunfig.toml`), including HMR when the dev server requests client code.
 *
 * To resolve libraries that ship raw component source behind a `svelte`
 * export condition, pass `conditions: ['svelte']` to `Bun.build()` yourself —
 * mutating `builder.config` from `setup()` is a no-op in every registration
 * mode (verified against Bun 1.3: `Bun.build` snapshots its config before
 * plugins run, the dev server hands plugins a config it never reads, and the
 * runtime builder has no config at all), so this plugin does not pretend to.
 */
export function sveltePlugin(options: SvelteOptions = {}): BunPlugin {
  validateOptions(options);

  return {
    name: '@lostgradient/bun-plugin-svelte',
    setup(builder: PluginBuilder) {
      // The runtime Bun.plugin() builder has no config; guard every read.
      const config = (builder as { config?: Partial<BuildConfig> }).config;

      // The runtime module loader (Bun.plugin, the only builder without a
      // config) supports no `css` loader, so a virtual CSS import emitted
      // there could never load — degrade external mode to discarding CSS.
      const cssMode = options.css ?? 'external';
      const effectiveCssMode = cssMode === 'external' && config === undefined ? 'none' : cssMode;

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
          cssMode: effectiveCssMode,
          filename: resolveCompileFilename(options, args.path),
          compilerOptions: options.compilerOptions,
          warningFilter: options.warningFilter,
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
          warningFilter: options.warningFilter,
          transpiler,
        });
      });

      // Strip the namespace prefix from the resolved path: Bun renders module
      // identity as `namespace:path`, so passing the prefixed specifier
      // through doubles the prefix in emitted CSS banners; the registry keys
      // by the bare identifier either way.
      builder.onResolve({ filter: /^bun-svelte:/ }, (args) => ({
        path: stripNamespacePrefix(args.path),
        namespace: VIRTUAL_CSS_NAMESPACE,
      }));

      builder.onLoad({ filter: /\.css$/, namespace: VIRTUAL_CSS_NAMESPACE }, (args) =>
        cssRegistry.load(args.path),
      );
    },
  };
}
