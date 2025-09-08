#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const n = Number(process.argv[2] || 1000);
const base = 'src/pages/docs';
await mkdir(base, { recursive: true });

const mdx = process.env.MDX === '1';

for (let i = 0; i < n; i++) {
  const ext = mdx ? 'mdx' : 'md';
  const p = join(base, `guide-${String(i).padStart(4, '0')}.${ext}`);
  const fm = `---\ntitle: Guide ${i}\ntags: [bench, example]\n---`;
  const body = `\n\n# H1 ${i}\n\n${'This is a paragraph. '.repeat(12)}\n\n## H2 ${i}\n\n- item A\n- item B\n- item C\n\n\`\`\`ts\nexport const v${i} = ${i};\n\`\`\``;
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, fm + body, 'utf8');
}
console.log(`[seed] Generated ${n} ${mdx ? 'MDX' : 'MD'} pages under ${base}`);
