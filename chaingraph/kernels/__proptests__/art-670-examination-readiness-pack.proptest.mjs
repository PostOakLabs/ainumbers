// art-670-examination-readiness-pack — class-K property-test FLOOR. Scaffolded by scripts/new-kernel.mjs
// (KERNEL-SCAFFOLD-1), properties authored in EXAMPACK-BUILD-1.
// kernel_digest_at_authoring: sha256:ebb4a56e64e94981a36d1f81ec90fd68bda94fa0312501ef282bed7568615cb8
// spec: EXAM-READINESS-BUILD-SPEC.md (workspace root; worked example re-pinned by SLATE-SPEC-REPIN-1)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-670-examination-readiness-pack.proptest.mjs

import { compute } from '../art-670-examination-readiness-pack.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-670-examination-readiness-pack';

// ---- synthetic-vector generators (zero PII: synthetic ids/dates only) ----
const SYNTH_IDS = ['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06'];
const STATUSES = ['delivered', 'open'];

function synthDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function synthRequests(n, rng) {
  const reqs = [];
  for (let i = 0; i < n; i++) {
    reqs.push({
      id: SYNTH_IDS[i % SYNTH_IDS.length] + (i >= SYNTH_IDS.length ? `x${i}` : ''),
      status: STATUSES[Math.floor(rng() * 2) % 2],
      due_date: synthDate(2026, 1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)),
    });
  }
  return reqs;
}

// deterministic LCG so the "random" corpus is reproducible run-to-run (seeded PRNG, §0 sanctioned)
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// P1 — ROLL-UP CONSERVATION + OVERDUE SUBSET (stages 2-3 invariants over a synthetic corpus):
// counts always sum to total; overdue_ids are a subset of the open requests; readiness_pct is the
// one-decimal delivered share; the pinned worked-example vector's hash parity is carried by the
// fixture oracle, so this property pins the ARITHMETIC, not just the one vector.
function checkRollupConservation() {
  const rng = lcg(20260903);
  let checked = 0;
  const violations = [];
  for (let t = 0; t < 300; t++) {
    const n = 1 + Math.floor(rng() * 6);
    const requests = synthRequests(n, rng);
    const as_of = synthDate(2026, 1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 28));
    const pp = { as_of, module: rng() < 0.5 ? 'sec-2026' : 'amla', requests };
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.valid === false) continue; // malformed synth dates are impossible here, but never assert on a refusal
    const op = output_payload;
    if (op.delivered + op.open !== op.total) violations.push({ case: t, expected: 'delivered+open==total', got: `${op.delivered}+${op.open}!=${op.total}` });
    const openIds = new Set(requests.filter((r) => r.status === 'open').map((r) => r.id));
    const expectedOverdue = requests.filter((r) => r.status === 'open' && r.due_date < as_of).map((r) => r.id);
    if (op.overdue_count !== expectedOverdue.length) violations.push({ case: t, expected: `overdue_count ${expectedOverdue.length}`, got: op.overdue_count });
    if (JSON.stringify(op.overdue_ids) !== JSON.stringify(expectedOverdue)) violations.push({ case: t, expected: `overdue_ids ${expectedOverdue.join(',')}`, got: op.overdue_ids.join(',') });
    if (!op.overdue_ids.every((id) => openIds.has(id))) violations.push({ case: t, expected: 'overdue_ids subset of open ids', got: op.overdue_ids.join(',') });
    const expectPct = Math.round((op.delivered / op.total) * 1000) / 10;
    if (op.readiness_pct !== expectPct) violations.push({ case: t, expected: `readiness_pct ${expectPct}`, got: op.readiness_pct });
    if (op.readiness_pct < 0 || op.readiness_pct > 100) violations.push({ case: t, expected: '0..100', got: op.readiness_pct });
    const flagOk = op.overall === 'READY' || op.overall === 'AT_RISK' || op.overall === 'NOT_READY';
    if (!flagOk) violations.push({ case: t, expected: 'overall in {READY,AT_RISK,NOT_READY}', got: op.overall });
    if (!compliance_flags.includes(`EXAMPACK_${op.overall}`)) violations.push({ case: t, expected: `flag EXAMPACK_${op.overall}`, got: compliance_flags.join(',') });
  }
  if (violations.length) console.log('  violations:', JSON.stringify(violations));
  return { name: 'P1_rollup_conservation_overdue_subset', checked, violations: violations.length };
}

// P2 — VERDICT BAND TOTALITY: every run lands on exactly one branch of the pinned mapping
// (100%+no-overdue -> READY; 0% -> NOT_READY; otherwise AT_RISK), and the overdue_requests finding
// FAILs exactly when overdue_count > 0.
function checkVerdictBands() {
  const rng = lcg(670670);
  let checked = 0;
  const violations = [];
  for (let t = 0; t < 300; t++) {
    const n = 1 + Math.floor(rng() * 5);
    const requests = synthRequests(n, rng);
    const as_of = synthDate(2026, 1 + Math.floor(rng() * 12), 1 + Math.floor(rng() * 28));
    const { output_payload } = compute({ as_of, module: 'sec-2026', requests });
    checked++;
    if (output_payload.valid === false) continue;
    const op = output_payload;
    const expected = op.readiness_pct === 100 && op.overdue_count === 0 ? 'READY' : (op.readiness_pct === 0 ? 'NOT_READY' : 'AT_RISK');
    if (op.overall !== expected) violations.push({ case: t, expected, got: op.overall });
    const f = op.findings.find((x) => x.check === 'overdue_requests');
    if (!f) violations.push({ case: t, expected: 'overdue_requests finding present', got: 'missing' });
    else {
      const expectStatus = op.overdue_count > 0 ? 'FAIL' : 'PASS';
      if (f.status !== expectStatus) violations.push({ case: t, expected: `finding ${expectStatus}`, got: f.status });
      if (f.detail !== `${op.overdue_count} of ${op.total} requests overdue`) violations.push({ case: t, expected: 'detail pinned shape', got: f.detail });
    }
  }
  if (violations.length) console.log('  violations:', JSON.stringify(violations));
  return { name: 'P2_verdict_band_totality', checked, violations: violations.length };
}

// P3 — NO-RUNTIME-CLOCK DETERMINISM (the deadline-wall lesson, mechanized): the same pp computed
// twice yields byte-identical payloads, and moving every due_date strictly LATER while holding the
// declared as_of can never increase overdue_count (monotonicity of the deadline wall).
function checkDeterminismAndDeadlineMonotonicity() {
  const rng = lcg(4862);
  let checked = 0;
  const violations = [];
  for (let t = 0; t < 150; t++) {
    const n = 1 + Math.floor(rng() * 4);
    const requests = synthRequests(n, rng);
    const as_of = synthDate(2026, 6 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 28));
    const pp = { as_of, module: 'amla', requests };
    const a = compute(pp);
    const b = compute(pp);
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations.push({ case: t, expected: 'byte-identical repeat compute', got: 'diverged' });
    const later = { ...pp, requests: requests.map((r) => ({ ...r, due_date: r.due_date < as_of ? as_of : r.due_date })) };
    const c = compute(later).output_payload;
    if (c.valid === false) continue;
    if (c.overdue_count > a.output_payload.overdue_count) violations.push({ case: t, expected: 'overdue_count non-increasing when due dates move later', got: `${a.output_payload.overdue_count} -> ${c.overdue_count}` });
  }
  if (violations.length) console.log('  violations:', JSON.stringify(violations));
  return { name: 'P3_determinism_deadline_monotonicity', checked, violations: violations.length };
}

// P4 — INVALID-DOMAIN REJECTION (refusal branches stay refused): malformed as_of, unknown module,
// empty/duplicate/invalid requests, unknown checklist item, and dangling evidence ids are ALL
// refused (valid:false, EXAMPACK_INTAKE_INVALID), never silently coerced; a refusal never carries
// stage-2 fields.
function checkInvalidDomain() {
  const cases = [
    { name: 'as_of missing', pp: { module: 'sec-2026', requests: [{ id: 'R-01', status: 'open', due_date: '2026-08-01' }] } },
    { name: 'as_not a real date', pp: { as_of: '2026-02-30', module: 'sec-2026', requests: [{ id: 'R-01', status: 'open', due_date: '2026-08-01' }] } },
    { name: 'module unknown', pp: { as_of: '2026-09-03', module: 'finra-2027', requests: [{ id: 'R-01', status: 'open', due_date: '2026-08-01' }] } },
    { name: 'requests empty', pp: { as_of: '2026-09-03', module: 'sec-2026', requests: [] } },
    { name: 'request status invalid', pp: { as_of: '2026-09-03', module: 'sec-2026', requests: [{ id: 'R-01', status: 'pending', due_date: '2026-08-01' }] } },
    { name: 'duplicate request id', pp: { as_of: '2026-09-03', module: 'sec-2026', requests: [{ id: 'R-01', status: 'open', due_date: '2026-08-01' }, { id: 'R-01', status: 'open', due_date: '2026-08-02' }] } },
    { name: 'unknown checklist item', pp: { as_of: '2026-09-03', module: 'sec-2026', requests: [{ id: 'R-01', status: 'open', due_date: '2026-08-01' }], module_checklist: [{ item: 'crypto_custody', status: 'PASS' }] } },
    { name: 'checklist status invalid', pp: { as_of: '2026-09-03', module: 'amla', requests: [{ id: 'R-01', status: 'open', due_date: '2026-08-01' }], module_checklist: [{ item: 'six_member_state_eligibility', status: 'MAYBE' }] } },
    { name: 'evidence id dangling', pp: { as_of: '2026-09-03', module: 'sec-2026', requests: [{ id: 'R-01', status: 'delivered', due_date: '2026-08-01' }], evidence_request_ids: ['R-99'] } },
    { name: 'empty input object', pp: {} },
  ];
  let checked = 0;
  const violations = [];
  for (const c of cases) {
    checked++;
    const { output_payload, compliance_flags } = compute(c.pp);
    if (output_payload.valid !== false) violations.push({ case: c.name, expected: 'valid:false', got: 'accepted' });
    if (!Array.isArray(output_payload.errors) || output_payload.errors.length === 0) violations.push({ case: c.name, expected: 'non-empty errors', got: 'none' });
    if (!compliance_flags.includes('EXAMPACK_INTAKE_INVALID')) violations.push({ case: c.name, expected: 'EXAMPACK_INTAKE_INVALID flag', got: compliance_flags.join(',') });
    if (output_payload.total !== undefined) violations.push({ case: c.name, expected: 'no stage-2 fields on refusal', got: 'total present' });
  }
  if (violations.length) console.log('  violations:', JSON.stringify(violations));
  return { name: 'P4_invalid_domain_rejection', checked, violations: violations.length };
}

// P5 — ANNEX LATTICE + AMLA PRE-EFFECTIVE MARKER (stage 4): annex_verdict is GAPS iff any FAIL,
// INCOMPLETE iff no FAIL but any NOT_ASSESSED/missing, else COMPLETE; unassessed module items are
// echoed as NOT_ASSESSED; the amla pre_effective boolean flips exactly at the first-selection
// conclusion date constant, on either side.
function checkAnnexLattice() {
  const base = (over) => ({ as_of: over, module: 'amla', requests: [{ id: 'R-01', status: 'delivered', due_date: '2026-01-01' }] });
  const items = ['six_member_state_eligibility', 'high_risk_selection_evidence', 'supervision_commencement_tracking'];
  const mk = (statuses) => statuses.map((status, i) => ({ item: items[i], status }));
  const cases = [
    { pp: { ...base('2028-06-01'), module_checklist: mk(['PASS', 'PASS', 'PASS']) }, expect: 'COMPLETE', pre: false },
    { pp: { ...base('2028-06-01'), module_checklist: mk(['PASS', 'FAIL', 'PASS']) }, expect: 'GAPS', pre: false },
    { pp: { ...base('2028-06-01'), module_checklist: mk(['PASS', 'NOT_ASSESSED', 'PASS']) }, expect: 'INCOMPLETE', pre: false },
    { pp: { ...base('2028-06-01'), module_checklist: mk(['FAIL', 'NOT_ASSESSED', 'FAIL']) }, expect: 'GAPS', pre: false },
    { pp: { ...base('2028-06-01'), module_checklist: [mk(['PASS', 'PASS', 'PASS'])[0]] }, expect: 'INCOMPLETE', pre: false },
    { pp: { ...base('2027-12-31'), module_checklist: mk(['PASS', 'PASS', 'PASS']) }, expect: 'COMPLETE', pre: true },
    { pp: { ...base('2028-01-01'), module_checklist: mk(['PASS', 'PASS', 'PASS']) }, expect: 'COMPLETE', pre: false },
  ];
  let checked = 0;
  const violations = [];
  for (const c of cases) {
    checked++;
    const op = compute(c.pp).output_payload;
    if (op.module_annex === undefined) { violations.push({ case: checked, expected: 'module_annex present', got: 'absent' }); continue; }
    if (op.module_annex.annex_verdict !== c.expect) violations.push({ case: checked, expected: c.expect, got: op.module_annex.annex_verdict });
    if (op.module_annex.pre_effective !== c.pre) violations.push({ case: checked, expected: `pre_effective ${c.pre}`, got: op.module_annex.pre_effective });
    const echoed = op.module_annex.items.map((i) => i.status);
    if (echoed.some((st) => !['PASS', 'FAIL', 'NOT_ASSESSED'].includes(st))) violations.push({ case: checked, expected: 'echoed statuses in enum', got: echoed.join(',') });
  }
  // missing-item case: the two unassessed items must come back NOT_ASSESSED
  const partial = compute(cases[4].pp).output_payload.module_annex.items;
  if (partial.filter((i) => i.status === 'NOT_ASSESSED').length !== 2) violations.push({ case: 'partial', expected: '2x NOT_ASSESSED', got: partial.map((i) => i.status).join(',') });
  if (violations.length) console.log('  violations:', JSON.stringify(violations));
  return { name: 'P5_annex_lattice_amla_pre_effective', checked, violations: violations.length };
}

// P6 — EVIDENCE HANDOFF COMPOSITION (stage 5): binder pointer set is the fixed T574-T576 composition
// (never rebuilt, never a second pointer set); handover eligibility follows delivery/overdue status
// exactly, and unknown ids can never reach it (refused in intake).
function checkEvidenceHandoff() {
  const pp = {
    as_of: '2026-09-03', module: 'sec-2026',
    requests: [
      { id: 'R-01', status: 'delivered', due_date: '2026-09-01' },
      { id: 'R-02', status: 'open', due_date: '2026-09-10' },
      { id: 'R-03', status: 'open', due_date: '2026-08-30' },
    ],
    evidence_request_ids: ['R-01', 'R-02', 'R-03'],
  };
  const op = compute(pp).output_payload;
  const eh = op.evidence_handoff;
  const expectPaths = ['tools/574-casefile-binder-composer.html', 'tools/575-casefile-binder-verifier.html', 'tools/576-evidence-handover-bundle.html'];
  const violations = [];
  let checked = 1;
  if (!eh || eh.mode !== 'composition') violations.push({ case: 1, expected: 'mode composition', got: eh && eh.mode });
  if (!eh || JSON.stringify(eh.binder_tools.map((t) => t.path)) !== JSON.stringify(expectPaths)) violations.push({ case: 1, expected: expectPaths.join(','), got: eh && eh.binder_tools.map((t) => t.path).join(',') });
  if (!eh || !eh.binder_tools.every((t) => typeof t.tool_id === 'string' && typeof t.role === 'string')) violations.push({ case: 1, expected: 'pointer shape {tool_id,path,role}', got: 'malformed' });
  const byId = Object.fromEntries(eh.per_request.map((p) => [p.request_id, p.handover]));
  if (byId['R-01'] !== 'ELIGIBLE') violations.push({ case: 1, expected: 'R-01 ELIGIBLE', got: byId['R-01'] });
  if (byId['R-02'] !== 'BLOCKED_NOT_DELIVERED') violations.push({ case: 1, expected: 'R-02 BLOCKED_NOT_DELIVERED', got: byId['R-02'] });
  if (byId['R-03'] !== 'BLOCKED_OVERDUE') violations.push({ case: 1, expected: 'R-03 BLOCKED_OVERDUE', got: byId['R-03'] });
  // omitted when input absent
  const op2 = compute({ as_of: '2026-09-03', module: 'sec-2026', requests: pp.requests }).output_payload;
  checked++;
  if (op2.evidence_handoff !== undefined) violations.push({ case: 2, expected: 'no evidence_handoff key when input absent', got: 'present' });
  if (violations.length) console.log('  violations:', JSON.stringify(violations));
  return { name: 'P6_evidence_handoff_composition', checked, violations: violations.length };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkRollupConservation(),
  checkVerdictBands(),
  checkDeterminismAndDeadlineMonotonicity(),
  checkInvalidDomain(),
  checkAnnexLattice(),
  checkEvidenceHandoff(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
