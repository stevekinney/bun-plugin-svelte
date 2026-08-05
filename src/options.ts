import type { BuildConfig } from 'bun';
import type { CompileOptions, Warning } from 'svelte/compiler';

import { isRecord } from './errors.js';

/** Which code the Svelte compiler generates: DOM-mounting client code or SSR server code. */
export type GenerationSide = 'client' | 'server';

/**
 * How component `<style>` blocks are delivered: `'injected'` inlines them into
 * the JS bundle and appends them to the document at runtime (and into `head`
 * during SSR); `'external'` extracts them into a virtual CSS module that Bun
 * bundles as a real stylesheet; `'none'` compiles scoped classes but discards
 * the CSS entirely — for libraries that manage stylesheets out of band.
 */
export type CssMode = 'injected' | 'external' | 'none';

/**
 * Extra fields Bun's fullstack dev server adds to `onLoad` arguments. They are
 * not part of the public `bun-types` surface, so every read goes through this
 * shape instead of trusting the type system.
 */
export type DevServerHints = {
  side?: GenerationSide;
  hmr?: boolean;
};

/** Options accepted by {@link import('./svelte-plugin.ts').sveltePlugin}. */
export type SvelteOptions = {
  /** Force client or server codegen. Overrides dev-server hints and build-target inference. */
  generate?: GenerationSide;
  /** Enable dev-mode compiler checks and richer errors. Defaults to `NODE_ENV !== 'production'`. */
  dev?: boolean;
  /** CSS delivery mode. Defaults to `'external'`. */
  css?: CssMode;
  /** Force HMR glue on or off. Defaults to the dev-server-supplied flag, else `dev` — and never applies to server compiles. */
  hmr?: boolean;
  /**
   * Rewrite the filename handed to the Svelte compiler. Scoped-CSS class
   * hashes derive from this filename, so workspace and published copies of the
   * same component must map to the same string here or server and client
   * output disagree on class names and cannot hydrate each other.
   */
  compileFilename?: (path: string) => string;
  /**
   * Filter compiler warnings before they are printed: return `false` to
   * suppress a warning. Forwarded to both component and rune-module compiles.
   */
  warningFilter?: (warning: Warning) => boolean;
  /**
   * Passed through to `svelte/compiler` for component compiles only —
   * `compileModule` accepts none of these fields (rune modules are always in
   * runes mode and have no markup for `customElement`/`namespace` to affect).
   */
  compilerOptions?: Pick<CompileOptions, 'customElement' | 'runes' | 'namespace'>;
};

function isGenerationSide(value: unknown): value is GenerationSide {
  return value === 'client' || value === 'server';
}

function isCssMode(value: unknown): value is CssMode {
  return value === 'injected' || value === 'external' || value === 'none';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFunction(value: unknown): value is (path: string) => string {
  return typeof value === 'function';
}

const OPTION_VALIDATORS = {
  generate: { isValid: isGenerationSide, expected: "'client' or 'server'" },
  css: { isValid: isCssMode, expected: "'injected', 'external', or 'none'" },
  dev: { isValid: isBoolean, expected: 'a boolean' },
  hmr: { isValid: isBoolean, expected: 'a boolean' },
  compileFilename: { isValid: isFunction, expected: 'a function' },
  warningFilter: { isValid: isFunction, expected: 'a function' },
} as const;

/**
 * Validate a plugin options object, throwing a `TypeError` describing the
 * first invalid field. Accepts anything structurally matching
 * {@link SvelteOptions}.
 */
export function validateOptions(options: unknown): asserts options is SvelteOptions {
  if (!isRecord(options)) {
    throw new TypeError(`sveltePlugin options must be an object, got ${typeof options}`);
  }

  for (const [field, { isValid, expected }] of Object.entries(OPTION_VALIDATORS)) {
    const value = options[field];
    if (value !== undefined && !isValid(value)) {
      throw new TypeError(`options.${field} must be ${expected}, got ${JSON.stringify(value)}`);
    }
  }
}

/** Resolve the effective dev flag: the explicit option wins, else `NODE_ENV`. */
export function resolveDev(options: SvelteOptions): boolean {
  return options.dev ?? process.env['NODE_ENV'] !== 'production';
}

/**
 * Resolve which side to generate for a given load. Precedence: the explicit
 * `generate` option, then the dev server's per-request `side` hint, then
 * inference from the build target (`browser` bundles are client code; `node`
 * and `bun` bundles are server code), then `'server'` — the safe fallback for
 * the runtime `Bun.plugin()` builder, which exposes no build config at all.
 */
export function resolveSide(
  options: SvelteOptions,
  hints: DevServerHints,
  target: BuildConfig['target'] | undefined,
): GenerationSide {
  if (options.generate !== undefined) return options.generate;
  if (isGenerationSide(hints.side)) return hints.side;
  if (target === 'browser') return 'client';
  if (target === 'node' || target === 'bun') return 'server';

  return 'server';
}

/**
 * Resolve whether to compile with HMR glue. The explicit option wins, then the
 * dev server's hint, then the dev flag — but HMR is never enabled for server
 * compiles, where there is no live DOM to hot-swap.
 */
export function resolveHmr(
  options: SvelteOptions,
  hints: DevServerHints,
  side: GenerationSide,
  dev: boolean,
): boolean {
  if (side === 'server') return false;

  return options.hmr ?? hints.hmr ?? dev;
}

/** Apply the `compileFilename` rewrite hook, defaulting to the path unchanged. */
export function resolveCompileFilename(options: SvelteOptions, path: string): string {
  return options.compileFilename === undefined ? path : options.compileFilename(path);
}

/** Short, stable, filename-safe hash used to disambiguate virtual CSS specifiers. */
export function hashPath(value: string): string {
  return Bun.hash(value, 5381).toString(36);
}
