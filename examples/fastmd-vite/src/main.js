// Example main.js for Vite
console.log('fastmd-cache example loaded');

import demoContent from './content/demo.mdx?raw';
// Import markdown files (transformed by fastmd-cache)
import sampleContent from './content/sample.md?raw';

// Display content info
document.getElementById('app').innerHTML = `
  <h1>fastmd-cache Vite Example</h1>
  <p>This example demonstrates caching of MD/MDX transformations.</p>
  
  <h2>Loaded Content:</h2>
  <ul>
    <li>sample.md - ${sampleContent.length} bytes</li>
    <li>demo.mdx - ${demoContent.length} bytes</li>
  </ul>
  
  <p>Check the console and build output to see cache hits/misses!</p>
`;
