#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

export async function generatePages(baseDir, count, subdir = 'docs') {
  const pagesDir = path.join(baseDir, 'src/pages', subdir);
  await fs.mkdir(pagesDir, { recursive: true });
  let created = 0;
  for (let i = 1; i <= count; i++) {
    const id = String(i).padStart(3, '0');
    const fp = path.join(pagesDir, `page-${id}.md`);
    const body = `---
title: Generated Page ${id}
tags: [bench, generated]
order: ${i}
---

# Generated Page ${id}

This is generated content for bench runs. Index: ${i}

- Line A ${i}
- Line B ${i}
- Line C ${i}
`;
    await fs.writeFile(fp, body, 'utf8');
    created++;
  }
  return created;
}

async function main() {
  const dir = process.argv[2] || 'examples/minimal';
  const count = Number(process.argv[3] || '100');
  const subdir = process.argv[4] || 'docs';
  const n = await generatePages(dir, count, subdir);
  console.log(`Generated ${n} pages under ${dir}/src/pages/${subdir}/`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
