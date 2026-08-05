import { compileModule } from 'svelte/compiler';

import { forwardWarnings, mapCompileError } from './errors.js';
import type { GenerationSide } from './options.js';

/** Everything a single `.svelte.(js|ts)` compilation needs, resolved ahead of time. */
export type RuneModuleCompileParameters = {
  side: GenerationSide;
  dev: boolean;
  /** Filename handed to the compiler — already rewritten by `compileFilename`. */
  filename: string;
  /** Shared TS transpiler; rune modules written in TypeScript are transpiled before `compileModule`. */
  transpiler: Bun.Transpiler;
};

/** JS module produced from a rune module, ready to return from `onLoad`. */
export type CompiledRuneModule = {
  contents: string;
  loader: 'js';
};

/**
 * Compile a `.svelte.js` / `.svelte.ts` rune module. `compileModule` only
 * accepts JavaScript, so TypeScript sources are transpiled first. HMR is never
 * passed here — a plain module has no component boundary to hot-swap.
 */
export async function compileRuneModule(
  source: string,
  path: string,
  parameters: RuneModuleCompileParameters,
): Promise<CompiledRuneModule> {
  const { side, dev, filename, transpiler } = parameters;

  const javascriptSource = path.endsWith('.ts') ? await transpiler.transform(source) : source;

  let result;
  try {
    result = compileModule(javascriptSource, {
      filename,
      generate: side,
      dev,
    });
  } catch (error) {
    throw mapCompileError(error, path);
  }

  forwardWarnings(result.warnings, path);

  return { contents: result.js.code, loader: 'js' };
}
