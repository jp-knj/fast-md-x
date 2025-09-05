/// <reference types="bun-types" />
/**
 * Test helpers for invoking Vite plugin hooks in a type-safe way.
 */

export type TransformLike =
  | ((code: string, id: string) => unknown)
  | {
      handler: (code: string, id: string) => unknown;
      order?: 'pre' | 'post';
    };

/**
 * Call a Vite transform hook that may be either a function or an ObjectHook.
 * This narrows the union so TypeScript is satisfied (avoids TS2349).
 *
 * Note: we pass a minimal context; hooks in this repo do not rely on Rollup context.
 */
export async function callTransform(
  phase: { transform?: TransformLike } | undefined,
  code: string,
  id: string
) {
  const t = phase?.transform as TransformLike | undefined;
  if (!t) return null;
  if (typeof t === 'function') {
    return await (t as (code: string, id: string) => unknown).call({}, code, id);
  }
  if (typeof t === 'object' && typeof t.handler === 'function') {
    return await t.handler.call({}, code, id);
  }
  return null;
}
