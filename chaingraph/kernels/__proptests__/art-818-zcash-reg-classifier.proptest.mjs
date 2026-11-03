// art-818-zcash-reg-classifier: class-K property-test FLOOR (KERNEL-SCAFFOLD-1 scaffold, authored).
// kernel_digest_at_authoring: sha256:55b2bcbefcdbbf54a39dfd51700e0483cf6859e9d0fd80cb024a8377b2efc64a
// spec: declared-property classification against MiCA Article 76(3) and AMLR Article 79(1) (pinned text)
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md). NOT a proof.
// float_sensitive: NO (string and boolean comparisons only).
// Checks: fixture-oracle gate; R1 is NOT_YET_APPLICABLE exactly before 2024-12-30; R2 is never
// WITHIN_TEXT before its stated date (2027-07-10, or 2029-07-10 for the Article 3(3)(n)/(o) flag);
// the R1 exception status needs both identifiability flags true; the R2 prohibition status needs
// the account flag true and a role the paragraph addresses; role other is never WITHIN_TEXT;
// refusals mirror the INPUT_REFUSED flag and junk input always refuses; no NaN/Infinity anywhere;
// determinism.
// Zero external dependencies: Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-818-zcash-reg-classifier.proptest.mjs

import { compute } from '../art-818-zcash-reg-classifier.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-818-zcash-reg-classifier';
const rand = mulberry32(0x818C1A);
const int = (n) => Math.floor(rand() * n);
const pick = (xs) => xs[int(xs.length)];
const ROLES = ['casp_operating_trading_platform', 'casp_other', 'credit_or_financial_institution', 'other'];
const DATES = ['2023-06-29', '2024-06-30', '2024-12-29', '2024-12-30', '2025-06-01', '2027-07-09', '2027-07-10', '2028-02-29', '2029-07-09', '2029-07-10', '2031-01-01'];

function maybeBool() { const r = rand(); return r < 0.4 ? true : r < 0.8 ? false : undefined; }

function randomPP() {
  const d = {};
  for (const k of ['inbuilt_anonymisation_function', 'holders_identifiable_by_platform_casp', 'transaction_history_identifiable_by_platform_casp', 'account_allows_anonymisation_or_obfuscation']) {
    const v = maybeBool();
    if (v !== undefined) d[k] = v;
  }
  const entity = { role: pick(ROLES) };
  const sp = maybeBool();
  if (sp !== undefined) entity.obliged_entity_art_3_3_n_or_o = sp;
  return { assessment_date: pick(DATES), coin_label: 'COIN-' + int(1000), entity, declared_properties: d };
}

function checkR1Date() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 600; i++) {
    const pp = randomPP();
    const r1 = compute(pp).output_payload.rules[0];
    const before = pp.assessment_date < '2024-12-30';
    if ((r1.status === 'NOT_YET_APPLICABLE') !== before) violations++;
    checked++;
  }
  return { name: 'r1_not_yet_applicable_iff_before_2024_12_30', checked, violations };
}

function checkR2NeverEarly() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 600; i++) {
    const pp = randomPP();
    const r2 = compute(pp).output_payload.rules[1];
    const from = pp.entity.obliged_entity_art_3_3_n_or_o === true ? '2029-07-10' : '2027-07-10';
    if (r2.applies_from !== from) violations++;
    if (pp.assessment_date < from && r2.status.indexOf('WITHIN_TEXT_') === 0) violations++;
    if (pp.entity.role !== 'other' && (r2.status === 'NOT_YET_APPLICABLE') !== (pp.assessment_date < from)) violations++;
    checked++;
  }
  return { name: 'r2_never_within_text_before_stated_date', checked, violations };
}

function checkStatusNeedsDeclaredInputs() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 800; i++) {
    const pp = randomPP();
    const d = pp.declared_properties;
    const [r1, r2] = compute(pp).output_payload.rules;
    if (r1.status === 'WITHIN_TEXT_EXCEPTION_ON_DECLARED_INPUTS' && !(d.holders_identifiable_by_platform_casp === true && d.transaction_history_identifiable_by_platform_casp === true)) violations++;
    if (r1.status === 'WITHIN_TEXT_RESTRICTION_ON_DECLARED_INPUTS' && (d.inbuilt_anonymisation_function !== true || pp.entity.role !== 'casp_operating_trading_platform')) violations++;
    if (r2.status === 'WITHIN_TEXT_PROHIBITION_ON_DECLARED_INPUTS' && (d.account_allows_anonymisation_or_obfuscation !== true || pp.entity.role === 'other')) violations++;
    if (pp.entity.role === 'other' && (r2.status !== 'ROLE_NOT_ADDRESSED' || r1.status.indexOf('WITHIN_TEXT_') === 0)) violations++;
    checked++;
  }
  return { name: 'within_text_statuses_need_the_declared_inputs', checked, violations };
}

function checkRefusals() {
  let checked = 0, violations = 0;
  const nasties = [undefined, null, NaN, Infinity, -1, 1.5, '', 'abc', [], {}, 7, true];
  for (let i = 0; i < 400; i++) {
    const pp = /** @type {any} */ (randomPP());
    const which = i % 4;
    if (which === 0) pp.assessment_date = nasties[i % nasties.length];
    if (which === 1) pp.entity.role = nasties[i % nasties.length];
    if (which === 2) pp.declared_properties.inbuilt_anonymisation_function = nasties[i % nasties.length];
    if (which === 3) pp.coin_label = nasties[i % nasties.length];
    const { output_payload, compliance_flags } = compute(pp);
    const refused = output_payload.refusals.length > 0;
    if (refused !== compliance_flags.includes('INPUT_REFUSED')) violations++;
    if (refused && output_payload.rules.length !== 0) violations++;
    if (!refused && output_payload.rules.length !== 2) violations++;
    if (findShapeViolations(output_payload).length) violations++;
    checked++;
  }
  for (const junk of [undefined, null, 7, 'x', [], {}]) {
    const { output_payload, compliance_flags } = compute(junk);
    if (!compliance_flags.includes('INPUT_REFUSED')) violations++;
    if (findShapeViolations(output_payload).length) violations++;
    checked++;
  }
  return { name: 'refusals_mirror_flag_and_no_nan_or_infinity', checked, violations };
}

function checkDeterminism() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomPP();
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
    checked++;
  }
  return { name: 'determinism', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkR1Date(),
  checkR2NeverEarly(),
  checkStatusNeedsDeclaredInputs(),
  checkRefusals(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test: privacy-coin regulatory classification.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
