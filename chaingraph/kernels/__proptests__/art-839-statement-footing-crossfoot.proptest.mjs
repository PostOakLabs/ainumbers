// art-839-statement-footing-crossfoot — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:eb1354bc1eeb65cc7d09b3c3fde494eaa32fd5f9599f0a0a59ec5d9a13f35ecf
// spec: FOOTING-CROSSFOOT-NODE-1 board row (footing, cross-footing and note ties over declared integer values)
// human_sign_off: PENDING
//
// Properties: a statement built to foot always reports ties; one perturbed cell reports exactly the
// relations that touch it (independent BigInt recompute); the tolerance boundary is exact on both sides;
// line order never changes the findings; refusals and unresolved ids never yield a verdict of ties.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-839-statement-footing-crossfoot.proptest.mjs

import { compute } from '../art-839-statement-footing-crossfoot.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-839-statement-footing-crossfoot';
const N_CASES = 400;

function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

// A statement built to foot: k details, a subtotal over the first m, a total over [subtotal, rest],
// c3 = c1 + c2 on every line, a note tied to the total's c3.
function genStatement(rng) {
  const k = randInt(rng, 2, 7);
  const m = randInt(rng, 1, k - 1);
  const rows = [];
  for (let i = 0; i < k; i++) {
    const c1 = randInt(rng, -50000, 50000);
    const c2 = randInt(rng, -50000, 50000);
    rows.push({ id: 'd' + i, role: 'detail', a: [c1, c2, c1 + c2] });
  }
  const sum = (list) => [0, 1, 2].map((c) => list.reduce((s, r) => s + r.a[c], 0));
  const sub = { id: 'sub', role: 'subtotal', a: sum(rows.slice(0, m)) };
  const tot = { id: 'tot', role: 'total', a: sum([sub].concat(rows.slice(m))) };
  const all = rows.concat([sub, tot]);
  const pp = {
    columns: ['c1', 'c2', 'c3'],
    lines: all.map((r) => ({ line_id: r.id, section_id: 's', role: r.role, amounts_minor: r.a.slice() })),
    total_relations: [
      { total_line_id: 'sub', members: rows.slice(0, m).map((r) => ({ line_id: r.id, sign: 1 })) },
      { total_line_id: 'tot', members: [{ line_id: 'sub', sign: 1 }].concat(rows.slice(m).map((r) => ({ line_id: r.id, sign: 1 }))) },
    ],
    crossfoot_relations: all.map((r) => ({ line_id: r.id, member_column_ids: ['c1', 'c2'], total_column_id: 'c3' })),
    note_refs: [{ note_id: 'n1', noted_amount_minor: tot.a[2], line_id: 'tot', column_id: 'c3' }],
    tolerance_minor: 0,
    sign_convention: 'signed',
  };
  return pp;
}

const COLS = ['c1', 'c2', 'c3'];

// Independent reference: the set of break keys, recomputed with BigInt straight from the declared relations.
function referenceKeys(pp, tol) {
  const T = BigInt(tol);
  const amt = new Map(pp.lines.map((l) => [l.line_id, l.amounts_minor.map((x) => BigInt(x))]));
  const keys = new Set();
  const abs = (x) => (x < 0n ? -x : x);
  for (const r of pp.total_relations) {
    COLS.forEach((col, i) => {
      let e = 0n;
      for (const m of r.members) e += BigInt(m.sign) * amt.get(m.line_id)[i];
      if (abs(amt.get(r.total_line_id)[i] - e) > T) keys.add('F:' + r.total_line_id + ':' + col);
    });
  }
  for (const r of pp.crossfoot_relations) {
    const a = amt.get(r.line_id);
    const e = r.member_column_ids.reduce((s, c) => s + a[COLS.indexOf(c)], 0n);
    if (abs(a[COLS.indexOf(r.total_column_id)] - e) > T) keys.add('X:' + r.line_id);
  }
  for (const n of pp.note_refs) {
    if (abs(BigInt(n.noted_amount_minor) - amt.get(n.line_id)[COLS.indexOf(n.column_id)]) > T) keys.add('N:' + n.note_id);
  }
  return keys;
}

function kernelKeys(o) {
  const keys = new Set();
  for (const b of o.footing_breaks) keys.add('F:' + b.total_line_id + ':' + b.column_id);
  for (const b of o.crossfoot_breaks) keys.add('X:' + b.line_id);
  for (const b of o.note_breaks) keys.add('N:' + b.note_id);
  return keys;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function checkBuiltToFootTies(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const { output_payload: o, compliance_flags } = compute(genStatement(rng));
    if (o.verdict !== 'ties' || compliance_flags.length !== 0) violations++;
    if (o.footing_breaks.length + o.crossfoot_breaks.length + o.note_breaks.length !== 0) violations++;
  }
  return { name: 'statement_built_to_foot_always_ties', checked: N_CASES, violations };
}

function checkPerturbedCellReportsExactRelations(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genStatement(rng);
    const li = randInt(rng, 0, pp.lines.length - 1);
    const ci = randInt(rng, 0, 2);
    let delta = randInt(rng, 1, 1000);
    if (rng() < 0.5) delta = -delta;
    pp.lines[li].amounts_minor[ci] += delta;
    const { output_payload: o, compliance_flags } = compute(pp);
    const expected = referenceKeys(pp, 0);
    if (!sameSet(expected, kernelKeys(o))) violations++;
    if (expected.size === 0 || o.verdict !== 'breaks' || compliance_flags.includes('INDETERMINATE')) violations++;
  }
  return { name: 'single_perturbed_cell_reports_exactly_its_relations', checked: N_CASES, violations };
}

function checkToleranceBoundary(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genStatement(rng);
    const tol = randInt(rng, 0, 500);
    pp.tolerance_minor = tol;
    // Perturb the note only: a one-relation break whose difference is exactly the perturbation.
    const side = rng() < 0.5 ? 1 : -1;
    pp.note_refs[0].noted_amount_minor += side * tol;
    const atLimit = compute(pp).output_payload;
    pp.note_refs[0].noted_amount_minor += side;
    const over = compute(pp).output_payload;
    if (atLimit.verdict !== 'ties' || over.verdict !== 'breaks' || over.note_breaks.length !== 1) violations++;
  }
  return { name: 'tolerance_boundary_exact_on_both_sides', checked: N_CASES, violations };
}

function checkLineOrderInvariance(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genStatement(rng);
    const li = randInt(rng, 0, pp.lines.length - 1);
    pp.lines[li].amounts_minor[randInt(rng, 0, 2)] += randInt(rng, 1, 99);
    const a = compute(pp).output_payload;
    const shuffled = JSON.parse(JSON.stringify(pp));
    for (let j = shuffled.lines.length - 1; j > 0; j--) {
      const t = Math.floor(rng() * (j + 1));
      [shuffled.lines[j], shuffled.lines[t]] = [shuffled.lines[t], shuffled.lines[j]];
    }
    const b = compute(shuffled).output_payload;
    if (!sameSet(kernelKeys(a), kernelKeys(b)) || a.verdict !== b.verdict) violations++;
  }
  return { name: 'line_order_never_changes_findings', checked: N_CASES, violations };
}

function checkRefusalsAndIndeterminate(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const which = i % 5;
    const pp = genStatement(rng);
    if (which === 0) /** @type {any} */ (pp.lines[randInt(rng, 0, pp.lines.length - 1)]).label = 'x';
    else if (which === 1) pp.lines[0].line_id = 'acct' + String(randInt(rng, 10000000, 99999999));
    else if (which === 2) pp.total_relations[0].members[0].line_id = 'ghost';
    else if (which === 3) delete pp.tolerance_minor;
    else pp.note_refs[0].column_id = 'c9';
    const { output_payload: o, compliance_flags } = compute(pp);
    const refused = which <= 1;
    if (refused) {
      if (o.verdict !== 'input_refused' || !o.refusal_code || !compliance_flags.includes('INPUT_REFUSED')) violations++;
    } else if (o.verdict !== 'indeterminate' || !compliance_flags.includes('INDETERMINATE')) violations++;
    if (o.footing_breaks.length + o.crossfoot_breaks.length + o.note_breaks.length !== 0) violations++;
  }
  return { name: 'refusals_and_unresolved_ids_never_tie', checked: N_CASES, violations };
}

function checkDeterminismAndWarningsMirror(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genStatement(rng);
    if (rng() < 0.5) pp.lines[randInt(rng, 0, pp.lines.length - 1)].amounts_minor[randInt(rng, 0, 2)] += 1;
    if (rng() < 0.2) pp.lines.push({ line_id: 'memo', section_id: 's', role: 'detail', amounts_minor: [1, 1, 2] });
    const a = compute(pp);
    const b = compute(JSON.parse(JSON.stringify(pp)));
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if ((a.output_payload.warnings.length > 0) !== (a.compliance_flags.length > 0)) violations++;
  }
  return { name: 'deterministic_and_warnings_mirror_flags', checked: N_CASES, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkBuiltToFootTies(mulberry32(1)),
  checkPerturbedCellReportsExactRelations(mulberry32(2)),
  checkToleranceBoundary(mulberry32(3)),
  checkLineOrderInvariance(mulberry32(4)),
  checkRefusalsAndIndeterminate(mulberry32(5)),
  checkDeterminismAndWarningsMirror(mulberry32(6)),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
