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
// ── THE ONE EXCEPTION: SENTINEL-ONLY AUTO-REVALIDATION ──────────────────────
// (EVIDENCE-REGISTER-SENTINEL-AUTOREVAL-1) A count-sentinel number is not
// human copy — it is output of the estate's single count engine
// (scripts/counts.mjs), and re-reviewing a number the engine derives adds
// nothing. So for a claim whose `anchor` is `COUNT:<key>`, when the ONLY bytes
// that moved on its line are inside `<!--COUNT:...-->N<!--/COUNT-->` spans AND
// every new number equals the engine's own value for its key, the default
// write path re-snapshots the line itself and logs
//   SENTINEL_REVALIDATED <id> <old> -> <new>
// Both conditions are hard, and each failure keeps the behaviour this file
// already had (snapshot preserved, gate red until --revalidate after
// re-review):
//   1. MASKED BYTE-EQUALITY — snapshot line vs live line compared with every
//      sentinel numeric span masked (lines often carry a sibling sentinel,
//      e.g. "N of M": its number is engine-derived too). Any byte outside the
//      spans — wording, markup — changed -> NOT sentinel-only.
//   2. ENGINE AGREEMENT — the register never certifies a number the engine
//      did not derive: any span number without an exact engine match refuses
//      the revalidation (SENTINEL_REVAL_REFUSED), as does an engine that
//      cannot be derived at all (fail-safe: an empty engine agrees with
//      nothing).
// The CLI imports the counts engine lazily — only when a COUNT-anchored
// claim's snapshot actually differs from its live line — so on the clean path
// the regen still reads no node graph and stays cheap.
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
//   node scripts/gen-evidence-register.mjs                        # write (additive; sentinel-only drift self-revalidates, wording drift never rewrites an existing snapshot)
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

// ── SENTINEL-ONLY DRIFT CLASSIFICATION (EVIDENCE-REGISTER-SENTINEL-AUTOREVAL-1)
//
// The count-sentinel grammar is verify-counts.mjs's SENTINEL_RE — the key
// carries no hyphen, the numeric span is digits only. Declared here, not
// imported, because verify-counts.mjs is a top-level-await CLI, not a library;
// if the grammar ever moves, move both.
const COUNT_SPAN_RE = /<!--COUNT:([^-]+?)-->(\d+)<!--\/COUNT-->/g;
const COUNT_ANCHOR_RE = /^COUNT:([^-]+)$/;
const MASKED_SPAN = '\u0000';

/** The count key when a claim's anchor is a `COUNT:<key>` sentinel, else null. */
export function countKeyFromAnchor(anchor) {
  if (typeof anchor !== 'string') return null;
  const m = anchor.match(COUNT_ANCHOR_RE);
  return m ? m[1] : null;
}

/**
 * Mask every COUNT sentinel's numeric span on a line. Pure. Returns
 * { masked, values }: `masked` replaces each span's digits with a constant
 * digit-free marker so two lines compare byte-equal exactly when nothing
 * outside the spans moved; `values` lists { key, value } in order of
 * appearance, so the caller can check every written number against the engine.
 */
export function maskCountSentinels(line) {
  const values = [];
  const masked = line.replace(COUNT_SPAN_RE, (_m, key, num) => {
    values.push({ key, value: Number(num) });
    return `<!--COUNT:${key}-->${MASKED_SPAN}<!--/COUNT-->`;
  });
  return { masked, values };
}

/**
 * Classify a drifted live line against the line its snapshot recorded. Pure.
 * `engineCounts` maps count key -> derived number (Map or plain object).
 * Returns:
 *   { sentinelOnly: true, oldValue, newValue }   — masked texts byte-equal AND
 *         every sentinel number on the live line equals the engine's value;
 *         oldValue/newValue are the lines' span numbers joined with "/".
 *   { sentinelOnly: false, engineMismatch: null } — wording/markup outside the
 *         spans changed (never auto-revalidatable).
 *   { sentinelOnly: false, engineMismatch: { key, page, engine } } — masked
 *         byte-equal but the first unconfirmed span: the page says `page`
 *         while the engine derives `engine` (null = engine has/derives no
 *         value for that key).
 */
export function classifySentinelDrift(oldLine, newLine, engineCounts) {
  const oldMasked = maskCountSentinels(oldLine);
  const newMasked = maskCountSentinels(newLine);
  if (oldMasked.masked !== newMasked.masked) {
    return { sentinelOnly: false, engineMismatch: null };
  }
  const engineValue = (key) => (engineCounts instanceof Map)
    ? engineCounts.get(key)
    : (engineCounts ? engineCounts[key] : undefined);
  for (const { key, value } of newMasked.values) {
    const engine = engineValue(key);
    if (engine === undefined || engine === null || Number(engine) !== value) {
      return { sentinelOnly: false, engineMismatch: { key, page: value, engine: engine ?? null } };
    }
  }
  return {
    sentinelOnly: true,
    oldValue: oldMasked.values.map((v) => v.value).join('/'),
    newValue: newMasked.values.map((v) => v.value).join('/'),
  };
}

/** The source line a snapshot recorded — its last non-empty line (the writer's layout). */
function snapshotExtractedLine(snapText) {
  const lines = snapText.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] !== '') return lines[i];
  }
  return '';
}

/**
 * Build the register document from the src doc + page contents. Pure.
 * `getPage(rel)` returns file content or null. `engineCounts` (optional; Map
 * or plain object keyed by count key) enables sentinel-only auto-revalidation
 * — absent/empty, a sentinel drift can never be certified, which is the
 * fail-safe. `readSnapshot(rel)` (optional) overrides where existing snapshot
 * bytes come from — default reads the repo's snapshot files, so the paired
 * self-test can drive the drift branches fully in memory. Returns
 * { register, snapshotWrites: [{ rel, text }], notices } — notices carry the
 * drift events (preserved, refused, or auto-revalidated).
 */
export function buildRegister(srcDoc, getPage, { revalidate = new Set(), engineCounts = new Map(), readSnapshot = null } = {}) {
  const readSnap = readSnapshot ?? ((rel) => (existsSync(join(REPO, rel)) ? readFileSync(join(REPO, rel), 'utf8') : null));
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
    const onDisk = readSnap(rel);
    let sentinelRevalidated = null;
    if (onDisk !== null && onDisk !== want && !revalidate.has(c.id)
        && countKeyFromAnchor(c.anchor) !== null) {
      const verdict = classifySentinelDrift(snapshotExtractedLine(onDisk), extracted.line, engineCounts);
      if (verdict.sentinelOnly) {
        // The only bytes that moved are engine-derived numbers the engine
        // confirms — self-certifying: the default write path re-snapshots.
        sentinelRevalidated = { oldValue: verdict.oldValue, newValue: verdict.newValue };
        notices.push({
          id: c.id,
          kind: 'SENTINEL_REVALIDATED',
          oldValue: verdict.oldValue,
          newValue: verdict.newValue,
          message: `claim ${c.id}: sentinel-only drift on ${c.source_path} (${verdict.oldValue} -> ${verdict.newValue}) — the counts engine derives the new value, so the snapshot is re-validated without human re-review`,
        });
      } else if (verdict.engineMismatch) {
        notices.push({
          id: c.id,
          kind: 'SENTINEL_REVAL_REFUSED',
          message: `claim ${c.id}: sentinel drift on ${c.source_path} refused — the page says ${verdict.engineMismatch.page} but the counts engine derives ${verdict.engineMismatch.engine} for ${verdict.engineMismatch.key}; the register never certifies a number the engine did not derive (snapshot preserved, gate red)`,
        });
      }
    }
    if (onDisk !== null && onDisk !== want && !revalidate.has(c.id) && !sentinelRevalidated) {
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
    if (onDisk === null || revalidate.has(c.id) || sentinelRevalidated) {
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

async function main() {
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

  // EVIDENCE-REGISTER-SENTINEL-AUTOREVAL-1: import the counts engine lazily
  // and ONLY when a COUNT-anchored claim's snapshot actually differs from its
  // live line — deriveCounts() walks the node graph and kernels, and the clean
  // regen path must stay cheap and node-graph-free. If the engine cannot be
  // derived, auto-revalidation is refused (an empty engine agrees with
  // nothing), which lands on the same preserved-drift red this file has
  // always produced.
  let engineCounts = new Map();
  const maySelfRevalidate = (srcDoc.claims ?? []).some((c) => {
    if (!c || countKeyFromAnchor(c.anchor) === null) return false;
    const pageText = getPage(c.source_path);
    if (pageText === null || pageText === undefined) return false;
    try {
      const snapAbs = join(REPO, snapshotRel(c.id));
      const onDisk = existsSync(snapAbs) ? readFileSync(snapAbs, 'utf8') : null;
      return onDisk !== null && onDisk !== snapshotTextFor(c, extractClaimLine(pageText, c.anchor, c.occurrence ?? 1).line);
    } catch { return false; }
  });
  if (maySelfRevalidate) {
    try {
      const counts = await import('./counts.mjs').then((m) => m.deriveCounts());
      engineCounts = new Map(Object.entries(counts).filter(([, v]) => typeof v === 'number'));
    } catch { engineCounts = new Map(); }
  }

  let built;
  try {
    built = buildRegister(srcDoc, getPage, { revalidate: revalidateIdsFromArgv(process.argv), engineCounts });
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

  for (const n of built.notices) {
    if (n.kind === 'SENTINEL_REVALIDATED') {
      console.log(`SENTINEL_REVALIDATED ${n.id} ${n.oldValue} -> ${n.newValue}`);
    } else {
      console.log(`⚠ ${n.kind}: ${n.message}`);
    }
  }
  console.log(`gen-evidence-register: ${built.register.claims.length} claim(s) in ${REGISTER_REL}` +
    `${registerChanged ? ' (written)' : ' (unchanged)'}, ${written} snapshot(s) written` +
    `${built.snapshotWrites.length ? `, snapshot writes: ${built.snapshotWrites.map((w) => w.rel).join(', ')}` : ''}.`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main().catch((e) => { console.error(`gen-evidence-register: ${e.message}`); process.exit(1); });
