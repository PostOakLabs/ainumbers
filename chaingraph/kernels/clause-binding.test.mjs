// clause-binding.test.mjs — GATE for profile `ocg-clause-binding@1`
// (CLAUSE-BINDING-BUILD-SPEC.md §1.2 / §1.4 / §4; RED list §13).
//
// Enforces, in order:
//   1. NON-ADOPTER INVARIANCE — the profile existing moves no execution_hash. Recomputes the shipped
//      goldens for a non-adopting node (art-01) and an already-proven adopting node (art-215) and
//      asserts they still match what is pinned in their fixtures.
//   2. ATTACH IS HASH-NEUTRAL — attaching clause_bindings to an artifact leaves execution_hash
//      byte-identical, because the array is a top-level sibling of the preimage, not part of it.
//   3. §1.2 shape — a pinned citation missing any REQUIRED member is RED.
//   4. §1.4 — a citation outside the signed preimage claiming pinned status is RED.
//   5. §0.10 — an interpretation_ref that is not a content hash is RED.
//   6. §1.1 — a legacy bare string may not be declared pinned (it stays valid, just unpinned).
//   7. LIVE SWEEP — every artifact-shaped file on disk that declares clause_bindings must validate.
//   8. §0.7 / §13 — this gate emits no percentage. Asserted against the gate's own output.
//
// Zero-dependency. Non-zero exit blocks.  node chaingraph/kernels/clause-binding.test.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionHash } from './_hash.mjs';
import {
  CLAUSE_BINDING_PROFILE,
  validateCitation,
  validateClauseBindings,
  attachClauseBindings,
  isInPreimage,
  resolvePointer,
} from './_clausebinding.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXDIR = resolve(HERE, 'fixtures');
const SHARDDIR = resolve(HERE, '..', 'graph', 'nodes');

const out = [];
let fail = 0;
const log = (s) => { out.push(s); console.log(s); };
const err = (s) => { out.push(s); console.error(s); fail++; };
const ok = (cond, label) => (cond ? log(`✓ ${label}`) : err(`✗ ${label}`));

// ── 1. NON-ADOPTER INVARIANCE ────────────────────────────────────────────────
// The row's own done-criterion: prove no existing execution_hash moved. One kernel that does not
// carry regulatory_basis, one that does AND already ships a compute_proof.
const WITNESSES = [
  ['non-adopting     ', 'art-01-ap2-mandate-chain-validator'],
  ['adopting + proven', 'art-215-reg-z-appendix-j-apr'],
];
log('— unmoved-hash witnesses (recomputed against pinned goldens) —');
for (const [label, id] of WITNESSES) {
  const fp = join(FIXDIR, `${id}.fixtures.json`);
  if (!existsSync(fp)) { err(`✗ witness fixture missing: ${id}`); continue; }
  const doc = JSON.parse(readFileSync(fp, 'utf8'));
  for (const v of doc.vectors ?? []) {
    const got = await executionHash(v.policy_parameters, v.output_payload);
    if (got === v.golden_hash) log(`✓ ${label} ${id}/${v.name}  ${got}`);
    else err(`✗ ${label} ${id}/${v.name} HASH MOVED\n    pinned ${v.golden_hash}\n    got    ${got}`);
  }
}

// ── 2. ATTACH IS HASH-NEUTRAL ────────────────────────────────────────────────
const CITATION = {
  scheme: 'cfr',
  id: '12 CFR 1026',
  path: 'Appendix J',
  in_force_from: '2011-12-30',
  in_force_to: null,
  jurisdiction: 'US-FED',
  mapped_by: 'ainumbers-ocg',
  mapped_at: '2026-07-28',
};
const pp = { input_parameters: { amount: 1000 }, execution_backend: 'js' };
const op = { result: 42, regulatory_citation: CITATION };
const baseHash = await executionHash(pp, op);
const minted = {
  '@context': 'https://ainumbers.co/chaingraph/context/v0.3/',
  chaingraph_version: '0.4.0',
  tool_id: 'test-clause-binding',
  tool_version: '1.0.0',
  generated_at: '2026-07-28T00:00:00Z',
  execution_hash: `sha256:${baseHash}`,
  chain: { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 },
  policy_parameters: pp,
  output_payload: op,
  audit_signature: { client_side_executed: true, zero_pii_verified: true, deterministic_run: true },
};

const bound = attachClauseBindings(minted, ['/output_payload/regulatory_citation']);
const afterHash = await executionHash(bound.policy_parameters, bound.output_payload);
ok(afterHash === baseHash, `attaching clause_bindings leaves execution_hash byte-identical (${baseHash})`);
ok(minted.clause_bindings === undefined, 'attach does not mutate the input artifact');
const emptyAttached = attachClauseBindings(minted, []);
ok(emptyAttached.clause_bindings === undefined && (await executionHash(emptyAttached.policy_parameters, emptyAttached.output_payload)) === baseHash,
  'zero declarations leaves the artifact byte-identical to a pre-profile artifact');

// ── 3-6. RED CASES ───────────────────────────────────────────────────────────
const red = (label, artifact, needle) => {
  const r = validateClauseBindings(artifact);
  if (r.ok) { err(`✗ RED case did not go red: ${label}`); return; }
  if (needle && !r.errors.some((e) => e.includes(needle))) {
    err(`✗ RED case went red for the wrong reason: ${label}\n    ${r.errors.join('\n    ')}`); return;
  }
  log(`✓ RED: ${label}`);
};

log('— RED cases —');
ok(validateClauseBindings(bound).ok, 'a well-formed adopting artifact validates');
ok(validateClauseBindings(minted).ok && validateClauseBindings(minted).checked === 0,
  'an artifact with no clause_bindings is conformant (absence carries no meaning)');

// §1.2 — missing REQUIRED member
const noMappedBy = { ...CITATION }; delete noMappedBy.mapped_by;
red('§1.2 pinned citation missing a REQUIRED member',
  attachClauseBindings({ ...minted, output_payload: { ...op, regulatory_citation: noMappedBy } }, ['/output_payload/regulatory_citation']),
  'missing REQUIRED §1.2 member "mapped_by"');

// §1.4 — pointer outside the preimage. attachClauseBindings refuses it outright, so build by hand
// to prove the validator catches a hand-written artifact too.
red('§1.4 citation outside the signed preimage claiming pinned status',
  { ...minted, compliance_flags: [], clause_bindings: [{ pointer: '/audit_signature/regulatory_citation' }] },
  'OUTSIDE the execution_hash preimage');
let threw = false;
try { attachClauseBindings(minted, ['/audit_signature/citation']); } catch { threw = true; }
ok(threw, '§1.4 attachClauseBindings refuses an out-of-preimage pointer at mint time');
ok(isInPreimage('/policy_parameters/a') && isInPreimage('/output_payload/a/0') && !isInPreimage('/anchor_bindings/0'),
  'isInPreimage accepts exactly the two preimage halves');

// §0.10 — interpretation_ref must be a content hash
red('§0.10 interpretation_ref that is not a content hash',
  attachClauseBindings({ ...minted, output_payload: { ...op, regulatory_citation: { ...CITATION, interpretation_ref: 'https://example.invalid/interp' } } },
    ['/output_payload/regulatory_citation']),
  'must be a sha256:<64 hex> content hash');

// §1.1 — legacy bare string is valid-but-unpinned; declaring it pinned is RED
red('§1.1 legacy bare-string citation declared as pinned',
  attachClauseBindings({ ...minted, output_payload: { ...op, regulatory_citation: 'Reg Z Appendix J, 12 CFR 1026 Appendix J' } },
    ['/output_payload/regulatory_citation']),
  'legacy bare-string citation cannot claim pinned status');

// unresolvable pointer
red('pointer that does not resolve',
  { ...minted, clause_bindings: [{ pointer: '/output_payload/nope' }] }, 'does not resolve');
// wrong profile tag
red('declaration tagged with a different profile',
  { ...minted, clause_bindings: [{ pointer: '/output_payload/regulatory_citation', profile: 'ocg-clause-binding@2' }] },
  `is not ${CLAUSE_BINDING_PROFILE}`);

ok(validateCitation(CITATION).length === 0, 'the reference §1.2 citation object is valid');
ok(resolvePointer(bound, '/output_payload/regulatory_citation').value === CITATION, 'resolvePointer resolves into the preimage');

// ── 7. LIVE SWEEP ────────────────────────────────────────────────────────────
// Every artifact-shaped file on disk that DECLARES clause_bindings must validate. Today the
// declaring set is empty by design — the profile is new-artifacts-only and retrofits nothing —
// so this loop is the tripwire that keeps the first adopter honest rather than a backlog counter.
log('— live sweep —');
let swept = 0, declaring = 0;
for (const [dir, pred] of [[FIXDIR, (f) => f.endsWith('.fixtures.json')], [SHARDDIR, (f) => f.endsWith('.json')]]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(pred)) {
    const raw = readFileSync(join(dir, f), 'utf8');
    swept++;
    if (!raw.includes('clause_bindings')) continue;
    declaring++;
    const doc = JSON.parse(raw);
    const candidates = Array.isArray(doc.vectors) ? doc.vectors : [doc];
    for (const c of candidates) {
      const r = validateClauseBindings(c);
      if (!r.ok) err(`✗ ${f}: ${r.errors.join('; ')}`);
    }
  }
}
log(`✓ swept ${swept} file(s); ${declaring} declare clause_bindings, all valid`);

// ── 8. NO PERCENTAGE ─────────────────────────────────────────────────────────
// §0.7 / §13: any gate emitting a percentage is RED. A published completeness figure converts an
// ordinary miss into a misrepresentation claim, so gaps ship as a LIST, never as a ratio.
const emitted = out.join('\n');
ok(!/%|\bpercent\b/i.test(emitted) && !/\b\d+\s*(?:of|\/)\s*\d+\s*(?:citations?|kernels?|tools?)\b/i.test(emitted),
  'gate emits no percentage and no coverage ratio (§0.7)');

console.log();
console.log(fail ? `✗ ${fail} clause-binding failure(s).` : `✓ ${CLAUSE_BINDING_PROFILE} clean.`);
process.exit(fail ? 1 : 0);
