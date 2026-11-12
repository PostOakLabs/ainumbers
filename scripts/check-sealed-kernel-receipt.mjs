#!/usr/bin/env node
// check-sealed-kernel-receipt.mjs — SO #36 push gate (SEALED-KERNEL-RECEIPT-PUSH-GATE-1).
//
// RULE (board STANDING-ORDERS #36): a sealed kernel is either left byte-identical, or it is fixed AND
// re-proven in the SAME push. The "fixed, unproven" middle state is forbidden. Until this gate the rule
// lived only in prose: check-s18-digest-freshness.mjs is a RATCHET (one --update-baseline raises the
// ceiling and the push goes through) and check-recompute-equality.mjs re-executes outputs, so neither
// refuses the push shape itself. This gate does, per changed kernel, with no baseline to raise.
//
// SEALED SET (single machine-readable source): a node shard `chaingraph/graph/nodes/<tool_id>.json`
// carries `compute_proof` (a §18 ZkVmReceipt). Its `journal.kernel_digest` is the digest the zkVM guest
// committed at prove time, produced by the canonical `sourceDigest()` in chaingraph/kernels/_buildid.mjs
// (the same function check-s18-digest-freshness.mjs and gen-kernel-identity.mjs call — never re-rolled
// here). A kernel's OLD bytes are SEALED iff the BASE shard's receipt binds sourceDigest(old bytes).
// A stale-at-base receipt (it already attests an earlier revision) or no receipt (compute_proof_ready
// "deferred") is NOT sealed by this definition: that kernel is already outside the proven state and the
// §18 freshness ratchet owns it.
//
// FRESH RECEIPT for the new bytes = the HEAD shard's `compute_proof` with
//   (a) journal.kernel_digest === sourceDigest(new bytes), AND
//   (b) verifySeal(compute_proof) === true (the BN254 Groth16 reference verifier in _computeproof.mjs).
// (b) is what makes this a proof check and not a string check: the seal commits to the journal bytes,
// so a receipt whose kernel_digest was rewritten by hand (old seal, new digest) fails verification.
// A stark receipt is vendor-delegated (§18.1) and cannot be verified here, so it does not count as fresh.
//
// Base/head: base = merge-base(origin/main, HEAD) (the PR integration point, same rule as preflight's
// touched-set; `@{u}` only when origin/main is absent), head = HEAD (what the push carries). Both are
// read from git objects, never the working tree, so an uncommitted edit can neither cause nor hide a red.
// Fails CLOSED when no base resolves (CI checks out fetch-depth 0, so this only fires on a broken clone).
//
// Usage:
//   node scripts/check-sealed-kernel-receipt.mjs                         base=merge-base origin/main HEAD, head=HEAD
//   node scripts/check-sealed-kernel-receipt.mjs --base <ref> --head <ref>   explicit range (read-only audits)

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KERNEL_RE = /^chaingraph\/kernels\/([^/]+)\.kernel\.mjs$/;
const NODES_DIR = 'chaingraph/graph/nodes';

const sha8 = (d) => (typeof d === 'string' ? d.replace(/^sha256:/, '').slice(0, 8) : '(none)');
const receiptOf = (node) => (node ? node.audit_signature?.compute_proof ?? node.compute_proof ?? null : null);

// ── evaluate ──────────────────────────────────────────────────────────────────────────────────────
// Pure over pre-loaded inputs so the paired test drives it with real kernels and real receipts.
// changes: [{ path, tool_id, oldSrc, newSrc (null = deleted), baseNode, headNode }]
export async function evaluate(changes, { sourceDigest, verifySeal }) {
  const findings = [];
  for (const c of changes) {
    const baseCp = receiptOf(c.baseNode);
    const oldDigest = c.oldSrc == null ? null : await sourceDigest(c.oldSrc);
    const sealed = !!(baseCp && oldDigest && baseCp.journal?.kernel_digest === oldDigest);
    if (!sealed) {
      const why = !baseCp ? 'no receipt at base (unproven/deferred)'
        : 'base receipt already attests an earlier revision (stale; §18 freshness ratchet owns it)';
      findings.push({ ...c, verdict: 'unsealed', oldDigest, why });
      continue;
    }
    if (c.newSrc == null) {
      const stillLive = c.headNode && c.headNode.status === 'live';
      findings.push({ ...c, verdict: stillLive ? 'red' : 'retired', oldDigest, newDigest: null,
        why: stillLive ? 'sealed kernel file deleted while its node is still live' : 'kernel removed with its node' });
      continue;
    }
    const newDigest = await sourceDigest(c.newSrc);
    const headCp = receiptOf(c.headNode);
    let why;
    if (!headCp) why = 'node carries no compute_proof at head';
    else if (headCp.journal?.kernel_digest !== newDigest) {
      why = `head receipt binds ${sha8(headCp.journal?.kernel_digest)}, not the new bytes`;
    } else {
      let ok = false;
      try { ok = verifySeal(headCp) === true; } catch (e) { why = `seal not locally verifiable (${e.message.split(';')[0]})`; }
      if (!ok && !why) why = 'head receipt names the new digest but its seal does NOT verify (journal edited without a re-prove)';
      if (ok) { findings.push({ ...c, verdict: 'fresh', oldDigest, newDigest }); continue; }
    }
    findings.push({ ...c, verdict: 'red', oldDigest, newDigest, why });
  }
  return findings;
}

// ── git readers ───────────────────────────────────────────────────────────────────────────────────
function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: REPO, env: gitEnv(), maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'], ...opts }).toString();
}
function show(ref, path) {
  try { return git(['show', `${ref}:${path}`]); } catch { return null; }
}
function nodeAt(ref, tool_id) {
  const direct = show(ref, `${NODES_DIR}/${tool_id}.json`);
  if (direct != null) return JSON.parse(direct);
  // shard file not named after the tool_id: find it by content (rare; exact-string match on the key).
  let hits = [];
  try { hits = git(['grep', '-l', '-F', `"tool_id": "${tool_id}"`, ref, '--', NODES_DIR]).split('\n').filter(Boolean); } catch { /* none */ }
  for (const h of hits) {
    const p = h.slice(h.indexOf(':') + 1);
    const n = JSON.parse(show(ref, p));
    if (n.tool_id === tool_id) return n;
  }
  return null;
}
function resolveBase() {
  try { return git(['merge-base', 'origin/main', 'HEAD']).trim(); } catch { /* fall through */ }
  try {
    const up = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).trim();
    return git(['merge-base', up, 'HEAD']).trim();
  } catch { return null; }
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const head = arg('--head') ?? 'HEAD';
  const base = arg('--base') ?? resolveBase();
  if (!base) {
    console.error('✗ SO #36 sealed-kernel receipt gate: no base ref resolves (origin/main and @{u} both absent).');
    console.error('  Failing CLOSED: without a base the changed-kernel set would be empty, a false green. Fetch origin/main.');
    process.exit(1);
  }
  const baseSha = git(['rev-parse', base]).trim();
  const headSha = git(['rev-parse', head]).trim();
  const diff = git(['diff', '--no-renames', '--name-status', baseSha, headSha, '--', 'chaingraph/kernels/'])
    .split('\n').filter(Boolean).map((l) => l.split('\t'));
  const changes = [];
  for (const [status, path] of diff) {
    const m = KERNEL_RE.exec(path);
    if (!m || status === 'A') continue; // a brand-new kernel has no sealed old bytes
    const tool_id = m[1];
    changes.push({ path, tool_id, oldSrc: show(baseSha, path), newSrc: status === 'D' ? null : show(headSha, path),
      baseNode: nodeAt(baseSha, tool_id), headNode: nodeAt(headSha, tool_id) });
  }
  const range = `${baseSha.slice(0, 8)}..${headSha.slice(0, 8)}`;
  if (!changes.length) {
    console.log(`✓ SO #36 sealed-kernel receipt gate clean — no existing kernel changed in ${range}.`);
    process.exit(0);
  }
  const { sourceDigest } = await import(pathToFileURL(resolve(REPO, 'chaingraph/kernels/_buildid.mjs')).href);
  const { verifySeal } = await import(pathToFileURL(resolve(REPO, 'chaingraph/kernels/_computeproof.mjs')).href);
  const findings = await evaluate(changes, { sourceDigest, verifySeal });
  const red = findings.filter((f) => f.verdict === 'red');
  for (const f of findings) {
    if (f.verdict === 'red') continue;
    const tag = f.verdict === 'fresh' ? `sealed ${sha8(f.oldDigest)} → ${sha8(f.newDigest)}, fresh receipt verified`
      : f.verdict === 'retired' ? `sealed, ${f.why}` : `not sealed: ${f.why}`;
    console.log(`  · ${f.path} — ${tag}`);
  }
  if (red.length) {
    console.error(`\n✗ SO #36 sealed-kernel receipt gate FAILED (${range}) — ${red.length} sealed kernel(s) changed without a fresh receipt:`);
    for (const f of red) {
      console.error(`  • ${f.path} (${f.headNode?.mcp_name ?? f.tool_id}) — old ${sha8(f.oldDigest)} → new ${sha8(f.newDigest)}: ${f.why}`);
    }
    console.error('  SO #36 remedy: re-prove this kernel at the new bytes IN THIS PUSH (fresh receipt into the node shard\'s');
    console.error('  compute_proof, journal.kernel_digest = new digest, seal verifying), or revert the kernel bytes.');
    console.error('  There is no baseline to raise and no allowlist: the fixed-but-unproven state is the defect.');
    process.exit(1);
  }
  console.log(`✓ SO #36 sealed-kernel receipt gate clean — ${findings.length} changed kernel(s) in ${range}, none sealed-and-unproven.`);
}
