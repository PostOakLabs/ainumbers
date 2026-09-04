// art-675-recordkeeping-completeness-mapper.proptest.mjs — class-A property-test FLOOR
// (RECORDKEEPING-MAPPER-BUILD-1, RECORDKEEPING-MAPPER-BUILD-SPEC.md; FV-PBT-FLOOR-BUILD-SPEC.md).
// kernel_digest_at_authoring: sha256:135e6d5e8ef30c3c6d18890b02e8ca948329ac77ab58bb3768d8f7340c973990
// spec: RECORDKEEPING-MAPPER-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof. float_sensitive: NO — completeness_pct is a
// half-up-rounded whole percentage; boundary channel counts (1, 2, 3 of small totals) are
// forced categorically rather than via ULP-forcing.
// Checks: fixture-oracle gate (8 golden vectors incl. the spec canonical preimage whose
// execution_hash pins 80e11f09ee7530d6091e58de7f6524e99fd906406da0a1727305c03a020141d8 and the
// opposite-verdict COMPLETE vector), arithmetic identity of the roll-up
// (total/captured/uncaptured/retrieval_passes/completeness_pct), verdict consistency
// (COMPLETE iff every channel captured AND every retrieval_test pass), a metamorphic property
// (never improves any summary field when a channel is flipped to uncaptured or a retrieval
// result is downgraded), determinism, and fail-closed rejection of out-of-domain inputs.
// Zero external dependencies — Node built-ins plus _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-675-recordkeeping-completeness-mapper.proptest.mjs

import { compute } from '../art-675-recordkeeping-completeness-mapper.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, pickNasty } from './_pbt-common.mjs';

const KERNEL_ID = 'art-675-recordkeeping-completeness-mapper';
const RETRIEVAL_RESULTS = ['pass', 'fail', 'not_run'];

function roundHalfUp(x) {
  return x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5);
}

const rand = mulberry32(0xa67a70);
const CHANNEL_NAMES = ['email', 'chat_app', 'voice', 'sms', 'whatsapp', 'teams', 'bloomberg', 'signal', 'text', 'fax'];

function randomChannels(rng) {
  const n = 1 + Math.floor(rng() * 8);
  const names = CHANNEL_NAMES.slice();
  const channels = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * names.length);
    const name = names.splice(idx, 1)[0] || `ch${i}`;
    channels.push({
      name,
      captured: rng() < 0.6,
      retrieval_test: pick(rng, RETRIEVAL_RESULTS),
    });
  }
  return channels;
}

function randomPP(rng) {
  return { channels: randomChannels(rng) };
}

const TRIALS = 2000;

// ---------- P1: roll-up arithmetic identity over declared-domain inputs ----------
function checkP1_rollup_arithmetic() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const out = compute(pp).output_payload;
    checked++;
    const captured = pp.channels.filter((c) => c.captured).length;
    const passes = pp.channels.filter((c) => c.retrieval_test === 'pass').length;
    const uncaptured = pp.channels.filter((c) => !c.captured).map((c) => c.name);
    if (out.total !== pp.channels.length) violations++;
    if (out.captured !== captured) violations++;
    if (out.retrieval_passes !== passes) violations++;
    if (JSON.stringify(out.uncaptured) !== JSON.stringify(uncaptured)) violations++;
    if (out.completeness_pct !== roundHalfUp((100 * captured) / pp.channels.length)) violations++;
    if (out.completeness_pct < 0 || out.completeness_pct > 100) violations++;
    if (out.captured + out.uncaptured.length !== out.total) violations++;
  }
  return { name: 'P1 roll-up arithmetic identity (total/captured/passes/uncaptured/pct)', checked, violations };
}

// ---------- P2: verdict consistency — COMPLETE iff all captured AND all pass ----------
function checkP2_verdict_consistency() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const out = compute(pp).output_payload;
    checked++;
    const allCaptured = pp.channels.every((c) => c.captured);
    const allPass = pp.channels.every((c) => c.retrieval_test === 'pass');
    if (out.overall !== ((allCaptured && allPass) ? 'COMPLETE' : 'GAPS_FOUND')) violations++;
  }
  // Forced boundary cases around the verdict rule.
  const boundaries = [
    { channels: [{ name: 'a', captured: true, retrieval_test: 'pass' }] },
    { channels: [{ name: 'a', captured: true, retrieval_test: 'not_run' }] },
    { channels: [{ name: 'a', captured: false, retrieval_test: 'pass' }] },
    { channels: [{ name: 'a', captured: true, retrieval_test: 'fail' }] },
    { channels: [{ name: 'a', captured: true, retrieval_test: 'pass' }, { name: 'b', captured: true, retrieval_test: 'fail' }] },
  ];
  for (const pp of boundaries) {
    const out = compute(pp).output_payload;
    checked++;
    const allCaptured = pp.channels.every((c) => c.captured);
    const allPass = pp.channels.every((c) => c.retrieval_test === 'pass');
    if (out.overall !== ((allCaptured && allPass) ? 'COMPLETE' : 'GAPS_FOUND')) violations++;
  }
  return { name: 'P2 verdict consistency (COMPLETE iff all captured AND all pass)', checked, violations };
}

// ---------- P3: metamorphic — degrading a channel never improves the roll-up ----------
function checkP3_metamorphic_degrade() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const pp = randomPP(rand);
    const before = compute(pp).output_payload;
    const mutated = JSON.parse(JSON.stringify(pp));
    const idx = Math.floor(rand() * mutated.channels.length);
    if (rand() < 0.5) mutated.channels[idx].captured = false;
    else if (mutated.channels[idx].retrieval_test === 'pass') mutated.channels[idx].retrieval_test = 'not_run';
    else mutated.channels[idx].retrieval_test = 'fail';
    const after = compute(mutated).output_payload;
    checked++;
    if (after.captured > before.captured) violations++;
    if (after.retrieval_passes > before.retrieval_passes) violations++;
    if (after.completeness_pct > before.completeness_pct) violations++;
    if (before.overall === 'COMPLETE' && after.overall !== 'GAPS_FOUND') violations++;
  }
  return { name: 'P3 metamorphic degrade-never-improves', checked, violations };
}

// ---------- P4: determinism ----------
function checkP4_determinism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const pp = randomPP(rand);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'P4 determinism (same pp, same payload)', checked, violations };
}

// ---------- P5: fail-closed rejection of out-of-domain inputs, never a throw ----------
function checkP5_fail_closed() {
  let violations = 0, checked = 0;
  const badPPs = [
    {},
    { channels: [] },
    { channels: 'email' },
    { channels: null },
    { channels: [{}] },
    { channels: [{ name: '', captured: true, retrieval_test: 'pass' }] },
    { channels: [{ name: 'email', captured: 'yes', retrieval_test: 'pass' }] },
    { channels: [{ name: 'email', captured: true, retrieval_test: 'PASS' }] },
    { channels: [{ name: 'email', captured: true, retrieval_test: null }] },
    { channels: [{ name: 'email', captured: true, retrieval_test: 'pass' }, { name: 'email', captured: false, retrieval_test: 'not_run' }] },
    { channels: [{ name: 'email', captured: true, retrieval_test: 'pass' }, null] },
  ];
  for (const pp of badPPs) {
    checked++;
    try {
      const out = compute(pp).output_payload;
      if (!Array.isArray(out.domain_errors) || out.domain_errors.length === 0) violations++;
      if (out.total !== null || out.captured !== null || out.completeness_pct !== null || out.retrieval_passes !== null || out.overall !== null) violations++;
    } catch (e) { violations++; }
  }
  // Nasty values in the channels key must never throw and never fabricate a roll-up.
  for (let i = 0; i < 200; i++) {
    const pp = { channels: pickNasty(rand) };
    checked++;
    try {
      const out = compute(pp).output_payload;
      if (out.overall !== null && out.overall !== 'COMPLETE' && out.overall !== 'GAPS_FOUND') violations++;
      if (out.total !== null && (!Array.isArray(pp.channels) || pp.channels.length === 0)) violations++;
    } catch (e) { violations++; }
  }
  return { name: 'P5 fail-closed rejection, never throws, never fabricates', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_rollup_arithmetic(),
  checkP2_verdict_consistency(),
  checkP3_metamorphic_degrade(),
  checkP4_determinism(),
  checkP5_fail_closed(),
];
console.log(`[${KERNEL_ID}] class-A floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
