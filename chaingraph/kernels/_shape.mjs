// _shape.mjs — the ONE reader for kernel return shapes and committed fixture shapes.
// KERNEL-OUTPUT-READER-1.
//
// WHY THIS EXISTS. Kernels return two shapes and every tool that reads them has had to guess.
// Measured by execution over the whole corpus (HY4-RETURN-SHAPE-CENSUS-2026-09-07): 617 of 662
// kernels (93.2%) return `{ output_payload, compliance_flags }`; 45 (6.8%) return a flat payload.
// A static search for `output_payload:` finds only 229 of the 617, because the dominant form is
// the shorthand `return { output_payload, compliance_flags }` with no colon — so anyone sizing
// this by grep concludes wrapping is a minority habit and writes a single-level reader. That has
// happened four times (FreeBuff Tasks 13/14/16 and the Opus grade of 16). Four tools broke; zero
// kernels did. This module makes every reader correct; it does NOT normalise any kernel.
//
// SPEC STATUS (recorded, per the row's step 1). SPEC.md does NOT mandate a kernel return shape.
// §12 requires only that a kernel export `compute(pp)`, `async buildArtifact(pp, opts)` and
// `meta`. §24.0 writes the compute surface as `compute(policy_parameters) → output_payload`, but
// that is the profile naming the value that feeds the §4 preimage, not a normative statement that
// `compute()` returns the payload unwrapped — and §4's preimage is defined over the artifact's
// `{ policy_parameters, output_payload }`, which `buildArtifact` assembles either way. The spec is
// SILENT on the return shape, and that silence is why two shapes coexist. This module therefore
// reads both rather than picking a winner; which shape SHOULD be canonical is deliberately left
// open.
//
// This module is for TOOLS that read kernels — gates, harnesses, generators. It is NOT for kernels
// to import: a kernel may import `./_hash.mjs` and nothing else (the §18 guest / VM-1 ESM strip
// depends on that), so nothing here is on any kernel's compute path and no `execution_hash` moves.

import { readFileSync } from 'node:fs';

/**
 * readOutcome(result) — return the innermost payload of a kernel `compute()` result.
 *
 * While `result` is a non-null, non-array object carrying an OWN `output_payload` key, descend
 * into it (capped at 4 levels, so a self-referential or pathological structure terminates). A
 * flat payload — an object with no `output_payload` key — is returned unchanged, as are
 * non-objects and arrays.
 *
 * The cap matters for the art-424 case: `art-424-witness-cosignature-verifier`'s sync path
 * returns `{ __async: true, mode, parsed, … }` — flat — while its source text contains
 * `output_payload:` further down (on its error paths). It is the one kernel where a static
 * classification and an executed one legitimately disagree, so `readOutcome` must hand that
 * object back untouched rather than hunting for a payload inside it.
 */
export function readOutcome(result) {
  let cur = result;
  for (let depth = 0; depth < 4; depth++) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return cur;
    if (!Object.prototype.hasOwnProperty.call(cur, 'output_payload')) return cur;
    cur = cur.output_payload;
  }
  return cur;
}

// Keys that only ever appear on a fixture WRAPPER, never on a case. Measured over all 683
// committed fixture files / 3493 cases: case-level `tool_id` = 0, case-level `vectors` = 0.
const WRAPPER_ONLY_KEYS = ['vectors', 'tool_id'];

// `note` is NOT in that list, and this is a deliberate, measured departure from the row's literal
// wording. The row asks the assertion to fire on `vectors`, `tool_id` OR `note`. Measured over the
// same corpus, 38 REAL cases carry a case-level `note` alongside their `policy_parameters` (e.g.
// `art-09-dora-incident-classifier.fixtures.json`), so a blanket `note` test would throw on
// legitimate input and make this module worse than the readers it replaces. `note` is therefore
// treated as wrapper evidence only when the candidate ALSO lacks `policy_parameters` — which is
// the row's own stated rule ("the case is the element carrying `policy_parameters`, never the
// wrapper carrying `vectors`") and still catches the exact `{ tool_id, note, vectors }` wrapper
// that broke Task 16.
function assertIsCase(candidate, where) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
  const hit = WRAPPER_ONLY_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(candidate, k));
  const noteWrapper = Object.prototype.hasOwnProperty.call(candidate, 'note')
    && !Object.prototype.hasOwnProperty.call(candidate, 'policy_parameters');
  if (hit.length === 0 && !noteWrapper) return candidate;
  const keys = hit.concat(noteWrapper ? ['note (with no policy_parameters)'] : []);
  const err = new Error(
    `fixture WRAPPER returned as a case${where ? ` from ${where}` : ''}: carries ${keys.join(', ')}. `
    + 'The case is the element carrying policy_parameters, never the wrapper carrying vectors. '
    + 'Descend into .vectors / .cases before executing.',
  );
  err.name = 'FixtureWrapperAsCaseError';
  throw err;
}

/**
 * readCases(fixtureFile) — return the array of cases from any committed fixture shape.
 *
 * Accepts either an already-parsed fixture value or a path/URL string to a JSON file (a string is
 * never itself a fixture shape, so the two cannot be confused). Handles, in this order:
 *   `{ tool_id, note, vectors: [...] }`  — 671 of the 683 committed fixture files
 *   `{ cases: [...] }`                   — defensive; not currently present in the corpus
 *   `[ ... ]`                            — a bare array of cases
 *   `{ ... }`                            — a single case object, returned as a one-element array
 *
 * Every element about to be handed back as a case is asserted NOT to be a wrapper. That assertion
 * is the whole defect, caught: Task 16 read the `{ tool_id, note, vectors }` wrapper of node 540's
 * fixture as if it were a case, executed the wrapper, lost three of the nine scalar fields and
 * published three phantom field-level gaps off the loss.
 */
export function readCases(fixtureFile) {
  let value = fixtureFile;
  let where = '';
  if (typeof fixtureFile === 'string') {
    where = fixtureFile;
    value = JSON.parse(readFileSync(fixtureFile, 'utf8'));
  }

  if (Array.isArray(value)) return value.map((c) => assertIsCase(c, where));
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value.vectors)) return value.vectors.map((c) => assertIsCase(c, where));
    if (Array.isArray(value.cases)) return value.cases.map((c) => assertIsCase(c, where));
    return [assertIsCase(value, where)];
  }
  throw new Error(`readCases: not a fixture shape${where ? ` (${where})` : ''}: ${typeof value}`);
}
