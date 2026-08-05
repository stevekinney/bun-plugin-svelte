import { compile } from 'svelte/compiler';

import { forwardWarnings, mapCompileError } from './errors.js';
import type { CssMode, GenerationSide, SvelteOptions } from './options.js';
import type { VirtualCssRegistry } from './virtual-css.js';

/** Everything a single `.svelte` compilation needs, resolved ahead of time. */
export type ComponentCompileParameters = {
  side: GenerationSide;
  dev: boolean;
  hmr: boolean;
  cssMode: CssMode;
  /** Filename handed to the compiler — already rewritten by `compileFilename`. */
  filename: string;
  compilerOptions: SvelteOptions['compilerOptions'];
  cssRegistry: VirtualCssRegistry;
};

/** JS module produced from a component, ready to return from `onLoad`. */
export type CompiledComponent = {
  contents: string;
  loader: 'js';
};

/**
 * Compile a `.svelte` component for one side. In `'external'` CSS mode, client
 * compiles register their extracted CSS as a virtual module and import it;
 * server compiles never emit a CSS import (SSR output has nowhere to load a
 * stylesheet), and `'injected'` mode needs no plugin-side CSS handling because
 * the compiled JS appends its own styles at runtime.
 */
export function compileComponent(
  source: string,
  path: string,
  parameters: ComponentCompileParameters,
): CompiledComponent {
  const { side, dev, hmr, cssMode, filename, compilerOptions, cssRegistry } = parameters;

  let result;
  try {
    result = compile(source, {
      ...compilerOptions,
      filename,
      generate: side,
      css: cssMode,
      dev,
      hmr,
    });
  } catch (error) {
    throw mapCompileError(error, path);
  }

  forwardWarnings(result.warnings, path);

  let contents = result.js.code;
  if (
    cssMode === 'external' &&
    side !== 'server' &&
    result.css !== null &&
    result.css.code !== ''
  ) {
    const specifier = cssRegistry.register(path, result.css.code);
    contents += `\nimport "${specifier}";`;
  }

  return { contents, loader: 'js' };
}
