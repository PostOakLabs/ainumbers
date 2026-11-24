// replay-result.mjs: replay the golden fixture corpus and write a byte-stable result file.
//
// Usage: node scripts/replay-result.mjs --out <dir> [--kernels-dir <dir>] [--rules <file>]
//
// Writes two files into --out:
//   replay-result.json  deterministic content only (corpus_digest, one leaf per module keyed on its
//                       published source digest, one root over the leaves). JCS-canonical, LF, no
//                       timestamps, no paths, no host facts.
//   replay-env.json     OS, architecture, Node version, wall time, counts. Never part of a result digest.
//
// The calling convention is the golden parity harness's: executionHash(policy_parameters, output_payload)
// per vector, in file order. A vector whose recomputed hash differs from its pinned golden_hash is
// recorded under its module in `mismatches` (never dropped, never fatal); the script still exits 0 and
// prints the differing vector ids. The result then differs from the agreed digest, which is the signal.
//
// corpus_digest keys on content, not on a commit: it is the sha256 of the canonical list of
// [module source digest, fixture file sha256] pairs plus the digest of the exclusion rules.

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { executionHash, jcsStringify } from '../chaingraph/kernels/_hash.mjs';
import { sourceDigest, normalizeSource } from '../chaingraph/kernels/_buildid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const canonDigest = (v) => sha256(jcsStringify(v));
// Text files are hashed LF-normalized so CRLF checkouts produce the same bytes (same rule as section 17).
const readLf = (p) => normalizeSource(readFileSync(p, 'utf8'));

/** Load the tracked exclusion rules and return { rules, digest }. */
export function loadRules(rulesPath) {
  const doc = JSON.parse(readLf(rulesPath));
  return { rules: doc.rules ?? [], digest: canonDigest(doc) };
}

function excludedBy(rules, source) {
  for (const r of rules) {
    if (r.match && typeof r.match.source_includes === 'string' && source.includes(r.match.source_includes)) return r.id;
  }
  return null;
}

/**
 * Replay the corpus under kernelsDir (fixtures in kernelsDir/fixtures). Pure: no clock, no host facts.
 * @returns {Promise<{result: object, counts: object}>}
 */
export async function replayCorpus({ kernelsDir, rulesPath }) {
  const { rules, digest: rulesDigest } = loadRules(rulesPath);
  const fixDir = join(kernelsDir, 'fixtures');
  const files = readdirSync(fixDir).filter((f) => f.endsWith('.fixtures.json')).sort();

  const pairs = [];                 // [module source digest, fixture sha256]
  const leaves = new Map();         // module digest -> [leaf, ...] (more than one only on identical source)
  const mismatches = {};            // module digest -> [vector id, ...]
  const excluded = [];              // module digests
  const counts = { fixtures: 0, vectors: 0, modules: 0, excluded: 0, no_vectors: 0, no_module: 0, mismatched: 0 };

  for (const ff of files) {
    const text = readLf(join(fixDir, ff));
    const fixtureSha = sha256(text);
    const doc = JSON.parse(text);
    const toolId = doc.tool_id ?? ff.replace(/\.fixtures\.json$/, '');
    const kernelPath = join(kernelsDir, `${toolId}.kernel.mjs`);
    counts.fixtures++;
    // A fixtures file with no vectors array is a different schema consumed by a sibling gate; not replayable here.
    if (!Array.isArray(doc.vectors)) { counts.no_vectors++; continue; }
    let modDigest;
    let source = '';
    if (existsSync(kernelPath)) {
      source = readLf(kernelPath);
      modDigest = await sourceDigest(source);
    } else {
      // No kernel module of that name: still part of the corpus, keyed on the fixture identity.
      modDigest = `fixture-only:${toolId}`;
      counts.no_module++;
    }
    pairs.push([modDigest, fixtureSha]);
    if (excludedBy(rules, source)) { excluded.push(modDigest); counts.excluded++; continue; }

    const hashes = [];
    for (const v of doc.vectors) {
      const got = await executionHash(v.policy_parameters, v.output_payload);
      if (got === null) {
        // HASH-REFUSAL-GUARDS-SCRIPTS-1: HASH-REFUSAL-SHARED-1 makes
        // executionHash return null on unhashable input. A null must never be
        // folded into the corpus digest or compared against a golden — refuse loudly.
        console.error(`replay-result: ${toolId}/${v.name}: executionHash returned null (unhashable vector); refusing to fold a null golden into the corpus digest`);
        process.exit(1);
      }
      hashes.push(got);
      counts.vectors++;
      if (v.golden_hash !== got) {
        (mismatches[modDigest] ??= []).push(`${toolId}/${v.name}`);
        counts.mismatched++;
      }
    }
    if (!leaves.has(modDigest)) leaves.set(modDigest, []);
    leaves.get(modDigest).push(canonDigest(hashes));
  }

  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const corpus_digest = canonDigest({ pairs, exclusion_rules: rulesDigest });

  const modules = {};
  for (const [k, ls] of leaves) modules[k] = ls.length === 1 ? ls[0] : canonDigest([...ls].sort());
  counts.modules = Object.keys(modules).length;
  const root = canonDigest(modules);

  const result = {
    schema: 'ainumbers.co/replay-result/v1',
    corpus_digest,
    exclusion_rules_digest: rulesDigest,
    excluded_count: excluded.length,
    modules,
    mismatches,
    root,
  };
  return { result, counts };
}

/** Canonical serialization of the result file: JCS, one trailing LF. */
export const serializeResult = (result) => jcsStringify(result) + '\n';

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

async function main() {
  const out = arg('--out', null);
  if (!out) { console.error('usage: node scripts/replay-result.mjs --out <dir> [--kernels-dir <dir>] [--rules <file>]'); process.exit(2); }
  const kernelsDir = resolve(arg('--kernels-dir', join(SITE_ROOT, 'chaingraph', 'kernels')));
  const rulesPath = resolve(arg('--rules', join(SITE_ROOT, 'data', 'replay-exclusion-rules.json')));
  const t0 = Date.now();
  const { result, counts } = await replayCorpus({ kernelsDir, rulesPath });
  const wall_ms = Date.now() - t0;
  mkdirSync(out, { recursive: true });
  const body = serializeResult(result);
  writeFileSync(join(out, 'replay-result.json'), body);
  const env = {
    schema: 'ainumbers.co/replay-env/v1',
    os: process.platform,
    os_release: os.release(),
    arch: process.arch,
    node: process.version,
    wall_ms,
    counts,
    result_sha256: sha256(body),
  };
  writeFileSync(join(out, 'replay-env.json'), JSON.stringify(env, null, 2) + '\n');
  for (const [mod, ids] of Object.entries(result.mismatches)) {
    for (const id of ids) console.log(`DIFFERS ${id} (module ${mod})`);
  }
  console.log(`replay-result.json sha256 ${env.result_sha256}`);
  console.log(`corpus_digest ${result.corpus_digest}`);
  console.log(`${counts.vectors} vector(s), ${counts.modules} module(s), ${counts.excluded} excluded, ${counts.mismatched} differing, ${wall_ms} ms`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
