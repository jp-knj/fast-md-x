export interface NavItem {
  title: string;
  href?: string;
  items?: NavItem[];
}

export const navigation: NavItem[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', href: '/docs/getting-started' },
      { title: 'Installation', href: '/docs/getting-started#installation' },
      { title: 'Quick Start', href: '/docs/getting-started#quick-start' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { title: 'Basic Configuration', href: '/docs/configuration' },
      { title: 'Environment Variables', href: '/docs/configuration#environment-variables' },
      { title: 'Plugin Options', href: '/docs/configuration#plugin-options' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'Overview', href: '/docs/api-reference' },
      { title: 'Cache API', href: '/docs/api-reference#cache-api' },
      { title: 'Transform API', href: '/docs/api-reference#transform-api' },
      { title: 'RPC Protocol', href: '/docs/api-reference#rpc-protocol' },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { title: 'Performance Tuning', href: '/docs/advanced/performance' },
      { title: 'Rust Sidecar', href: '/docs/advanced/rust-sidecar' },
      { title: 'WebAssembly', href: '/docs/advanced/performance#wasm' },
      { title: 'Benchmarking', href: '/docs/advanced/performance#benchmarking' },
    ],
  },
];