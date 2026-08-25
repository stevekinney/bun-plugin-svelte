# @lostgradient/bun-plugin-svelte

A Bun plugin for Svelte 5 — compile `.svelte` components and `.svelte.(js|ts)` rune modules with `Bun.build()`, the runtime `Bun.plugin()`, or Bun's fullstack dev server (with HMR). Client and server (SSR) output, two CSS delivery modes, no preprocessors required: Svelte 5 compiles `<script lang="ts">` natively.

## Install

```sh
bun add -D @lostgradient/bun-plugin-svelte svelte
```

Requires Bun ≥ 1.3 and Svelte 5.

## Dev server (`bun index.html`)

Bun's fullstack dev server bundles the scripts and stylesheets referenced by an HTML entry. Register the plugin in `bunfig.toml` and point Bun at your page:

```toml
[serve.static]
plugins = ["@lostgradient/bun-plugin-svelte"]
```

```html
<!-- index.html -->
<!doctype html>
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts
// main.ts
import { mount } from 'svelte';

import Application from './application.svelte';

mount(Application, { target: document.getElementById('root')! });
```

```sh
bun index.html
```

Editing a component hot-reloads it in place: the dev server tells the plugin which side it is bundling and the Svelte compiler emits its own `import.meta.hot` glue. The same works from `Bun.serve()`:

```ts
import index from './index.html';

Bun.serve({
  routes: { '/': index },
  development: { hmr: true, console: true },
});
```

A runnable version of this app lives in [`example/`](./example).

## Bundler (`Bun.build`)

```ts
import { sveltePlugin } from '@lostgradient/bun-plugin-svelte';

await Bun.build({
  entrypoints: ['./src/main.ts'],
  outdir: './dist',
  target: 'browser',
  plugins: [sveltePlugin({ generate: 'client' })],
});
```

### Server-side rendering

Compile the same components for the server side and render them with `svelte/server`:

```ts
import { render } from 'svelte/server';
import { sveltePlugin } from '@lostgradient/bun-plugin-svelte';

await Bun.build({
  entrypoints: ['./src/application.svelte'],
  outdir: './dist/server',
  target: 'bun',
  plugins: [sveltePlugin({ generate: 'server' })],
});

const { default: Application } = await import('./dist/server/application.js');
const { head, body } = render(Application);
```

Client and server are two independent compilations of the same source — bundle each side separately, exactly as Vite and SvelteKit do.

## Runtime (`Bun.plugin`)

Register the plugin at runtime — for example in a `bun test` preload — and import `.svelte` files directly:

```ts
// preload.ts (wired up via bunfig.toml's `preload`)
import { plugin } from 'bun';
import { sveltePlugin } from '@lostgradient/bun-plugin-svelte';

plugin(sveltePlugin({ generate: 'client' }));
```

## Options

| Option            | Type                                 | Default                      | What it does                                                                                                         |
| ----------------- | ------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `generate`        | `'client' \| 'server'`               | inferred (see below)         | Which side to compile for.                                                                                           |
| `dev`             | `boolean`                            | `NODE_ENV === 'development'` | Dev-mode compiler checks and richer runtime errors.                                                                  |
| `css`             | `'injected' \| 'external' \| 'none'` | `'external'`                 | `'external'` extracts CSS into a real stylesheet asset; `'injected'` delivers styles from JS; `'none'` discards CSS. |
| `hmr`             | `boolean`                            | dev-server hint, else `dev`  | Whether the compiler emits hot-reload glue. Never applied to server compiles.                                        |
| `compileFilename` | `(path: string) => string`           | identity                     | Rewrite the filename the compiler sees. Scoped-CSS class hashes derive from it — see below.                          |
| `warningFilter`   | `(warning) => boolean`               | all warnings printed         | Return `false` to suppress a warning, e.g. `(w) => !w.code.startsWith('a11y')`. Components and rune modules.         |
| `compilerOptions` | `Pick<CompileOptions, …>`            | —                            | Pass-through for `customElement`, `runes`, and `namespace`. Components only — `compileModule` accepts none.          |

When `generate` is not set, the side comes from the dev server's per-request hint, then from the build target (`browser` → client, `node`/`bun` → server), and finally falls back to `server` — the runtime `Bun.plugin()` builder exposes no build config to infer from.

Bun only applies Svelte's `development` export condition when `NODE_ENV` is exactly `'development'`, and there's no `bunfig.toml` key that sets it. If you need dev-mode Svelte internals under some other `NODE_ENV`, pass `bun --conditions development` on the command line.

### `compileFilename`

Svelte derives scoped-CSS class names (`svelte-abc123`) from the compiler `filename`. If the same component is compiled once from a workspace checkout path and once from its published `node_modules` path — a common setup when a component library's server bundle and client bundle resolve the source differently — the class hashes disagree and hydration produces unstyled markup. `compileFilename` lets you normalize both paths to a single canonical string so both compilations agree.

### CSS modes

In `'external'` mode (the default) the plugin registers each component's extracted CSS as a virtual `bun-svelte:*.css` module and appends an import to the compiled JS; Bun bundles it into a real `.css` artifact (and the dev server serves it as a stylesheet). Server compiles never emit CSS imports — SSR output has nowhere to load a stylesheet from. Under the runtime `Bun.plugin()` loader, which supports no CSS loader at all, external mode degrades to `'none'` automatically.

In `'injected'` mode the compiled JS delivers its own styles — appended to the document at runtime on the client, and collected into `render()`'s `head` during SSR. This makes `'injected'` the right choice for SSR-only deployments that never ship a client stylesheet.

In `'none'` mode components compile with scoped class names but the CSS is discarded entirely — for component libraries whose stylesheets are built and shipped out of band (per-component CSS sidecars, a design-system cascade), where an auto-emitted stylesheet would duplicate rules.

One special case: with `compilerOptions: { customElement: true }`, Svelte always inlines styles into the element's shadow DOM and the `css` option is bypassed — no external CSS ever exists for custom elements.

### The `svelte` export condition

Packages that ship raw component source behind a `"svelte"` condition in their `exports` map (the convention `@sveltejs/package` produces) resolve to that source when you pass the condition to your build — the plugin then compiles it with your options:

```ts
await Bun.build({
  entrypoints: ['./src/main.ts'],
  target: 'browser',
  conditions: ['svelte'],
  plugins: [sveltePlugin({ generate: 'client' })],
});
```

You must pass `conditions: ['svelte']` yourself: a plugin cannot add it for you, because Bun snapshots the build config before plugins run (and the dev server and runtime loader expose no conditions configuration at all).

### TypeScript and `.svelte` imports

Svelte ships an ambient `declare module '*.svelte'` in its own types, so `import Application from './application.svelte'` type-checks as long as `svelte`'s types are part of your program (importing anything from `svelte` in the same project is enough). For precise per-component prop types, use `svelte-check`, which understands component internals.

## Not supported

- **Preprocessors** (Sass, PostCSS in `<style>`, `svelte-preprocess`): Svelte 5 handles TypeScript natively; anything else is out of scope for now.
- **Svelte 4 and earlier.**
- **Source maps** for compiled components: Bun's plugin API has no channel for layered source maps from `onLoad` results yet.
- The dev-server contract (`side`/`hmr` hints on load arguments) is not part of Bun's typed API; it is covered by unit tests against hand-built arguments and verified manually against the real dev server.

## License

MIT
