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
 *         records intent for post to write the final output.
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
      // record bundler mode for keying (dev/prod)
      try {
        state.mode = cfg?.mode || state.mode || '';
      } catch {}
      // compute toolchain digest once
      state.toolchainDigest = getToolchainDigestSync(state.trackDependencies || 'strict');
    },
    async transform(code, id) {
      if (!shouldProcess(id, state)) return null;
      if (!state.enabled) return null;

      const s0 = now();
      const norm = normalizeId(id, state.root);
      // include/exclude gating (bypass when not included or explicitly excluded)
      if (isBypassed(norm.rel, state)) return null;
      const contentLF = normalizeNewlines(stripBOM(code));
      const fmParsed = matter(contentLF);
      const frontmatterNorm = stringify(fmParsed.data || {});
      const featuresDigest = digestJSON(sortedObject(state.features));
      const toolchainDigest =
        state.toolchainDigest || getToolchainDigestSync(state.trackDependencies || 'strict');
      const key = sha256(
        contentLF +
          frontmatterNorm +
          featuresDigest +
          toolchainDigest +
          (state.mode || '') +
          (state.salt || '') +
          norm.pathDigest
      );

      // Try cacache
      try {
        const res = await cacache.get(state.cacheDir, key);
        const got = JSON.parse(res.data.toString('utf8'));
        state.stats.hits++;
        const dt = now() - s0;
        // estimated saved time (prior MISS duration)
        if (got?.meta?.durationMs != null) {
          const prior = Number(got.meta.durationMs) || 0;
          state.stats.savedMs = (state.stats.savedMs || 0) + (prior > 0 ? prior : 0);
        }
        if (state.logLevel === 'verbose') logLine(`HIT  ${fmtMs(dt)}  ${norm.rel}`);
        if (state.logLevel === 'json')
          logJSON('cache_hit', { rel: norm.rel, durationMs: dt, sizeBytes: got?.meta?.sizeBytes });
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
      if (isBypassed(norm.rel, state)) return null;
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
        toolchainDigest:
          state.toolchainDigest || getToolchainDigestSync(state.trackDependencies || 'strict'),
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
 * @returns {{
 *  root:string;
 *  enabled:boolean;
 *  logLevel:string;
 *  cacheDir:string;
 *  features:object;
 *  include?: string[];
 *  exclude?: string[];
 *  includeREs?: RegExp[];
 *  excludeREs?: RegExp[];
 *  salt?: string;
 *  mode?: string;
 *  trackDependencies?: 'strict'|'loose';
 *  stats:{hits:number;misses:number;durations:number[];savedMs?:number};
 *  pending:Map<string, any>;
 *  toolchainDigest:string;
 * }}
 */
function createState(userOptions) {
  const env = process.env;
  const root = process.cwd();

  // Compose: options -> ENV (ENV highest)
  const withOpts = pickKnownConfig(userOptions || {});
  const withEnv = applyEnvOverrides(withOpts, env);

  const enabled = withEnv.enabled ?? true;
  const logLevel = withEnv.log ?? 'summary';
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
  const include = normGlobList(withEnv.include);
  const exclude = normGlobList(withEnv.exclude);
  const salt = typeof withEnv.salt === 'string' ? withEnv.salt : undefined;
  return {
    root,
    enabled,
    logLevel,
    cacheDir,
    features,
    include,
    exclude,
    includeREs: compileGlobs(include),
    excludeREs: compileGlobs(exclude),
    salt,
    mode: '',
    trackDependencies: withEnv.trackDependencies === 'loose' ? 'loose' : 'strict',
    stats: { hits: 0, misses: 0, durations: [], savedMs: 0 },
    pending: new Map(),
    toolchainDigest: ''
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
 * Return true if the path should be bypassed due to include/exclude.
 * @param {string} rel posix, lowercased relative path
 * @param {any} state
 */
function isBypassed(rel, state) {
  // include: if provided, must match at least one pattern
  if (state?.includeREs?.length) {
    const ok = patternsMatch(rel, state.includeREs, state.include);
    if (!ok) return true;
  }
  // exclude: if any pattern matches, bypass
  if (state?.excludeREs?.length) {
    if (patternsMatch(rel, state.excludeREs, state.exclude)) return true;
  }
  return false;
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
function getToolchainDigestSync(mode = 'strict') {
  const parts = [];
  const nodeVer = process.versions.node;
  parts.push(`node=${mode === 'loose' ? nodeVer.split('.')[0] : nodeVer}`);
  for (const name of ['vite', 'astro', '@mdx-js/mdx', 'remark', 'rehype', 'expressive-code']) {
    const ver = safePkgVersion(name);
    if (ver) {
      const v = String(ver);
      parts.push(`${name}=${mode === 'loose' ? v.split('.')[0] : v}`);
    }
  }
  return parts.join('|');
}

/**
 * Promise wrapper for compatibility with existing callers/tests.
 * @returns {Promise<string>}
 */
async function getToolchainDigest(mode = 'strict') {
  return getToolchainDigestSync(mode);
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

function logJSON(evt, fields) {
  try {
    const row = { evt, ts: new Date().toISOString(), ...fields };
    console.log(JSON.stringify(row));
  } catch {}
}

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
  if ('log' in o) out.log = o.log;
  if ('features' in o) out.features = o.features;
  if ('include' in o) out.include = o.include;
  if ('exclude' in o) out.exclude = o.exclude;
  if ('salt' in o) out.salt = o.salt;
  if ('trackDependencies' in o) out.trackDependencies = o.trackDependencies;
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
  if (env.FASTMD_INCLUDE) out.include = splitList(env.FASTMD_INCLUDE);
  if (env.FASTMD_EXCLUDE) out.exclude = splitList(env.FASTMD_EXCLUDE);
  if (env.FASTMD_SALT) out.salt = env.FASTMD_SALT;
  if (env.FASTMD_TRACK)
    out.trackDependencies = /^(loose|strict)$/i.test(env.FASTMD_TRACK)
      ? env.FASTMD_TRACK.toLowerCase()
      : undefined;
  return out;
}

// Expose internals for white-box tests (non-breaking for consumers)
export const __internals = {
  createState,
  shouldProcess,
  isBypassed,
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
  logSummary
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
    const norm = normalizeId(e.id, root);
    const contentLF = normalizeNewlines(stripBOM(e.code));
    const fmParsed = matter(contentLF);
    const frontmatterNorm = stringify(fmParsed.data || {});
    const key = sha256(
      contentLF + frontmatterNorm + featuresDigest + toolchainDigest + norm.pathDigest
    );

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

// ------------------------
// Glob helpers
// ------------------------

/**
 * Normalize a string or string[] into string[] or undefined.
 * @param {unknown} v
 * @returns {string[]|undefined}
 */
function normGlobList(v) {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((s) => typeof s === 'string');
  return undefined;
}

/**
 * Split env list by comma.
 */
function splitList(s) {
  return String(s)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Compile glob patterns to RegExp objects (supports *, **, ? minimally).
 * @param {string[]|undefined} arr
 * @returns {RegExp[]}
 */
function compileGlobs(arr) {
  if (!arr || !arr.length) return [];
  return arr.map((p) => globToRegExp(p));
}

/**
 * Return true if any regex matches OR a simple substring fallback matches.
 * The fallback helps with very broad patterns (e.g., any path containing '/draft/') without
 * depending on a full glob engine.
 * @param {string} rel
 * @param {RegExp[]} res
 * @param {string[]|undefined} raw
 */
function patternsMatch(rel, res, raw) {
  if (res.some((re) => re.test(rel))) return true;
  if (raw?.length) {
    const r = rel;
    for (const pat of raw) {
      const token = pat
        .toLowerCase()
        .replace(/\\/g, '/')
        .replace(/\*\*?/g, '')
        .replace(/\?/g, '')
        .replace(/\.+/g, '.');
      if (token && r.includes(token)) return true;
    }
  }
  return false;
}

/**
 * Convert a simple glob to a RegExp. Supports **, *, ? and escapes '.'
 * Pattern is applied to POSIX lowercased paths.
 * @param {string} pat
 */
function globToRegExp(pat) {
  // escape regex specials except * ? /
  let s = pat.replace(/[.+^${}()|\[\]\\]/g, '\\$&');
  // normalize backslashes to slashes
  s = s.replace(/\\/g, '/');
  // '**/' => '(?:.*/)?' (any leading path)
  s = s.replace(/\*\*\//g, '(?:.*/)?');
  // '/**' => '(?:/.*)?' (any trailing path)
  s = s.replace(/\/\*\*/g, '(?:/.*)?');
  // remaining '**' => '.*'
  s = s.replace(/\*\*/g, '.*');
  // '*' => '[^/]*'
  s = s.replace(/\*/g, '[^/]*');
  // '?' => '[^/]'
  s = s.replace(/\?/g, '[^/]');
  return new RegExp(`^${s}$`);
}
