#!/usr/bin/env node
// check-proven-digest-freeze.mjs - proven-kernel digest freeze gate.
//
// WHY: a node that already carries a receipt is proven against one exact kernel source. Any change to
// that source stales the receipt (hash-neutral is not proof-neutral), and the only remedy is a re-prove.
// Policy (Tim, 2026-10-17): a re-prove is created only when an audit says the kernel is broken. This gate
// makes that policy mechanical: a change that moves the sourceDigest() of a proven node is refused unless
//   (i)  the PR body or a commit message in the range carries
//          REPROVE-AUTHORIZED: art-<n> <audit path>#<finding id>
//        for that node, and the cited audit file exists, AND
//   (ii) the same change carries a fresh receipt for the node: the s18 per-node staleness test
//        (computeStaleness() from check-s18-digest-freshness.mjs) classifies it fresh at HEAD.
// It also refuses, unconditionally, any change that flips a proven node to compute_proof_ready "deferred".
//
// WHAT THE DIGEST COVERS (verified before this gate was written, recorded in its PR body):
//   * The s18 freshness gate hands sourceDigest() the full text of chaingraph/kernels/<tool_id>.kernel.mjs
//     and nothing else. That is also the text gen-kernel-identity.mjs stamps into compute_images.
//   * Shared bundles (_amort, _dtree, _detmath, _ruleversion, the vendored noble crypto, the CSV guard)
//     are INLINED verbatim into each kernel file so compute() is self-contained in the zkVM guest. Their
//     bytes are therefore inside the digested text; no transitive bundle walk is needed.
//   * The only relative imports any kernel carries are ./_hash.mjs and ./_proof.mjs. The guest replaces
//     ./_hash.mjs with its own stub, so the repo copy is not part of the proven program. Those two files
//     are outside every node digest by design and outside this gate.
//   * Node-shard JSON is not part of the digest: a description-only shard edit moves neither the digest
//     nor the s18 stale count (measured).
//
// WHICH NODES ARE FROZEN: a node whose shard on the base tree has compute_proof_ready "ready" or "proven",
// or has no compute_proof_ready field but carries a receipt (compute_proof.journal.kernel_digest). SPEC
// section 18 lets a node either carry a receipt or declare "deferred"; most proven shards carry the receipt
// with no readiness field at all, so keying on the field alone would leave them unguarded. "deferred"
// nodes are never frozen (first proves of deferred nodes are fine).
//
// CANONICAL PRODUCER ONLY: digests come from sourceDigest() in chaingraph/kernels/_buildid.mjs, never from
// a second canonicalization in this file. Unchanged blobs are skipped because identical bytes cannot move
// a digest; every candidate that did change is digested on both trees.
//
// CONTEXT SPLIT (mirrors the in-gate split of check-compute-proof-coverage.mjs): advisory (warn, exit 0)
// on a GitHub pull_request run; blocking everywhere else, including merge_group, main and local preflight.
// Put the REPROVE-AUTHORIZED line in a COMMIT MESSAGE: a merge_group or main run has no PR body to read.
//
// Usage:
//   node scripts/check-proven-digest-freeze.mjs                 compare merge-base(origin/main, HEAD) with the work tree
//   node scripts/check-proven-digest-freeze.mjs --base <ref>    compare <ref> with the work tree
//   node scripts/check-proven-digest-freeze.mjs --body-file <f> also read REPROVE-AUTHORIZED lines from <f>
// Env: PR_BODY (CI passes the pull_request body through env, never spliced into the script).

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const KERNEL_DIR_REL = 'chaingraph/kernels';
const SHARD_DIR_REL = 'chaingraph/graph/nodes';

// ── pure helpers (exported for the fixture test) ───────────────────────────────────────────────────

export function hasReceipt(shard) {
  const cp = shard?.audit_signature?.compute_proof ?? shard?.compute_proof;
  return Boolean(cp && cp.journal && typeof cp.journal.kernel_digest === 'string');
}

export function isProven(shard) {
  if (!shard) return false;
  const r = shard.compute_proof_ready;
  if (r === 'ready' || r === 'proven') return true;
  if (r === undefined) return hasReceipt(shard);
  return false;
}

// "art-191-conversion-receipt-builder" and "504-settlement-risk-capital-optimizer" both carry their node
// number as the leading digits; returns the number as a string with leading zeros stripped, or null.
export function nodeNumber(toolId) {
  const m = /^(?:art-)?0*(\d+)-/.exec(String(toolId));
  return m ? m[1] : null;
}

export function parseAuthorizations(text) {
  const out = [];
  const re = /REPROVE-AUTHORIZED:\s*art-0*(\d+)\s+([^\s#]+)#(\S+)/g;
  let m;
  while ((m = re.exec(String(text ?? ''))) !== null) out.push({ art: m[1], path: m[2], finding: m[3] });
  return out;
}

// Pure evaluation. All inputs are plain lookups so the fixture test drives the real logic:
//   ids              tool_ids to examine (the CLI passes only ids whose kernel or shard changed)
//   baseShard(id)    parsed shard on the base tree, or undefined
//   headShard(id)    parsed shard at HEAD (work tree), or undefined
//   baseSrc(id)      kernel source text on the base tree, or undefined
//   headSrc(id)      kernel source text at HEAD, or undefined
//   authorizations   parseAuthorizations() output over every citation source
//   citedFileExists  (path) => boolean
//   sourceDigestFn   the canonical sourceDigest() from _buildid.mjs
//   computeStalenessFn  computeStaleness() from check-s18-digest-freshness.mjs
export async function evaluateFreeze({
  ids, baseShard, headShard, baseSrc, headSrc,
  authorizations, citedFileExists, sourceDigestFn, computeStalenessFn,
}) {
  const refused = [];
  const allowed = [];
  const notes = [];
  for (const id of ids) {
    const b = baseShard(id);
    if (!isProven(b)) continue;
    const h = headShard(id);

    if (h && h.compute_proof_ready === 'deferred') {
      refused.push({ id, reason: 'flips a proven node to compute_proof_ready "deferred" (never allowed)' });
      continue;
    }

    const bText = baseSrc(id);
    if (bText === undefined) {
      notes.push(`${id}: proven on base but has no kernel file there; nothing to freeze`);
      continue;
    }
    const hText = headSrc(id);
    const d0 = await sourceDigestFn(bText);
    const d1 = hText === undefined ? null : await sourceDigestFn(hText);
    if (d0 === d1) continue; // bytes changed but the canonical digest did not (for example line endings)

    const n = nodeNumber(id);
    const cites = authorizations.filter((a) => n !== null && a.art === n);
    const citedOk = cites.find((a) => citedFileExists(a.path));

    let fresh = false;
    if (h && hText !== undefined && hasReceipt(h)) {
      // Reuse the s18 per-node staleness test verbatim. It only scores live gpu:false nodes, so the node
      // is presented in that scope here; the comparison it runs (journal digest vs recomputed digest) is
      // the same for every proven node regardless of its gpu or status flags.
      const { results } = await computeStalenessFn(
        { nodes: [{ ...h, status: 'live', gpu: false }] },
        { [h.tool_id ?? id]: hText },
        sourceDigestFn,
      );
      fresh = results.length === 1 && results[0].state === 'fresh';
    }

    const digestLine = `base=${d0.slice(0, 19)} head=${d1 ? d1.slice(0, 19) : '(kernel removed)'}`;
    if (citedOk && fresh) {
      allowed.push({ id, reason: `digest moved, authorized by ${citedOk.path}#${citedOk.finding} with a fresh receipt (${digestLine})` });
      continue;
    }
    const missing = [];
    if (!cites.length) missing.push(`no "REPROVE-AUTHORIZED: art-${n ?? '?'} <audit path>#<finding id>" line in the PR body or commit messages`);
    else if (!citedOk) missing.push(`cited audit file not found: ${cites.map((a) => a.path).join(', ')}`);
    if (!fresh) missing.push(hText === undefined ? 'kernel file removed, so no receipt can be fresh' : 'no fresh receipt at HEAD (receipt journal digest does not match the edited kernel)');
    refused.push({ id, reason: `sourceDigest moved (${digestLine}); ${missing.join('; ')}` });
  }
  return { refused, allowed, notes };
}

// ── git plumbing ──────────────────────────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: REPO, env: gitEnv(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

// Read many blobs in one `git cat-file --batch` call. Returns Map(spec -> utf8 text) for blobs that exist.
function readBlobs(specs) {
  const map = new Map();
  if (!specs.length) return map;
  const r = spawnSync('git', ['cat-file', '--batch'], { cwd: REPO, env: gitEnv(), input: specs.join('\n') + '\n', maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git cat-file --batch failed: ' + String(r.stderr));
  const buf = r.stdout;
  let pos = 0;
  for (const spec of specs) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl < 0) break;
    const header = buf.subarray(pos, nl).toString('utf8');
    pos = nl + 1;
    if (header.endsWith(' missing') || header.endsWith(' ambiguous')) continue;
    const size = Number(header.split(' ')[2]);
    map.set(spec, buf.subarray(pos, pos + size).toString('utf8'));
    pos += size + 1;
  }
  return map;
}

function resolveBase(explicit) {
  if (explicit) {
    const v = git(['rev-parse', '--verify', '--quiet', `${explicit}^{commit}`]);
    return v.ok ? { sha: v.out, how: `--base ${explicit}` } : null;
  }
  const mb = git(['merge-base', 'origin/main', 'HEAD']);
  if (!mb.ok || !mb.out) return null;
  const head = git(['rev-parse', 'HEAD']).out;
  if (mb.out !== head) return { sha: mb.out, how: 'merge-base(origin/main, HEAD)' };
  // HEAD is main itself (a run on main): the change under test is the last landed commit.
  const parent = git(['rev-parse', '--verify', '--quiet', 'HEAD~1^{commit}']);
  return parent.ok ? { sha: parent.out, how: 'HEAD~1 (HEAD is on origin/main)' } : null;
}

function citedFileExistsOnDisk(p) {
  if (isAbsolute(p)) return existsSync(p);
  // Repo-relative first; then workspace-relative, which only resolves on a local checkout.
  return existsSync(resolve(REPO, p)) || existsSync(resolve(REPO, '..', p));
}

// ── CLI entry point ───────────────────────────────────────────────────────────────────────────────

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  const argVal = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const advisory = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_EVENT_NAME === 'pull_request';
  const t0 = Date.now();

  const base = resolveBase(argVal('--base'));
  if (!base) {
    console.error('✗ proven-digest freeze: base ref does not resolve (need origin/main or --base). Failing closed.');
    process.exit(1);
  }

  const diff = git(['diff', '--name-only', base.sha, '--', `${KERNEL_DIR_REL}/*.kernel.mjs`, `${SHARD_DIR_REL}/*.json`]);
  if (!diff.ok) {
    console.error('✗ proven-digest freeze: git diff failed: ' + diff.err);
    process.exit(1);
  }
  const ids = new Set();
  for (const f of diff.out.split('\n').filter(Boolean)) {
    const name = f.split('/').pop();
    if (f.startsWith(KERNEL_DIR_REL + '/') && name.endsWith('.kernel.mjs')) ids.add(name.slice(0, -'.kernel.mjs'.length));
    else if (f.startsWith(SHARD_DIR_REL + '/') && name.endsWith('.json')) ids.add(name.slice(0, -'.json'.length));
  }

  const idList = [...ids].sort();
  const specs = idList.flatMap((id) => [`${base.sha}:${SHARD_DIR_REL}/${id}.json`, `${base.sha}:${KERNEL_DIR_REL}/${id}.kernel.mjs`]);
  const blobs = readBlobs(specs);
  const parse = (t) => { try { return JSON.parse(t); } catch { return undefined; } };
  const readHead = (rel) => { const p = resolve(REPO, rel); return existsSync(p) ? readFileSync(p, 'utf8') : undefined; };

  // Citation sources: commit messages in base..HEAD, the PR body (env), and an optional body file.
  let citeText = git(['log', '--format=%B', `${base.sha}..HEAD`]).out;
  if (process.env.PR_BODY) citeText += '\n' + process.env.PR_BODY;
  const bodyFile = argVal('--body-file');
  if (bodyFile && existsSync(bodyFile)) citeText += '\n' + readFileSync(bodyFile, 'utf8');

  const { sourceDigest } = await import(pathToFileURL(resolve(REPO, KERNEL_DIR_REL, '_buildid.mjs')).href);
  const { computeStaleness } = await import(pathToFileURL(resolve(HERE, 'check-s18-digest-freshness.mjs')).href);

  const { refused, allowed, notes } = await evaluateFreeze({
    ids: idList,
    baseShard: (id) => { const t = blobs.get(`${base.sha}:${SHARD_DIR_REL}/${id}.json`); return t === undefined ? undefined : parse(t); },
    headShard: (id) => { const t = readHead(`${SHARD_DIR_REL}/${id}.json`); return t === undefined ? undefined : parse(t); },
    baseSrc: (id) => blobs.get(`${base.sha}:${KERNEL_DIR_REL}/${id}.kernel.mjs`),
    headSrc: (id) => readHead(`${KERNEL_DIR_REL}/${id}.kernel.mjs`),
    authorizations: parseAuthorizations(citeText),
    citedFileExists: citedFileExistsOnDisk,
    sourceDigestFn: sourceDigest,
    computeStalenessFn: computeStaleness,
  });

  const ms = Date.now() - t0;
  for (const n of notes) console.log(`  note: ${n}`);
  for (const a of allowed) console.log(`  ✓ ${a.id}: ${a.reason}`);
  if (refused.length) {
    const head = advisory ? '⚠ proven-digest freeze (ADVISORY on pull_request; blocking on merge_group and main)' : '✗ proven-digest freeze FAILED';
    console.error(`\n${head}: ${refused.length} proven node(s) refused (base ${base.how} @ ${base.sha.slice(0, 12)}):`);
    for (const r of refused) console.error(`  • ${r.id}: ${r.reason}`);
    console.error('  A proven kernel changes only when an audit finds it broken. Cite the finding in a commit message as');
    console.error('  "REPROVE-AUTHORIZED: art-<n> <audit path>#<finding id>" and attach the fresh receipt in the same change.');
    if (advisory) {
      console.log(`::warning::proven-digest freeze: ${refused.length} proven node(s) refused; this blocks in the merge queue`);
      process.exit(0);
    }
    process.exit(1);
  }
  console.log(`✓ proven-digest freeze clean: ${idList.length} changed node file(s) examined against ${base.how} @ ${base.sha.slice(0, 12)}, ${allowed.length} authorized re-prove(s), ${ms} ms`);
}
