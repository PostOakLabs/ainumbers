#!/usr/bin/env node
/**
 * scripts/migrate-clause-snapshot-shards.mjs — one-shot split of the legacy clause-snapshot
 * registry into one file per digest (CLAUSE-SNAPSHOT-SHARD-1, 2026-11-03; exemplar
 * migrate-reservations-shards.mjs).
 *
 * Writes chaingraph/standard/clause-snapshots/<hex>.json per legacy entry. The legacy
 * clause-snapshot-registry.json is NEVER edited (open PRs that appended to it stay mergeable);
 * readers take the union (chaingraph/standard/clause-snapshot-store.mjs). An existing shard whose
 * content differs from the legacy entry is reported and left alone: the readers refuse it.
 *
 * Usage:
 *   node scripts/migrate-clause-snapshot-shards.mjs          # write missing shards
 *   node scripts/migrate-clause-snapshot-shards.mjs --verify # exit 1 unless assembled == legacy (parity)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { shardDirFor, shardFileName, shardText, assembleSorted } from '../chaingraph/standard/clause-snapshot-store.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = resolve(REPO, 'chaingraph/standard/clause-snapshot-registry.json');
const DIR = shardDirFor(LEGACY);
const VERIFY = process.argv.includes('--verify');

const legacy = JSON.parse(readFileSync(LEGACY, 'utf8'));
let written = 0, same = 0, mismatched = 0;
if (!VERIFY) mkdirSync(DIR, { recursive: true });
for (const entry of legacy) {
  const path = join(DIR, shardFileName(entry.digest));
  if (existsSync(path)) {
    if (isDeepStrictEqual(JSON.parse(readFileSync(path, 'utf8')), entry)) same++;
    else { mismatched++; console.error(`  MISMATCH ${entry.digest}: shard differs from legacy entry, left alone`); }
    continue;
  }
  if (VERIFY) { console.error(`  missing shard ${entry.digest}`); mismatched++; continue; }
  writeFileSync(path, shardText(entry));
  written++;
}
const canon = [...legacy].sort((a, b) => a.digest.localeCompare(b.digest));
const assembled = assembleSorted(LEGACY);
const parity = JSON.stringify(canon) === JSON.stringify(assembled);
console.log(`legacy entries ${legacy.length}; shards written ${written}, already equal ${same}, mismatched/missing ${mismatched}; assembled ${assembled.length}; parity after canonical sort: ${parity ? 'EQUAL' : 'DIFFERENT'}`);
process.exit(parity && !mismatched ? 0 : 1);
