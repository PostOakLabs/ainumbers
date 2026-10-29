// 784-cbr-data-return-validator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:1b635db680bdd9e1d6e211a2f0246ef54e0cbfafab2824296906135790199dd3
// spec: illustrative CBR aggregate data return template (CBR-DATA-RETURN-VALIDATOR-1); metric
//       definitions pinned from the CPMI correspondent banking chartpack, the PIFS CBR Project
//       2025 Annual Report (Rec 3 data collection scope) and FATF revised R.16 (June 2025).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/784-cbr-data-return-validator.proptest.mjs

import { compute } from '../784-cbr-data-return-validator.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '784-cbr-data-return-validator';

// Longest enumerated input value the template admits ('other_non_bank', 15 chars). The
// aggregate-only contract says the output never echoes any input string longer than this.
const LONGEST_ENUM_VALUE = 'other_non_bank'.length;

function collectStrings(node, out) {
  if (typeof node === 'string') { out.push(node); return; }
  if (Array.isArray(node)) { for (const v of node) collectStrings(v, out); return; }
  if (node !== null && typeof node === 'object') { for (const k of Object.keys(node)) collectStrings(node[k], out); }
}

function randomInt(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }

// A well-formed, internally consistent random return (values chosen so corridor sums are exact).
function randomReturn(rand, junk) {
  const currencies = [];
  const nCur = randomInt(rand, 1, 3);
  const codes = ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'FJD'];
  for (let i = 0; i < nCur; i++) {
    const opening = randomInt(rand, 1, 8);
    const opened = randomInt(rand, 0, 3);
    const terminated = randomInt(rand, 0, Math.min(3, opening + opened));
    const active = opening + opened - terminated;
    const corridors = [];
    const nCor = randomInt(rand, 1, 4);
    const countries = ['US', 'GB', 'DE', 'AU', 'NZ', 'SG', 'FJ'];
    let obc = 0, ibc = 0, obv = 0, ibv = 0;
    for (let k = 0; k < nCor; k++) {
      const c1 = randomInt(rand, 10, 400), c2 = randomInt(rand, 10, 400);
      const v1 = randomInt(rand, 1, 90) * 10000, v2 = randomInt(rand, 1, 90) * 10000;
      obc += c1; ibc += c2; obv += v1; ibv += v2;
      corridors.push({ country: countries[k % countries.length], outbound_count: c1, inbound_count: c2, outbound_value: v1, inbound_value: v2 });
    }
    currencies.push({
      currency: codes[i % codes.length],
      opening_correspondents: opening,
      active_correspondents: active,
      opened,
      terminated_restricted: terminated,
      corridors,
      totals: { outbound_count: obc, inbound_count: ibc, outbound_value: obv, inbound_value: ibv },
    });
  }
  const pp = {
    profile: rand() < 0.5 ? 'generic' : 'pacific',
    institution_type: ['bank', 'mto', 'other_non_bank'][randomInt(rand, 0, 2)],
    institution_code: 'FI-' + String(randomInt(rand, 1, 999)).padStart(3, '0'),
    period: { start: '2026-01-01', end: '2026-03-31' },
    currencies,
  };
  if (junk) pp[junk.key] = junk.value;
  return pp;
}

// P1 — aggregate-only echo discipline: for ANY input (including free-text junk leaves), the
// serialized output never contains an input string longer than the longest enumeration value.
function checkNoEcho() {
  const rand = mulberry32(0xC0FFEE);
  const junkNames = [
    'First Pacific Savings Bank Ltd',
    'Correspondent: Banque Regionale du Pacifique SA 1962',
    'prepared by the head of correspondent banking operations',
    'SWIFT BIC ABCDFIJTXXX account 1234567890',
  ];
  let checked = 0, violations = 0;
  const placements = [null, { key: 'preparer_notes' }, { key: 'correspondent_name' }, { key: 'internal_comment' }];
  for (let i = 0; i < 240; i++) {
    const junk = placements[i % placements.length]
      ? { key: placements[i % placements.length].key, value: junkNames[i % junkNames.length] }
      : null;
    const pp = randomReturn(rand, junk);
    const out = compute(pp);
    const serialized = JSON.stringify(out);
    const strings = [];
    collectStrings(pp, strings);
    for (const s of strings) {
      if (s.length > LONGEST_ENUM_VALUE) {
        checked++;
        if (serialized.includes(s)) { violations++; break; }
      }
    }
    // every junk-carrying input must be refused, never merely violated
    if (junk) {
      checked++;
      if (!out.output_payload.refused || out.output_payload.refused.path !== junk.key) violations++;
    }
  }
  return { name: 'aggregate-only-echo-discipline', checked, violations };
}

// P2 — roll-forward identity iff: COUNT-ROLLFORWARD fires exactly when opening+opened-terminated
// differs from the stated closing count (on otherwise well-formed blocks).
function checkRollforward() {
  const rand = mulberry32(0xBEEF01);
  let checked = 0, violations = 0;
  for (let i = 0; i < 240; i++) {
    const pp = randomReturn(rand, null);
    const cur = pp.currencies[0];
    if (i % 2 === 0) cur.active_correspondents = randomInt(rand, 0, 12); // break the identity
    const out = compute(pp).output_payload;
    const identityHolds = cur.opening_correspondents + cur.opened - cur.terminated_restricted === cur.active_correspondents;
    const fired = out.violations.some((v) => v.rule_id === 'COUNT-ROLLFORWARD' && v.path === 'currencies[0].active_correspondents');
    checked++;
    if (fired === identityHolds) violations++;
  }
  return { name: 'rollforward-iff', checked, violations };
}

// P3 — concentration bounds: HHI reported in [0,1]; HHI flag fires iff unrounded HHI > threshold.
function checkHhiBounds() {
  const rand = mulberry32(0xF00D02);
  let checked = 0, violations = 0;
  for (let i = 0; i < 240; i++) {
    const pp = randomReturn(rand, null);
    const cur = pp.currencies[0];
    const out = compute(pp).output_payload;
    const total = cur.corridors.reduce((a, k) => a + k.outbound_value, 0);
    let hhi = 0;
    for (const k of cur.corridors) { const s = k.outbound_value / total; hhi += s * s; }
    const flag = out.flags.find((f) => f.flag_id === 'CONCENTRATION_HHI' && f.path === 'currencies[0]');
    checked += 2;
    if (flag) {
      if (!(flag.hhi > 0.5 && flag.hhi <= 1)) violations++;
      if (!(hhi > 0.5)) violations++;
    } else if (hhi > 0.5) violations++;
  }
  return { name: 'hhi-bounds', checked, violations };
}

// P4 — determinism + sorted output: same pp twice gives deep-equal output; violations and flags
// are sorted by (path/rule_id) and (flag_id/path) respectively.
function checkDeterminismAndOrder() {
  const rand = mulberry32(0x5EED03);
  let checked = 0, violations = 0;
  for (let i = 0; i < 120; i++) {
    const pp = randomReturn(rand, i % 4 === 0 ? { key: 'junk_field', value: 'Some Treasury Team Ltd branch remark' } : null);
    const a = compute(pp), b = compute(pp);
    checked += 3;
    if (!deepEqual(a, b)) violations++;
    const vs = b.output_payload.violations;
    for (let j = 1; j < vs.length; j++) {
      const prev = vs[j - 1], cur = vs[j];
      if (prev.path > cur.path || (prev.path === cur.path && prev.rule_id > cur.rule_id)) { violations++; break; }
    }
    const fs = b.output_payload.flags;
    for (let j = 1; j < fs.length; j++) {
      const prev = fs[j - 1], cur = fs[j];
      if (prev.flag_id > cur.flag_id || (prev.flag_id === cur.flag_id && prev.path > cur.path)) { violations++; break; }
    }
  }
  return { name: 'determinism-and-sorted-output', checked, violations };
}

// P5 — readiness percentages and band are exact: the kernel's rounded shares must equal
// the independently computed round(1000*x/n)/10 and the band must follow the 85/70, 60/40 gates.
function checkReadinessExact() {
  const rand = mulberry32(0x0B5EED04);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const n = randomInt(rand, 10, 900);
    const fs = randomInt(rand, 0, n);
    const hy = randomInt(rand, 0, n - fs);
    const un = n - fs - hy;
    const leiLinted = randomInt(rand, 0, n);
    const leiValid = randomInt(rand, 0, leiLinted);
    const pp = {
      profile: 'generic', institution_type: 'bank', institution_code: 'FI-002',
      period: { start: '2026-01-01', end: '2026-03-31' },
      currencies: [{
        currency: 'EUR', opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
        corridors: [{ country: 'DE', outbound_count: 10, inbound_count: 10, outbound_value: 100000, inbound_value: 100000 }]
      }],
      message_quality: { messages_linted: n, fully_structured: fs, hybrid: hy, unstructured: un, lei_linted: leiLinted, lei_valid: leiValid }
    };
    const r = compute(pp).output_payload.readiness;
    const pctInd = (part, whole) => (whole <= 0 ? 0 : Math.round(1000 * part / whole) / 10);
    const fsPct = pctInd(fs, n), leiPct = pctInd(leiValid, leiLinted);
    let band = 'LOW';
    if (fsPct >= 85 && leiPct >= 70) band = 'HIGH';
    else if (fsPct >= 60 && leiPct >= 40) band = 'MEDIUM';
    checked += 7;
    if (r.status !== 'supplied') { violations++; continue; }
    if (r.fully_structured_pct !== fsPct) violations++;
    if (r.hybrid_pct !== pctInd(hy, n)) violations++;
    if (r.unstructured_pct !== pctInd(un, n)) violations++;
    if (r.valid_lei_pct !== leiPct) violations++;
    if (r.lei_coverage_pct !== pctInd(leiLinted, n)) violations++;
    if (r.band !== band) violations++;
  }
  return { name: 'readiness-exact-percentages-and-band', checked, violations };
}

// P6 — corridor-sum value tolerance boundary: with a single corridor, the violation fires
// exactly when |corridor - stated| exceeds max(1, 0.5 percent of stated). Both sides pinned.
function checkToleranceBoundary() {
  const rand = mulberry32(0x707AB05);
  let checked = 0, violations = 0;
  for (let i = 0; i < 120; i++) {
    const T = 200 * randomInt(rand, 500, 5000); // multiple of 200 so T/200 is an exact integer tolerance
    const side = i % 2 === 0 ? 0 : 1;
    const offset = T / 200 + side; // exactly at tolerance (no violation), then +1 beyond it
    const corridorValue = T - offset;
    const pp = {
      profile: 'generic', institution_type: 'bank', institution_code: 'FI-004',
      period: { start: '2026-01-01', end: '2026-01-31' },
      currencies: [{
        currency: 'EUR', opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
        corridors: [{ country: 'DE', outbound_count: 10, inbound_count: 10, outbound_value: corridorValue, inbound_value: T }],
        totals: { outbound_count: 10, inbound_count: 10, outbound_value: T, inbound_value: T }
      }]
    };
    const out = compute(pp).output_payload;
    const fired = out.violations.some((v) => v.rule_id === 'CORRIDOR-SUM-VALUE' && v.path === 'currencies[0].totals.outbound_value');
    checked++;
    if (fired === (side === 0)) violations++; // side 0 = at tolerance (must NOT fire), side 1 = beyond (must fire)
  }
  return { name: 'corridor-sum-value-tolerance-boundary', checked, violations };
}

// P7 — concentration thresholds are strict and exact: 80/20 shares give top 0.8 (no top flag,
// threshold not strictly crossed) with HHI 0.68 (flagged); 50/50 gives HHI exactly 0.5 (no flag);
// 81/19 gives top 0.81 and HHI 0.6922 exactly.
function checkConcentrationExact() {
  const mk = (v1, v2) => ({
    profile: 'generic', institution_type: 'bank', institution_code: 'FI-005',
    period: { start: '2026-02-01', end: '2026-02-28' },
    currencies: [{
      currency: 'EUR', opening_correspondents: 3, active_correspondents: 3, opened: 0, terminated_restricted: 0,
      corridors: [
        { country: 'DE', outbound_count: 10, inbound_count: 10, outbound_value: v1, inbound_value: v1 },
        { country: 'FR', outbound_count: 10, inbound_count: 10, outbound_value: v2, inbound_value: v2 }
      ]
    }]
  });
  let checked = 0, violationsCount = 0;
  {
    const out = compute(mk(800000, 200000)).output_payload;
    checked += 3;
    if (out.flags.some((f) => f.flag_id === 'CONCENTRATION_TOP_CORRIDOR')) violationsCount++;
    const hhi = out.flags.find((f) => f.flag_id === 'CONCENTRATION_HHI');
    if (!hhi || hhi.hhi !== 0.68) violationsCount++;
    if (!out.flags.some((f) => f.flag_id === 'CONCENTRATION_HHI' && f.currency === 'EUR')) violationsCount++;
  }
  {
    const out = compute(mk(500000, 500000)).output_payload;
    checked += 2;
    if (out.flags.some((f) => f.flag_id === 'CONCENTRATION_HHI')) violationsCount++; // 0.5 exactly: strict > means no flag
    if (out.flags.some((f) => f.flag_id === 'CONCENTRATION_TOP_CORRIDOR')) violationsCount++;
  }
  {
    const out = compute(mk(810000, 190000)).output_payload;
    checked += 2;
    const top = out.flags.find((f) => f.flag_id === 'CONCENTRATION_TOP_CORRIDOR');
    if (!top || top.top_corridor_share !== 0.81) violationsCount++;
    const hhi = out.flags.find((f) => f.flag_id === 'CONCENTRATION_HHI');
    if (!hhi || hhi.hhi !== 0.6922) violationsCount++;
  }
  return { name: 'concentration-thresholds-strict-and-exact', checked, violations: violationsCount };
}

// P8 — period sanity boundaries and the R4 null-equals-absent contract.
function checkPeriodAndR4Null() {
  const base = {
    profile: 'generic', institution_type: 'bank', institution_code: 'FI-006',
    currencies: [{
      currency: 'EUR', opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
      corridors: [{ country: 'DE', outbound_count: 10, inbound_count: 10, outbound_value: 100000, inbound_value: 100000 }]
    }]
  };
  const mk = (start, end) => Object.assign(JSON.parse(JSON.stringify(base)), { period: { start, end } });
  let checked = 0, violationsCount = 0;
  const fires = (pp) => compute(pp).output_payload.violations.some((v) => v.rule_id === 'PERIOD-SANITY');
  checked += 6;
  if (fires(mk('2026-01-01', '2027-02-04'))) violationsCount++; // 399 days: passes (no violation expected)
  if (fires(mk('2026-01-01', '2027-02-05'))) violationsCount++; // 400 days: passes
  if (!fires(mk('2026-01-01', '2027-02-06'))) violationsCount++; // 401 days: fails
  if (!fires(mk('2026-03-31', '2026-03-30'))) violationsCount++; // end before start
  if (!fires(mk('2026-02-30', '2026-03-30'))) violationsCount++; // invalid calendar date
  if (!fires(mk('2010-01-01', '2010-03-30'))) violationsCount++; // below the 2011 floor
  // R4: explicit null message_quality must answer exactly like absent
  checked += 2;
  const withNull = Object.assign(JSON.parse(JSON.stringify(base)), { period: { start: '2026-01-01', end: '2026-03-31' }, message_quality: null });
  const withAbsent = Object.assign(JSON.parse(JSON.stringify(base)), { period: { start: '2026-01-01', end: '2026-03-31' } });
  const a = compute(withNull), b = compute(withAbsent);
  if (JSON.stringify(a) !== JSON.stringify(b)) violationsCount++;
  if (a.output_payload.readiness.status !== 'not_supplied') violationsCount++;
  return { name: 'period-sanity-boundaries-and-null-equals-absent', checked, violations: violationsCount };
}

// P9 — structural rules: duplicate currency and country, negative and non-integer counts,
// key-currency zero-correspondent violation, pacific missing-key-currency requirement.
function checkStructuralRules() {
  let checked = 0, violationsCount = 0;
  const base = (currencies, profile) => ({
    profile: profile || 'generic', institution_type: 'bank', institution_code: 'FI-008',
    period: { start: '2026-01-01', end: '2026-03-31' },
    currencies
  });
  const cur = (over) => Object.assign({
    currency: 'EUR', opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
    corridors: [{ country: 'DE', outbound_count: 10, inbound_count: 10, outbound_value: 100000, inbound_value: 100000 }]
  }, over);
  const has = (pp, rule, path) => compute(pp).output_payload.violations.some((v) => v.rule_id === rule && (!path || v.path === path));
  checked += 6;
  if (!has(base([cur({}), cur({})]), 'CURRENCY-DUPLICATE')) violationsCount++;
  if (!has(base([cur({ corridors: [{ country: 'DE', outbound_count: 1, inbound_count: 1, outbound_value: 1, inbound_value: 1 }, { country: 'DE', outbound_count: 1, inbound_count: 1, outbound_value: 1, inbound_value: 1 }] })]), 'CORRIDOR-DUPLICATE')) violationsCount++;
  if (!has(base([cur({ active_correspondents: -1 })]), 'REQ-NUMERIC-FIELD', 'currencies[0].active_correspondents')) violationsCount++;
  if (!has(base([cur({ opened: 1.5 })]), 'REQ-NUMERIC-FIELD', 'currencies[0].opened')) violationsCount++;
  if (!has(base([cur({ currency: 'USD', active_correspondents: 0, opening_correspondents: 0 })]), 'KEY-CURRENCY-NO-CORRESPONDENT')) violationsCount++;
  if (!has(base([cur({ currency: 'EUR' })], 'pacific'), 'REQ-KEY-CURRENCY')) violationsCount++;
  return { name: 'structural-rules-duplicates-and-key-currency', checked, violations: violationsCount };
}

// P10 — output constants are exact: profile_definition mirrors the profile's key-currency sets
// and every threshold literal; computed.period_days and currencies_reported are exact. Kills
// literal mutants anywhere in the emitted configuration block.
function checkOutputConstantsExact() {
  let checked = 0, violationsCount = 0;
  const mk = (profile, currencies, start, end) => ({
    profile, institution_type: 'bank', institution_code: 'FI-010',
    period: { start, end },
    currencies
  });
  const one = (cur) => [{
    currency: cur, opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
    corridors: [{ country: 'DE', outbound_count: 10, inbound_count: 10, outbound_value: 100000, inbound_value: 100000 }]
  }];
  {
    const out = compute(mk('generic', one('EUR'), '2026-01-01', '2026-03-31')).output_payload;
    checked += 10;
    const pd = out.profile_definition;
    if (JSON.stringify(pd.key_currencies) !== JSON.stringify(['USD','EUR','GBP'])) violationsCount++;
    if (pd.required_key_currencies.length !== 0) violationsCount++;
    if (pd.top_share_threshold !== 0.8) violationsCount++;
    if (pd.hhi_threshold !== 0.5) violationsCount++;
    if (pd.value_tolerance_pct !== 0.005) violationsCount++;
    if (pd.count_tolerance !== 0) violationsCount++;
    if (pd.max_period_days !== 400) violationsCount++;
    if (out.computed.period_days !== 89) violationsCount++;
    if (out.computed.currencies_reported !== 1) violationsCount++;
    if (out.template_version !== 'CBR-DATA-RETURN-ILLUSTRATIVE-V1') violationsCount++;
  }
  {
    const out = compute(mk('pacific', one('AUD'), '2026-01-01', '2026-12-31')).output_payload;
    checked += 3;
    if (JSON.stringify(out.profile_definition.key_currencies) !== JSON.stringify(['USD','AUD','NZD'])) violationsCount++;
    if (JSON.stringify(out.profile_definition.required_key_currencies) !== JSON.stringify(['USD','AUD','NZD'])) violationsCount++;
    if (out.computed.period_days !== 364) violationsCount++;
  }
  {
    // flags carry the threshold literals too
    const pp = mk('generic', [{ currency: 'EUR', opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
      corridors: [{ country: 'DE', outbound_count: 10, inbound_count: 10, outbound_value: 900000, inbound_value: 900000 }] }], '2026-01-01', '2026-01-31');
    const out = compute(pp).output_payload;
    checked += 2;
    if (!out.flags.some((f) => f.flag_id === 'CONCENTRATION_TOP_CORRIDOR' && f.threshold === 0.8)) violationsCount++;
    if (!out.flags.some((f) => f.flag_id === 'CONCENTRATION_HHI' && f.threshold === 0.5)) violationsCount++;
  }
  return { name: 'output-constants-exact', checked, violations: violationsCount };
}

// P11 — count-sum boundary is exact (tolerance 0: any off-by-one fires) and concentration is
// skipped when total outbound value is 0; lei_linted 0 yields valid_lei_pct 0 without throwing.
function checkCountBoundaryAndEdges() {
  let checked = 0, violationsCount = 0;
  const mk = (obc, stated, values) => ({
    profile: 'generic', institution_type: 'bank', institution_code: 'FI-011',
    period: { start: '2026-05-01', end: '2026-05-31' },
    currencies: [{
      currency: 'EUR', opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
      corridors: [{ country: 'DE', outbound_count: obc, inbound_count: 5, outbound_value: values, inbound_value: values }],
      totals: { outbound_count: stated, inbound_count: 5, outbound_value: values, inbound_value: values }
    }]
  });
  checked += 2;
  if (compute(mk(100, 100, 50000)).output_payload.violations.some((v) => v.rule_id === 'CORRIDOR-SUM-COUNT')) violationsCount++;
  if (!compute(mk(100, 101, 50000)).output_payload.violations.some((v) => v.rule_id === 'CORRIDOR-SUM-COUNT' && v.path === 'currencies[0].totals.outbound_count')) violationsCount++;
  // zero total outbound value: no concentration flags, no throw
  checked += 2;
  const zero = compute(mk(10, 10, 0)).output_payload;
  if (zero.flags.length !== 0) violationsCount++;
  if (zero.violations.length !== 0) violationsCount++;
  // lei_linted 0: valid_lei_pct is 0, band LOW
  checked += 2;
  const mq = compute(Object.assign(mk(10, 10, 50000), { message_quality: { messages_linted: 50, fully_structured: 50, hybrid: 0, unstructured: 0, lei_linted: 0, lei_valid: 0 } })).output_payload.readiness;
  if (mq.valid_lei_pct !== 0) violationsCount++;
  if (mq.band !== 'LOW') violationsCount++;
  return { name: 'count-boundary-and-edges', checked, violations: violationsCount };
}

// P12 — malformed-input matrix: each variant breaks exactly one thing and the violations
// array must deep-equal the expected {path, rule_id, source} list. Kills guard, comparison,
// path-string and message-string mutants across every validation branch.
function checkMalformedMatrix() {
  let checked = 0, violationsCount = 0;
  const base = () => ({
    profile: 'generic', institution_type: 'bank', institution_code: 'FI-020',
    period: { start: '2026-01-01', end: '2026-03-31' },
    currencies: [{
      currency: 'EUR', opening_correspondents: 2, active_correspondents: 2, opened: 0, terminated_restricted: 0,
      corridors: [
        { country: 'DE', outbound_count: 10, inbound_count: 8, outbound_value: 100000, inbound_value: 90000 },
        { country: 'FR', outbound_count: 5, inbound_count: 4, outbound_value: 50000, inbound_value: 40000 }
      ],
      totals: { outbound_count: 15, inbound_count: 12, outbound_value: 150000, inbound_value: 130000 }
    }]
  });
  const cases = [];
  const add = (pp, expected) => cases.push({ pp, expected });
  {
    const c = base(); delete c.profile; add(c, [{ path: 'profile', rule_id: 'REQ-PROFILE', source: 'required_fields' }]);
  }
  {
    const c = base(); c.institution_type = 'bsu'; add(c, { refusePath: 'institution_type' }); // string walk refusal
  }
  {
    const c = base(); c.institution_code = 'FI-1'; add(c, { refusePath: 'institution_code' }); // refusal by pattern
  }
  {
    const c = base(); delete c.period; add(c, [{ path: 'period', rule_id: 'REQ-PERIOD', source: 'required_fields' }]);
  }
  {
    const c = base(); c.period = { start: '2026-03-31', end: '2026-01-01' };
    add(c, [{ path: 'period.end', rule_id: 'PERIOD-SANITY', source: 'period' }]);
  }
  {
    const c = base(); c.currencies = []; add(c, [{ path: 'currencies', rule_id: 'REQ-CURRENCY-BLOCK', source: 'required_fields' }]);
  }
  {
    const c = base(); delete c.currencies[0].opened; add(c, [{ path: 'currencies[0].opened', rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' }]);
  }
  {
    const c = base(); c.currencies[0].corridors = []; add(c, [{ path: 'currencies[0].corridors', rule_id: 'REQ-CORRIDORS', source: 'required_fields' }]);
  }
  {
    const c = base(); delete c.currencies[0].corridors[0].outbound_value;
    add(c, [
      { path: 'currencies[0].corridors[0].outbound_value', rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' }
    ]);
  }
  {
    const c = base(); c.currencies[0].active_correspondents = 5;
    add(c, [{ path: 'currencies[0].active_correspondents', rule_id: 'COUNT-ROLLFORWARD', source: 'internal_consistency' }]);
  }
  {
    const c = base(); c.currencies[0].totals.outbound_count = 16;
    add(c, [{ path: 'currencies[0].totals.outbound_count', rule_id: 'CORRIDOR-SUM-COUNT', source: 'internal_consistency' }]);
  }
  {
    const c = base(); c.currencies[0].totals.outbound_value = 200000;
    add(c, [{ path: 'currencies[0].totals.outbound_value', rule_id: 'CORRIDOR-SUM-VALUE', source: 'internal_consistency' }]);
  }
  {
    const c = base(); c.currencies.push(JSON.parse(JSON.stringify(c.currencies[0])));
    add(c, [{ path: 'currencies[1].currency', rule_id: 'CURRENCY-DUPLICATE', source: 'internal_consistency' }]);
  }
  {
    const c = base(); c.currencies[0].corridors[1].country = 'DE';
    add(c, [{ path: 'currencies[0].corridors[1].country', rule_id: 'CORRIDOR-DUPLICATE', source: 'internal_consistency' }]);
  }
  {
    const c = base(); c.message_quality = { messages_linted: 20, fully_structured: 10, hybrid: 5, unstructured: 4, lei_linted: 10, lei_valid: 5 };
    add(c, [{ path: 'message_quality', rule_id: 'MESSAGE-QUALITY-SUM', source: 'message_quality' }]);
  }
  {
    const c = base(); c.message_quality = { messages_linted: 20, fully_structured: 10, hybrid: 5, unstructured: 5, lei_linted: 10, lei_valid: 11 };
    add(c, [{ path: 'message_quality.lei_valid', rule_id: 'MESSAGE-QUALITY-SUM', source: 'message_quality' }]);
  }
  {
    const c = base(); c.prepared_by_treasury = true; add(c, [{ path: 'prepared_by_treasury', rule_id: 'TYPE_DISCIPLINE', source: 'type' }]);
  }
  {
    const c = base(); c.profile = 'pacific'; c.currencies[0].currency = 'EUR';
    add(c, [{ path: 'currencies', rule_id: 'REQ-KEY-CURRENCY', source: 'required_fields' }]);
  }
  {
    const c = base(); c.currencies[0].currency = 'USD'; c.currencies[0].opening_correspondents = 0; c.currencies[0].active_correspondents = 0;
    add(c, [{ path: 'currencies[0].active_correspondents', rule_id: 'KEY-CURRENCY-NO-CORRESPONDENT', source: 'key_currency_watch' }]);
  }
  for (const { pp, expected } of cases) {
    checked++;
    const out = compute(pp).output_payload;
    if (expected === null) {
      if (!out.refused) violationsCount++;
      continue;
    }
    if (expected.refusePath) {
      if (!out.refused || out.refused.path !== expected.refusePath) violationsCount++;
      continue;
    }
    if (JSON.stringify(out.violations) !== JSON.stringify(expected)) {
      violationsCount++;
    }
  }
  return { name: 'malformed-input-exact-violation-matrix', checked, violations: violationsCount };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkNoEcho(),
  checkRollforward(),
  checkHhiBounds(),
  checkDeterminismAndOrder(),
  checkReadinessExact(),
  checkToleranceBoundary(),
  checkConcentrationExact(),
  checkPeriodAndR4Null(),
  checkStructuralRules(),
  checkOutputConstantsExact(),
  checkCountBoundaryAndEdges(),
  checkMalformedMatrix(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — aggregate-only CBR data return validator.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
