import { describe, expect, it, spyOn } from 'bun:test';
import { compile } from 'svelte/compiler';

import { forwardWarnings, isSvelteCompileError, mapCompileError } from './errors.js';

function captureCompileError(): unknown {
  try {
    compile('<div>{', { filename: 'broken.svelte', generate: 'client' });
  } catch (error) {
    return error;
  }
  throw new Error('expected compile to throw');
}

describe('isSvelteCompileError', () => {
  it('recognizes a real thrown CompileError', () => {
    expect(isSvelteCompileError(captureCompileError())).toBe(true);
  });

  it.each([null, 'oops', new Error('plain'), { name: 'CompileError' }])('rejects %p', (value) => {
    expect(isSvelteCompileError(value)).toBe(false);
  });

  it('rejects a CompileError shape with a malformed position', () => {
    const candidate = {
      name: 'CompileError',
      code: 'x',
      message: 'y',
      start: { line: 'one' },
    };
    expect(isSvelteCompileError(candidate)).toBe(false);
  });
});

describe('mapCompileError', () => {
  it('formats path, position, message, and code from a real CompileError', () => {
    const mapped = mapCompileError(captureCompileError(), '/app/broken.svelte');

    expect(mapped.message).toMatch(/^\/app\/broken\.svelte:\d+:\d+: /);
    expect(mapped.message).toContain('(');
    expect(mapped.cause).toBeDefined();
  });

  it('defaults to line 1 column 0 when the error has no position', () => {
    const positionless = { name: 'CompileError', code: 'mystery', message: 'boom' };

    const mapped = mapCompileError(positionless, '/app/broken.svelte');

    expect(mapped.message).toBe('/app/broken.svelte:1:0: boom (mystery)');
  });

  it('passes plain Error values through untouched', () => {
    const original = new Error('plain');
    expect(mapCompileError(original, '/app/x.svelte')).toBe(original);
  });

  it('wraps non-Error thrown values', () => {
    const mapped = mapCompileError('a string', '/app/x.svelte');
    expect(mapped).toBeInstanceOf(Error);
    expect(mapped.message).toBe('a string');
  });
});

describe('forwardWarnings', () => {
  it('prints each warning with its position and code', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});

    forwardWarnings(
      [
        { code: 'a11y_missing_attribute', message: 'needs alt', start: { line: 3, column: 2 } },
        { code: 'positionless_warning', message: 'somewhere' },
      ],
      '/app/warning.svelte',
    );

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(
      1,
      '/app/warning.svelte:3:2: needs alt (a11y_missing_attribute)',
    );
    expect(warn).toHaveBeenNthCalledWith(
      2,
      '/app/warning.svelte:1:0: somewhere (positionless_warning)',
    );
  });
});
