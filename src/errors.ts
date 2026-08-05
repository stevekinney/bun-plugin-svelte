type Position = { line: number; column: number };

type SvelteCompileError = {
  name: 'CompileError';
  code: string;
  message: string;
  start?: Position;
};

/** A compiler warning, structurally matching what `svelte/compiler` emits. */
export type SvelteWarning = {
  code: string;
  message: string;
  start?: Position | undefined;
};

/** Narrow an unknown value to a plain indexable object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPosition(value: unknown): value is Position {
  return (
    isRecord(value) && typeof value['line'] === 'number' && typeof value['column'] === 'number'
  );
}

/** Narrow an unknown thrown value to Svelte's `CompileError` shape. */
export function isSvelteCompileError(value: unknown): value is SvelteCompileError {
  return (
    isRecord(value) &&
    value['name'] === 'CompileError' &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string' &&
    (value['start'] === undefined || isPosition(value['start']))
  );
}

/**
 * Map a value thrown by the Svelte compiler into an `Error` whose message
 * carries `path:line:column` so it stays legible in `Bun.build` logs, which do
 * not thread structured positions through plugin `onLoad` failures. The
 * original error is preserved as `cause`.
 */
export function mapCompileError(error: unknown, path: string): Error {
  if (isSvelteCompileError(error)) {
    const { line, column } = error.start ?? { line: 1, column: 0 };
    return new Error(`${path}:${line}:${column}: ${error.message} (${error.code})`, {
      cause: error,
    });
  }

  if (error instanceof Error) return error;

  return new Error(String(error));
}

/**
 * Fail fast with a clear message when this package is loaded outside Bun.
 * Under plain Node the module would import cleanly and then crash deep inside
 * a bundler callback with a bare `ReferenceError: Bun is not defined`; this
 * converts that into an immediate, actionable error at import time.
 */
export function assertBunRuntime(scope: { Bun?: unknown }): void {
  if (scope.Bun === undefined) {
    throw new Error(
      '@lostgradient/bun-plugin-svelte requires the Bun runtime (it uses Bun.Transpiler and Bun.file). Run under Bun, or use @sveltejs/vite-plugin-svelte for Node-based toolchains.',
    );
  }
}

/**
 * Map a TypeScript transpile failure (thrown by `Bun.Transpiler`, before the
 * Svelte compiler ever runs) into an `Error` that names the offending file —
 * Bun's transpiler errors do not carry the path themselves.
 */
export function mapTranspileError(error: unknown, path: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  return new Error(`${path}: TypeScript transpile failed: ${message}`, { cause: error });
}

/** Print compiler warnings with file positions; Bun's plugin API has no warnings channel. */
export function forwardWarnings(warnings: readonly SvelteWarning[], path: string): void {
  for (const warning of warnings) {
    const { line, column } = warning.start ?? { line: 1, column: 0 };
    // oxlint-disable-next-line no-console -- the console IS the warnings channel here
    console.warn(`${path}:${line}:${column}: ${warning.message} (${warning.code})`);
  }
}
