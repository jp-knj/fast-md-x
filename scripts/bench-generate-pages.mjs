#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const n = Number(process.argv[2] || 200);
const base = 'src/pages/bench';
await mkdir(base, { recursive: true });

for (let i = 0; i < n; i++) {
  const p = join(base, `p-${String(i).padStart(4, '0')}.md`);
  const fm = `---\ntitle: Bench ${i}\n---`;
  const body = `\n\n# Heading ${i}\n\n${'Lorem ipsum dolor sit amet. '.repeat(10)}`;
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, fm + body, 'utf8');
}
console.log(`[bench] Generated ${n} markdown pages under ${base}`);
