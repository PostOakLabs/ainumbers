// kernel.draft.mjs -- DRAFT for trusted builder registration as
//   chaingraph/kernels/art-767-compute-travel-nurse-vs-staff-comp.kernel.mjs
//
// PORT OF: Apex #132 "Travel Nurse vs. Staff Comp" (al_id AL-139, tool_id
// 132-travel-nurse-vs-staff-comp), page compute `calculate()`, page lines
// 329-379 of the 34,826-byte snapshot sha256
// d40048feb51036a660d3d66cd08f97aa88f654c852b9f7714975e885138a748b fetched
// 2026-10-15 from https://apexlogics.org/tools/132-travel-nurse-vs-staff-comp/.
// Provenance + verbatim re-extraction harness: ../provenance/apex-reference.mjs.
//
// NOT TAX ADVICE, AND NOT A DETERMINATION OF ANY STIPEND'S TAX TREATMENT. This
// node models a cash-flow comparison under a caller-asserted tax treatment. It
// performs no tax research, applies no bracket, and validates nothing.
//
// ─────────────────────────────────────────────────────────────────────────────
// READ THIS BEFORE REGISTERING: THE PAGE SWALLOWS ZERO ON ALL FOURTEEN INPUTS.
// ─────────────────────────────────────────────────────────────────────────────
// The page reads every control as `parseFloat(el.value) || <default>`. `0` is
// falsy in JavaScript, so an input of 0 -- and an empty, non-numeric, or blank
// control -- does NOT compute as 0. It silently reverts to the page default.
// The user who types "0" into "Weekly Housing Stipend" gets $1,200/week. The
// user who types "0" into "Effective Tax Rate" gets 22%, not 0%. This is
// reproduced here exactly, because it is observable behaviour of the shipped
// tool and the port is a port, not a redesign. It is NOT a convention worth
// copying into new code: the trusted builder should treat it as a defect to
// report upstream, and the DIFFERS.md row "zero-input-default-substitution" is
// the standing record. Each of the fourteen is flagged per call below and each
// has its own flipping boundary pair in fixtures.json.
//
// A second consequence, and the reason the division guard looks unreachable: the
// guard `totalHoursWorked > 0` cannot be reached AT 0. Its three factors are
// travelHours, contractWeeks and contractsPerYear, and 0 on any of them is
// swallowed by the guard above, substituting 36 / 13 / 3. The guard's reachable
// flip is therefore a SIGN boundary, not a zero crossing -- see
// B33-total-hours-worked-division-guard in fixtures.json.
//
// ─────────────────────────────────────────────────────────────────────────────
// WALL CLOCK: none. The page's arithmetic block (lines 329-379) contains no
// Date, no new Date and no performance.now; verified mechanically, see CITES.md
// and the `clock_dependency` probe in ../provenance/verify-parity.mjs. The only
// clock read on the page is `generated_at: new Date().toISOString()` inside the
// AP2 *envelope* (line 461), which never enters the computation. buildArtifact()
// below therefore takes `now` as an explicit parameter and defaults it to null
// (the APEXPORT-110B pattern), so the hashed envelope is deterministic and
// zkVM-promotable rather than clock-dependent.
//
// ─────────────────────────────────────────────────────────────────────────────
// ROUNDING: none inside output_payload. The page rounds in exactly two places --
// `fmt`/`fmtHr` at render (Math.round for dollars, toFixed(2) for the hourly
// rate) and the AP2 export (Math.round on the money, Math.round(x*100)/100 on
// the rate). output_payload carries the unrounded IEEE-754 doubles the page
// computes, so parity is exact rather than 2dp-approximate. The AINumbers r2
// convention is deliberately NOT applied here; see DIFFERS.md row
// "no-intermediate-rounding-vs-ainumbers-r2".
//
// NO VALIDATION. The page's HTML `min`/`max` attributes are browser hints only:
// calculate() never reads them, and a negative or absurd value flows straight
// through (it is truthy, so `||` lets it by). This kernel adds no clamping,
// because clamping would silently diverge from the live tool. The accepted
// range is documented in manifest.draft.json as metadata only.

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id: 'art-767-compute-travel-nurse-vs-staff-comp',
  tool_version: '1.0.0',
  mcp_name: 'compute_travel_nurse_pay',
  mandate_type: 'compliance_control',
  gpu: false,
};

// ── Page defaults, literals, from page lines 330-343 `|| <default>` ─────────
// Every one of these is the page's own fallback. None is an authoritative
// 2026 figure: the page's own MANIFEST labels the tool "... GSA M&IE rates
// 2025 — user-input rates", i.e. illustrative placeholders, not published
// figures. DIFFERS.md rows "mie-weekly-default" and "housing-weekly-default"
// carry the FY2026 CONUS figures this node deliberately does NOT substitute.
const DEFAULT_STAFF_RATE_USD_HR = 38;
const DEFAULT_STAFF_HOURS_WK = 36;
const DEFAULT_STAFF_BENEFITS_USD_YR = 12000;
const DEFAULT_STAFF_WEEKS_YR = 50;
const DEFAULT_TAX_RATE = 0.22;
const DEFAULT_TRAVEL_BASE_USD_HR = 22;
const DEFAULT_HOUSING_STIPEND_USD_WK = 1200;
const DEFAULT_MIE_STIPEND_USD_WK = 350;
const DEFAULT_CONTRACT_WEEKS = 13;
const DEFAULT_CONTRACTS_PER_YEAR = 3;
const DEFAULT_GAP_WEEKS = 3;
const DEFAULT_TRAVEL_HOURS_WK = 36;
const DEFAULT_TRAVEL_COST_USD_CONTRACT = 1500;
const DEFAULT_TTP_HOUSING_USD_WK = 200;

// ── Official figures carried for the builder's convenience, NOT used ────────
// GSA FY2026 CONUS standard rate, fetched 2026-10-15 from
// https://www.gsa.gov/system/files/FY2026_PerDiemMasterRatesFile.xlsx
// (42,276 bytes, sha256 5a3214fdafa1034799e2ff61d8997cface1a1ff0322be3efad78595b12b4e244),
// sheet row 3: "Standard CONUS rate applies to all counties not specifically
// listed", FY26 Lodging Rate = 110, FY26 M&IE = 68. These govern FEDERAL
// agency travel under title 41 of the Code of Federal Regulations; a nurse private staffing
// contract is not bound by them. They are exported so the builder can see, in
// one place, that the page's defaults are not the federal rates.
export const REFERENCE_FY2026_CONUS = {
  lodging_usd_per_night: 110,
  mie_usd_per_day: 68,
  mie_usd_per_week_7day: 68 * 7,               // 476
  mie_usd_per_week_first_last_day_rule: 5 * 68 + 2 * 51, // 5 full days + 2 at 75%
  lodging_usd_per_week_7night: 110 * 7,         // 770
  source_url: 'https://www.gsa.gov/system/files/FY2026_PerDiemMasterRatesFile.xlsx',
  source_sha256: '5a3214fdafa1034799e2ff61d8997cface1a1ff0322be3efad78595b12b4e244',
  binding: false,
};

// parseFloat, then `|| default`. Reproduces the page exactly, including the
// zero/NaN/blank swallow described at the top of this file. Returns the
// resolved value and whether the default was substituted.
/**
 * @param {*} raw
 * @param {number} fallback
 * @returns {{v: number, defaulted: boolean}}
 */
function apexRead(raw, fallback) {
  const n = parseFloat(raw);
  if (n === n && n !== 0) return { v: n, defaulted: false };
  // n !== n catches NaN; n === 0 and all other falsy parse results take the
  // page's `||` branch, exactly as the shipped page does.
  return { v: fallback, defaulted: true };
}

export function compute(pp) {
  pp = pp || {};

  const defaultsUsed = [];

  // ── STAFF SIDE ────────────────────────────────────────────────────────────
  const rStaffRate = apexRead(pp.staffRate, DEFAULT_STAFF_RATE_USD_HR);
  const rStaffHours = apexRead(pp.staffHours, DEFAULT_STAFF_HOURS_WK);
  const rStaffBenefits = apexRead(pp.staffBenefits, DEFAULT_STAFF_BENEFITS_USD_YR);
  const rStaffWeeks = apexRead(pp.staffWeeks, DEFAULT_STAFF_WEEKS_YR);
  // The page's only divided input: `parseFloat(...) / 100 || 0.22`. The /100
  // happens BEFORE the falsy test, so taxRate = 0 becomes 0/100 = 0, which is
  // falsy, which reverts to 0.22. Same swallow as every other input.
  const taxRateRaw = apexRead(pp.taxRate, NaN);
  const rTaxRate = apexRead(taxRateRaw.v / 100, DEFAULT_TAX_RATE);

  // ── TRAVEL SIDE ───────────────────────────────────────────────────────────
  const rTravelBase = apexRead(pp.travelBase, DEFAULT_TRAVEL_BASE_USD_HR);
  const rHousingStipend = apexRead(pp.housingStipend, DEFAULT_HOUSING_STIPEND_USD_WK);
  const rMieStipend = apexRead(pp.mieStipend, DEFAULT_MIE_STIPEND_USD_WK);
  const rContractWeeks = apexRead(pp.contractWeeks, DEFAULT_CONTRACT_WEEKS);
  const rContractsPerYear = apexRead(pp.contractsPerYear, DEFAULT_CONTRACTS_PER_YEAR);
  const rGapWeeks = apexRead(pp.gapWeeks, DEFAULT_GAP_WEEKS);
  const rTravelHours = apexRead(pp.travelHours, DEFAULT_TRAVEL_HOURS_WK);
  const rTravelCost = apexRead(pp.travelCost, DEFAULT_TRAVEL_COST_USD_CONTRACT);
  const rTtpHousingCost = apexRead(pp.ttpHousingCost, DEFAULT_TTP_HOUSING_USD_WK);

  /** @type {Array<[string, {v: number, defaulted: boolean}]>} */
  const reads = [
    ['staffRate', rStaffRate], ['staffHours', rStaffHours],
    ['staffBenefits', rStaffBenefits], ['staffWeeks', rStaffWeeks],
    ['taxRate', rTaxRate], ['travelBase', rTravelBase],
    ['housingStipend', rHousingStipend], ['mieStipend', rMieStipend],
    ['contractWeeks', rContractWeeks], ['contractsPerYear', rContractsPerYear],
    ['gapWeeks', rGapWeeks], ['travelHours', rTravelHours],
    ['travelCost', rTravelCost], ['ttpHousingCost', rTtpHousingCost],
  ];
  for (const [name, r] of reads) if (r.defaulted) defaultsUsed.push(name);

  const staffRate = rStaffRate.v;
  const staffHours = rStaffHours.v;
  const staffBenefits = rStaffBenefits.v;
  const staffWeeks = rStaffWeeks.v;
  const taxRate = rTaxRate.v;
  const travelBase = rTravelBase.v;
  const housingStipend = rHousingStipend.v;
  const mieStipend = rMieStipend.v;
  const contractWeeks = rContractWeeks.v;
  const contractsPerYear = rContractsPerYear.v;
  const gapWeeks = rGapWeeks.v;
  const travelHours = rTravelHours.v;
  const travelCost = rTravelCost.v;
  const ttpHousingCost = rTtpHousingCost.v;

  // STAFF (page lines 346-348)
  const staffGrossAnnual = staffRate * staffHours * staffWeeks;
  const staffNetAnnual = staffGrossAnnual * (1 - taxRate) + staffBenefits;
  // The apples-to-apples comparator: staff net EXCLUDING benefits.
  const staffNetNoFringe = staffGrossAnnual * (1 - taxRate);

  // TRAVEL (page lines 351-359)
  const weeksWorked = contractWeeks * contractsPerYear;
  const totalAnnualGapWeeks = gapWeeks * contractsPerYear;
  const travelTaxableAnnual = travelBase * travelHours * weeksWorked;
  // Caller-asserted tax-free. Nothing in this node establishes that a housing
  // stipend or an M&IE allowance is excludable; see the header and CITES.md.
  const housingAnnual = housingStipend * weeksWorked;
  const mieAnnual = mieStipend * weeksWorked;
  const travelTaxableNet = travelTaxableAnnual * (1 - taxRate);
  const travelTravelCostAnnual = travelCost * contractsPerYear;
  const ttpHousingCostAnnual = ttpHousingCost * weeksWorked;
  const travelNetAnnual = travelTaxableNet + housingAnnual + mieAnnual
    - travelTravelCostAnnual - ttpHousingCostAnnual;

  // Stipend tax savings (page line 362): what the stipends would have cost the
  // nurse had they been taxed at the same assumed effective rate. It is a
  // counterfactual on an asserted treatment, not a tax computation.
  const stipendTaxSavings = (housingAnnual + mieAnnual) * taxRate;
  // Opportunity cost of the unpaid gap weeks, valued at the STAFF rate (page
  // line 363) -- note this is the only place gapWeeks enters an output.
  const gapCost = staffRate * travelHours * totalAnnualGapWeeks;

  // Effective all-in travel rate (page lines 366-367). Strict `> 0`, so a
  // negative totalHoursWorked yields 0 and exactly-zero totalHoursWorked is
  // unreachable through the inputs (see header).
  const totalHoursWorked = travelHours * weeksWorked;
  const effectiveHourly = totalHoursWorked > 0 ? travelNetAnnual / totalHoursWorked : 0;

  // Head-to-head delta (page line 369), both sides benefit-free.
  const delta = travelNetAnnual - staffNetNoFringe;
  // The page's winner test, lifted out of renderResults (page line 384) so it
  // is a kernel output rather than a rendering side effect.
  const travelWins = travelNetAnnual > staffNetNoFringe;

  const compliance_flags = ['NOT_TAX_ADVICE', 'STIPEND_TAX_TREATMENT_CALLER_ASSERTED'];
  if (defaultsUsed.length > 0) {
    compliance_flags.push('ZERO_OR_BLANK_INPUT_SUBSTITUTED_BY_PAGE_DEFAULT');
    compliance_flags.push('DEFAULTS_APPLIED:' + defaultsUsed.join(','));
  }
  if (totalHoursWorked <= 0) compliance_flags.push('EFFECTIVE_HOURLY_GUARD_RETURNED_ZERO');
  const negatives = reads.filter(([, r]) => r.v < 0).map(([n]) => n);
  if (negatives.length > 0) compliance_flags.push('NEGATIVE_INPUT_ACCEPTED:' + negatives.join(','));
  if (travelNetAnnual < 0) compliance_flags.push('NEGATIVE_TRAVEL_NET');
  if (taxRate > 0 && taxRate < 1) {
    compliance_flags.push('STIPEND_TAX_SAVINGS_COUNTERFACTUAL_ON_ASSUMED_EFFECTIVE_RATE');
  }

  const output_payload = {
    // resolved inputs, in the page's own order
    staffRate, staffHours, staffBenefits, staffWeeks, taxRate,
    travelBase, housingStipend, mieStipend, contractWeeks,
    contractsPerYear, gapWeeks, travelHours, travelCost, ttpHousingCost,
    // page line 376 order, plus the two locals the page keeps to itself
    staffGrossAnnual, staffNetAnnual, staffNetNoFringe,
    travelTaxableAnnual, housingAnnual, mieAnnual, travelTaxableNet,
    travelTravelCostAnnual, ttpHousingCostAnnual, travelNetAnnual,
    stipendTaxSavings, gapCost, effectiveHourly, delta, weeksWorked,
    totalAnnualGapWeeks, totalHoursWorked, travelWins,
    inputs_defaulted: defaultsUsed,
  };

  return { output_payload, compliance_flags };
}

/**
 * Deterministic envelope. `now` is an explicit parameter defaulting to null --
 * never a clock read -- so the artifact is zkVM-promotable (APEXPORT-110B
 * pattern), and the execution hash comes from the vendored
 * chaingraph/kernels/_hash.mjs per the repo-wide kernel identity rule
 * (the repo kernel identity rule).
 */
export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: meta.tool_id,
    tool_version: meta.tool_version,
    generated_at: now,
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

