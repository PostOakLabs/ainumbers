// check-chain-composer-urls.mjs — chain composer-page existence gate (CHAINURL-GATE-1).
//
// WHY: a chain shard (chaingraph/graph/chains/<name>.json) can declare a composer_url
// pointing at a page nobody built. The assembler then correctly refuses to integrate the
// chain, so the work silently does not ship, and the gap is only discovered by an ORCH
// eyeballing an assemble-land report. Measured twice: nav-verification-pack (fixed by
// NAVPACK-1, PR #396) and vop-liability-evidence (fix staged as VEPACK-1).
//
// This gate asserts, for every chaingraph/graph/chains/*.json shard, that its composer_url
// resolves to a page that actually exists on disk. Zero-dependency, node: builtins only
// (site repo is zero-dep, no npm/Ajv ever).
//
// Usage: node scripts/check-chain-composer-urls.mjs
// Exit 0 = every chain shard's composer_url resolves to an existing file.
// Exit 1 = prints every violation (chain name + expected path).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CHAINS_DIR = resolve(REPO, 'chaingraph/graph/chains');

const PREFIX = 'https://ainumbers.co/';

const files = readdirSync(CHAINS_DIR).filter((f) => f.endsWith('.json')).sort();

let checked = 0;
const violations = [];
const unmapped = [];

for (const file of files) {
  const path = resolve(CHAINS_DIR, file);
  const shard = JSON.parse(readFileSync(path, 'utf8'));
  const url = shard.composer_url;

  if (!url) {
    unmapped.push({ file, reason: 'shard has no composer_url field' });
    continue;
  }
  checked++;

  if (!url.startsWith(PREFIX)) {
    unmapped.push({ file, reason: `composer_url "${url}" does not match the expected https://ainumbers.co/ prefix — cannot derive a repo path` });
    continue;
  }

  const relPath = url.slice(PREFIX.length);
  const absPath = resolve(REPO, relPath);

  if (!existsSync(absPath)) {
    violations.push({ file, chain: shard.chain_id ?? shard.name ?? file, url, expectedPath: `repo/${relPath}` });
  }
}

if (unmapped.length) {
  console.error(`✗ check-chain-composer-urls FAILED — ${unmapped.length} shard(s) do not fit the single URL-to-path transform:`);
  for (const u of unmapped) console.error(`  • ${u.file} — ${u.reason}`);
}

if (violations.length) {
  console.error(`✗ check-chain-composer-urls FAILED — ${violations.length} chain(s) declare a composer_url whose page does not exist:`);
  for (const v of violations) console.error(`  • ${v.chain} (${v.file}) — expected ${v.expectedPath}, declared ${v.url}`);
  console.error('\nFix: build the missing composer page, or correct composer_url if it was wrong.');
}

if (unmapped.length || violations.length) process.exit(1);
console.log(`✓ check-chain-composer-urls clean — ${checked} chain shard(s), all composer_url pages exist.`);
