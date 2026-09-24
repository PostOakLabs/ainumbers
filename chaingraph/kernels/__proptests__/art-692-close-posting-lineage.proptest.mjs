// art-692-close-posting-lineage — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:283c21b3b560aea23f694080f9469594091f0ed6106a06221fb9d6b38e6d6e65
// spec: CLOSE-COMMAND-CENTER-BUILD-SPEC-2026-09-23.md (workspace root) Sec. D2/F, narrowed to the
//       lineage node alone by FINTECH-SAAS-SPECS-VALUE-REVIEW-2026-09-24.md (board row CCC-LINEAGE-NODE-1).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Class K, float_sensitive: NO — every output member is a list of declared string keys, a list of
// {accrual_key, trace_ref} pairs, or a verdict token. Declared amounts are carried through the
// input and never arithmetic, so there is no rounding path to pin.
//
// Run: node chaingraph/kernels/__proptests__/art-692-close-posting-lineage.proptest.mjs

import { compute } from '../art-692-close-posting-lineage.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-692-close-posting-lineage';
const rand = mulberry32(0x692C1E);
const TRIALS = 8000;

const INDET_FLAG = JSON.stringify(['CLOSE_LINEAGE_INDETERMINATE']);
const EMPTY = JSON.stringify([]);

function randId(rng, prefix) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';
  return prefix + '-' + Array.from({ length: 3 + Math.floor(rng() * 5) }, () => pick(rng, alphabet.split(''))).join('');
}

// A structurally VALID register: unique lineage keys across both lists, well-typed optional fields,
// traces_to drawn from the declared coding keys plus an occasional deliberately dangling reference.
function randValidRegister(rng, nCoding, nAccrual) {
  const used = new Set();
  const uniq = (prefix) => {
    let id = randId(rng, prefix);
    while (used.has(id)) id = randId(rng, prefix);
    used.add(id);
    return id;
  };
  const coding_entries = Array.from({ length: nCoding }, () => {
    const e = { key: uniq('COD'), gl_account: '6' + Math.floor(rng() * 900 + 100) + '-acct', amount: Math.floor(rng() * 500000) / 100 };
    if (rng() < 0.7) e.source_document_digest = randId(rng, 'DOC');
    return e;
  });
  const codingKeys = coding_entries.map((e) => e.key);
  const accrual_entries = Array.from({ length: nAccrual }, () => {
    const e = { key: uniq('ACC'), gl_account: '2' + Math.floor(rng() * 900 + 100) + '-accrued', amount: Math.floor(rng() * 500000) / 100 };
    const roll = rng();
    if (roll < 0.2) {
      // leave traces_to off entirely — reads as unlinked, never as malformed
    } else if (roll < 0.35) {
      e.traces_to = [];
    } else if (roll < 0.5 || codingKeys.length === 0) {
      e.traces_to = [randId(rng, 'GONE')]; // deliberately dangling
    } else {
      const n = 1 + Math.floor(rng() * Math.min(3, codingKeys.length));
      e.traces_to = Array.from({ length: n }, () => pick(rng, codingKeys));
      if (rng() < 0.15) e.traces_to.push(randId(rng, 'GONE'));
    }
    return e;
  });
  const pp = { coding_entries, accrual_entries };
  if (rng() < 0.6) pp.as_of = '2026-09-30';
  return pp;
}

// Re-derive the classification straight from the declared entries, independently of the kernel.
function reclassify(pp) {
  const codingKeys = new Set(pp.coding_entries.map((e) => e.key));
  const linked = [];
  const unlinked = [];
  const dangling = [];
  const referenced = new Set();
  for (const a of pp.accrual_entries) {
    const refs = Array.isArray(a.traces_to) ? a.traces_to : [];
    if (refs.length === 0) { unlinked.push(a.key); continue; }
    let allResolve = true;
    for (const ref of refs) {
      if (codingKeys.has(ref)) referenced.add(ref);
      else { allResolve = false; dangling.push({ accrual_key: a.key, trace_ref: ref }); }
    }
    if (allResolve) linked.push(a.key);
  }
  const orphan = pp.coding_entries.filter((e) => !referenced.has(e.key)).map((e) => e.key);
  const missing = pp.coding_entries
    .filter((e) => !(typeof e.source_document_digest === 'string' && e.source_document_digest.trim().length > 0))
    .map((e) => e.key);
  return { linked, unlinked, dangling, orphan, missing };
}

// ---------- P1: classification partition — every accrual is linked, unlinked, or carries a dangling ref ----------
function checkP1_classificationPartition() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, Math.floor(rand() * 6), 1 + Math.floor(rand() * 8));
    checked++;
    const op = compute(pp).output_payload;
    if (op.overall === 'INDETERMINATE') { violations++; continue; } // a valid non-empty register is always assertable
    const danglingAccruals = new Set(op.dangling_trace_refs.map((d) => d.accrual_key));
    const partition = op.linked_accruals.length + op.unlinked_accruals.length + danglingAccruals.size;
    if (partition !== pp.accrual_entries.length) violations++;
    const overlap = op.linked_accruals.filter((k) => danglingAccruals.has(k) || op.unlinked_accruals.includes(k));
    if (overlap.length > 0) violations++;
  }
  return { name: 'P1_every_accrual_linked_unlinked_or_dangling_exactly_once', checked, violations };
}

// ---------- P2: classification re-derived independently, member by member ----------
function checkP2_classificationRecomputed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, Math.floor(rand() * 8), 1 + Math.floor(rand() * 10));
    checked++;
    const op = compute(pp).output_payload;
    const rc = reclassify(pp);
    if (JSON.stringify(op.linked_accruals) !== JSON.stringify(rc.linked)) violations++;
    if (JSON.stringify(op.unlinked_accruals) !== JSON.stringify(rc.unlinked)) violations++;
    if (JSON.stringify(op.dangling_trace_refs) !== JSON.stringify(rc.dangling)) violations++;
    if (JSON.stringify(op.orphan_coding) !== JSON.stringify(rc.orphan)) violations++;
    if (JSON.stringify(op.missing_source_refs) !== JSON.stringify(rc.missing)) violations++;
  }
  return { name: 'P2_classification_independently_recomputed', checked, violations };
}

// ---------- P3: verdict — CLOSE_READY iff no unlinked, no dangling, no duplicate key ----------
function checkP3_verdictContract() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 8));
    checked++;
    const op = compute(pp).output_payload;
    const rc = reclassify(pp);
    const shouldPass = rc.unlinked.length === 0 && rc.dangling.length === 0; // generator never repeats a key
    if (shouldPass !== (op.overall === 'CLOSE_READY')) violations++;
    if (!shouldPass && op.overall !== 'GAPS_FOUND') violations++;
    if (op.duplicate_lineage_keys.length !== 0) violations++;
  }
  return { name: 'P3_close_ready_iff_no_unlinked_no_dangling_no_duplicate', checked, violations };
}

// ---------- P4: the advisory observations never gate the verdict ----------
function checkP4_advisoriesNeverGate() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 5), 1 + Math.floor(rand() * 6));
    checked++;
    const base = compute(pp).output_payload;
    // Strip every source digest, then add a coding entry nobody traces to: both observations move,
    // the verdict may not.
    const stripped = {
      ...pp,
      coding_entries: pp.coding_entries.map((e) => ({ key: e.key, gl_account: e.gl_account, amount: e.amount })),
    };
    const withOrphan = {
      ...stripped,
      coding_entries: stripped.coding_entries.concat([{ key: 'COD-ORPHAN-ONLY', gl_account: '6999-misc', amount: 1 }]),
    };
    const a = compute(stripped).output_payload;
    const b = compute(withOrphan).output_payload;
    if (a.overall !== base.overall) violations++;
    if (b.overall !== base.overall) violations++;
    if (JSON.stringify(b.linked_accruals) !== JSON.stringify(base.linked_accruals)) violations++;
    if (JSON.stringify(b.dangling_trace_refs) !== JSON.stringify(base.dangling_trace_refs)) violations++;
    if (a.missing_source_refs.length !== stripped.coding_entries.length) violations++;
    if (!b.orphan_coding.includes('COD-ORPHAN-ONLY')) violations++;
  }
  return { name: 'P4_missing_source_and_orphan_coding_are_advisory', checked, violations };
}

// ---------- P5: intake mutations always fail closed to INDETERMINATE ----------
const MUTATORS = [
  (pp) => ({ ...pp, coding_entries: 'not-an-array' }),
  (pp) => ({ ...pp, accrual_entries: undefined }),
  (pp) => ({ ...pp, coding_entries: pp.coding_entries.map((e, i) => (i === 0 ? { ...e, key: undefined } : e)) }),
  (pp) => ({ ...pp, accrual_entries: pp.accrual_entries.map((e, i) => (i === 0 ? { ...e, key: '  ' } : e)) }),
  (pp) => ({ ...pp, accrual_entries: pp.accrual_entries.map((e, i) => (i === 0 ? { ...e, gl_account: 7 } : e)) }),
  (pp) => ({ ...pp, coding_entries: pp.coding_entries.map((e, i) => (i === 0 ? { ...e, amount: 'ten' } : e)) }),
  (pp) => ({ ...pp, accrual_entries: pp.accrual_entries.map((e, i) => (i === 0 ? { ...e, amount: Number.NaN } : e)) }),
  (pp) => ({ ...pp, accrual_entries: pp.accrual_entries.map((e, i) => (i === 0 ? { ...e, traces_to: 'COD-1' } : e)) }),
  (pp) => ({ ...pp, accrual_entries: pp.accrual_entries.map((e, i) => (i === 0 ? { ...e, traces_to: [''] } : e)) }),
  (pp) => ({ ...pp, coding_entries: pp.coding_entries.map((e, i) => (i === 0 ? 'not-an-object' : e)) }),
  (pp) => ({ ...pp, as_of: '30-09-2026' }),
  (pp) => ({ ...pp, accrual_entries: [] }),
  () => ({}),
];
function checkP5_intakeFailsClosed() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 4), 1 + Math.floor(rand() * 4));
    const mutated = pick(rand, MUTATORS)(pp);
    checked++;
    const { output_payload: op, compliance_flags } = compute(mutated);
    if (op.overall !== 'INDETERMINATE') violations++;
    if (!Array.isArray(op.errors) || op.errors.length !== 1 || typeof op.errors[0] !== 'string' || op.errors[0].length === 0) violations++;
    if (op.linked_accruals.length || op.unlinked_accruals.length || op.dangling_trace_refs.length) violations++;
    if (op.orphan_coding.length || op.missing_source_refs.length || op.duplicate_lineage_keys.length) violations++;
    if (JSON.stringify(compliance_flags) !== INDET_FLAG) violations++;
  }
  return { name: 'P5_malformed_or_empty_register_is_indeterminate', checked, violations };
}

// ---------- P6: duplicate keys are reported once, in first-repeat order, and always gate ----------
function checkP6_duplicateKeys() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 4), 1 + Math.floor(rand() * 4));
    const dupKey = pp.coding_entries.length > 0 ? pp.coding_entries[0].key : pp.accrual_entries[0].key;
    const doubled = {
      ...pp,
      coding_entries: pp.coding_entries.concat([{ key: dupKey, gl_account: '6999-misc', amount: 5, source_document_digest: 'DOC-DUP' }]),
    };
    checked++;
    const op = compute(doubled).output_payload;
    if (JSON.stringify(op.duplicate_lineage_keys) !== JSON.stringify([dupKey])) violations++;
    if (op.overall !== 'GAPS_FOUND') violations++;
    // A third entry on the same key must not report it twice.
    const tripled = { ...doubled, coding_entries: doubled.coding_entries.concat([{ key: dupKey, gl_account: '6999-misc', amount: 6 }]) };
    if (JSON.stringify(compute(tripled).output_payload.duplicate_lineage_keys) !== JSON.stringify([dupKey])) violations++;
  }
  return { name: 'P6_duplicate_key_reported_once_and_gates', checked, violations };
}

// ---------- P7: determinism — same pp twice, byte-identical output ----------
function checkP7_deterministic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randValidRegister(rand, Math.floor(rand() * 10), 1 + Math.floor(rand() * 12));
    checked++;
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    if (a !== b) violations++;
  }
  return { name: 'P7_deterministic_same_input_same_output', checked, violations };
}

// ---------- P8: shape invariant — no NaN/undefined/non-finite anywhere in the result ----------
function checkP8_shapeClean() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 2000; i++) {
    const pp = randValidRegister(rand, Math.floor(rand() * 10), 1 + Math.floor(rand() * 12));
    checked++;
    const r = compute(pp);
    if (findShapeViolations(r.output_payload).length || findShapeViolations(r.compliance_flags).length) violations++;
  }
  return { name: 'P8_output_shape_no_nan_undefined', checked, violations };
}

// ---------- P9: flag channel — empty on an assertable register, one mirrored flag otherwise ----------
function checkP9_flagMirrorContract() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randValidRegister(rand, 1 + Math.floor(rand() * 4), 1 + Math.floor(rand() * 4));
    const mutated = pick(rand, MUTATORS)(pp);
    checked++;
    const ok = compute(pp);
    if (JSON.stringify(ok.compliance_flags) !== EMPTY) violations++;
    if (Array.isArray(ok.output_payload.errors)) violations++;
    const bad = compute(mutated);
    if (JSON.stringify(bad.compliance_flags) !== INDET_FLAG) violations++;
    if (!(Array.isArray(bad.output_payload.errors) && bad.output_payload.errors.length > 0)) violations++;
  }
  return { name: 'P9_flag_mirror_empty_on_assertable_indeterminate_mirrored_by_errors', checked, violations };
}

// ---------- P10 forced categorical boundary cases ----------
const FORCED_CASES = [
  [{}, 'fully empty input'],
  [{ coding_entries: [], accrual_entries: [] }, 'empty register'],
  [{ coding_entries: [{ key: 'COD-1', gl_account: '6100-office', amount: 1200 }], accrual_entries: [] }, 'coding only, no accruals'],
  [{ coding_entries: [], accrual_entries: [{ key: 'ACC-1', gl_account: '2100-accrued', amount: 1200, traces_to: ['COD-1'] }] }, 'accrual referencing an undeclared key'],
  [{ coding_entries: [{ key: 'COD-1', gl_account: '6100-office', amount: 1200, source_document_digest: 'D1' }], accrual_entries: [{ key: 'ACC-1', gl_account: '2100-accrued', amount: 1200, traces_to: ['COD-1'] }] }, 'single fully linked pair'],
  [{ coding_entries: [{ key: 'COD-1', gl_account: '6100-office', amount: 1200, source_document_digest: 'D1' }], accrual_entries: [{ key: 'ACC-1', gl_account: '2100-accrued', amount: 1200, traces_to: ['COD-1', 'COD-1'] }] }, 'repeated reference to one coding entry'],
  [{ as_of: null, coding_entries: [{ key: 'COD-1', gl_account: '6100-office', amount: 0, source_document_digest: 'D1' }], accrual_entries: [{ key: 'ACC-1', gl_account: '2100-accrued', amount: 0, traces_to: ['COD-1'] }] }, 'null as_of and zero amounts'],
  [randValidRegister(mulberry32(0x5EED), 60, 120), '180-entry register'],
];
function checkP10_forced() {
  const rows = [];
  for (const [pp, label] of FORCED_CASES) {
    const { output_payload: op, compliance_flags } = compute(pp);
    const indeterminate = op.overall === 'INDETERMINATE';
    const plausible = indeterminate
      ? Array.isArray(op.errors) && op.errors.length === 1 && JSON.stringify(compliance_flags) === INDET_FLAG
      : (() => {
          const rc = reclassify(pp);
          return JSON.stringify(op.linked_accruals) === JSON.stringify(rc.linked)
            && JSON.stringify(op.unlinked_accruals) === JSON.stringify(rc.unlinked)
            && JSON.stringify(op.dangling_trace_refs) === JSON.stringify(rc.dangling)
            && (op.overall === 'CLOSE_READY') === (rc.unlinked.length === 0 && rc.dangling.length === 0 && op.duplicate_lineage_keys.length === 0)
            && JSON.stringify(compliance_flags) === EMPTY
            && op.errors === undefined;
        })();
    rows.push({ label, overall: op.overall, plausible });
  }
  return rows;
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_classificationPartition(),
  checkP2_classificationRecomputed(),
  checkP3_verdictContract(),
  checkP4_advisoriesNeverGate(),
  checkP5_intakeFailsClosed(),
  checkP6_duplicateKeys(),
  checkP7_deterministic(),
  checkP8_shapeClean(),
  checkP9_flagMirrorContract(),
];
const forced = checkP10_forced();
const forcedImplausible = forced.filter((f) => !f.plausible);
properties.push({ name: 'P10_forced_boundary_cases_plausible', checked: forced.length, violations: forcedImplausible.length });

const ok = summarize(KERNEL_ID, oracle, properties);
if (!ok) console.log('forced boundary rows:', JSON.stringify(forced, null, 2));
process.exit(ok ? 0 : 1);
