/// <reference types="bun-types" />
/**
 * NDJSON schema validation using Ajv (strict mode).
 */
import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import fastmdCache from '../../packages/fastmd-cache/index.mjs';
import { type TransformLike, callTransform } from '../_utils';

async function mkTmp() {
  const dir = path.resolve(
    process.cwd(),
    `.cache/tests-json-ajv-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('fastmd-cache: NDJSON schema (Ajv, strict)', () => {
  test('all emitted rows conform to schema', async () => {
    const schemaText = await fs.readFile(
      path.resolve(process.cwd(), 'schemas/fastmd-log.schema.json'),
      'utf8'
    );
    const schema = JSON.parse(schemaText);
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);

    const dir = await mkTmp();
    const cacheDir = path.join(dir, '.cache/fastmd');
    const id = path.join(dir, 's.md');
    const code = '# s';
    const js = 'export default 1;';

    const [pre, post] = fastmdCache({ cacheDir, log: 'json' });
    (pre as unknown as { buildStart?: () => void }).buildStart?.();

    const rows: unknown[] = [];
    const orig = console.log;
    console.log = (s: unknown) => {
      try {
        rows.push(JSON.parse(String(s)));
      } catch {}
    };
    try {
      // MISS → WRITE → HIT sequence
      expect(
        await callTransform(pre as unknown as { transform?: TransformLike }, code, id)
      ).toBeNull();
      await callTransform(post as unknown as { transform?: TransformLike }, js, id);
      const hit = await callTransform(pre as unknown as { transform?: TransformLike }, code, id);
      expect(hit).toBe(js);
      (pre as unknown as { buildEnd?: () => void }).buildEnd?.();
    } finally {
      console.log = orig;
    }

    const seen = new Set<string>();
    for (const r of rows as unknown[]) {
      const ok = validate(r);
      if (!ok) {
        // For debugging: attach readable error message
        const msg = ajv.errorsText(validate.errors, { separator: '\n' });
        throw new Error(`schema validation failed:\n${msg}\nrow=${JSON.stringify(r)}`);
      }
      seen.add((r as { evt: string }).evt);
    }
    expect(seen.has('cache_miss')).toBe(true);
    expect(seen.has('cache_write')).toBe(true);
    expect(seen.has('cache_hit')).toBe(true);
    expect(seen.has('summary')).toBe(true);
  });
});
