#!/usr/bin/env node
/**
 * check-kernel-exports.mjs — gate: every kernel must export meta + compute + buildArtifact.
 * Guards against the W45 defect class: compute-less kernels pass golden-parity
 * (which only hashes fixture vectors) but fail the RISC0 guest with ocg_run code -3.
 */
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KERNELS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'chaingraph', 'kernels');

const files = readdirSync(KERNELS_DIR).filter(f => f.endsWith('.kernel.mjs'));

let failures = 0;
for (const file of files) {
  const url = pathToFileURL(resolve(KERNELS_DIR, file)).href;
  const m = await import(url);
  const missing = [];
  if (typeof m.meta !== 'object' || m.meta === null) missing.push('meta');
  if (typeof m.compute !== 'function') missing.push('compute');
  if (typeof m.buildArtifact !== 'function') missing.push('buildArtifact');
  if (missing.length > 0) {
    console.error(`✗ ${file}: missing exports: ${missing.join(', ')}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n✗ ${failures} kernel(s) missing required exports (meta + compute + buildArtifact). Fix before push.`);
  process.exit(1);
}

console.log(`✓ kernel exports clean — ${files.length} kernel(s) all export meta + compute + buildArtifact.`);
