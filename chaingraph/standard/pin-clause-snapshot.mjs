#!/usr/bin/env node
// pin-clause-snapshot.mjs — SPEC.md §30.1/§30.2 (CLAUSE-DIGEST-GATE-1).
//
// The SOLE writer of chaingraph/standard/clause-snapshot-registry.json. Reads a LOCAL clause-level
// snapshot excerpt file (typically saved under workspace-root research/clause-snapshots/ — never
// this repo, since the excerpt may be copyrighted primary text), computes its sha256, and appends a
// METADATA-ONLY entry to the registry: digest + locator. The retrieved text itself is NEVER written
// to this repo — only the fact that a real excerpt was hashed, and where it came from.
//
// §30.2 GRANULARITY GATE: refuses any file above EXCERPT_MAX_BYTES. A real paragraph/section excerpt
// is small; a whole regulatory instrument (a "whole-PDF digest") is not, and this is the structural
// enforcement of "a whole-document digest is NOT a cited_clause_digest" — not a convention, a refusal.
//
// Usage:
//   node chaingraph/standard/pin-clause-snapshot.mjs \
//     --file <path-to-local-excerpt> \
//     --clause-path "(a)(2)" \
//     --source-url "https://..." \
//     --retrieved-at 2026-08-15 \
//     --registered-by sonnet \
//     --registered-at 2026-08-15 \
//     [--scheme cfr] [--id "12 CFR 1026.22"]
//
// Prints the resulting digest (paste it into a node's cited_clause_digest[] entry). Idempotent: a
// digest already registered is reported, not duplicated.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(HERE, 'clause-snapshot-registry.json');
export const EXCERPT_MAX_BYTES = 20000;

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1];
    out[key] = val;
    i++;
  }
  return out;
}

export function sha256Hex(buf) {
  return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

/** Pure function: validate + build a registry entry from an excerpt buffer + metadata. Throws a
 *  plain Error (never process.exit) so the pin logic is unit-testable without a subprocess. */
export function buildRegistryEntry(excerptBuf, meta) {
  if (excerptBuf.length > EXCERPT_MAX_BYTES) {
    throw new Error(
      `excerpt is ${excerptBuf.length} bytes, exceeds the ${EXCERPT_MAX_BYTES}-byte clause-level cap `
      + `(SPEC.md §30.2) — a whole-document/whole-PDF digest is NOT a cited_clause_digest. `
      + `Save only the specific paragraph/section excerpt and re-run.`
    );
  }
  if (excerptBuf.length === 0) throw new Error('excerpt file is empty');
  for (const req of ['clause_path', 'source_url', 'retrieved_at', 'registered_by', 'registered_at']) {
    if (!meta[req]) throw new Error(`--${req.replace(/_/g, '-')} is required`);
  }
  if (!ISO_DATE.test(meta.retrieved_at)) throw new Error(`--retrieved-at must be an ISO date (YYYY-MM-DD), got "${meta.retrieved_at}"`);
  if (!ISO_DATE.test(meta.registered_at)) throw new Error(`--registered-at must be an ISO date (YYYY-MM-DD), got "${meta.registered_at}"`);
  return {
    digest: sha256Hex(excerptBuf),
    excerpt_bytes: excerptBuf.length,
    clause_path: meta.clause_path,
    source_url: meta.source_url,
    retrieved_at: meta.retrieved_at,
    scheme: meta.scheme ?? null,
    id: meta.id ?? null,
    registered_by: meta.registered_by,
    registered_at: meta.registered_at,
  };
}

export function loadRegistry(path) {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function appendToRegistry(path, entry) {
  const registry = loadRegistry(path);
  const existing = registry.find((r) => r.digest === entry.digest);
  if (existing) return { registry, entry: existing, added: false };
  registry.push(entry);
  registry.sort((a, b) => a.digest.localeCompare(b.digest));
  writeFileSync(path, JSON.stringify(registry, null, 2) + '\n');
  return { registry, entry, added: true };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node pin-clause-snapshot.mjs --file <path> --clause-path <p> --source-url <u> --retrieved-at <YYYY-MM-DD> --registered-by <name> --registered-at <YYYY-MM-DD> [--scheme s] [--id i]');
    process.exit(1);
  }
  const filePath = resolve(args.file);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    console.error(`file not found: ${filePath}`);
    process.exit(1);
  }
  const buf = readFileSync(filePath);
  let entry;
  try {
    entry = buildRegistryEntry(buf, {
      clause_path: args['clause-path'],
      source_url: args['source-url'],
      retrieved_at: args['retrieved-at'],
      registered_by: args['registered-by'],
      registered_at: args['registered-at'],
      scheme: args.scheme,
      id: args.id,
    });
  } catch (e) {
    console.error(`pin-clause-snapshot: REFUSED — ${e.message}`);
    process.exit(1);
  }
  const { added, entry: stored } = appendToRegistry(REGISTRY_PATH, entry);
  if (added) {
    console.log(`pin-clause-snapshot: registered ${stored.digest} (${stored.excerpt_bytes} bytes, clause_path="${stored.clause_path}")`);
  } else {
    console.log(`pin-clause-snapshot: ${stored.digest} already registered (clause_path="${stored.clause_path}") — no change`);
  }
  console.log(`\nPaste into the node's cited_clause_digest[] entry:\n${JSON.stringify({
    digest: stored.digest,
    source_url: stored.source_url,
    retrieved_at: stored.retrieved_at,
    clause_path: stored.clause_path,
    ...(stored.scheme ? { scheme: stored.scheme } : {}),
    ...(stored.id ? { id: stored.id } : {}),
  }, null, 2)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
