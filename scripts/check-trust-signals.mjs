#!/usr/bin/env node
// check-trust-signals.mjs — TRUST-SIGNALS-WELLKNOWN-1's consumer-side gate.
//
// Validates the PUBLISHED digest .well-known/trust-signals.json against its
// schema (.well-known/trust-signals.schema.json) and asserts the commit anchor:
// on main, `commit` must equal HEAD — or HEAD^ when HEAD is the mechanical
// chore(derived) regen-bot commit (the one state where HEAD is a commit whose
// only contents are regenerated derived bytes; the digest's facts describe the
// merge commit the bot regenerated at). The anchor rule itself lives ONCE, in
// gen-trust-signals.mjs's pickFactCommit(); this gate imports it — a second
// implementation of the same rule is exactly the drift this project keeps
// getting burned by.
//
// ── CONTEXT SPLIT (the house derived-artifact shape) ─────────────────────────
//   • Schema/content validation: HARD in every context. A PR ships the initial
//     digest and can always satisfy this leg.
//   • Commit-anchor freshness: HARD on main, ADVISORY on a PR. The digest is a
//     shared derived artifact with a single writer (derived-artifacts-regen.yml,
//     SO #35) — a PR is forbidden to regenerate it, so an inherited file carries
//     the PREVIOUS main commit and cannot satisfy a HEAD assertion. A gate a
//     branch is forbidden to satisfy must not block that branch. It still RUNS
//     and prints its finding in full (nothing is ever skipped or silenced).
//
// Wired into scripts/preflight.mjs as a blocking GATES entry. The sibling
// freshness gate `node scripts/gen-trust-signals.mjs --check` is the COVERED
// gate (advisory on a PR via the generic downgrade, blocking on main).
//
// ── WHY A LOCAL VALIDATOR ────────────────────────────────────────────────────
// check-agent-feedback-descriptor.mjs ships a zero-dependency subset validator,
// but its subset stops at strings (no number/integer/boolean/array/minimum) —
// this schema's signals are counts. That file's validator is descriptor-scoped
// (maxLength/examples semantics) and extending it would widen a shipped gate's
// contract; a compact keyword-subset validator scoped to THIS schema's keywords
// is the smaller blast radius. It validates exactly: const, type (object,
// string, number, integer, boolean, array), required, properties, items,
// minimum, pattern, minLength. Keywords outside the subset (descriptions, $id,
// $schema, examples) are documentation and ignored.
//
// Usage:
//   node scripts/check-trust-signals.mjs           # gate (preflight, blocking)
// Self-test: scripts/check-trust-signals.test.mjs (node --test; RED/GREEN
// mutations per GATE-SELFTEST-META-1 — a new blocking gate must prove it can
// go red, not just that it currently reads green).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gitEnv } from './_git-env-lib.mjs';
import { isMainContext } from './derived-artifacts.mjs';
import { pickFactCommit } from './gen-trust-signals.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DOC_PATH = resolve(REPO, '.well-known', 'trust-signals.json');
const SCHEMA_PATH = resolve(REPO, '.well-known', 'trust-signals.schema.json');

// ── zero-dependency keyword-subset validator ─────────────────────────────────
/** Validate `inst` against schema node `schema`; returns findings (empty = valid).
 *  Exported for the self-test. Never throws on instance shape — every mismatch
 *  is a finding naming the path. */
export function validateTrustSignals(inst, schema, at = '$') {
  const f = [];
  if (schema == null || typeof schema !== 'object') return f;

  if (schema.const !== undefined && JSON.stringify(inst) !== JSON.stringify(schema.const)) {
    f.push(`${at}: const violation — expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(inst)}`);
    return f; // a const miss is total; deeper checks would only add noise
  }
  const t = schema.type;
  if (t === 'object') {
    if (typeof inst !== 'object' || inst === null || Array.isArray(inst)) {
      f.push(`${at}: expected object, got ${inst === null ? 'null' : Array.isArray(inst) ? 'array' : typeof inst}`);
      return f;
    }
    for (const key of schema.required || []) {
      if (!(key in inst)) f.push(`${at}: required member missing: ${key}`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in inst) f.push(...validateTrustSignals(inst[key], sub, `${at}.${key}`));
    }
    return f;
  }
  if (t === 'array') {
    if (!Array.isArray(inst)) { f.push(`${at}: expected array, got typeof ${typeof inst}`); return f; }
    if (schema.items) inst.forEach((v, i) => f.push(...validateTrustSignals(v, schema.items, `${at}[${i}]`)));
    return f;
  }
  if (t === 'string') {
    if (typeof inst !== 'string') { f.push(`${at}: expected string, got ${typeof inst}`); return f; }
    if (schema.pattern && !new RegExp(schema.pattern).test(inst)) {
      f.push(`${at}: ${JSON.stringify(inst.length > 80 ? inst.slice(0, 77) + '...' : inst)} fails pattern ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && inst.length < schema.minLength) {
      f.push(`${at}: length ${inst.length} below minLength ${schema.minLength}`);
    }
    return f;
  }
  if (t === 'integer') {
    if (!Number.isInteger(inst)) { f.push(`${at}: expected integer, got ${JSON.stringify(inst)}`); return f; }
    if (schema.minimum !== undefined && inst < schema.minimum) f.push(`${at}: ${inst} below minimum ${schema.minimum}`);
    return f;
  }
  if (t === 'number') {
    if (typeof inst !== 'number' || !Number.isFinite(inst)) { f.push(`${at}: expected finite number, got ${JSON.stringify(inst)}`); return f; }
    if (schema.minimum !== undefined && inst < schema.minimum) f.push(`${at}: ${inst} below minimum ${schema.minimum}`);
    return f;
  }
  if (t === 'boolean') {
    if (typeof inst !== 'boolean') f.push(`${at}: expected boolean, got ${typeof inst}`);
    return f;
  }
  return f;
}

// ── the context split, as a pure decision (the self-test drives this) ────────
/** Pure: decide the commit-anchor leg. Returns { ok, advisory } —
 *   ok=true                       → leg green (or warning-free).
 *   ok=false, advisory=true       → print + ::warning, exit 0 (PR: single-writer).
 *   ok=false, advisory=false      → exit 1 (main: the anchor must be current). */
export function decideCommitLeg({ fileCommit, expectedCommit, mainContext }) {
  if (fileCommit === expectedCommit) return { ok: true, advisory: false };
  return { ok: false, advisory: mainContext === false };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  let doc, schema;
  try { doc = JSON.parse(readFileSync(DOC_PATH, 'utf8')); }
  catch (e) { console.error(`✗ check-trust-signals: cannot read ${DOC_PATH} (${e.message}) — the digest is a declared derived artifact and must exist.`); process.exit(1); }
  try { schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')); }
  catch (e) { console.error(`✗ check-trust-signals: cannot read schema ${SCHEMA_PATH} (${e.message})`); process.exit(1); }

  const findings = validateTrustSignals(doc, schema);
  if (findings.length) {
    console.error(`✗ check-trust-signals: ${findings.length} schema violation(s) in .well-known/trust-signals.json:`);
    for (const x of findings) console.error(`  • ${x}`);
    console.error('  Regenerate main-side: node scripts/gen-trust-signals.mjs (single writer, SO #35).');
    process.exit(1);
  }

  // Commit-anchor leg. Same rule, one implementation (pickFactCommit).
  const expected = pickFactCommit(execFileSync('git', ['log', '-n', '50', '--format=%H%x01%cI%x01%s'], {
    cwd: REPO, env: gitEnv(), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  }));
  const MAIN_CONTEXT = isMainContext();
  const leg = decideCommitLeg({ fileCommit: doc.commit, expectedCommit: expected.commit, mainContext: MAIN_CONTEXT });
  if (!leg.ok && leg.advisory) {
    console.error(`::warning title=Advisory: trust-signals digest commit anchor::The digest is anchored at ${doc.commit.slice(0, 12)}; this branch's fact-commit is ${expected.commit.slice(0, 12)}. The digest is single-writer on main (SO #35) — a PR cannot regenerate it, so this stays advisory here and HARD on main. Full finding printed; nothing skipped.`);
    console.log(`⚠ commit anchor advisory (PR): digest @ ${doc.commit.slice(0, 12)}, fact-commit ${expected.commit.slice(0, 12)}.`);
    console.log('✓ check-trust-signals: schema clean (hard leg); commit anchor advisory on PR.');
    process.exit(0);
  }
  if (!leg.ok) {
    console.error(`✗ check-trust-signals: commit anchor STALE on main — digest anchored at ${doc.commit.slice(0, 12)}, current fact-commit is ${expected.commit.slice(0, 12)} (HEAD, or HEAD^ when HEAD is the chore(derived) bot commit).`);
    console.error('  derived-artifacts-regen.yml owns the rewrite; if main has been red longer than one bot cycle, investigate the regen run.');
    process.exit(1);
  }
  console.log(`✓ check-trust-signals: schema clean, commit anchor current (${doc.commit.slice(0, 12)})${MAIN_CONTEXT ? ', main context' : ''}.`);
}
