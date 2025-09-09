/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';

// Compare JS normalization (__internals) vs native normalize_content when available

async function getInternals() {
  const m = await import('../../plugins/fastmd-cache/index.mjs');
  // __internals export exists; pick stripBOM + normalizeNewlines
  const i: any = (m as any).__internals;
  return {
    stripBOM: i.stripBOM as (s: string) => string,
    normalizeNewlines: i.normalizeNewlines as (s: string) => string
  };
}

async function getNative() {
  const bridge = await import('../../plugins/fastmd-cache/native-bridge.mjs');
  return bridge.loadFastmdNative();
}

describe('native normalize_content equivalence (when available)', () => {
  test('JS vs Native produce identical output', async () => {
    // Require FASTMD_NATIVE=1 and a built native addon; otherwise skip
    const native = await getNative();
    if (!native || typeof native.normalize_content !== 'function') {
      // Skip gracefully on environments without the native binary
      // eslint-disable-next-line no-console
      console.warn('[skip] native normalize_content not available');
      return;
    }

    const { stripBOM, normalizeNewlines } = await getInternals();

    const cases = [
      '',
      '\uFEFF',
      '\uFEFFhello',
      'hello',
      'a\r\nb',
      'a\rb',
      '\uFEFFmulti\r\nline\rend\n',
      'no-bom\nwith\nlf\n'
    ];

    for (const s of cases) {
      const jsOut = normalizeNewlines(stripBOM(s));
      const nativeOut = String(native.normalize_content(String(s)));
      expect(nativeOut).toBe(jsOut);
    }
  });
});
