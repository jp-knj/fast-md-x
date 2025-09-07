import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import cacache from 'cacache';

const require = createRequire(import.meta.url);
const matter = require('gray-matter');
const stringify = require('json-stable-stringify');

/**
 * Create the fastmd-cache plugin (two phases: pre/post).
 *
 * Behavior
 * - pre: computes a stable key and tries to read from the cacache store; on MISS,
 *         records intent for post to persist the final output.
 * - post: after the toolchain produces code (+ optional sourcemap), writes an entry
 *         to cacache keyed identically to pre.
 *
 * Notes
 * - Cache backend is always cacache (no FS fallback).
 * - Only Markdown/MDX module ids are considered.
 *
 * @param {object} [userOptions] Optional overrides (enabled, cacheDir, log, features).
 * @returns {[{name:string,enforce?:string,transform?:unknown},{name:string,enforce?:string,transform?:unknown}]}
 */
export default function fastmdCache(userOptions = {}) {
  const state = createState(userOptions);
  const pre = {
    name: 'fastmd-cache-pre',
    enforce: 'pre',
    configResolved(cfg) {
      state.root = cfg.root || process.cwd();
      // compute toolchain digest once
      state.toolchainDigest = getToolchainDigestSync();
      // record vite command/mode for key derivation tagging
      // normalize to our compact tags used in keys: 'dev' | 'build'
      try {
        /** @type {any} */
        const anyCfg = cfg || {};
        state.viteCommand =
          anyCfg.command || (process.env.NODE_ENV === 'production' ? 'build' : 'serve');
        state.viteMode =
          anyCfg.mode || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
      } catch {}
    },
    async transform(code, id) {
      if (!shouldProcess(id, state)) return null;
      if (!state.enabled) return null;

      const s0 = now();
      const norm = normalizeId(id, state.root);
      const toolchainDigest = state.toolchainDigest || getToolchainDigestSync();
      // attempt to capture a representative importer (first) for added safety
      let importer = '';
      try {
        const info = this?.getModuleInfo?.(id);
        const first = info && Array.isArray(info.importers) ? info.importers[0] : '';
        importer = first || '';
      } catch {}

      const key = computeKey({
        code,
        id,
        root: state.root,
        features: state.features,
        toolchainDigest,
        mode: state.viteCommand === 'serve' ? 'dev' : 'build',
        salt: state.salt || '',
        importer
      });

      // Try cacache
      try {
        const res = await cacache.get(state.cacheDir, key);
        const got = JSON.parse(res.data.toString('utf8'));
        state.stats.hits++;
        const dt = now() - s0;
        // accumulate estimated saved time using prior MISS duration (if present)
        if (got?.meta?.durationMs != null) {
          const n = Number(got.meta.durationMs) || 0;
          state.stats.savedMs = (state.stats.savedMs || 0) + (n > 0 ? n : 0);
        }
        if (state.logLevel === 'verbose') logLine(`HIT  ${fmtMs(dt)}  ${norm.rel}`);
        if (state.logLevel === 'json')
          logJSON('cache_hit', {
            rel: norm.rel,
            durationMs: dt,
            sizeBytes: got?.meta?.sizeBytes,
            toolchainDigest: got?.meta?.toolchainDigest
          });
        return got.map ? { code: got.code, map: got.map } : got.code;
      } catch {}
      // MISS: record intent to store after pipeline finishes in post phase
      state.pending.set(norm.rel, { key, startedAt: s0, rel: norm.rel });
      if (state.logLevel === 'verbose') logLine(`MISS(new)  --  ${norm.rel}`);
      if (state.logLevel === 'json') logJSON('cache_miss', { rel: norm.rel });
      return null;
    },
    buildStart() {
      state.stats = { hits: 0, misses: 0, durations: [], savedMs: 0 };
    },
    buildEnd() {
      if (state.logLevel === 'json') {
        logSummaryJSON(state);
        return;
      }
      if (state.logLevel !== 'silent') logSummary(state);
    }
  };

  const post = {
    name: 'fastmd-cache-post',
    enforce: 'post',
    async transform(code, id) {
      if (!shouldProcess(id, state)) return null;
      if (!state.enabled) return null;
      const norm = normalizeId(id, state.root);
      const pending = state.pending.get(norm.rel);
      if (!pending) return null;

      // get combined sourcemap if available
      let map;
      try {
        // vite uses rollup context here
        const sm = this.getCombinedSourcemap?.();
        map = sm && Object.keys(sm).length ? sm : undefined;
      } catch {}

      const key = pending.key;
      // write via store (first wins semantics where applicable)
      const start = pending.startedAt || now();
      const duration = now() - start;
      const meta = {
        version: '1',
        createdAt: new Date().toISOString(),
        toolchainDigest: state.toolchainDigest || getToolchainDigestSync(),
        featuresDigest: digestJSON(sortedObject(state.features)),
        sizeBytes: Buffer.byteLength(code, 'utf8'),
        durationMs: duration
      };
      const payload = JSON.stringify({ code, map, meta });
      await cacache.put(state.cacheDir, key, Buffer.from(payload));
      state.pending.delete(norm.rel);
      state.stats.misses++;
      state.stats.durations.push(duration);
      if (state.logLevel === 'json')
        logJSON('cache_write', { rel: norm.rel, durationMs: duration, sizeBytes: meta.sizeBytes });
      return null; // do not alter code; just observe
    },
    buildEnd() {
      if (state.logLevel === 'json') {
        logSummaryJSON(state);
        return;
      }
      if (state.logLevel !== 'silent') logSummary(state);
    }
  };

  // no config file loading (env + options only)

  // expose both phases
  return [pre, post];
}

/**
 * Build internal, resolved state for a plugin instance.
 * Honors environment variables first, then user options.
 * @param {object} userOptions
 * @returns {{root:string, enabled:boolean, logLevel:string, cacheDir:string, salt:string, features:object, stats:{hits:number,misses:number,durations:number[],savedMs:number}, pending:Map<string, any>, toolchainDigest:string, viteCommand:string, viteMode:string}}
 */
function createState(userOptions) {
  const env = process.env;
  const root = process.cwd();

  // Compose: options -> ENV (ENV highest)
  const withOpts = pickKnownConfig(userOptions || {});
  const withEnv = applyEnvOverrides(withOpts, env);

  const enabled = withEnv.enabled ?? true;
  const logLevel = withEnv.log ?? 'summary';
  const salt = withEnv.salt || '';
  let cacheDir = withEnv.cacheDir ? path.resolve(root, withEnv.cacheDir) : undefined;
  if (!cacheDir) {
    try {
      const r = (require('find-cache-dir')?.default || require('find-cache-dir'))({
        name: 'fastmd',
        create: true
      });
      cacheDir = r || path.resolve(root, '.cache/fastmd');
    } catch {
      cacheDir = path.resolve(root, '.cache/fastmd');
    }
  }
  const features = withEnv.features ?? {};
  return {
    root,
    enabled,
    logLevel,
    salt,
    cacheDir,
    features,
    stats: { hits: 0, misses: 0, durations: [], savedMs: 0 },
    pending: new Map(),
    toolchainDigest: '',
    viteCommand: 'build',
    viteMode: 'production'
  };
}

/**
 * Returns true if the given id should be handled by the cache (md/mdx only).
 * @param {string} id Module id (may include query).
 * @param {any} _state Plugin state (unused).
 */
function shouldProcess(id, _state) {
  const [fp] = id.split('?', 2);
  if (!fp) return false;
  const ext = fp.toLowerCase().endsWith('.md') || fp.toLowerCase().endsWith('.mdx');
  return !!ext;
}

/**
 * Normalize an id to an absolute file path and a stable relative path digest.
 * - Drops queries
 * - Converts Vite /@fs/ URLs to absolute paths
 * - Produces POSIX lowercased relative path for keying
 * @param {string} id
 * @param {string} root
 * @returns {{rel:string, pathDigest:string}}
 */
function normalizeId(id, root) {
  let [fp] = id.split('?', 2);
  // Vite can give URLs like /@fs/abs-path or /@fs//abs-path (double slash)
  fp = fp.replace(/^\/@@?fs\/+/, '/');
  if (!path.isAbsolute(fp)) fp = path.resolve(root, fp);
  const rel = path.posix.normalize(path.relative(root, fp).split(path.sep).join('/')).toLowerCase();
  return { rel, pathDigest: rel };
}

/**
 * Remove a leading UTF-8 BOM if present.
 * @param {string} s
 */
function stripBOM(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/**
 * Convert CRLF/CR to LF for stable hashing.
 * @param {string} s
 */
function normalizeNewlines(s) {
  return s.replace(/\r\n?/g, '\n');
}

/**
 * Extract YAML frontmatter block from Markdown content (if present).
 * @param {string} s
 * @returns {string} YAML text or empty string
 */
function extractFrontmatter(s) {
  const m = s.match(/^---\s*\n([\s\S]*?)\n---\s*(\n|$)/);
  return m ? m[1] : '';
}

/**
 * Normalize top-level YAML key: value lines into a sorted JSON string.
 * Minimal parser that supports scalars only.
 * @param {string} yamlText
 * @returns {string}
 */
// normalizeFrontmatter/parseScalar removed (gray-matter handles parsing)

/**
 * Return a shallow key-sorted copy of an object.
 * @param {Record<string, any>} obj
 * @returns {Record<string, any>}
 */
function sortedObject(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

/**
 * Deterministically hash an object or string using sha256 of JSON.
 * @param {any} obj
 * @returns {string}
 */
function digestJSON(obj) {
  if (typeof obj === 'string') return sha256(obj);
  try {
    return sha256(stringify(obj));
  } catch {
    return sha256(JSON.stringify(obj));
  }
}

/**
 * Compute sha256 hex digest of a string.
 * @param {string} s
 * @returns {string}
 */
function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/**
 * Return paths used to store data/map/meta for a given key.
 * @param {string} cacheDir
 * @param {string} key
 */
// FS helper functions removed: using cacache or simple fs APIs inline

/**
 * Build a digest string from versions of Node and relevant packages (sync).
 * @returns {string}
 */
function getToolchainDigestSync() {
  const parts = [];
  parts.push(`node=${process.versions.node}`);
  for (const name of ['vite', 'astro', '@mdx-js/mdx', 'remark', 'rehype', 'expressive-code']) {
    const ver = safePkgVersion(name);
    if (ver) parts.push(`${name}=${ver}`);
  }
  return parts.join('|');
}

/**
 * Promise wrapper for compatibility with existing callers/tests.
 * @returns {Promise<string>}
 */
async function getToolchainDigest() {
  return getToolchainDigestSync();
}

/**
 * Safely read a package's version from its package.json using createRequire.
 * @param {string} name
 * @returns {string|undefined}
 */
function safePkgVersion(name) {
  try {
    const pkg = require(`${name}/package.json`);
    return pkg?.version ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Evaluate a variety of truthy string forms.
 * @param {any} v
 * @returns {boolean}
 */
function truthy(v) {
  return /^(1|true|on|yes)$/i.test(String(v));
}

/**
 * Millisecond timestamp wrapper for testability.
 * @returns {number}
 */
function now() {
  return Date.now();
}

/**
 * Format milliseconds as e.g. "15ms".
 * @param {number} n
 * @returns {string}
 */
function fmtMs(n) {
  return `${n}ms`;
}

/**
 * Emit a standardized log line with a prefix.
 * @param {string} s
 */
function logLine(s) {
  console.log(`[fastmd] ${s}`);
}

/**
 * Log a summary line of cache statistics.
 * @param {{stats:{hits:number,misses:number,durations:number[],savedMs?:number}}} state
 */
function logSummary(state) {
  const total = state.stats.hits + state.stats.misses;
  const hitRate = total ? Math.round((state.stats.hits / total) * 100) : 0;
  const arr = state.stats.durations.slice().sort((a, b) => a - b);
  const p50 = arr.length ? arr[Math.floor(arr.length * 0.5)] : 0;
  const p95 = arr.length ? arr[Math.floor(arr.length * 0.95)] : 0;
  logLine(
    `summary total=${total} hits=${state.stats.hits} misses=${state.stats.misses} hitRate=${hitRate}% p50=${fmtMs(
      p50
    )} p95=${fmtMs(p95)} savedMs=${fmtMs(state.stats.savedMs || 0)}`
  );
}

/**
 * Log a JSON line for an event (NDJSON-friendly).
 * @param {string} evt
 * @param {Record<string, any>} fields
 */
function logJSON(evt, fields) {
  try {
    const row = { evt, ts: new Date().toISOString(), ...fields };
    console.log(JSON.stringify(row));
  } catch {}
}

/**
 * Log a JSON summary row.
 * @param {{stats:{hits:number,misses:number,durations:number[],savedMs?:number}}} state
 */
function logSummaryJSON(state) {
  const total = state.stats.hits + state.stats.misses;
  const hitRate = total ? Math.round((state.stats.hits / total) * 100) : 0;
  const arr = state.stats.durations.slice().sort((a, b) => a - b);
  const p50 = arr.length ? arr[Math.floor(arr.length * 0.5)] : 0;
  const p95 = arr.length ? arr[Math.floor(arr.length * 0.95)] : 0;
  logJSON('summary', {
    total,
    hits: state.stats.hits,
    misses: state.stats.misses,
    hitRate,
    p50,
    p95,
    savedMs: state.stats.savedMs || 0
  });
}

/**
 * Pick known config keys only.
 * @param {any} src
 */
function pickKnownConfig(src) {
  const o = src || {};
  /** @type {any} */
  const out = {};
  if ('enabled' in o) out.enabled = o.enabled;
  if ('cacheDir' in o) out.cacheDir = o.cacheDir;
  if ('persist' in o) out.persist = o.persist;
  if ('log' in o) out.log = o.log;
  if ('features' in o) out.features = o.features;
  return out;
}

/**
 * Apply environment variable overrides to a partially merged config.
 * @param {any} base
 * @param {NodeJS.ProcessEnv} env
 */
function applyEnvOverrides(base, env) {
  /** @type {any} */
  const out = { ...(base || {}) };
  if (env.FASTMD_DISABLE != null) out.enabled = !truthy(env.FASTMD_DISABLE);
  if (env.FASTMD_LOG) out.log = env.FASTMD_LOG;
  if (env.FASTMD_CACHE_DIR) out.cacheDir = env.FASTMD_CACHE_DIR;
  if (env.FASTMD_PERSIST != null) out.persist = truthy(env.FASTMD_PERSIST);
  if (env.FASTMD_SALT) out.salt = env.FASTMD_SALT;
  return out;
}

// Expose internals for white-box tests (non-breaking for consumers)
export const __internals = {
  createState,
  shouldProcess,
  normalizeId,
  stripBOM,
  normalizeNewlines,
  extractFrontmatter,
  sortedObject,
  digestJSON,
  sha256,
  getToolchainDigest,
  truthy,
  fmtMs,
  logSummary,
  computeKey
};

/**
 * Clear the cacache store under the given cacheDir.
 * Uses `cacache.rm.all` and then best-effort removes the directory.
 * @param {string} cacheDir Base cache directory (e.g., `.cache/fastmd`).
 */
export async function clearCache(cacheDir) {
  const base = path.resolve(process.cwd(), cacheDir || '.cache/fastmd');
  await cacache.rm.all(base);
  // best-effort remove directory
  await fsp.rm(base, { recursive: true, force: true }).catch(() => {});
}

/**
 * Pre-populate cache entries given pairs of (id, code) → js.
 * Mirrors the key derivation used by the pre phase (content, frontmatter, features,
 * toolchain, pathDigest, configDigest).
 * @param {{id:string; code:string; js:string; map?:string}[]} entries Entries to warm.
 * @param {{cacheDir?:string; features?:Record<string, unknown>}} [opts] Optional cacheDir/features.
 */
export async function warmup(entries, opts = {}) {
  if (!Array.isArray(entries) || !entries.length) return;
  const root = process.cwd();
  const base = path.resolve(root, opts.cacheDir || '.cache/fastmd');
  const features = opts.features || {};

  // Compute digests common to all
  const featuresDigest = digestJSON(sortedObject(features));
  const toolchainDigest = getToolchainDigestSync();
  for (const e of entries) {
    // Reuse the same key derivation as runtime (mode=build, no importer, no salt unless provided)
    const key = computeKey({
      code: e.code,
      id: e.id,
      root,
      features,
      toolchainDigest,
      mode: 'build',
      salt: '',
      importer: ''
    });

    const meta = {
      version: '1',
      createdAt: new Date().toISOString(),
      toolchainDigest,
      featuresDigest,
      sizeBytes: Buffer.byteLength(e.js, 'utf8'),
      durationMs: 0
    };
    const payload = JSON.stringify({ code: e.js, map: e.map, meta });
    await cacache.put(base, key, Buffer.from(payload));
  }
}

/**
 * Compute the stable cache key for a given module content and context.
 * Includes normalized content, frontmatter, features digest, toolchain digest,
 * normalized relative path digest, and sensitivity to mode/importer/salt.
 * @param {{code:string; id:string; root:string; features:Record<string, unknown>; toolchainDigest:string; mode:'dev'|'build'|'prod'; salt?:string; importer?:string}} p
 * @returns {string}
 */
function computeKey(p) {
  const norm = normalizeId(p.id, p.root);
  const contentLF = normalizeNewlines(stripBOM(p.code));
  const fmParsed = matter(contentLF);
  const contentBody = fmParsed.content ?? contentLF; // exclude FM when present
  const frontmatterNorm = stringify(fmParsed.data || {});
  const featuresDigest = digestJSON(sortedObject(p.features || {}));
  const modeTag = p.mode === 'dev' ? 'dev' : 'build';
  const salt = p.salt || '';
  // normalize importer path if present for stability
  let importerDigest = '';
  if (p.importer) {
    try {
      importerDigest = normalizeId(String(p.importer), p.root).pathDigest;
    } catch {
      importerDigest = String(p.importer);
    }
  }
  return sha256(
    `${contentBody}${frontmatterNorm}${featuresDigest}${p.toolchainDigest || ''}${norm.pathDigest}|${modeTag}|${salt}|${importerDigest}`
  );
}
