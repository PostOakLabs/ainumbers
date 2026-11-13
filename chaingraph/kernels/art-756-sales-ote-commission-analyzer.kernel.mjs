// art-756-sales-ote-commission-analyzer — port of ApexLogics Apex #89 "Sales OTE
// & Commission Analyzer" (AL-96, tool_id 89-sales-ote-commission-analyzer)
// inline compute, landed from the APEXPORT-89 porting payload (bus aspire,
// GRADES PASS-PENDING-XV 2026-10-14, Tim 2026-10-18 "Extend ruling":
// Builder-verifies-at-land — all 33 payload fixture vectors re-executed through
// compute() matching the stored outputs, APEX-PORT-89-LAND-1).
//
// Source: Apex #89 "Sales OTE & Commission Analyzer", ApexLogics AL-96,
//   https://apexlogics.org/tools/89-sales-ote-commission-analyzer/
//   fetched 2026-10-14T01:18:22Z, 38935 bytes,
//   sha256 6543b438ed10a9cf0011bb997acf96ea2620ca6ab6399354b079c793a6472857
//
// FAITHFUL-PORT CONTRACT: every arithmetic operation below is the Apex page's
// operation on the Apex page's operands, in the Apex page's order. Where Apex
// is quirky (notably the `parseFloat(x) || default` zero-coercion), the quirk
// is reproduced EXACTLY and flagged, never silently repaired. Fixing a quirk
// is a semantics change and belongs to the trusted builder's decision, recorded
// in DIFFERS.md and Open Questions.
//
// SCOPE: this node models the W-2 gross of an On-Target-Earnings offer: base
// salary + variable pay as a function of quota attainment, with an accelerator
// tier and a recoverable draw. It does NOT compute a tax liability, an FLSA
// regular rate, or overtime. See `scope_note` in every output_payload.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random, no Intl/.toLocaleString. `as_of` is an INPUT: the node reads no
// clock, so the computation is deterministic and zkVM-promotable
// (APEXPORT-110B pattern). The Apex page stamped `new Date().toISOString()`
// into its AP2 export envelope; that stamp moved to `as_of` here.
//
// LICENSE of the ported algorithm: Apex page manifest declares "CC-BY-4.0".

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-756-sales-ote-commission-analyzer';
const TOOL_VERSION = '1.0.0';
const CONSTANTS_VERSION = '2026';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'analyze_sales_ote_commission',
  mandate_type: 'sales_comp_record',
  gpu: false,
};

/* ──────────────────────────────────────────────────────────────────────────
   CONSTANTS — every literal the Apex page hard-codes, with its Apex location.

   None of these is a dated external datum. They are the Apex tool's own
   structural choices. The Apex page banner advertises "BLS OEWS 2024 ·
   Internal sales comp benchmarks" as its data vintage, but NO BLS figure and
   no other external datum appears anywhere in its compute -- see DIFFERS.md
   row D-3 and CITES.md `UNGROUNDED: BLS OEWS 2024`.
   ────────────────────────────────────────────────────────────────────────── */

// Apex line 471: const levels = [50, 75, 100, 125, 150, 200];
// The attainment ladder rendered in the scenario table. Also the ladder
// stamped into the markdown export (Apex line 534).
export const ATTAINMENT_LEVELS_PCT = Object.freeze([50, 75, 100, 125, 150, 200]);

// Apex line 438: computeVariable(100, ...) -- the at-target column is ALWAYS
// evaluated at 100% attainment, regardless of the attainment slider. This is
// the Apex page's definition of "at target", kept verbatim.
export const AT_TARGET_ATTAINMENT_PCT = 100;

// Apex line 464: computeVariable(150, ...) -- the accelerator insight row is
// ALWAYS evaluated at 150% attainment.
export const ACCEL_INSIGHT_ATTAINMENT_PCT = 150;

// Apex line 490: const annualDraw = drawMonthly * 12;
export const MONTHS_PER_YEAR = 12;

// Apex lines 452-453: varSplit >= 60 ? 'high' : varSplit >= 40 ? 'moderate' : 'low'
// Percentages of OTE sitting in variable pay. Bare editorial thresholds with
// no cited source; reproduced as-is.
export const HIGH_VARIABLE_CONCENTRATION_PCT = 60;
export const MODERATE_VARIABLE_EXPOSURE_PCT = 40;

// Apex line 497: if (parseFloat(monthsToPayback) > 6)
// Bare editorial clawback-risk threshold in months. No cited source.
export const CLAWBACK_ELEVATED_MONTHS = 6;

// Apex line 480: Math.round(attainment / 25) * 25 === lv || lv === 100
export const HIGHLIGHT_BUCKET_PCT = 25;

/* ── Default inputs: the Apex `parseFloat(x) || <default>` fallbacks ─────────
   Apex lines 423-432. Reproduced exactly, including the zero-coercion: Apex's
   `||` fires when the parsed value is 0 as well as when it is NaN, so an
   explicit user input of 0 is silently replaced by the default. Apex lines
   169-172 constrain several of these with HTML min/max, but the JS accepts any
   number a caller passes. See DIFFERS.md row D-2. */
export const APEX_INPUT_DEFAULTS = Object.freeze({
  base_salary: 0,
  ote: 0,
  quota: 1,
  attainment_pct: 100,
  federal_tax_rate_pct: 32,
  accelerator_threshold_pct: 100,
  accelerator_multiplier: 1.5,
  draw_monthly: 0,
});

/* ── 2026 FEDERAL INCOME TAX REFERENCE SCHEDULE ─────────────────────────────
   NOT USED IN THE ARITHMETIC. Recorded as named literals so the flat-rate
   branch below can be read against the official schedule without guessing.

   SOURCE (fetched and quoted this run, see CITES.md C-1 / C-2):
   IRS Rev. Proc. 2025-32, section 4.01, "2026 ADJUSTED ITEMS -- Tax Rate
   Tables", https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
     sha256 e9ada115fb43a4af5ea326ca91edd40ab0bf29b9be01d2c13d7b8fa96214635b
   and the IRS announcement of the same figures,
   https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
     sha256 2a818826ab42cb5d3b1f42fd14f01cbab28e6d0ca0f875b4b183dba7c7b55ff5
     quote: "Marginal Rates: For tax year 2026, the top tax rate remains 37%
     for individual single taxpayers with incomes greater than $640,600
     ($768,700 for married couples filing jointly). ... 32% for incomes over
     $201,775 ($403,550 for married couples filing jointly); 24% for incomes
     over $105,700 ($211,400 for married couples filing jointly) ..."

   The official schedule is a MARGINAL bracket schedule keyed to taxable
   income. The Apex page instead applies ONE flat caller-supplied rate to the
   whole W-2 gross (Apex line 440), which ignores the standard deduction and
   the bracket stacking and is therefore neither a marginal-rate figure nor an
   effective-rate figure. DIFFERS.md row D-1 records the divergence and the
   decision; the flat-rate formula is preserved for parity and flagged. */
export const TY2026_INDIVIDUAL_RATES_PCT = Object.freeze([10, 12, 22, 24, 32, 35, 37]);
// Rev. Proc. 2025-32 sec. 4.01, TABLE 3 -- unmarried individuals other than
// surviving spouses and heads of household.
export const TY2026_SINGLE_BRACKET_CEILING_USD = Object.freeze([12400, 50400, 105700, 201775, 256225, 640600]);
// Rev. Proc. 2025-32 sec. 4.01, TABLE 1 -- married filing jointly / surviving spouses.
export const TY2026_MFJ_BRACKET_CEILING_USD = Object.freeze([24800, 100800, 211400, 403550, 512450, 768700]);
// Rev. Proc. 2025-32 sec. 4.01, TABLE 2 -- heads of household.
export const TY2026_HOH_BRACKET_CEILING_USD = Object.freeze([17700, 67450, 105700, 201750, 256200, 640600]);
// Rev. Proc. 2025-32 sec. 4.01, TABLE 4 -- married filing separately.
export const TY2026_MFS_BRACKET_CEILING_USD = Object.freeze([12400, 50400, 105700, 201775, 256225, 384350]);

/* ── FLSA CROSS-REFERENCE (context only; NOT computed here) ──────────────────
   The commission this tool prices is, on its face, "a percentage of total
   sales"; the commission-payment regulation quoted and pinned in the payload's
   CITES.md (C-3) puts such payments inside the regular rate when overtime is
   owed. So IF overtime is owed to the worker, this variable pay belongs in the
   FLSA regular rate -- that is the leg art-340-compute-flsa-regular-rate owns.
   The overtime question itself is a duty test (the exemption for employees
   customarily and regularly engaged away from the employer's place of business
   in making sales, CITES.md C-4), and a job title alone is insufficient to
   establish exempt status. Citation strings for both live in
   FLSA_COMMISSION_BASIS below and in the node metadata, not here.

   This node computes none of that. It flags the boundary so a caller who
   pairs it with art-340 knows the commission leg is already in scope. */
export const FLSA_COMMISSION_BASIS = '29 CFR 778.117 (commission payments are payments for hours worked and must be included in the regular rate)';

const SCOPE_NOTE =
  'Models the gross W-2 of an OTE offer only: base salary plus variable pay as a ' +
  'function of quota attainment, with an optional accelerator tier and an ' +
  'optional recoverable draw. It computes NO tax liability: after_tax_at_target is ' +
  'gross W-2 times a single caller-supplied flat federal rate, which ignores the ' +
  'standard deduction and the 2026 marginal bracket schedule in Rev. Proc. ' +
  '2025-32 sec. 4.01 (recorded above as named literals, not applied). No state tax, ' +
  'no FICA, no pre-tax deductions, no benefits load. It computes NO FLSA regular ' +
  'rate and NO overtime: see FLSA_COMMISSION_BASIS and cross-reference node ' +
  'art-340-compute-flsa-regular-rate, and note the duty test at 29 CFR 541.500. ' +
  'The risk labels (high/moderate/low at 60%/40% of OTE in variable pay), the ' +
  '6-month clawback threshold and the 25-point highlight bucket are the Apex ' +
  "tool's own editorial constants with no cited source; they are not regulatory. " +
  'The draw/clawback figures are arithmetic on the caller-supplied draw, not a ' +
  'reading of any offer letter or of wage law. NOT TAX ADVICE, NOT WAGE-HOUR ' +
  'LEGAL ADVICE, NOT COMPENSATION ADVICE.';

/* ── Apex-faithful coercion ────────────────────────────────────────────────
   Apex reads every control as `parseFloat(el.value) || <default>`. `||` is
   falsy for 0, for NaN and for "". So an explicit 0 is replaced by the
   default. Reproduced here, and every substitution is reported in
   `apex_zero_coercion_applied` so it is never silent. */
function apexCoerce(v, fallback) {
  const n = typeof v === 'number' ? v : Number(v);
  return (Number.isFinite(n) && n !== 0) ? n : fallback;
}
function isIsoDate(v) {
  if (typeof v !== 'string' || v.length !== 10 || v.charAt(4) !== '-' || v.charAt(7) !== '-') return false;
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) continue;
    const c = v.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  const y = Number(v.slice(0, 4)), m = Number(v.slice(5, 7)), d = Number(v.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim;
}

// Matches Number(v.toFixed(1)) bit-for-bit, which is what Apex's
// `.toFixed(1)` on monthsToPayback produces before `parseFloat` re-reads it.
// toFixed is plain ECMA-262 (no Intl), so this stays zkVM-safe.
function apexFixed1(v) {
  if (!Number.isFinite(v)) return 0;
  return Number(v.toFixed(1));
}

/* ── Apex line 409-420: computeVariable(attPct, base, quota, ote, hasAccel,
      accelThresh, accelMult). Transcribed operation-for-operation. ───────────
   The accelerated branch multiplies excessRevenue * baseCommRate, and
   baseCommRate = (ote - base) / quota, so `quota` cancels algebraically. It
   does NOT cancel bit-exactly in IEEE-754: the product is formed as
   ((att-thresh)/100)*quota * ((ote-base)/quota), so a different `quota` can
   move the last ULP of variable pay. `quota` therefore has no effect on any
   dollar output beyond float noise, and its only material effect is on the
   DISPLAYED base_commission_rate. DIFFERS.md row D-4. */
function computeVariable(attPct, base, quota, ote, hasAccel, accelThresh, accelMult) {
  const baseCommRate = (ote - base) / quota;
  const targetVar = ote - base;
  if (!hasAccel || attPct <= accelThresh) {
    return (attPct / 100) * targetVar;
  }
  const threshVar = (accelThresh / 100) * targetVar;
  const excessRevenue = ((attPct - accelThresh) / 100) * quota;
  const accelVar = excessRevenue * baseCommRate * accelMult;
  return threshVar + accelVar;
}

function riskLabelFor(variableSplitPct) {
  if (variableSplitPct >= HIGH_VARIABLE_CONCENTRATION_PCT) return 'high';
  if (variableSplitPct >= MODERATE_VARIABLE_EXPOSURE_PCT) return 'moderate';
  return 'low';
}

function refusedPayload(reason, text, coerced) {
  return {
    as_of: null,
    base_salary: null,
    ote: null,
    quota: null,
    attainment_pct: null,
    federal_tax_rate_pct: null,
    accelerator_threshold_pct: null,
    accelerator_multiplier: null,
    draw_monthly: null,
    base_commission_rate: null,
    variable_at_target: null,
    total_w2_at_target: null,
    after_tax_at_target: null,
    base_split_pct: null,
    variable_split_pct: null,
    risk_label: null,
    risk_rank: null,
    accelerator_insight: null,
    attainment_scenarios: [],
    draw: null,
    apex_zero_coercion_applied: coerced || [],
    refusal_reason: reason,
    domain_errors: [{ code: reason, text }],
    scope_note: SCOPE_NOTE,
    constants_version: CONSTANTS_VERSION,
  };
}

/**
 * Pure function of `pp`. No clock, no network, no DOM, no randomness.
 * Returns { output_payload, compliance_flags }.
 */
export function compute(pp) {
  pp = pp || {};

  if (!isIsoDate(pp.as_of)) {
    return {
      output_payload: refusedPayload(
        'REFUSED_BAD_AS_OF',
        'as_of must be a real calendar date as a YYYY-MM-DD string; the node never reads a clock',
        []
      ),
      compliance_flags: ['ART756_INPUT_REFUSED'],
    };
  }

  // ── Apex lines 423-432: read every control, with the Apex `||` fallbacks ──
  // R4 (absent equals explicit null): the Apex page reads DOM strings, so a
  // JSON `null` input is not an Apex-observable state; an explicit null is
  // normalized onto the absent path (Number(null) would be 0, which would
  // bookkeep a different `supplied` value for the same effective default).
  const coerced = [];
  const take = (key, fallback) => {
    const raw = pp[key] === null ? undefined : pp[key];
    const n = typeof raw === 'number' ? raw : Number(raw);
    const out = apexCoerce(raw, fallback);
    if (!(Number.isFinite(n) && n !== 0)) coerced.push({ field: key, supplied: Number.isFinite(n) ? n : null, substituted: fallback });
    return out;
  };
  // Visible top-level read of every declared input (KERNEL-INPUT-USAGE-CHECK-1
  // shape): each key below is dereferenced here and again inside take() above.
  const { base_salary, ote, quota, attainment_pct, federal_tax_rate_pct, accelerator_threshold_pct, accelerator_multiplier, draw_monthly } = pp;
  const base = take('base_salary', APEX_INPUT_DEFAULTS.base_salary);
  const oteC = take('ote', APEX_INPUT_DEFAULTS.ote);
  const quotaC = take('quota', APEX_INPUT_DEFAULTS.quota);
  const attainment = take('attainment_pct', APEX_INPUT_DEFAULTS.attainment_pct);
  const fedTax = take('federal_tax_rate_pct', APEX_INPUT_DEFAULTS.federal_tax_rate_pct);
  const accelThresh = take('accelerator_threshold_pct', APEX_INPUT_DEFAULTS.accelerator_threshold_pct);
  const accelMult = take('accelerator_multiplier', APEX_INPUT_DEFAULTS.accelerator_multiplier);
  const drawMonthly = take('draw_monthly', APEX_INPUT_DEFAULTS.draw_monthly);
  // Apex lines 428, 431: checkbox state. Apex reads `.checked`, so a non-boolean
  // is a falsy "off"; absent is falsy too.
  const hasAccel = pp.has_accelerator === true;
  const hasDraw = pp.has_draw === true;

  const compliance_flags = [];
  if (coerced.length) compliance_flags.push('APEX_ZERO_COERCION_APPLIED');

  // ── Apex lines 434-435: the two guards, in Apex's order ──────────────────
  if (oteC <= base) {
    const out = refusedPayload('OTE_NOT_ABOVE_BASE', 'OTE must be greater than base salary.', coerced);
    return { output_payload: out, compliance_flags: compliance_flags.concat(['ART756_INPUT_REFUSED']) };
  }
  if (base <= 0) {
    const out = refusedPayload('BASE_NOT_POSITIVE', 'Base salary must be positive.', coerced);
    return { output_payload: out, compliance_flags: compliance_flags.concat(['ART756_INPUT_REFUSED']) };
  }

  // ── Apex lines 437-442: the at-target column ─────────────────────────────
  const baseCommRate = (oteC - base) / quotaC;
  const varAtTarget = computeVariable(AT_TARGET_ATTAINMENT_PCT, base, quotaC, oteC, hasAccel, accelThresh, accelMult);
  const totalAtTarget = base + varAtTarget;
  const afterTaxAtTarget = totalAtTarget * (1 - fedTax / 100);
  const baseSplit = (base / oteC) * 100;
  const varSplit = 100 - baseSplit;
  const riskLabel = riskLabelFor(varSplit);

  // ── Apex lines 463-468: accelerator insight ─────────────────────────────
  let accelInsight = null;
  if (hasAccel) {
    const varAt150 = computeVariable(ACCEL_INSIGHT_ATTAINMENT_PCT, base, quotaC, oteC, true, accelThresh, accelMult);
    accelInsight = {
      attainment_pct: ACCEL_INSIGHT_ATTAINMENT_PCT,
      variable: varAt150,
      total_w2: base + varAt150,
      threshold_pct: accelThresh,
      multiplier: accelMult,
    };
  }

  // ── Apex lines 471-484: attainment scenario ladder ───────────────────────
  const highlightBucket = Math.round(attainment / HIGHLIGHT_BUCKET_PCT) * HIGHLIGHT_BUCKET_PCT;
  const scenarios = [];
  for (let i = 0; i < ATTAINMENT_LEVELS_PCT.length; i++) {
    const lv = ATTAINMENT_LEVELS_PCT[i];
    const vari = computeVariable(lv, base, quotaC, oteC, hasAccel, accelThresh, accelMult);
    const total = base + vari;
    const afterTax = total * (1 - fedTax / 100);
    const vsOte = ((total - oteC) / oteC) * 100;
    scenarios.push({
      attainment_pct: lv,
      variable: vari,
      total_w2: total,
      after_tax: afterTax,
      vs_ote_pct: vsOte,
      meets_or_exceeds_ote: vsOte >= 0,
      highlighted: highlightBucket === lv || lv === AT_TARGET_ATTAINMENT_PCT,
    });
  }

  // ── Apex lines 487-505: draw / clawback ─────────────────────────────────
  let draw = null;
  if (hasDraw && drawMonthly > 0) {
    const annualDraw = drawMonthly * MONTHS_PER_YEAR;
    const monthlyVariableAtTarget = varAtTarget / MONTHS_PER_YEAR;
    const paybackExact = varAtTarget > 0 ? annualDraw / monthlyVariableAtTarget : null;
    const paybackRounded = paybackExact === null ? null : apexFixed1(paybackExact);
    draw = {
      applies: true,
      draw_monthly: drawMonthly,
      annual_draw: annualDraw,
      monthly_variable_at_target: monthlyVariableAtTarget,
      months_to_payback: paybackExact,
      months_to_payback_rounded_1dp: paybackRounded,
      payback_computable: varAtTarget > 0,
      clawback_elevated: paybackRounded !== null && paybackRounded > CLAWBACK_ELEVATED_MONTHS,
    };
  }

  // ── Flags: surface, never silently repair ───────────────────────────────
  if (fedTax < 0 || fedTax > 100) compliance_flags.push('FEDERAL_TAX_RATE_OUT_OF_RANGE');
  if (hasAccel && accelMult < 1) compliance_flags.push('ACCELERATOR_MULTIPLIER_BELOW_ONE');
  if (hasAccel && accelThresh < 0) compliance_flags.push('ACCELERATOR_THRESHOLD_BELOW_ZERO');
  if (attainment < 0) compliance_flags.push('ATTAINMENT_BELOW_ZERO');
  if (quota < 0) compliance_flags.push('QUOTA_BELOW_ZERO');
  if (hasDraw && drawMonthly <= 0) compliance_flags.push('DRAW_ENABLED_BUT_ZERO');
  // The three standing disclosures (flat federal rate is not a tax computation;
  // no FLSA regular rate and no overtime; not tax / wage-hour / compensation
  // advice) ride in output_payload.scope_note verbatim instead of as
  // unconditional compliance_flags entries (FLAGS-COMPUTED-LINT-1: an
  // always-on flag attests work nothing conditioned).

  const output_payload = {
    as_of: pp.as_of,
    base_salary: base,
    ote: oteC,
    quota: quotaC,
    attainment_pct: attainment,
    federal_tax_rate_pct: fedTax,
    accelerator_threshold_pct: accelThresh,
    accelerator_multiplier: accelMult,
    draw_monthly: drawMonthly,
    has_accelerator: hasAccel,
    has_draw: hasDraw,
    base_commission_rate: baseCommRate,
    variable_at_target: varAtTarget,
    total_w2_at_target: totalAtTarget,
    after_tax_at_target: afterTaxAtTarget,
    base_split_pct: baseSplit,
    variable_split_pct: varSplit,
    risk_label: riskLabel,
    risk_rank: riskLabel === 'high' ? 3 : riskLabel === 'moderate' ? 2 : 1,
    accelerator_insight: accelInsight,
    attainment_scenarios: scenarios,
    draw: draw,
    apex_zero_coercion_applied: coerced,
    refusal_reason: null,
    domain_errors: [],
    flsa_commission_basis: FLSA_COMMISSION_BASIS,
    scope_note: SCOPE_NOTE,
    constants_version: CONSTANTS_VERSION,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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