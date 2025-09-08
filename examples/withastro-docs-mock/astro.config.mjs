import { defineConfig } from 'astro/config';
// Use the FastMD cache plugin from this repository
import fastmdCache from '../../plugins/fastmd-cache/index.mjs';

// Dynamically enable MDX + remark/rehype when deps are present.
// This keeps the project runnable even without installing extra deps.
const integrations = [];
if (process.env.FASTMD_ENABLE_MDX !== '0') {
  try {
    const [
      { default: mdx },
      { default: remarkGfm },
      { default: rehypeSlug },
      { default: autolink }
    ] = await Promise.all([
      import('@astrojs/mdx'),
      import('remark-gfm'),
      import('rehype-slug'),
      import('rehype-autolink-headings')
    ]);
    integrations.push(
      mdx({
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [autolink, { behavior: 'wrap' }]]
      })
    );
  } catch {
    // deps not installed; proceed without MDX
  }
}

export default defineConfig({
  integrations,
  vite: {
    plugins: fastmdCache({
      log: process.env.FASTMD_LOG || 'summary',
      include: ['**/*.md', '**/*.mdx'],
      exclude: ['**/draft/**'],
      trackDependencies: process.env.FASTMD_TRACK === 'loose' ? 'loose' : 'strict'
    })
  }
});
