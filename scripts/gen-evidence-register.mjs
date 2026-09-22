#!/usr/bin/env node
// scripts/gen-evidence-register.mjs — EVREG-1: the claim-level evidence register
// generator. The SINGLE WRITER (SO #35) for exactly two output surfaces:
//
//   evidence/claims.json   — the register: one entry per registered public claim,
//                            binding it to its source surface, scope, as_of,
//                            review_by, and the sha256 of its snapshot.
//   source/<claim-id>.txt  — the per-claim point-in-time snapshot of the exact
//                            source line the claim was registered against.
//
// It reads ONE hand-authored input: evidence/claims.src.json. Every generated
// byte is a pure function of committed inputs — NO wall clock anywhere in the
// output (the fv-status lesson: a wall-clock generator in the shared regen
// chain never converges). Registration/review dates live in the hand-authored
// src, never stamped here.
//
// ── WHY THE WRITER NEVER REWRITES A SNAPSHOT ────────────────────────────────
// A snapshot is EVIDENCE of what the page said when the claim was last
// reviewed. If the page text later drifts, the register MUST go red (that is
// the register's entire reason to exist — a public claim changed without
// re-review), so the default write path leaves an existing snapshot byte
// untouched and hashes what is actually on disk. Healing drift is a deliberate
// builder act: `--revalidate=<id>[,<id>...]` re-extracts and overwrites ONLY
// the named snapshots, after a human has re-reviewed the new text. This keeps
// the generator IDEMPOTENT and bot-safe (the main-side regen pass in
// derived-artifacts.mjs runs it on every push): the regen can add snapshots
// for new claims but can never launder a drift — the red belongs to
// check-evidence-register.mjs and stays until re-review.
//
// ── WIRING ──────────────────────────────────────────────────────────────────
// COVERED id 'evidence-register' in scripts/derived-artifacts.mjs: regen =
// this script (default mode), gate = scripts/check-evidence-register.mjs
// (advisory on a PR, blocking on main via the generic downgrade). The gate
// also carries the policy legs (field completeness, date sanity, review
// ratchet) and ships a paired mutation self-test, check-evidence-register
// .test.mjs — both live GATES entries in scripts/preflight.mjs,
// PREFLIGHT_ONLY-declared in check-workflow-gate-parity.mjs (their CI route is
// scripts-verify.yml's full preflight).
//
// ⛔ FENCE — all paths anchored. The workspace root already carries an
// `evidence/` directory, so every path here is repo-anchored `evidence/` and
// `source/` INSIDE this repo (written as `repo/evidence/`, `repo/source/` in
// board prose). This script writes nothing else.
//
// Usage:
//   node scripts/gen-evidence-register.mjs                        # write (additive; never rewrites an existing snapshot)
//   node scripts/gen-evidence-register.mjs --revalidate=<id>[,<id>...]  # builder-only: overwrite the named snapshots after re-review
//
// Exit codes: 0 ok (a preserved drift prints a notice — the gate owns that
// verdict) · 1 hard input error (missing field, anchor not found).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..');

export const SRC_REL = 'evidence/claims.src.json';
export const REGISTER_REL = 'evidence/claims.json';
export const SNAPSHOT_DIR_REL = 'source';

export const REQUIRED_FIELDS = [
  'id', 'claim', 'count_key', 'source_path', 'anchor',
  'scope', 'as_of', 'review_by', 'registered_by', 'registered_at',
];

/** sha256 hex of a string — the ONE hash used across register and snapshots. */
export function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Find the claim's source line. Pure: takes file CONTENT, not a path, so the
 * gate re-derives the identical answer from the identical input.
 * `anchor` must match EXACTLY ONE line unless `occurrence` (1-based) says
 * otherwise — an ambiguous anchor is refused, never silently resolved to the
 * first hit, because the snapshot binds to a specific line.
 */
export function extractClaimLine(pageText, anchor, occurrence = 1) {
  if (!anchor || typeof anchor !== 'string') {
    throw new Error('extractClaimLine: anchor must be a non-empty string');
  }
  const lines = pageText.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(anchor)) hits.push({ lineNo: i + 1, line: lines[i].trim() });
  }
  if (hits.length === 0) {
    throw new Error(`anchor ${JSON.stringify(anchor)} not found on the source surface (was the claim text removed or reworded? update evidence/claims.src.json deliberately)`);
  }
  if (occurrence < 1 || occurrence > hits.length) {
    throw new Error(`anchor ${JSON.stringify(anchor)} matched ${hits.length} line(s); occurrence ${occurrence} is out of range`);
  }
  return hits[occurrence - 1];
}

/** The deterministic snapshot document for one claim. No wall clock. */
export function snapshotTextFor(claim, extractedLine) {
  const lines = [
    `AINumbers claim-level evidence snapshot — ${claim.id}`,
    `claim: ${claim.claim}`,
    `count_key: ${claim.count_key}`,
    `source_path: ${claim.source_path}`,
    `anchor: ${claim.anchor}`,
    `occurrence: ${claim.occurrence ?? 1}`,
    `scope: ${claim.scope}`,
    `as_of: ${claim.as_of}`,
    `review_by: ${claim.review_by}`,
    `registered_by: ${claim.registered_by}`,
    `registered_at: ${claim.registered_at}`,
    `---`,
    `The single line below is the exact source-surface line (trimmed) this claim`,
    `was registered against at as_of. If the live line drifts from it,`,
    `scripts/check-evidence-register.mjs goes red until the claim is re-reviewed`,
    `and re-validated with --revalidate=${claim.id}.`,
    `---`,
    extractedLine,
    '',
  ];
  return lines.join('\n');
}

/** Snapshot file path for one claim id (repo-relative, forward slashes). */
export function snapshotRel(id) {
  return `${SNAPSHOT_DIR_REL}/${id}.txt`;
}

/**
 * Build the register document from the src doc + page contents. Pure.
 * `getPage(rel)` returns file content or null. Returns
 * { register, snapshotWrites: [{ rel, text }], notices } — notices carry the
 * drift events the default write path preserved (never silent, never healed).
 */
export function buildRegister(srcDoc, getPage, { revalidate = new Set() } = {}) {
  const claims = srcDoc.claims ?? [];
  const byId = new Map();
  const snapshotWrites = [];
  const notices = [];
  for (const c of claims) {
    for (const f of REQUIRED_FIELDS) {
      if (c[f] === undefined || c[f] === null || c[f] === '') {
        throw new Error(`evidence/claims.src.json: claim ${c.id || '(no id)'} is missing required field ${f}`);
      }
    }
    if (byId.has(c.id)) throw new Error(`evidence/claims.src.json: duplicate claim id ${c.id}`);
    const pageText = getPage(c.source_path);
    if (pageText === null || pageText === undefined) {
      throw new Error(`evidence/claims.src.json: claim ${c.id} source_path ${c.source_path} does not exist in the repo`);
    }
    const extracted = extractClaimLine(pageText, c.anchor, c.occurrence ?? 1);
    const rel = snapshotRel(c.id);
    const want = snapshotTextFor(c, extracted.line);
    let keepBytes = want;
    const snapAbs = join(REPO, rel);
    const onDisk = existsSync(snapAbs) ? readFileSync(snapAbs, 'utf8') : null;
    if (onDisk !== null && onDisk !== want && !revalidate.has(c.id)) {
      // Point-in-time evidence stays as committed; the drift belongs to the
      // gate. Hash the on-disk bytes so the register never disagrees with the
      // file it points at — the drift surfaces as exactly ONE red class
      // (CLAIM_DRIFT in check-evidence-register.mjs), never two.
      notices.push({
        id: c.id,
        kind: 'SNAPSHOT_DRIFT_PRESERVED',
        message: `claim ${c.id}: source line drifted from its snapshot — snapshot preserved, register gate will red until --revalidate=${c.id} after re-review`,
      });
      keepBytes = onDisk;
    }
    if (onDisk === null || revalidate.has(c.id)) {
      snapshotWrites.push({ rel, text: want });
    }
    byId.set(c.id, {
      id: c.id,
      claim: c.claim,
      count_key: c.count_key,
      source_path: c.source_path,
      anchor: c.anchor,
      occurrence: c.occurrence ?? 1,
      scope: c.scope,
      as_of: c.as_of,
      review_by: c.review_by,
      registered_by: c.registered_by,
      registered_at: c.registered_at,
      snapshot: {
        path: rel,
        sha256: hashText(keepBytes),
      },
    });
  }
  const register = {
    _comment: 'GENERATED FILE — single writer: node scripts/gen-evidence-register.mjs, from the hand-authored evidence/claims.src.json. Do not hand-edit: any disagreement between this file, source/*.txt and the source surfaces is reddened by scripts/check-evidence-register.mjs.',
    generator: 'scripts/gen-evidence-register.mjs',
    source_of_truth: 'evidence/claims.src.json',
    claim_count: byId.size,
    claims: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return { register, snapshotWrites, notices };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
export function revalidateIdsFromArgv(argv) {
  return new Set(
    (argv.find((a) => a.startsWith('--revalidate=')) ?? '')
      .slice('--revalidate='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function writeIfChanged(rel, text) {
  const abs = join(REPO, rel);
  try {
    if (readFileSync(abs, 'utf8') === text) return false;
  } catch { /* missing -> write fresh */ }
  writeFileSync(abs, text);
  return true;
}

function main() {
  const srcAbs = join(REPO, SRC_REL);
  if (!existsSync(srcAbs)) {
    console.error(`gen-evidence-register: ${SRC_REL} not found — nothing to register.`);
    process.exit(1);
  }
  const srcDoc = JSON.parse(readFileSync(srcAbs, 'utf8'));
  const pageCache = new Map();
  const getPage = (rel) => {
    if (!pageCache.has(rel)) {
      try { pageCache.set(rel, readFileSync(join(REPO, rel), 'utf8')); } catch { pageCache.set(rel, null); }
    }
    return pageCache.get(rel);
  };

  let built;
  try {
    built = buildRegister(srcDoc, getPage, { revalidate: revalidateIdsFromArgv(process.argv) });
  } catch (e) {
    console.error(`gen-evidence-register: ${e.message}`);
    process.exit(1);
  }

  mkdirSync(join(REPO, SNAPSHOT_DIR_REL), { recursive: true });
  let written = 0;
  for (const w of built.snapshotWrites) {
    if (writeIfChanged(w.rel, w.text)) written++;
  }
  const registerText = JSON.stringify(built.register, null, 2) + '\n';
  const registerChanged = writeIfChanged(REGISTER_REL, registerText);

  for (const n of built.notices) console.log(`⚠ ${n.kind}: ${n.message}`);
  console.log(`gen-evidence-register: ${built.register.claims.length} claim(s) in ${REGISTER_REL}` +
    `${registerChanged ? ' (written)' : ' (unchanged)'}, ${written} snapshot(s) written` +
    `${built.snapshotWrites.length ? `, snapshot writes: ${built.snapshotWrites.map((w) => w.rel).join(', ')}` : ''}.`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
