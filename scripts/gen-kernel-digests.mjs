#!/usr/bin/env node
/**
 * scripts/gen-kernel-digests.mjs -- VERIFYBINDING-DIGEST-DEFAULT-1 (2026-11-12)
 *
 * The PUBLISHED KERNEL-DIGEST LIST: every live node's current kernel identity digest,
 * derived from the node shards' compute_images[] entries with system "sha256-source"
 * (the Graph Index publication the kernel-identity section of the SPEC names), written
 * to chaingraph/kernel-digests.json -- a static file the site already serves.
 *
 * Consumers: the kernel_digest leg of verifyBinding (SPEC section 18.1). Browser
 * verifiers (the ledger verify path, the proof-walk kit) load this list and engage
 * that leg BY DEFAULT; the library keeps publishedKernelDigests: null as the explicit
 * opt-out for offline callers. SO #34 holds by construction: the digests a verifier
 * uses come from this published file, never from the artifact under test.
 *
 * SINGLE-WRITER (SO #35 / scripts/derived-artifacts.mjs id 'kernel-digests'):
 * main's derived-artifacts-regen workflow runs this script after merge and commits
 * the file; a PR is FORBIDDEN to commit it (prAbsentOk entry, ai-catalog precedent).
 * The generator is deterministic -- sorted keys, no timestamps -- so a second pass
 * over the same tree is byte-identical (the load-bearing idempotency property the
 * COVERED set requires, measured by content hash not git status).
 *
 * Usage:
 *   node scripts/gen-kernel-digests.mjs          # write mode (main-side regen)
 *   node scripts/gen-kernel-digests.mjs --check  # freshness gate: advisory on a PR, blocking on main
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Declare-parity: one module-level constant mirrors the COVERED entry's artifacts list
// (the static extractor reads call sites; the constant keeps them from drifting apart).
export const KERNEL_DIGESTS_REL = 'chaingraph/kernel-digests.json';
const NODES_DIR_REL = 'chaingraph/graph/nodes';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Published kernel-identity digest shape: sha256: + 64 lowercase hex (a malformed
// publication must stop the regen loudly, never silently drop a node from the list).
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

export function deriveKernelDigests() {
  const files = readdirSync(join(REPO, NODES_DIR_REL)).filter((f) => f.endsWith('.json')).sort();
  const byId = {};
  let withoutDigest = 0;
  for (const f of files) {
    const shard = JSON.parse(readFileSync(join(REPO, NODES_DIR_REL, f), 'utf8'));
    const toolId = shard.tool_id;
    if (typeof toolId !== 'string' || !toolId) throw new Error(`${NODES_DIR_REL}/${f}: shard carries no tool_id`);
    const entry = (shard.compute_images || []).find((ci) => ci && ci.system === 'sha256-source');
    if (!entry) { withoutDigest++; continue; } // publishes no kernel identity yet: counted, not mapped
    if (typeof entry.image_id !== 'string' || !DIGEST_RE.test(entry.image_id))
      throw new Error(`${NODES_DIR_REL}/${f}: sha256-source image_id is not a sha256: 64-hex digest: ${String(entry.image_id).slice(0, 80)}`);
    if (byId[toolId] && byId[toolId] !== entry.image_id)
      throw new Error(`${NODES_DIR_REL}/${f}: duplicate tool_id ${toolId} with a differing digest`);
    byId[toolId] = entry.image_id;
  }
  // Key order is code-unit sorted explicitly: shard filename order is not tool_id order.
  const digests = {};
  for (const k of Object.keys(byId).sort()) digests[k] = byId[k];
  const out = {
    spec: 'OpenChainGraph published kernel digests (SPEC section 17.1: compute_images system sha256-source)',
    source: 'derived from the node shards in chaingraph/graph/nodes; regenerated on main only (scripts/derived-artifacts.mjs id kernel-digests); never edited in a PR',
    usage: 'default engagement list for the verifyBinding kernel_digest leg (SPEC section 18.1). Digests are read from this published file, never from the artifact under test (SO #34).',
    node_count: Object.keys(digests).length,
    nodes_without_digest: withoutDigest,
    digests,
  };
  return JSON.stringify(out, null, 2) + '\n';
}

function main() {
  const check = process.argv.includes('--check');
  const generated = deriveKernelDigests();
  const outPath = resolve(REPO, KERNEL_DIGESTS_REL);
  const count = JSON.parse(generated).node_count;
  if (!check) {
    const prev = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
    writeFileSync(outPath, generated);
    console.log(prev === generated
      ? `gen-kernel-digests: already byte-exact -- no write (${count} node digests)`
      : `gen-kernel-digests: wrote ${KERNEL_DIGESTS_REL} (${count} node digests)`);
    return 0;
  }
  if (!existsSync(outPath)) {
    console.error(`gen-kernel-digests --check: ${KERNEL_DIGESTS_REL} is ABSENT on disk. Expected on a PR checkout (main's regen writes it after merge; the COVERED entry is prAbsentOk) -- on MAIN this is a hard failure: run node scripts/gen-kernel-digests.mjs.`);
    return 1;
  }
  if (readFileSync(outPath, 'utf8') === generated) {
    console.log('gen-kernel-digests --check: byte-exact');
    return 0;
  }
  console.error(`gen-kernel-digests --check: ${KERNEL_DIGESTS_REL} is STALE vs the node shards. main's derived-artifacts regen owns this file (SO #35); a PR must not rewrite it.`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
