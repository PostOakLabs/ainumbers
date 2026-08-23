#!/usr/bin/env node
// ratchet-baseline.mjs — the shared, HARD-FAILING loader for every pinned ratchet baseline
// (RATCHET-BASELINE-LOADER-1; gate-integrity audit finding F-11, top-risk).
//
// ⛔⛔ THE DEFECT THIS EXISTS TO KILL — "the deletable baseline".
// A ratchet gate compares a live count against a ceiling pinned in a JSON file. Three of them used to
// read that ceiling like this:
//
//     const ceiling = baseline?.deferred ?? Infinity;          // ⛔ DELETED KEY  ⇒ ceiling = Infinity
//     if (existsSync(BASELINE_PATH)) { …ratchet… }
//     else console.error('⚠ no baseline — run --update-baseline (not blocking).');   // ⛔ DELETED FILE ⇒ no ratchet at all
//
// ⇒ ONE `git rm` of a baseline file silently disabled TWO controls (the ceiling AND the provenance
// discriminator that reads the same file's node lists), and the gate STILL PRINTED ITS GREEN LINE and
// STILL EXITED 0. The control did not fail. ⭐ It stopped existing, and its output still read green.
// That is strictly worse than a red gate: a red gate is seen.
//
// ⚖ THIS IS SO #34c AT THE BASELINE BOUNDARY — "absence is not a pass". A missing gate result is a
// DISTINCT state, never a green one. A ratchet with no ceiling is not a satisfied ratchet; it is a
// switched-off ratchet, and the only honest exit code for that is 1.
//
// ✅ THE FOUR HARD-FAIL STATES (each names itself in the message, so a CI log says WHICH one happened):
//   MISSING-FILE   the baseline file is not on disk at all
//   INVALID-JSON   the file exists but does not parse, or parses to something that is not a JSON object
//   MISSING-KEY    a required key (the ceiling, or a provenance node list) is absent
//   NAN-KEY        a required count key is present but is not a finite number — NaN, a string, null, a
//                  boolean, or ±Infinity. ⚠ `Infinity` is caught DELIBERATELY and is not pedantry:
//                  `JSON.parse('{"deferred":1e999}')` yields `Infinity`, which is the exact ceiling the
//                  old `?? Infinity` default produced. A baseline may not smuggle that value back in.
//   BAD-LIST-KEY   a required provenance list key is present but is not an array of strings. Same class
//                  as NAN-KEY, one type down: `baseline.deferred_nodes ?? []` degrades a corrupt list to
//                  "nothing was known before", which turns every proof REGRESSION into a legitimate-looking
//                  brand-new node. The list keys are load-bearing, so they are validated, not defaulted.
//
// ⚖ SCOPE — ⛔ this module is for RATCHET BASELINES ONLY. It is not a general "config file must exist"
// helper, and a non-baseline `existsSync` elsewhere in scripts/ is none of its business. The test for
// whether a file belongs here: does a gate read a CEILING or a PROVENANCE SNAPSHOT out of it, such that
// deleting the file would make the gate pass everything? If yes, load it through here.
//
// ⚖ THE ONE LEGITIMATE ABSENT-BASELINE PATH, named explicitly so nobody later "fixes" it back into a
// hole: `--update-baseline` on a first-ever pin. That mode is the file's WRITER — it is the act that
// CREATES the baseline, and it never derives a ceiling from what it read. Use `readBaselineForUpdate()`
// there: absent ⇒ null (first pin, legal); present-but-broken ⇒ the same four hard failures, because a
// corrupt existing baseline must never be silently overwritten as if it had been a clean first pin.
//
// Zero-dependency. Self-test (SO #40(b), RED before GREEN): scripts/ratchet-baseline.test.mjs.

import { readFileSync, existsSync } from 'node:fs';

// ── RatchetBaselineError ─────────────────────────────────────────────────────────────────────────
// Carries the machine-readable `state` alongside the human message, so the self-test asserts on the
// STATE (a stable contract) rather than on message wording (which is prose and may be improved).
export class RatchetBaselineError extends Error {
  constructor(state, message) {
    super(message);
    this.name = 'RatchetBaselineError';
    this.state = state;
  }
}

export const RATCHET_BASELINE_STATES = Object.freeze([
  'MISSING-FILE',
  'INVALID-JSON',
  'MISSING-KEY',
  'NAN-KEY',
  'BAD-LIST-KEY',
]);

// ── normalizeRequiredKeys ────────────────────────────────────────────────────────────────────────
// `requiredKeys` accepts either form, mixed freely:
//   'deferred'                                  → shorthand for { key: 'deferred', type: 'count' }
//   { key: 'deferred_nodes', type: 'name-list' }
// 'count'     → must be a finite number (the ratchet ceiling itself).
// 'name-list' → must be an array of strings (a provenance snapshot the discriminators read).
function normalizeRequiredKeys(requiredKeys) {
  if (!Array.isArray(requiredKeys) || requiredKeys.length === 0) {
    throw new TypeError('loadRatchetBaseline: requiredKeys must be a non-empty array — a baseline with nothing required of it is not a ratchet');
  }
  return requiredKeys.map((spec) => {
    if (typeof spec === 'string') return { key: spec, type: 'count' };
    if (spec && typeof spec.key === 'string') {
      const type = spec.type ?? 'count';
      if (type !== 'count' && type !== 'name-list') {
        throw new TypeError(`loadRatchetBaseline: unknown required-key type ${JSON.stringify(type)} for ${JSON.stringify(spec.key)} — expected 'count' or 'name-list'`);
      }
      return { key: spec.key, type };
    }
    throw new TypeError(`loadRatchetBaseline: bad requiredKeys entry ${JSON.stringify(spec)} — expected a string or { key, type }`);
  });
}

// The common tail on every hard-fail message: what this state means and how to get out of it.
function remedy({ label, path, repinCommand }) {
  return [
    `  A ratchet baseline is a CONTROL, not a convenience: without a valid ceiling this gate has nothing to`,
    `  compare against, and passing anyway would be a silently-disabled control (SO #34c — absence is not a pass).`,
    `  These gates used to default the ceiling to Infinity here, so a deleted or corrupt baseline switched the`,
    `  ratchet off while the gate still printed green (RATCHET-BASELINE-LOADER-1, gate-integrity finding F-11).`,
    `  Fix, in order of likelihood:`,
    `    1. The file was deleted or damaged by accident — restore it:  git checkout origin/main -- ${path}`,
    `    2. This is a deliberate, reviewed re-pin — regenerate it:      ${repinCommand}`,
    `  ⛔ Do NOT "fix" this by making ${label} tolerate a missing baseline again.`,
  ].join('\n');
}

// ── validateRatchetBaseline ──────────────────────────────────────────────────────────────────────
// Pure: takes the file TEXT (or null for "not on disk") and returns the validated baseline object, or
// throws RatchetBaselineError. Split out from the disk read so the self-test can drive every one of the
// five states in memory as well as through the real filesystem, and so a caller that already holds the
// text never has to re-read it.
export function validateRatchetBaseline(text, requiredKeys, { label, path, repinCommand }) {
  const specs = normalizeRequiredKeys(requiredKeys);
  const tail = remedy({ label, path, repinCommand });

  if (text === null || text === undefined) {
    throw new RatchetBaselineError('MISSING-FILE',
      `✗ RATCHET BASELINE MISSING-FILE — ${label}: no baseline file at ${path}.\n${tail}`);
  }

  let baseline;
  try {
    baseline = JSON.parse(text);
  } catch (e) {
    throw new RatchetBaselineError('INVALID-JSON',
      `✗ RATCHET BASELINE INVALID-JSON — ${label}: ${path} is not parseable JSON (${e.message}).\n${tail}`);
  }
  // A baseline that parsed to an array, a string, a number or null is syntactically valid JSON and still
  // not a baseline document — every key lookup below would read undefined and every check would "pass".
  if (baseline === null || typeof baseline !== 'object' || Array.isArray(baseline)) {
    throw new RatchetBaselineError('INVALID-JSON',
      `✗ RATCHET BASELINE INVALID-JSON — ${label}: ${path} parsed, but to ${baseline === null ? 'null' : Array.isArray(baseline) ? 'an array' : `a ${typeof baseline}`}, not a JSON object. A baseline must be an object with the pinned keys.\n${tail}`);
  }

  for (const { key, type } of specs) {
    if (!Object.prototype.hasOwnProperty.call(baseline, key)) {
      throw new RatchetBaselineError('MISSING-KEY',
        `✗ RATCHET BASELINE MISSING-KEY — ${label}: ${path} has no ${JSON.stringify(key)} key (required, type '${type}').\n` +
        `  Present keys: ${Object.keys(baseline).join(', ') || '(none)'}\n${tail}`);
    }
    const value = baseline[key];
    if (type === 'count') {
      // Number.isFinite is the whole point: it rejects NaN, ±Infinity, and every non-number in one call.
      // JSON.parse('{"x":1e999}') === Infinity, which is precisely the old `?? Infinity` ceiling — banned.
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new RatchetBaselineError('NAN-KEY',
          `✗ RATCHET BASELINE NAN-KEY — ${label}: ${path} key ${JSON.stringify(key)} must be a finite number, got ${typeof value === 'number' ? String(value) : JSON.stringify(value)} (${typeof value}).\n` +
          `  A non-finite ceiling is the disabled-ratchet state this loader exists to refuse — Infinity compares true against every count.\n${tail}`);
      }
    } else {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        throw new RatchetBaselineError('BAD-LIST-KEY',
          `✗ RATCHET BASELINE BAD-LIST-KEY — ${label}: ${path} key ${JSON.stringify(key)} must be an array of strings, got ${Array.isArray(value) ? 'an array containing a non-string' : JSON.stringify(value)}.\n` +
          `  This list is the provenance snapshot the regression discriminator reads; degrading it to [] would reclassify every regression as a brand-new node.\n${tail}`);
      }
    }
  }

  return baseline;
}

// ── loadRatchetBaseline ──────────────────────────────────────────────────────────────────────────
// THE function the row specifies. Reads `path` and returns the validated baseline object, or throws a
// RatchetBaselineError naming exactly which of the states above fired. ⛔ There is no "absent is fine"
// mode and no default ceiling — that is the entire point.
export function loadRatchetBaseline(path, requiredKeys, { label, repinCommand }) {
  const text = existsSync(path) ? readFileSync(path, 'utf8') : null;
  return validateRatchetBaseline(text, requiredKeys, { label, path, repinCommand });
}

// ── loadRatchetBaselineOrExit ────────────────────────────────────────────────────────────────────
// CLI convenience: same validation, but a RatchetBaselineError prints its (already self-describing)
// message and exits 1 instead of unwinding as a stack trace. Any OTHER error still throws — a bug in
// this module must never be laundered into a tidy gate failure.
export function loadRatchetBaselineOrExit(path, requiredKeys, opts) {
  try {
    return loadRatchetBaseline(path, requiredKeys, opts);
  } catch (e) {
    if (e instanceof RatchetBaselineError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
}

// ── readBaselineForUpdate ────────────────────────────────────────────────────────────────────────
// ⚖ THE ONE SANCTIONED ABSENT-BASELINE PATH, and it is a WRITER path, never a gate path.
// `--update-baseline` on a first-ever pin has no file to read and legitimately returns null; the caller
// then pins whatever the current state is, with nothing to discriminate against. ⛔ But an EXISTING
// baseline that is corrupt still hard-fails here: overwriting a damaged baseline as though it had been
// an innocent first pin is how a real ceiling gets quietly replaced by a fresh, higher one.
// ⛔ Never call this from a strict gate path. The `?? []` defaults that remain in the callers'
// provenance discriminators exist ONLY to serve this null, and are unreachable from the strict path.
export function readBaselineForUpdate(path, requiredKeys, opts) {
  if (!existsSync(path)) return null;
  return loadRatchetBaselineOrExit(path, requiredKeys, opts);
}

// ── assertFiniteCeiling ──────────────────────────────────────────────────────────────────────────
// For an exported PURE ratchet function that receives an already-loaded baseline object from a caller
// this module cannot see (check-compute-proof-coverage.mjs's ratchetBreach() is called both by the gate
// and directly by its self-test). ⛔ Reading `baseline.deferred` there with no guard re-creates F-11
// INSIDE the pure function — `count > undefined` is false, i.e. a silent pass. One implementation of the
// finite-ceiling rule, used at both layers.
export function assertFiniteCeiling(value, { label, keyName }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RatchetBaselineError('NAN-KEY',
      `✗ RATCHET BASELINE NAN-KEY — ${label}: ceiling ${JSON.stringify(keyName)} must be a finite number, got ${typeof value === 'number' ? String(value) : JSON.stringify(value)} (${typeof value}). ` +
      'Refusing to compare a count against a non-finite ceiling (RATCHET-BASELINE-LOADER-1 / F-11).');
  }
  return value;
}
