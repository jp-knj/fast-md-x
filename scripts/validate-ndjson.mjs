#!/usr/bin/env node

/**
 * Validates NDJSON output from fastmd-cache plugin.
 * Reads from stdin, validates each JSON line, and reports statistics.
 *
 * Usage:
 *   FASTMD_LOG=json pnpm build | node scripts/validate-ndjson.mjs
 *
 * Exit codes:
 *   0 - All lines valid, summary found
 *   1 - JSON parsing error or missing required fields
 *   2 - No summary event found
 */

import { createInterface } from 'node:readline';

const REQUIRED_FIELDS = {
  cache_miss: ['evt', 'ts', 'rel'],
  cache_write: ['evt', 'ts', 'rel', 'durationMs', 'sizeBytes'],
  cache_hit: ['evt', 'ts', 'rel', 'durationMs'],
  summary: ['evt', 'ts', 'total', 'hits', 'misses', 'hitRate', 'p50', 'p95', 'savedMs']
};

const stats = {
  totalLines: 0,
  validLines: 0,
  invalidLines: 0,
  events: {
    cache_miss: 0,
    cache_write: 0,
    cache_hit: 0,
    summary: 0,
    other: 0
  },
  errors: []
};

const rl = createInterface({
  input: process.stdin,
  crlfDelay: Number.POSITIVE_INFINITY
});

rl.on('line', (line) => {
  stats.totalLines++;

  // Skip empty lines
  if (!line.trim()) {
    return;
  }

  try {
    const json = JSON.parse(line);

    // Check if it has an evt field
    if (!json.evt) {
      stats.invalidLines++;
      stats.errors.push(`Line ${stats.totalLines}: Missing 'evt' field`);
      return;
    }

    // Check required fields based on event type
    const requiredFields = REQUIRED_FIELDS[json.evt];
    if (requiredFields) {
      const missingFields = requiredFields.filter((field) => !(field in json));
      if (missingFields.length > 0) {
        stats.invalidLines++;
        stats.errors.push(
          `Line ${stats.totalLines}: Event '${json.evt}' missing fields: ${missingFields.join(', ')}`
        );
        return;
      }
      stats.events[json.evt]++;
    } else {
      stats.events.other++;
    }

    stats.validLines++;

    // Log important events for CI visibility
    if (json.evt === 'summary') {
      console.error(
        `✓ Summary: ${json.total} files, ${json.hits} hits, ${json.misses} misses, ${json.hitRate.toFixed(1)}% hit rate, ${json.savedMs.toFixed(0)}ms saved`
      );
    }
  } catch (err) {
    stats.invalidLines++;
    stats.errors.push(`Line ${stats.totalLines}: ${err.message}`);
  }
});

rl.on('close', () => {
  // Report statistics
  console.error('\n=== NDJSON Validation Results ===');
  console.error(`Total lines: ${stats.totalLines}`);
  console.error(`Valid JSON lines: ${stats.validLines}`);
  console.error(`Invalid lines: ${stats.invalidLines}`);
  console.error('\nEvent counts:');
  console.error(`  cache_miss: ${stats.events.cache_miss}`);
  console.error(`  cache_write: ${stats.events.cache_write}`);
  console.error(`  cache_hit: ${stats.events.cache_hit}`);
  console.error(`  summary: ${stats.events.summary}`);
  console.error(`  other: ${stats.events.other}`);

  // Report errors if any
  if (stats.errors.length > 0) {
    console.error('\nValidation errors:');
    for (const err of stats.errors.slice(0, 10)) {
      console.error(`  ${err}`);
    }
    if (stats.errors.length > 10) {
      console.error(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }

  // Exit with appropriate code
  if (stats.invalidLines > 0) {
    console.error('\n❌ NDJSON validation failed: Invalid JSON lines found');
    process.exit(1);
  }

  if (stats.events.summary === 0) {
    console.error('\n❌ NDJSON validation failed: No summary event found');
    process.exit(2);
  }

  console.error('\n✅ NDJSON validation passed');
  process.exit(0);
});

// Handle no input timeout
setTimeout(() => {
  if (stats.totalLines === 0) {
    console.error('❌ No input received within 30 seconds');
    process.exit(1);
  }
}, 30000);
