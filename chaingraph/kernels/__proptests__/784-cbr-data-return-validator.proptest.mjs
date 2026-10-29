// 784-cbr-data-return-validator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:4e11485e12f4624fff61302ad128f196dceaab870dfea50a69c64b2008ab1629
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
];
console.log(`[${KERNEL_ID}] class-K floor property test — aggregate-only CBR data return validator.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
