#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function buildContent(id, i, lines) {
  if (!lines || lines <= 0) {
    return `# Generated Page ${id}

This is generated content for bench runs. Index: ${i}

- Line A ${i}
- Line B ${i}
- Line C ${i}
`;
  }
  const out = [];
  out.push(`# Generated Page ${id}`);
  out.push('');
  out.push(`Intro paragraph for page ${id}, index ${i}.`);
  out.push('');
  for (let n = 1; n <= lines; n++) {
    if (n % 20 === 1) {
      out.push(`## Section ${Math.ceil(n / 20)} (${id})`);
    } else if (n % 20 === 5) {
      out.push('- item A');
      out.push('- item B');
      out.push('- item C');
    } else if (n % 20 === 10) {
      out.push('```js');
      out.push(`export const i${n} = ${i + n};`);
      out.push('```');
    } else {
      out.push(`Line ${n} content for page ${id}`);
    }
  }
  out.push('');
  return out.join('\n');
}

export async function generatePages(baseDir, count, subdir = 'docs', lines = 0) {
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

${buildContent(id, i, lines)}`;
    await fs.writeFile(fp, body, 'utf8');
    created++;
  }
  return created;
}

async function main() {
  const dir = process.argv[2] || 'examples/minimal';
  const count = Number(process.argv[3] || '100');
  // Support: dir count [subdir] [lines] — if 3rd arg numeric, treat as lines
  let subdir = 'docs';
  let lines = 0;
  if (process.argv[4]) {
    const a = process.argv[4];
    if (Number.isNaN(Number(a))) subdir = a;
    else lines = Number(a);
  }
  if (process.argv[5]) lines = Number(process.argv[5] || '0');
  const n = await generatePages(dir, count, subdir, lines);
  console.log(`Generated ${n} pages under ${dir}/src/pages/${subdir}/ (lines=${lines})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
