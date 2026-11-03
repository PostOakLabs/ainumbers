// clause-snapshot-store.mjs — read/write layer for the clause-snapshot registry
// (CLAUSE-SNAPSHOT-SHARD-1, 2026-11-03; pattern: RESERVATIONS-SHARD-1 #2841).
//
// The registry was one append-only JSON array every clause-pinning PR edited, so two PRs pinning
// DIFFERENT digests conflicted on adjacent lines. Layout now: one file per digest at
// chaingraph/standard/clause-snapshots/<hex>.json holding exactly that entry. Two PRs pinning the
// SAME digest still add/add the same path, so the same-digest lock survives.
//
// Readers take the UNION of the directory and the legacy array file (kept byte-identical so open
// PRs that appended to it stay mergeable). A digest present in both with different content is a
// refusal (throws). Zero-dep, node: builtins only.

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/** Shard directory that sits beside a legacy registry path. */
export function shardDirFor(legacyPath) {
  return resolve(dirname(legacyPath), 'clause-snapshots');
}

export function shardFileName(digest) {
  return digest.replace(/^sha256:/, '') + '.json';
}

/** Canonical shard bytes for one entry. */
export function shardText(entry) {
  return JSON.stringify(entry, null, 2) + '\n';
}

function readLegacy(legacyPath) {
  if (!existsSync(legacyPath)) return [];
  return JSON.parse(readFileSync(legacyPath, 'utf8'));
}

export function readShards(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const entry = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (!entry || !DIGEST_RE.test(entry.digest || '')) throw new Error(`clause-snapshots/${f}: not a registry entry with a sha256 digest`);
    if (shardFileName(entry.digest) !== f) throw new Error(`clause-snapshots/${f}: file name does not match its digest ${entry.digest}`);
    return entry;
  });
}

/**
 * The assembled registry: legacy rows in file order (raw, so the (id, digest) duplicate gate still
 * sees them), then shard rows whose digest is not in the legacy file. Throws when a digest is in
 * both with different content.
 */
export function loadRegistryUnion(legacyPath) {
  const legacy = readLegacy(legacyPath);
  const byDigest = new Map(legacy.map((e) => [e.digest, e]));
  const out = [...legacy];
  for (const s of readShards(shardDirFor(legacyPath))) {
    const l = byDigest.get(s.digest);
    if (l) {
      if (!isDeepStrictEqual(l, s)) throw new Error(`clause-snapshot registry conflict: ${s.digest} is in clause-snapshot-registry.json and clause-snapshots/${shardFileName(s.digest)} with different content`);
      continue;
    }
    byDigest.set(s.digest, s);
    out.push(s);
  }
  return out;
}

/** Canonical assembled array: unique by digest, sorted by digest (the legacy file's order). */
export function assembleSorted(legacyPath) {
  const seen = new Set();
  return loadRegistryUnion(legacyPath)
    .filter((e) => (seen.has(e.digest) ? false : seen.add(e.digest)))
    .sort((a, b) => a.digest.localeCompare(b.digest));
}

/** Writer: a new per-digest file only. Idempotent; returns the stored entry. */
export function addShard(legacyPath, entry) {
  const existing = loadRegistryUnion(legacyPath).find((e) => e.digest === entry.digest);
  if (existing) return { entry: existing, added: false };
  const dir = shardDirFor(legacyPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, shardFileName(entry.digest)), shardText(entry));
  return { entry, added: true };
}
