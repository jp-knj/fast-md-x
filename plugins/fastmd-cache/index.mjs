import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Create the fastmd-cache Vite plugin in two phases (pre/post).
 *
 * - pre: attempts cache read and records pending writes on MISS
 * - post: completes pending writes after the toolchain generates output
 *
 * @param {object} [userOptions] Optional configuration overrides.
 * @returns {[import('vite').Plugin, import('vite').Plugin]} Vite plugins.
 */
export default function fastmdCache(userOptions = {}) {
  const state = createState(userOptions);
  const pre = {
    name: 'fastmd-cache-pre',
    enforce: 'pre',
    configResolved(cfg) {
      state.root = cfg.root || process.cwd();
    },
    async transform(code, id) {
      if (!shouldProcess(id, state)) return null;
      if (!state.enabled) return null;

      const s0 = now();
      const norm = normalizeId(id, state.root);
      const contentLF = normalizeNewlines(stripBOM(code));
      const fm = extractFrontmatter(contentLF);
      const frontmatterNorm = normalizeFrontmatter(fm);
      const featuresDigest = digestJSON(sortedObject(state.features));
      const toolchainDigest = await getToolchainDigest();
      const key = sha256(
        contentLF +
          frontmatterNorm +
          featuresDigest +
          toolchainDigest +
          norm.pathDigest +
          (state.configDigest || '')
      );

      const { dataPath, mapPath } = cachePaths(state.cacheDir, key);
      try {
        const data = await fsp.readFile(dataPath, 'utf8');
        let map = undefined;
        try {
          map = await fsp.readFile(mapPath, 'utf8');
        } catch {}
        state.stats.hits++;
        const dt = now() - s0;
        if (state.logLevel === 'verbose') logLine(`HIT  ${fmtMs(dt)}  ${norm.rel}`);
        return map ? { code: data, map } : data;
      } catch {
        // MISS: record intent to store after pipeline finishes in post phase
        state.pending.set(norm.rel, { key, startedAt: s0, rel: norm.rel });
        if (state.logLevel === 'verbose') logLine(`MISS(new)  --  ${norm.rel}`);
        return null;
      }
    },
    buildStart() {
      state.stats = { hits: 0, misses: 0, durations: [] };
    },
    buildEnd() {
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
        map = Object.keys(sm ?? {}).length ? JSON.stringify(sm) : undefined;
      } catch {}

      const key = pending.key;
      const { dataPath, mapPath, metaPath } = cachePaths(state.cacheDir, key);
      await ensureDirs(state.cacheDir);
      // write data/map atomically; first wins
      const start = pending.startedAt || now();
      const duration = now() - start;
      try {
        await atomicWriteIfAbsent(dataPath, code);
        if (map) await atomicWriteIfAbsent(mapPath, map);
        const meta = {
          version: '1',
          createdAt: new Date().toISOString(),
          toolchainDigest: await getToolchainDigest(),
          featuresDigest: digestJSON(sortedObject(state.features)),
          sizeBytes: Buffer.byteLength(code, 'utf8'),
          durationMs: duration
        };
        await atomicWriteIfAbsent(metaPath, JSON.stringify(meta));
      } catch (e) {
        // ignore write races or errors; always passthrough
      }
      state.pending.delete(norm.rel);
      state.stats.misses++;
      state.stats.durations.push(duration);
      return null; // do not alter code; just observe
    },
    buildEnd() {
      if (state.logLevel !== 'silent') logSummary(state);
    }
  };

  // attempt to load YAML for digest synchronously (no deps)
  resolveConfigDigestSync(state);

  // expose both phases
  return [pre, post];
}

/**
 * Build internal, resolved state for a plugin instance.
 * Honors environment variables first, then user options.
 * @param {object} userOptions
 * @returns {{root:string, enabled:boolean, logLevel:string, cacheDir:string, features:object, stats:{hits:number,misses:number,durations:number[]}, pending:Map<string, any>, configDigest:string}}
 */
function createState(userOptions) {
  const env = process.env;
  const root = process.cwd();

  // Load YAML config (root + env[NODE_ENV])
  const yaml = loadYamlConfigSync(root);
  const nodeEnv = env.NODE_ENV || 'development';
  const yamlRoot = pickKnownConfig(yaml.root);
  const yamlEnv = pickKnownConfig(yaml.env[nodeEnv] || {});

  // Compose: YAML root -> YAML env -> options -> ENV (highest)
  const base = mergeConfig(yamlRoot, yamlEnv);
  const withOpts = mergeConfig(base, pickKnownConfig(userOptions || {}));
  const withEnv = applyEnvOverrides(withOpts, env);

  const enabled = withEnv.enabled ?? true;
  const logLevel = withEnv.log ?? 'summary';
  const cacheDir = path.resolve(root, withEnv.cacheDir ?? '.cache/fastmd');
  const features = withEnv.features ?? {};
  return {
    root,
    enabled,
    logLevel,
    cacheDir,
    features,
    stats: { hits: 0, misses: 0, durations: [] },
    pending: new Map(),
    configDigest: ''
  };
}

/**
 * Returns true if the given id should be handled by the cache (md/mdx only).
 * @param {string} id Module id (may include query).
 * @param {any} state Plugin state (unused here).
 */
function shouldProcess(id, state) {
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
function normalizeFrontmatter(yamlText) {
  if (!yamlText) return '';
  // minimal YAML object parser: key: value at top-level only
  const obj = {};
  const lines = yamlText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    const vraw = trimmed.slice(idx + 1).trim();
    obj[k] = parseScalar(vraw);
  }
  return JSON.stringify(sortedObject(obj));
}

/**
 * Parse a YAML-like scalar value into JS types.
 * @param {string} v
 * @returns {string|number|boolean|null}
 */
function parseScalar(v) {
  const low = v.toLowerCase();
  if (['true', 'false'].includes(low)) return low === 'true';
  if (['null', 'none', '~'].includes(low)) return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  // strip quotes if present
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Return a shallow key-sorted copy of an object.
 * @template T extends Record<string, any>
 * @param {T} obj
 * @returns {T}
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
  return sha256(typeof obj === 'string' ? obj : JSON.stringify(obj));
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
function cachePaths(cacheDir, key) {
  const dataDir = path.join(cacheDir, 'data');
  const metaDir = path.join(cacheDir, 'meta');
  return {
    dataDir,
    metaDir,
    dataPath: path.join(dataDir, `${key}.js`),
    mapPath: path.join(dataDir, `${key}.js.map`),
    metaPath: path.join(metaDir, `${key}.json`)
  };
}

/**
 * Ensure the cache directories exist.
 * @param {string} cacheDir
 */
async function ensureDirs(cacheDir) {
  const { dataDir, metaDir } = cachePaths(cacheDir, 'x');
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(metaDir, { recursive: true });
}

/**
 * Atomically write to dest if and only if it does not already exist.
 * @param {string} dest
 * @param {string} content
 */
async function atomicWriteIfAbsent(dest, content) {
  try {
    await fsp.access(dest, fs.constants.F_OK);
    return; // already exists
  } catch {}
  const dir = path.dirname(dest);
  const tmp = path.join(dir, `.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`);
  await fsp.writeFile(tmp, content);
  try {
    await fsp.rename(tmp, dest);
  } catch (e) {
    // if destination now exists, ignore; otherwise rethrow
    try {
      await fsp.access(dest, fs.constants.F_OK);
    } catch {
      throw e;
    }
  } finally {
    // cleanup tmp if still there
    fsp.unlink(tmp).catch(() => {});
  }
}

/**
 * Build a digest string from versions of Node and relevant packages.
 * @returns {Promise<string>}
 */
async function getToolchainDigest() {
  const parts = [];
  parts.push(`node=${process.versions.node}`);
  for (const name of ['vite', 'astro', '@mdx-js/mdx', 'remark', 'rehype', 'expressive-code']) {
    const ver = safePkgVersion(name);
    if (ver) parts.push(`${name}=${ver}`);
  }
  return parts.join('|');
}

/**
 * Safely read a package's version from its package.json using require.
 * @param {string} name
 * @returns {string|undefined}
 */
function safePkgVersion(name) {
  try {
    const pkg = require(`${name}/package.json`);
    return pkg?.version ?? '0';
  } catch {
    // Fallback: resolve the entry and walk up to nearest package.json
    try {
      const entry = require.resolve(name);
      let dir = path.dirname(entry);
      const root = path.parse(dir).root;
      while (dir && dir !== root) {
        const pj = path.join(dir, 'package.json');
        try {
          const raw = fs.readFileSync(pj, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed?.version) return parsed.version;
        } catch {}
        dir = path.dirname(dir);
      }
    } catch {}
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
 * @param {{stats:{hits:number,misses:number,durations:number[]}}} state
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
    )} p95=${fmtMs(p95)}`
  );
}

/**
 * Compute a digest of the YAML config if present in the root.
 * Side-effect: sets `state.configDigest`.
 * @param {{root:string, configDigest:string}} state
 */
function resolveConfigDigestSync(state) {
  const root = state.root || process.cwd();
  const candidates = ['fastmd.config.yml', 'fastmd.config.yaml'];
  for (const f of candidates) {
    try {
      const p = path.join(root, f);
      const raw = fs.readFileSync(p, 'utf8');
      state.configDigest = sha256(normalizeNewlines(stripBOM(raw)));
      return;
    } catch {}
  }
  state.configDigest = '';
}

/**
 * Read YAML config from fastmd.config.yml/yaml and return a structured object.
 * Supports a simplified subset: root keys and one-level nested maps under `env` and `features`.
 * @param {string} rootDir
 */
function loadYamlConfigSync(rootDir) {
  const out = { root: {}, env: {} };
  const candidates = ['fastmd.config.yml', 'fastmd.config.yaml'];
  let raw = '';
  for (const f of candidates) {
    try {
      raw = fs.readFileSync(path.join(rootDir, f), 'utf8');
      break;
    } catch {}
  }
  if (!raw) return out;
  const parsed = parseYamlSimple(raw);
  const env = parsed.env && typeof parsed.env === 'object' ? parsed.env : {};
  const root = { ...parsed };
  root.env = undefined;
  out.root = root;
  out.env = env;
  return out;
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
 * Shallow merge for config with special handling for `features` (deep merge one level).
 * Later properties override earlier ones.
 */
function mergeConfig(a, b) {
  /** @type {any} */
  const out = { ...(a || {}) };
  for (const k of Object.keys(b || {})) {
    if (k === 'features') {
      out.features = { ...(a?.features || {}), ...(b?.features || {}) };
    } else {
      out[k] = b[k];
    }
  }
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
  return out;
}

/**
 * Very small YAML parser supporting root mapping and two nested levels.
 * Handles lines: `key: value` and nested blocks ending with `:` using 2-space indents.
 * Scalars parsed via parseScalar().
 * @param {string} text
 */
function parseYamlSimple(text) {
  const root = {};
  /** @type {{obj:any, indent:number}[]} */
  const stack = [{ obj: root, indent: -1 }];
  const lines = normalizeNewlines(stripBOM(text)).split('\n');
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#') || raw.trim() === '---') continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trimEnd();
    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    const m = line.match(/^([^:#]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const rest = m[2];
    if (rest === '') {
      // nested map
      const obj = {};
      parent[key] = obj;
      stack.push({ obj, indent });
    } else {
      parent[key] = parseScalar(rest.trim());
    }
  }
  return root;
}

// Expose internals for white-box tests (non-breaking for consumers)
export const __internals = {
  createState,
  loadYamlConfigSync,
  pickKnownConfig,
  mergeConfig,
  applyEnvOverrides,
  parseYamlSimple,
  shouldProcess,
  normalizeId,
  stripBOM,
  normalizeNewlines,
  extractFrontmatter,
  normalizeFrontmatter,
  parseScalar,
  sortedObject,
  digestJSON,
  sha256,
  cachePaths,
  ensureDirs,
  atomicWriteIfAbsent,
  getToolchainDigest,
  safePkgVersion,
  truthy,
  now,
  fmtMs,
  logLine,
  logSummary,
  resolveConfigDigestSync
};

/**
 * Remove all cached data and metadata under the given cacheDir.
 * Does nothing if the directory does not exist.
 * @param {string} cacheDir base cache directory (e.g., .cache/fastmd)
 */
export async function clearCache(cacheDir) {
  const base = path.resolve(process.cwd(), cacheDir || '.cache/fastmd');
  const { dataDir, metaDir } = cachePaths(base, 'x');
  await Promise.all([safeRm(dataDir), safeRm(metaDir)]);
}

async function safeRm(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {}
}

/**
 * Pre-populate cache entries given pairs of (id, code)->js.
 * This mirrors the key derivation used by the pre phase.
 * @param {{id:string; code:string; js:string; map?:string}[]} entries
 * @param {{cacheDir?:string; features?:Record<string, unknown>}} [opts]
 */
export async function warmup(entries, opts = {}) {
  if (!Array.isArray(entries) || !entries.length) return;
  const root = process.cwd();
  const base = path.resolve(root, opts.cacheDir || '.cache/fastmd');
  const features = opts.features || {};

  // Compute digests common to all
  const featuresDigest = digestJSON(sortedObject(features));
  const toolchainDigest = await getToolchainDigest();
  const st = { root, configDigest: '' };
  resolveConfigDigestSync(st);
  const configDigest = st.configDigest || '';

  await ensureDirs(base);
  for (const e of entries) {
    const norm = normalizeId(e.id, root);
    const contentLF = normalizeNewlines(stripBOM(e.code));
    const fm = extractFrontmatter(contentLF);
    const frontmatterNorm = normalizeFrontmatter(fm);
    const key = sha256(
      contentLF +
        frontmatterNorm +
        featuresDigest +
        toolchainDigest +
        norm.pathDigest +
        configDigest
    );

    const { dataPath, mapPath, metaPath } = cachePaths(base, key);
    try {
      await atomicWriteIfAbsent(dataPath, e.js);
      if (e.map) await atomicWriteIfAbsent(mapPath, e.map);
      const meta = {
        version: '1',
        createdAt: new Date().toISOString(),
        toolchainDigest,
        featuresDigest,
        sizeBytes: Buffer.byteLength(e.js, 'utf8'),
        durationMs: 0
      };
      await atomicWriteIfAbsent(metaPath, JSON.stringify(meta));
    } catch {}
  }
}
