// art-766-parental-leave-income-gap — port of ApexLogics Apex #131 "Parental Leave Income Gap
// Planner" (AL-138, tool_id 131-parental-leave-income-gap, v1.0.0) inline calculate()
// (Apex L329-399), landed from the APEXPORT-131 porting payload (bus ps,
// GRADES PASS-PENDING-XV 2026-10-18, Builder-verifies-at-land: 35/35 payload fixture
// vectors re-executed through compute() matching the stored outputs — 28 reproduce the
// Apex page exactly, 7 diverge by declared design — plus an independent 35/35 Apex-side
// re-execution against the re-fetched source page, APEX-PORT-131-LAND-1).
//
// Source bytes pinned in APEXPORT-131-REPORT.md (Apex page 34107 bytes,
// sha256 ddd140c288a9219c6873ad1c54fe724d271e81dfa4216014b1da4cc5a0ec3001,
// fetched 2026-10-13T19:57:11Z). Apex HTML line numbers cited below as "Apex L<n>".
// A 2026-10-20 re-fetch of the same URL (34712 bytes, sha256
// e46d43fe23e6161ced0b5eafb920ea245ed331614f29f15d2731827bf5341aff) differs only in
// prose/markup: re-running the page's own inline script on the re-fetched bytes
// reproduces all 35 payload Apex vectors exactly (builder re-derivation at land).
//
// Pure function: no Date, no clock, no randomness, no I/O. The Apex arithmetic reads
// NO clock (no Date/now in calculate(), L329-399; `new Date()` appears only in the AP2
// export envelope), so the computation is deterministic as-is and zkVM-promotable with
// NO as-of parameter (the APEXPORT-110B as-of pattern does not apply).
//
// GROUNDING / VINTAGE (see APEXPORT-131 payload CITES.md and DIFFERS.md D1-D11):
// - FMLA entitlement reference 12 workweeks is GROUNDED (29 CFR 825.200, CITES G0);
//   it appears in NO arithmetic on either side.
// - State PFL rates/caps are the Apex 2025-vintage schedule (registry data_vintage
//   "state PFL rates as of 2025"), kept verbatim for fixture parity. Official 2026
//   schedules differ on every state row (CITES G1-G6, DIFFERS D1-D6); every output
//   carries the ART766_2025_VINTAGE flag. Do not modernize silently.
// - The state-benefit haircut at half the entered tax rate (Apex L351) is UNGROUNDED
//   (CITES U2) — flagged ART766_PFL_PARTIALLY_TAXABLE_ASSUMPTION on every output.
// - The 1.05x no-windfall cap (Apex L374) is an Apex-authored modelling choice,
//   UNGROUNDED — flagged ART766_WINDFALL_CAP.
// - The falsy-default idiom of the Apex page (parseFloat(...) || default, L330-342) is
//   deliberately NOT reproduced: the kernel validates declared form domains and either
//   uses the explicit value or refuses by name (DIFFERS D10; boundary fixtures
//   BF-T1..BF-T7 pin all seven divergences).
//
// Reservation: art-766 reserved by APEX-PORT-ARTNUM-ALLOC-1 2026-10-18 for Apex #131;
// re-verified absent on fresh origin/main 674dd9556 before the first kernel byte
// (PR-ID-COLLISION-GATE-1).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-766-parental-leave-income-gap';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-138',
  tool_id: '131-parental-leave-income-gap',
  display_number: '#131',
  page_url: 'https://apexlogics.org/tools/131-parental-leave-income-gap/',
  page_bytes: 34107,
  page_sha256: 'ddd140c288a9219c6873ad1c54fe724d271e81dfa4216014b1da4cc5a0ec3001',
  fetch_date: '2026-10-13',
};

// --- Named literals (Apex line refs are to the fetched page) ---------------

// Base salary is quoted per year; the week is the schedule atom (Apex L344).
export const WEEKS_PER_YEAR = 52; // exact by definition
// Apex month denominator, L346-347. NOTE: 52/12 = 4.3333...; Apex truncates to the
// literal 4.333. Reproduced verbatim for fixture parity (effect < 0.01%; DIFFERS D9).
export const WEEKS_PER_MONTH = 4.333; // Apex L346, L347, L382

// State PFL wage-replacement points, 2025 vintage (Apex L316-319).
// ca 0.65 and wa 0.75 are MIDPOINTS of the ranges the page itself advertises
// ("CA 60-70%", "WA 60-90%", L166/L169) — DIFFERS D7. co 0.90 is the low-end label of
// a sliding scale — DIFFERS D5. or 0.60 contradicts the ORS 657B formula (100%/50%) —
// DIFFERS D6. ny 0.67 and nj 0.85 match the official 2026/2025 rates (CITES G2/G3).
export const STATE_PFL_RATES_2025 = Object.freeze({
  none: 0, // Apex L318
  ca: 0.65, // Apex L318
  ny: 0.67, // Apex L318; matches official NY 2026 67% (CITES G2)
  nj: 0.85, // Apex L318; matches official NJ 85% (CITES G3)
  wa: 0.75, // Apex L318; official WA is a sliding scale up to 90% (CITES G4)
  co: 0.90, // Apex L318; official CO is 90%/50% sliding (CITES G5)
  or: 0.60, // Apex L318; official OR is 100%/50% of SAWW (CITES G6)
  custom: null, // Apex L318: custom takes the user rate
});

// State weekly benefit caps, 2025 vintage dollars (Apex L321-324). Official 2026
// maxima differ on every row (DIFFERS D1-D6).
export const STATE_CAPS_WEEKLY_2025 = Object.freeze({
  none: 0, // Apex L323 -> falsy -> STATE_CAP_FALLBACK via || (L350)
  ca: 1620, // Apex L323; official 2026: $1,765 (CITES G1)
  ny: 1177, // Apex L323; official 2026: $1,228.53 (CITES G2)
  nj: 1055, // Apex L323; official 2025: $1,081 / 2026: $1,119 (CITES G3)
  wa: 1574, // Apex L323; official 2026: $1,647 (CITES G4)
  co: 1292, // Apex L323; official from 2026-07-01: $1,448.02 (CITES G5)
  or: 1470, // Apex L323; official from 2026-06-28: $1,692.16 (CITES G6)
  custom: 99999, // Apex L323
});

// Fallback cap when the table entry is falsy (Apex L350:
// `STATE_CAPS_WEEKLY[stateProgram] || 99999`). Only 'none' (0) takes it.
export const STATE_CAP_FALLBACK = 99999; // Apex L350

// "PFL often partially taxable": Apex haircuts the state benefit by half the entered
// effective tax rate (Apex L351). No source is cited on the page; CITES.md records it
// UNGROUNDED (U2). Flagged on every output.
export const PFL_TAXABLE_SHARE = 0.5; // Apex L351

// "No windfall": employer pay + state PFL can never exceed 105% of net weekly pay in
// any week (Apex L374). Modelling choice, not a cited fact.
export const WINDFALL_CAP_MULT = 1.05; // Apex L374

// Recovery sentinel: written when post-return surplus is not positive (Apex L390).
// Display sentinel, not a computed quantity (DIFFERS D8).
export const RECOVERY_SENTINEL_MONTHS = 999; // Apex L390, L408, L418

// Verdict gate: savings above half the gap read "warn", at/below half read "danger"
// (Apex L411). Display gate only.
export const VERDICT_HALF = 0.5; // Apex L411

// FMLA reference: 12 workweeks (29 CFR 825.200, CITES G0). Display/prose reference
// only — it appears in NO arithmetic on either side.
export const FMLA_WEEKS_REFERENCE = 12;

export const STATE_PROGRAMS = Object.freeze(['none', 'ca', 'ny', 'nj', 'wa', 'co', 'or', 'custom']);

// Declared form domains, taken from the input min/max attributes (Apex L122-193).
// The kernel enforces them and refuses by name; the Apex page does NOT enforce them
// in code (all reads are `||` fallbacks).
export const DOMAINS = Object.freeze({
  base_salary: { min: 10000, max: 500000 },
  tax_rate_pct: { min: 0, max: 50 },
  monthly_expenses: { min: 500, max: 30000 },
  partner_income: { min: 0, max: 20000 },
  savings: { min: 0, max: 500000 },
  employer_paid_weeks: { min: 0, max: 26 },
  employer_partial_weeks: { min: 0, max: 26 },
  employer_partial_pct: { min: 0, max: 100 },
  state_pfl_weeks: { min: 0, max: 16 },
  custom_pfl_rate_pct: { min: 0, max: 100 },
  total_leave_weeks: { min: 1, max: 52, integer: true },
  baby_expense: { min: 0, max: 5000 },
});

function refused(field, text) {
  const err = /** @type {Error & { code?: string, field?: string }} */ (new Error(`REFUSED_BAD_${field}: ${text}`));
  err.code = `REFUSED_BAD_${field}`;
  err.field = field;
  throw err;
}

function num(pp, name, { integer = false } = {}) {
  const v = pp[name];
  const d = DOMAINS[name];
  if (typeof v !== 'number' || !Number.isFinite(v)) refused(name.toUpperCase(), `${name} must be a finite number`);
  if (integer && !Number.isInteger(v)) refused(name.toUpperCase(), `${name} must be an integer`);
  if (v < d.min || v > d.max) refused(name.toUpperCase(), `${name}=${v} outside declared form domain [${d.min}, ${d.max}]`);
  return v;
}

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'parental_leave_income_gap',
  mandate_type: 'career_workforce', gpu: false,
};

// Pure compute. pp = {
//   base_salary: number 10000..500000 (annual gross, Apex L122),
//   tax_rate_pct: number 0..50 (effective tax rate PERCENT, Apex L126),
//   monthly_expenses: number 500..30000 (Apex L130),
//   partner_income: number 0..20000 (partner monthly take-home, Apex L136),
//   savings: number 0..500000 (Apex L140),
//   employer_paid_weeks: number 0..26 (Apex L150),
//   employer_partial_weeks: number 0..26 (Apex L153),
//   employer_partial_pct: number 0..100 (PERCENT of net weekly pay, Apex L158),
//   state_program: 'none'|'ca'|'ny'|'nj'|'wa'|'co'|'or'|'custom' (Apex L164),
//   state_pfl_weeks: number 0..16 (Apex L177),
//   custom_pfl_rate_pct: number 0..100 (PERCENT, used only for custom, Apex L181),
//   total_leave_weeks: integer 1..52 (Apex L187),
//   baby_expense: number 0..5000 (Apex L190),
// }.
// Out-of-domain inputs are refused by throw with a named REFUSED_BAD_* reason (the
// payload contract; DIFFERS D10 — the Apex page silently substituted falsy defaults).
// Returns the full week-by-week schedule plus headline gap/shortfall/recovery numbers
// and the compliance_flags array (mirrored at the envelope level by compute()).
function computeFlat(pp) {
  if (!pp || typeof pp !== 'object') refused('INPUT', 'pp must be an object');

  const baseSalary = num(pp, 'base_salary');
  const taxRatePct = num(pp, 'tax_rate_pct');
  const monthlyExpenses = num(pp, 'monthly_expenses');
  const partnerIncome = num(pp, 'partner_income');
  const savings = num(pp, 'savings');
  const employerPaidWeeks = num(pp, 'employer_paid_weeks');
  const employerPartialWeeks = num(pp, 'employer_partial_weeks');
  const employerPartialPct = num(pp, 'employer_partial_pct');
  const stateProgram = pp.state_program;
  if (!STATE_PROGRAMS.includes(stateProgram)) refused('STATE_PROGRAM', `state_program=${JSON.stringify(stateProgram)} not in [${STATE_PROGRAMS.join(', ')}]`);
  const statePflWeeks = num(pp, 'state_pfl_weeks');
  const customPflRatePct = num(pp, 'custom_pfl_rate_pct');
  const totalLeaveWeeks = num(pp, 'total_leave_weeks', { integer: true });
  const babyExpense = num(pp, 'baby_expense');

  const taxRate = taxRatePct / 100; // L331
  const employerPartialRate = employerPartialPct / 100; // L337
  const customPflRate = customPflRatePct / 100; // L340

  const weeklyGross = baseSalary / WEEKS_PER_YEAR; // L344
  const weeklyNet = weeklyGross * (1 - taxRate); // L345
  const weeklyExpenses = (monthlyExpenses + babyExpense) / WEEKS_PER_MONTH; // L346
  const weeklyPartner = partnerIncome / WEEKS_PER_MONTH; // L347

  const statePflRate = stateProgram === 'custom' ? customPflRate : STATE_PFL_RATES_2025[stateProgram]; // L349
  const stateCap = STATE_CAPS_WEEKLY_2025[stateProgram] || STATE_CAP_FALLBACK; // L350
  const capBinds = weeklyGross * statePflRate >= stateCap; // diagnostic only
  // L351 (UNGROUNDED haircut U2):
  const statePflWeekly = Math.min(weeklyGross * statePflRate, stateCap) * (1 - taxRate * PFL_TAXABLE_SHARE);

  const rows = [];
  let totalGap = 0;
  let totalIncome = 0;

  for (let w = 1; w <= totalLeaveWeeks; w++) {
    let phase, empPay, statePfl;
    if (w <= employerPaidWeeks) { // C1, L360
      phase = 'Employer Paid';
      empPay = weeklyNet;
    } else if (w <= employerPaidWeeks + employerPartialWeeks) { // C2, L363
      phase = 'Employer Partial';
      empPay = weeklyNet * employerPartialRate;
    } else { // L366
      phase = 'Unpaid / FMLA';
      empPay = 0;
    }
    statePfl = w <= statePflWeeks ? statePflWeekly : 0; // C3, L372
    // C4 no-windfall cap, L374:
    const capped = Math.min(empPay + statePfl, weeklyNet * WINDFALL_CAP_MULT);
    const windfallCapped = empPay + statePfl > weeklyNet * WINDFALL_CAP_MULT;
    const combinedIncome = capped + weeklyPartner;
    const net = combinedIncome - weeklyExpenses;
    if (net < 0) totalGap += Math.abs(net); // C5, L376
    totalIncome += combinedIncome;
    rows.push({ week: w, phase, emp_pay: empPay, state_pfl: statePfl, partner: weeklyPartner, total_in: combinedIncome, expenses: weeklyExpenses, net, windfall_capped: windfallCapped });
  }

  const avgLeaveMonthly = (totalIncome / totalLeaveWeeks) * WEEKS_PER_MONTH; // L382
  const shortfallMonthly = Math.max(0, monthlyExpenses + babyExpense - avgLeaveMonthly); // C6, L383
  const savingsNeeded = totalGap; // L384
  const isFullyCovered = savings >= savingsNeeded; // C7, L385

  const returnMonthlyNet = (baseSalary / 12) * (1 - taxRate); // L388
  const surplusPerMonth = Math.max(0, returnMonthlyNet + partnerIncome - monthlyExpenses - babyExpense); // L389
  const recoveryFinite = surplusPerMonth > 0; // C8, L390
  const recoveryMonths = recoveryFinite ? Math.ceil(savingsNeeded / surplusPerMonth) : RECOVERY_SENTINEL_MONTHS; // L390

  // Verdict gates, L411-414 (C9). recovery display gate (L408: < 999) is a page
  // concern; the kernel reports recovery_finite so no consumer mistakes the sentinel
  // for a duration.
  const verdict = isFullyCovered ? 'positive' : savings > savingsNeeded * VERDICT_HALF ? 'warn' : 'danger'; // C9

  const compliance_flags = [
    'ART766_2025_VINTAGE', // state rates/caps are the Apex 2025 schedule; 2026 differs (DIFFERS D1-D6)
    'ART766_PFL_PARTIALLY_TAXABLE_ASSUMPTION', // L351 haircut is ungrounded (CITES U2)
    'ART766_WINDFALL_CAP', // L374 1.05 cap is a modelling choice, not a cited fact
    ...(capBinds ? ['ART766_STATE_CAP_BINDS'] : []),
    ...(recoveryFinite ? [] : ['ART766_RECOVERY_SENTINEL']),
  ];

  return {
    total_gap: totalGap,
    avg_leave_monthly: avgLeaveMonthly,
    shortfall_monthly: shortfallMonthly,
    savings_needed: savingsNeeded,
    recovery_months: recoveryMonths,
    recovery_finite: recoveryFinite,
    is_fully_covered: isFullyCovered,
    verdict,
    weekly_gross: weeklyGross,
    weekly_net: weeklyNet,
    weekly_expenses: weeklyExpenses,
    weekly_partner: weeklyPartner,
    state_pfl_rate: statePflRate,
    state_pfl_weekly: statePflWeekly,
    state_cap: stateCap,
    state_cap_binds: capBinds,
    return_monthly_net: returnMonthlyNet,
    surplus_per_month: surplusPerMonth,
    rows,
    compliance_flags,
  };
}

/**
 * compute(pp) — pure decision kernel (port of Apex #131 inline calculate()).
 * Invalid-domain inputs are rejected by throw with a named REFUSED_BAD_* reason
 * (the payload contract; no refused-payload branch — see fixtures/proptest).
 * The output_payload carries the kernel's compliance_flags inline (vintage,
 * ungrounded-assumption and sentinel flags), mirrored in the envelope.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const output_payload = computeFlat(pp);
  return { output_payload, compliance_flags: output_payload.compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
