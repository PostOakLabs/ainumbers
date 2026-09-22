#!/usr/bin/env node
// scripts/check-evidence-register.mjs — EVREG-1: the claim-level evidence
// register gate. The COVERED freshness gate of derived-artifacts.mjs id
// 'evidence-register' (advisory on a PR, blocking on main via the generic
// downgrade) AND the register's policy gate. Paired mutation self-test
// (GATE-SELFTEST-META-1): scripts/check-evidence-register.test.mjs, itself a
// live GATES entry.
//
// Verdict classes, all named:
//   SRC_FIELD_MISSING        a src claim lacks a required field
//   SRC_DUP_ID               duplicate claim id in evidence/claims.src.json
//   SRC_PAGE_MISSING         a src claim's source_path is not on disk
//   SRC_AS_OF_FUTURE         as_of is after today (measured, not prophesied)
//   SRC_REVIEW_ORDER_INVALID review_by is not strictly after as_of
//   OVERDUE_UNPINNED         review_by is past AND the claim is not pinned in
//                            the ratchet baseline — NEW review debt, hard red
//   BASELINE_COUNT_MISMATCH  baseline overdue count disagrees with its own list
//   REGISTER_MISSING         evidence/claims.json absent — run the generator
//   REGISTER_STALE           the register disagrees with the src (id set or
//                            per-claim fields/hash) — run the generator
//   SNAPSHOT_MISSING         source/<id>.txt absent — run the generator
//   SNAPSHOT_TAMPERED        snapshot bytes no longer hash to the registered
//                            sha256 — hand-edited evidence
//   CLAIM_DRIFT              the live source line no longer matches the
//                            snapshot — the claim changed without re-review;
//                            heal ONLY via --revalidate=<id> after re-review
//
// ── THE REVIEW RATCHET (reviews-only-forward) ───────────────────────────────
// review_by is a commitment. A claim that goes past due reds this gate unless
// it is PINNED in scripts/evidence-register-baseline.json — the deliberate,
// reviewed record of the claims that were already overdue at pin time. A pin
// is never implicit: new overdue claims are always hard red until a human runs
//   node scripts/check-evidence-register.mjs --update-baseline
// and commits the baseline. Reviews only move forward: the overdue set may
// shrink freely (a review happened — the gate WARNs to prune the stale pin);
// growing it requires the named, committed re-pin. The baseline loads through
// ratchet-baseline.mjs (RATCHET-BASELINE-LOADER-1) so a deleted or corrupt
// baseline is a hard RED, never a silent pass.
//
// The drift verdict reads BOTH sides through the generator's OWN extraction
// (imported, never re-implemented), so the writer and the gate cannot desync.
//
// Usage:
//   node scripts/check-evidence-register.mjs                    # verdict (exit 1 on any finding)
//   node scripts/check-evidence-register.mjs --update-baseline  # deliberate re-pin of the overdue set (then COMMIT the baseline)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRatchetBaselineOrExit, readBaselineForUpdate } from './ratchet-baseline.mjs';
import {
  REPO, SRC_REL, REGISTER_REL, REQUIRED_FIELDS,
  extractClaimLine, hashText, snapshotRel,
} from './gen-evidence-register.mjs';

const BASELINE_REL = 'scripts/evidence-register-baseline.json';
const BASELINE_ABS = join(REPO, BASELINE_REL);
const REPIN_COMMAND = 'node scripts/check-evidence-register.mjs --update-baseline';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pure verdict core. Every input is plain data so the self-test drives every
 * class in memory. `pages` maps source_path -> content | null (null/absent =
 * missing surface); `snapshots` maps claim id -> content | null.
 */
export function evaluateRegister({ srcDoc, register, pages, snapshots, today, baseline }) {
  const findings = [];
  const add = (kind, id, message) => findings.push({ kind, id: id ?? null, message });

  const srcClaims = (srcDoc && Array.isArray(srcDoc.claims)) ? srcDoc.claims : [];
  const seen = new Set();
  const overdueNow = [];
  for (const c of srcClaims) {
    const cid = c && c.id;
    for (const f of REQUIRED_FIELDS) {
      if (!c || c[f] === undefined || c[f] === null || c[f] === '') {
        add('SRC_FIELD_MISSING', cid, `evidence/claims.src.json: claim ${cid || '(no id)'} is missing required field ${f}`);
      }
    }
    if (!cid) continue;
    if (seen.has(cid)) add('SRC_DUP_ID', cid, `evidence/claims.src.json: duplicate claim id ${cid}`);
    seen.add(cid);

    if (c.source_path && (pages.get(c.source_path) ?? null) === null) {
      add('SRC_PAGE_MISSING', cid, `claim ${cid}: source_path ${c.source_path} does not exist in the repo`);
    }
    if (c.as_of && c.as_of > today) {
      add('SRC_AS_OF_FUTURE', cid, `claim ${cid}: as_of ${c.as_of} is after today (${today}) — a claim cannot be measured in the future`);
    }
    if (c.as_of && c.review_by && c.review_by <= c.as_of) {
      add('SRC_REVIEW_ORDER_INVALID', cid, `claim ${cid}: review_by ${c.review_by} is not after as_of ${c.as_of} — reviews only move forward`);
    }
    if (c.review_by && c.review_by < today) overdueNow.push(cid);
  }

  const pinned = new Set(baseline.overdue_ids ?? []);
  if (typeof baseline.overdue === 'number' && Array.isArray(baseline.overdue_ids)
      && baseline.overdue !== baseline.overdue_ids.length) {
    add('BASELINE_COUNT_MISMATCH', null, `${BASELINE_REL}: overdue=${baseline.overdue} but overdue_ids has ${baseline.overdue_ids.length} entr(y/ies) — re-pin with ${REPIN_COMMAND}`);
  }
  for (const cid of overdueNow) {
    if (!pinned.has(cid)) {
      add('OVERDUE_UNPINNED', cid, `claim ${cid}: review_by passed and is NOT pinned in ${BASELINE_REL} — review the claim, move review_by forward in evidence/claims.src.json, or (deliberate, reviewed) re-pin with ${REPIN_COMMAND}`);
    }
  }
  const prunable = [...pinned].filter((cid) => !overdueNow.includes(cid));
  if (prunable.length) {
    console.warn(`check-evidence-register: ${prunable.length} baseline pin(s) no longer overdue (review happened — prune with ${REPIN_COMMAND}): ${prunable.join(', ')}`);
  }

  // Register/snapshot legs.
  if (!register) {
    if (srcClaims.length) add('REGISTER_MISSING', null, `${REGISTER_REL} not found — run: node scripts/gen-evidence-register.mjs`);
    return { findings, overdueNow, prunable };
  }
  const regById = new Map((register.claims ?? []).map((r) => [r.id, r]));
  const srcIds = srcClaims.filter((c) => c && c.id).map((c) => c.id).sort();
  const regIds = [...regById.keys()].sort();
  if (JSON.stringify(srcIds) !== JSON.stringify(regIds)) {
    add('REGISTER_STALE', null, `${REGISTER_REL} id set disagrees with evidence/claims.src.json — run: node scripts/gen-evidence-register.mjs`);
  }
  for (const c of srcClaims) {
    if (!c || !c.id) continue;
    const r = regById.get(c.id);
    if (!r) continue;
    // The register normalizes occurrence to 1 when src omits it; compare the
    // SAME normalization on both sides, everything else verbatim.
    const normalize = (f) => (f === 'occurrence' ? (c[f] ?? 1) : c[f]);
    const compared = [...REQUIRED_FIELDS, 'occurrence'];
    for (const f of compared) {
      if (r[f] !== normalize(f)) {
        add('REGISTER_STALE', c.id, `claim ${c.id}: register field ${f} disagrees with evidence/claims.src.json — run: node scripts/gen-evidence-register.mjs`);
        break;
      }
    }
    const snapRel = snapshotRel(c.id);
    const snapText = snapshots.get(c.id) ?? null;
    if (snapText === null) {
      add('SNAPSHOT_MISSING', c.id, `${snapRel} not found — run: node scripts/gen-evidence-register.mjs`);
      continue;
    }
    if (r.snapshot && r.snapshot.sha256 !== hashText(snapText)) {
      add('SNAPSHOT_TAMPERED', c.id, `${snapRel} no longer hashes to the registered sha256 — snapshots are evidence; restore the bytes or re-review, then --revalidate=${c.id}`);
      continue;
    }
    if (!c.anchor) continue;
    const pageText = pages.get(c.source_path) ?? null;
    if (pageText === null) continue; // SRC_PAGE_MISSING already reported
    let extractedLine = null;
    let anchorGone = false;
    try { extractedLine = extractClaimLine(pageText, c.anchor, c.occurrence ?? 1).line; }
    catch { anchorGone = true; }
    const snapLines = snapText.split(/\r?\n/);
    if (extractedLine !== null) {
      if (!snapLines.some((l) => l === extractedLine)) {
        add('CLAIM_DRIFT', c.id, `claim ${c.id}: ${c.source_path} no longer matches its snapshot — the public claim changed without re-review. Re-review, update evidence/claims.src.json, then: node scripts/gen-evidence-register.mjs --revalidate=${c.id}`);
      }
    } else if (anchorGone && snapLines.some((l) => l.includes(c.anchor))) {
      add('CLAIM_DRIFT', c.id, `claim ${c.id}: anchor ${JSON.stringify(c.anchor)} no longer appears on ${c.source_path} — the source line moved or was removed. Re-review, then: node scripts/gen-evidence-register.mjs --revalidate=${c.id}`);
    }
  }

  return { findings, overdueNow, prunable };
}

function loadInputsForEvaluate() {
  const pages = new Map();
  const snapshots = new Map();
  let srcDoc = null;
  try { srcDoc = JSON.parse(readFileSync(join(REPO, SRC_REL), 'utf8')); } catch { srcDoc = null; }
  let register = null;
  try { register = JSON.parse(readFileSync(join(REPO, REGISTER_REL), 'utf8')); } catch { register = null; }
  const srcClaims = srcDoc && Array.isArray(srcDoc.claims) ? srcDoc.claims : [];
  for (const c of srcClaims) {
    if (!c || !c.id) continue;
    try { pages.set(c.source_path, readFileSync(join(REPO, c.source_path), 'utf8')); } catch { pages.set(c.source_path, null); }
    try { snapshots.set(c.id, readFileSync(join(REPO, snapshotRel(c.id)), 'utf8')); } catch { snapshots.set(c.id, null); }
  }
  return { srcDoc, register, pages, snapshots };
}

function updateBaseline({ srcDoc }) {
  if (!srcDoc) { console.error(`✗ ${SRC_REL} missing/unparseable — nothing to pin against`); process.exit(1); }
  const { overdueNow } = evaluateRegister({
    srcDoc, register: null,
    pages: new Map(), snapshots: new Map(),
    today: todayIso(),
    baseline: { overdue: 0, overdue_ids: [] },
  });
  const prior = readBaselineForUpdate(BASELINE_ABS, ['overdue', { key: 'overdue_ids', type: 'name-list' }], {
    label: 'evidence-register review ratchet',
    path: BASELINE_REL,
    repinCommand: REPIN_COMMAND,
  });
  const priorSet = new Set(prior ? prior.overdue_ids : []);
  const added = overdueNow.filter((id) => !priorSet.has(id));
  const removed = [...priorSet].filter((id) => !overdueNow.includes(id));
  const doc = {
    _comment: 'RATCHET BASELINE (reviews-only-forward) — claims already past review_by at pin time (EVREG-1). New overdue claims are RED until a deliberate, reviewed re-pin; pins only shrink without one. Loaded through ratchet-baseline.mjs, so deleting this file is a hard red, never a silent pass.',
    overdue: overdueNow.length,
    overdue_ids: overdueNow,
  };
  writeFileSync(BASELINE_ABS, JSON.stringify(doc, null, 2) + '\n');
  console.log(`evidence-register baseline re-pinned: ${overdueNow.length} overdue claim(s).` +
    (added.length ? ` added: ${added.join(', ')}.` : '') +
    (removed.length ? ` removed: ${removed.join(', ')}.` : ''));
  console.log('⛔ COMMIT the baseline with this change — an uncommitted re-pin protects nothing.');
}

function main() {
  if (process.argv.includes('--update-baseline')) {
    updateBaseline(loadInputsForEvaluate());
    return;
  }

  const baseline = loadRatchetBaselineOrExit(BASELINE_ABS, ['overdue', { key: 'overdue_ids', type: 'name-list' }], {
    label: 'evidence-register review ratchet',
    path: BASELINE_REL,
    repinCommand: REPIN_COMMAND,
  });
  const { srcDoc, register, pages, snapshots } = loadInputsForEvaluate();
  if (!srcDoc) {
    console.error(`✗ evidence register: ${SRC_REL} missing or unparseable.`);
    process.exit(1);
  }
  const { findings } = evaluateRegister({
    srcDoc, register, pages, snapshots, today: todayIso(), baseline,
  });

  if (findings.length) {
    console.error(`✗ evidence register: ${findings.length} finding(s):`);
    for (const f of findings) console.error(`  [${f.kind}] ${f.message}`);
    console.error('Writer: node scripts/gen-evidence-register.mjs (additive; snapshots are point-in-time evidence and are never rewritten by default).');
    process.exit(1);
  }
  const n = srcDoc.claims.length;
  console.log(`check-evidence-register: OK — ${n} claim(s) bound, snapshots verified, review ratchet green (${BASELINE_REL}: ${baseline.overdue} pinned).`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
