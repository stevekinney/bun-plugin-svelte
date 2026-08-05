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

/** Print compiler warnings with file positions; Bun's plugin API has no warnings channel. */
export function forwardWarnings(warnings: readonly SvelteWarning[], path: string): void {
  for (const warning of warnings) {
    const { line, column } = warning.start ?? { line: 1, column: 0 };
    // oxlint-disable-next-line no-console -- the console IS the warnings channel here
    console.warn(`${path}:${line}:${column}: ${warning.message} (${warning.code})`);
  }
}
