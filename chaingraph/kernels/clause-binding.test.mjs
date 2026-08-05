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
//   7. §9 CB-8 — `clause_version` is OPTIONAL and its addition to the schema is hash-neutral; a
//      present-but-empty value is RED. `asOfReplay()` recomputes in-force status from data already
//      inside the preimage, against a synthetic artifact AND against art-499's real shipped
//      citation set (fixtures/art-499-check-safeguarding-reconciliation.fixtures.json) — the one
//      existing node this row demonstrates the binding on, per its check-off.
//   8. LIVE SWEEP — every artifact-shaped file on disk that declares clause_bindings must validate.
//   9. §0.7 / §13 — this gate emits no percentage. Asserted against the gate's own output.
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
  asOfReplay,
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

// ── 7. §9 CB-8 — as-of replay ────────────────────────────────────────────────
log('— §9 CB-8: clause_version + as-of replay —');

// clause_version is OPTIONAL and additive — the reference citation (no clause_version) still
// validates, and adding a well-formed one still validates. Neither moves execution_hash: both are
// the same citation object at the same preimage pointer, exercised without re-hashing.
ok(validateCitation(CITATION).length === 0, 'reference citation with no clause_version still valid (additive, hash-neutral)');
ok(validateCitation({ ...CITATION, clause_version: '2026-ed3' }).length === 0, 'citation with a well-formed clause_version validates');
ok(validateCitation({ ...CITATION, clause_version: '' }).some((e) => e.includes('clause_version')),
  'present-but-empty clause_version is RED');

// asOfReplay recomputes in-force status from fields already inside the preimage.
ok(asOfReplay(bound, '2005-01-01').ok === false && asOfReplay(bound, '2005-01-01').findings[0].valid_as_of === false,
  'asOfReplay: a date before in_force_from (12 CFR 1026 App J, 2011-12-30) is NOT valid as-of');
const midWindow = asOfReplay(bound, '2026-01-01');
ok(midWindow.ok === true && midWindow.findings[0].valid_as_of === true && midWindow.findings[0].clause_version === null,
  'asOfReplay: a date inside an open-ended in_force window is valid as-of; clause_version reports null when the citation does not carry one');
const withVersion = attachClauseBindings(
  { ...minted, output_payload: { ...op, regulatory_citation: { ...CITATION, clause_version: '2026-ed3' } } },
  ['/output_payload/regulatory_citation'],
);
ok(asOfReplay(withVersion, '2026-01-01').findings[0].clause_version === '2026-ed3',
  'asOfReplay surfaces clause_version from the preimage when a kernel carries one');
ok(asOfReplay(bound, 'not-a-date').ok === false && /must be an ISO/.test(asOfReplay(bound, 'not-a-date').errors[0]),
  'asOfReplay: a malformed asOfDate is RED with no findings computed');
ok(asOfReplay({ ...bound, clause_bindings: [{ pointer: '/output_payload/nope' }] }, '2026-01-01').ok === false,
  'asOfReplay refuses to compute findings over a shape that is already RED (unresolvable pointer)');

// Demonstrated on ONE EXISTING NODE (this row's check-off names it): art-499's real shipped
// citation set, taken from its own fixture — not a synthetic. No kernel/shard file is touched;
// this only reads the already-shipped output_payload and re-derives clause_bindings pointers the
// same way art-499's own CLAUSE_BINDING_POINTERS does, to prove replay against real preimage data.
{
  const art499Path = join(FIXDIR, 'art-499-check-safeguarding-reconciliation.fixtures.json');
  if (existsSync(art499Path)) {
    const doc = JSON.parse(readFileSync(art499Path, 'utf8'));
    const vector = (doc.vectors ?? []).find((v) => v.output_payload?.citations);
    if (vector) {
      const artifact = {
        policy_parameters: vector.policy_parameters,
        output_payload: vector.output_payload,
        clause_bindings: Object.keys(vector.output_payload.citations).map((k) => ({
          profile: CLAUSE_BINDING_PROFILE,
          pointer: `/output_payload/citations/${k}`,
        })),
      };
      const replay = asOfReplay(artifact, vector.output_payload.as_of_date);
      ok(replay.ok === true && replay.checked === Object.keys(vector.output_payload.citations).length,
        `art-499: as-of replay against its OWN as_of_date (${vector.output_payload.as_of_date}) recomputes all ${replay.checked} citations as in force, from the real shipped output_payload`);
      const early = asOfReplay(artifact, '2020-01-01');
      ok(early.ok === false && early.findings.every((f) => f.valid_as_of === false),
        'art-499: replaying a date before CASS 15.8 commencement (2026-05-07) correctly finds every citation NOT yet in force — provable, not asserted');
    } else {
      err('✗ art-499 fixture has no vector with output_payload.citations to replay against');
    }
  } else {
    err('✗ art-499 fixture missing — cannot demonstrate as-of replay on the named node');
  }
}

// ── 8. LIVE SWEEP ────────────────────────────────────────────────────────────
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

// ── 9. NO PERCENTAGE ─────────────────────────────────────────────────────────
// §0.7 / §13: any gate emitting a percentage is RED. A published completeness figure converts an
// ordinary miss into a misrepresentation claim, so gaps ship as a LIST, never as a ratio.
const emitted = out.join('\n');
ok(!/%|\bpercent\b/i.test(emitted) && !/\b\d+\s*(?:of|\/)\s*\d+\s*(?:citations?|kernels?|tools?)\b/i.test(emitted),
  'gate emits no percentage and no coverage ratio (§0.7)');

console.log();
console.log(fail ? `✗ ${fail} clause-binding failure(s).` : `✓ ${CLAUSE_BINDING_PROFILE} clean.`);
process.exit(fail ? 1 : 0);
