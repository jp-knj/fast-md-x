import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

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

function createState(userOptions) {
  const env = process.env;
  const enabled = env.FASTMD_DISABLE
    ? !truthy(env.FASTMD_DISABLE)
    : (userOptions.enabled ?? true);
  const logLevel = env.FASTMD_LOG || userOptions.log || 'summary';
  const cacheDir = path.resolve(
    process.cwd(),
    env.FASTMD_CACHE_DIR || userOptions.cacheDir || '.cache/fastmd'
  );
  const features = userOptions.features || {};
  return {
    root: process.cwd(),
    enabled,
    logLevel,
    cacheDir,
    features,
    stats: { hits: 0, misses: 0, durations: [] },
    pending: new Map(),
    configDigest: ''
  };
}

function shouldProcess(id, state) {
  const [fp] = id.split('?', 2);
  if (!fp) return false;
  const ext = fp.toLowerCase().endsWith('.md') || fp.toLowerCase().endsWith('.mdx');
  return !!ext;
}

function normalizeId(id, root) {
  let [fp] = id.split('?', 2);
  // Vite can give URLs like /@fs/abs-path
  fp = fp.replace(/^\/@@?fs\//, '/');
  if (!path.isAbsolute(fp)) fp = path.resolve(root, fp);
  const rel = path.posix.normalize(path.relative(root, fp).split(path.sep).join('/')).toLowerCase();
  return { rel, pathDigest: rel };
}

function stripBOM(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function normalizeNewlines(s) {
  return s.replace(/\r\n?/g, '\n');
}

function extractFrontmatter(s) {
  const m = s.match(/^---\s*\n([\s\S]*?)\n---\s*(\n|$)/);
  return m ? m[1] : '';
}

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

function sortedObject(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

function digestJSON(obj) {
  return sha256(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

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

async function ensureDirs(cacheDir) {
  const { dataDir, metaDir } = cachePaths(cacheDir, 'x');
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(metaDir, { recursive: true });
}

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

async function getToolchainDigest() {
  const parts = [];
  parts.push(`node=${process.versions.node}`);
  for (const name of ['vite', 'astro', '@mdx-js/mdx', 'remark', 'rehype', 'expressive-code']) {
    const ver = safePkgVersion(name);
    if (ver) parts.push(`${name}=${ver}`);
  }
  return parts.join('|');
}

function safePkgVersion(name) {
  try {
    const pkg = require(`${name}/package.json`);
    return pkg?.version ?? '0';
  } catch {
    return undefined;
  }
}

function truthy(v) {
  return /^(1|true|on|yes)$/i.test(String(v));
}

function now() {
  return Date.now();
}

function fmtMs(n) {
  return `${n}ms`;
}

function logLine(s) {
  // eslint-disable-next-line no-console
  console.log(`[fastmd] ${s}`);
}

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
