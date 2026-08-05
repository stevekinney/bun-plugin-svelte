import { describe, expect, it } from 'bun:test';

import {
  hashPath,
  resolveCompileFilename,
  resolveDev,
  resolveHmr,
  resolveSide,
  validateOptions,
} from './options.js';

describe('validateOptions', () => {
  it('accepts an empty object', () => {
    expect(() => validateOptions({})).not.toThrow();
  });

  it('accepts a fully specified options object', () => {
    expect(() =>
      validateOptions({
        generate: 'client',
        dev: true,
        css: 'injected',
        hmr: false,
        compileFilename: (path: string) => path,
      }),
    ).not.toThrow();
  });

  it.each([null, undefined, 'client', 42])('rejects non-object input %p', (value) => {
    expect(() => validateOptions(value)).toThrow(TypeError);
  });

  it('rejects an invalid generate value', () => {
    expect(() => validateOptions({ generate: 'universal' })).toThrow(/generate/);
  });

  it('rejects an invalid css value', () => {
    expect(() => validateOptions({ css: 'inline' })).toThrow(/css/);
  });

  it('rejects a non-boolean dev value', () => {
    expect(() => validateOptions({ dev: 'yes' })).toThrow(/dev/);
  });

  it('rejects a non-boolean hmr value', () => {
    expect(() => validateOptions({ hmr: 1 })).toThrow(/hmr/);
  });

  it('rejects a non-function compileFilename', () => {
    expect(() => validateOptions({ compileFilename: 'rename' })).toThrow(/compileFilename/);
  });
});

describe('resolveDev', () => {
  it('prefers the explicit option', () => {
    expect(resolveDev({ dev: false })).toBe(false);
    expect(resolveDev({ dev: true })).toBe(true);
  });

  it('falls back to NODE_ENV', () => {
    const original = process.env['NODE_ENV'];
    try {
      process.env['NODE_ENV'] = 'production';
      expect(resolveDev({})).toBe(false);

      process.env['NODE_ENV'] = 'development';
      expect(resolveDev({})).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = original;
      }
    }
  });
});

describe('resolveSide', () => {
  it('prefers the explicit generate option over everything', () => {
    expect(resolveSide({ generate: 'server' }, { side: 'client' }, 'browser')).toBe('server');
  });

  it('uses the dev server side hint when no option is set', () => {
    expect(resolveSide({}, { side: 'client' }, 'node')).toBe('client');
    expect(resolveSide({}, { side: 'server' }, 'browser')).toBe('server');
  });

  it('ignores a malformed side hint', () => {
    expect(resolveSide({}, { side: 'universal' as never }, 'browser')).toBe('client');
  });

  it('infers client from a browser target', () => {
    expect(resolveSide({}, {}, 'browser')).toBe('client');
  });

  it('infers server from node and bun targets', () => {
    expect(resolveSide({}, {}, 'node')).toBe('server');
    expect(resolveSide({}, {}, 'bun')).toBe('server');
  });

  it('falls back to server when nothing is known', () => {
    expect(resolveSide({}, {}, undefined)).toBe('server');
  });
});

describe('resolveHmr', () => {
  it('is never enabled for server compiles', () => {
    expect(resolveHmr({ hmr: true }, { hmr: true }, 'server', true)).toBe(false);
  });

  it('prefers the explicit option', () => {
    expect(resolveHmr({ hmr: false }, { hmr: true }, 'client', true)).toBe(false);
    expect(resolveHmr({ hmr: true }, {}, 'client', false)).toBe(true);
  });

  it('uses the dev server hint when no option is set', () => {
    expect(resolveHmr({}, { hmr: true }, 'client', false)).toBe(true);
    expect(resolveHmr({}, { hmr: false }, 'client', true)).toBe(false);
  });

  it('derives from the dev flag otherwise', () => {
    expect(resolveHmr({}, {}, 'client', true)).toBe(true);
    expect(resolveHmr({}, {}, 'client', false)).toBe(false);
  });
});

describe('resolveCompileFilename', () => {
  it('defaults to the path unchanged', () => {
    expect(resolveCompileFilename({}, '/app/counter.svelte')).toBe('/app/counter.svelte');
  });

  it('applies the rewrite hook', () => {
    const options = {
      compileFilename: (path: string) => path.replace('/workspace/', 'node_modules/pkg/'),
    };
    expect(resolveCompileFilename(options, '/workspace/counter.svelte')).toBe(
      'node_modules/pkg/counter.svelte',
    );
  });
});

describe('hashPath', () => {
  it('is stable for the same input', () => {
    expect(hashPath('/a/b.svelte')).toBe(hashPath('/a/b.svelte'));
  });

  it('differs for different inputs', () => {
    expect(hashPath('/a/b.svelte')).not.toBe(hashPath('/c/b.svelte'));
  });
});
