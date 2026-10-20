// art-757-dual-career-household-optimizer — port of ApexLogics Apex #92 "Dual-Career Household
// Optimizer" (AL-99, tool_id 92-dual-career-household-optimizer) inline compute,
// landed from the APEXPORT-92 porting payload (bus farm-ps, payload commit
// 88e58801c, GRADES PASS-PENDING-XV 2026-10-14, Builder-verifies-at-land per
// Tim 2026-10-18T21:20Z: 22/22 payload fixture vectors re-executed through
// compute() matching the stored outputs, APEX-PORT-92-LAND-1).
//
// Source bytes pinned in APEXPORT-92-REPORT.md (Apex page 53859 bytes,
// sha256 b0e6c6712213c422910aa6659a4bfb18d4f5e96922e7b9837b49d473d88ae79a,
// fetched 2026-10-13T20:56:01-04:00). The GRADES block records a later live-page
// drift of exactly -367 bytes (53859 -> 53492) entirely outside the inline
// script (snapshot-provenance-only, APEXPORT-159 page-drift class, non-decisive).
//
// Pure function: no Date, no clock, no randomness, no I/O. The Apex page calls
// `new Date().toISOString()` / `toLocaleString()` ONLY inside buildPayload /
// exportMarkdown / exportAP2 (payload `generated_at` stamp), never in the
// arithmetic, so per the APEXPORT-110B pattern the kernel takes an explicit
// `asOf` input (ISO string; null when absent) and never reads a clock.
//
// GROUNDING / VINTAGE (see APEXPORT-92 payload CITES.md / DIFFERS.md):
// - CITY_COL_INDEX is the Apex page's own cost-of-living select table. UNGROUNDED
//   (Apex-internal index, no official counterpart found this run); kept verbatim,
//   user-overridable via the origin/dest COL inputs.
// - DATA_VINTAGE_LABEL carries the page banner "BLS CES 2024 · ChildCare Aware of
//   America 2024". The BLS CES 2024 leg is UNGROUNDED this run (BLS bot-wall
//   denied fetch); it is informational only — NO numeric CES constant enters the
//   arithmetic (payload DIFFERS.md Row 3, NO SUBSTITUTION POSSIBLE).
// - ChildCare Aware 2024 national average $13,128 GROUNDED (CCA price-landscape24);
//   the page's $25,000/yr default is an infant-center hint, a DIFFERENT statistic —
//   NOT A CONFLICT (payload DIFFERS.md Row 1): kept as the page default, user-
//   overridable; the kernel embeds NO childcare price constant.
// - Tax rate is a user-supplied effective rate (default 28); no statutory bracket
//   table is embedded (payload DIFFERS.md Row 2, NO DIFFERS).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-757-dual-career-household-optimizer';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-99',
  tool_id: '92-dual-career-household-optimizer',
  display_number: '#92',
  page_url: 'https://apexlogics.org/tools/92-dual-career-household-optimizer/',
  page_bytes: 53859,
  page_sha256: 'b0e6c6712213c422910aa6659a4bfb18d4f5e96922e7b9837b49d473d88ae79a',
  fetch_date: '2026-10-13T20:56:01-04:00',
};

// --- Named constants (all values literal from the Apex page) ----------------

// Apex Tab 2 comment: "Each year the gap compounds. Simplified: gap in first
// year * future value factor for 10 years" with loop `for (yr = 1; yr <= 10; yr++)`.
export const SABBATICAL_HORIZON_YEARS = 10; // Apex calculateTab2 loop bound (inline JS)

// Apex Tab 3: "Assume 3 months average job search per $10k salary band":
// `breakEvenMonths = Math.round((salCut / 10000) * 3)`.
export const BREAK_EVEN_MONTHS_PER_10K_SALARY_BAND = 3; // months per $10,000 of Partner B pay cut
export const SALARY_BAND_SIZE_USD = 10000; // denominator of the break-even-months heuristic

// Apex Tab 3 city COL index (select option values; NYC = 100 baseline).
// UNGROUNDED premise: Apex-internal index, no official counterpart found this run;
// kept verbatim as the page's lookup table, user-overridable via origin/dest COL inputs.
export const CITY_COL_INDEX = {
  "New York City": 100,
  "San Francisco": 98,
  "Boston": 87,
  "Washington DC": 84,
  "Chicago": 75,
  "Miami": 73,
  "Austin": 72,
  "Denver": 70,
  "Dallas": 70,
  "Atlanta": 68,
  "Phoenix": 67,
  "Houston": 65,
}; // Apex geoOriginCity/geoDestCity <option value="..."> list

// Data-vintage label carried from the page banner (informational only; no numeric
// constant from these vintages enters the arithmetic). BLS CES 2024 citation is
// UNGROUNDED this run (BLS bot-wall denied fetch; see CITES.md UNGROUNDED-1).
export const DATA_VINTAGE_LABEL = "BLS CES 2024 · ChildCare Aware of America 2024";

function num(v, fallback = 0) {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round0(n) {
  return Math.round(n);
}

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'dual_career_optimizer',
  mandate_type: 'career_workforce', gpu: false,
};

// Tab 1: childcare break-even. Mirrors Apex calculateTab1 line-for-line.
// Guard added (Apex has none): taxRate >= 100 makes (1 - t/100) <= 0, so
// breakEvenSalary would be Infinity/negative; the kernel returns null instead
// of a non-finite value and flags DIV_ZERO_GUARD.
function tab1(pp) {
  const salA = num(pp.partnerASalary);
  const salB = num(pp.partnerBSalary);
  const taxRate = num(pp.combinedTaxRate, 28);
  const childcareCost = num(pp.annualChildcareCost);
  const numChildren = Math.trunc(num(pp.numChildren, 1));
  const flags = [];

  const totalChildcare = childcareCost * numChildren;
  const keep = 1 - taxRate / 100;
  let breakEvenSalary = null;
  if (keep > 0) {
    breakEvenSalary = totalChildcare / keep;
  } else {
    flags.push("DIV_ZERO_GUARD");
  }
  const partnerBAfterTax = salB * keep;
  const netContrib = partnerBAfterTax - totalChildcare;
  const householdBothAfterTax = (salA + salB) * keep - totalChildcare;
  const householdOneAfterTax = salA * keep;
  const netGainBothWorking = householdBothAfterTax - householdOneAfterTax;

  return {
    totalChildcare: round0(totalChildcare),
    // Apex stores Math.round(breakEvenSalary); null when taxRate >= 100 (guard).
    childcareBreakevenSalary: breakEvenSalary === null ? null : round0(breakEvenSalary),
    netContribution: round0(netContrib),
    householdNetBothWorking: round0(householdBothAfterTax),
    householdNetOneStops: round0(householdOneAfterTax),
    netHouseholdGainFromBothWorking: round0(netGainBothWorking),
    verdicts: {
      // Apex: `if (salB < breakEvenSalary)` warning branch.
      belowBreakEven: breakEvenSalary === null ? null : salB < breakEvenSalary,
      // Apex: `netContrib >= 0 ? green : red`.
      netPositive: netContrib >= 0,
    },
    flags,
  };
}

// Tab 2: sabbatical true cost. Mirrors Apex calculateTab2, including the
// "subtract the direct loss already counted" step:
//   oppCost = sum_{yr=1..10} annualGap*(1+g/100)^yr - directLost.
function tab2(pp) {
  const salary = num(pp.sabbaticalSalary);
  const reduction = num(pp.sabbaticalReduction, 100);
  const months = num(pp.sabbaticalMonths, 12);
  const matchPct = num(pp.match401k, 4);
  const growthRate = num(pp.incomeGrowthRate, 3);

  const annualReduction = salary * (reduction / 100);
  const monthlyReduction = annualReduction / 12;
  const directLost = monthlyReduction * months;
  const matchLost = directLost * (matchPct / 100);
  const annualGap = (months / 12) * annualReduction;
  let oppCost = 0;
  for (let yr = 1; yr <= SABBATICAL_HORIZON_YEARS; yr++) {
    oppCost += annualGap * Math.pow(1 + growthRate / 100, yr);
  }
  oppCost = oppCost - directLost;
  const totalTrueCost = directLost + matchLost + oppCost;

  return {
    directIncomeLost: round0(directLost),
    matchLost: round0(matchLost),
    opportunityCost10yr: round0(oppCost),
    totalTrueCost: round0(totalTrueCost),
    verdicts: {
      // Apex: `if (totalTrueCost > salary)` long-term-cost warning branch.
      substantialCost: totalTrueCost > salary,
    },
    flags: [],
  };
}

// Tab 3: geo relocation. Mirrors Apex calculateTab3.
// Guards added (Apex has none): currentHousehold === 0 nulls the percentages;
// destCOL === 0 nulls the COL-adjusted leg; both flagged DIV_ZERO_GUARD.
function tab3(pp) {
  const aCurrentSal = num(pp.geoACurrentSalary);
  const aNewSal = num(pp.geoANewSalary);
  const bCurrentSal = num(pp.geoBCurrentSalary);
  const bNewSal = num(pp.geoBNewSalary);
  const originCOL = num(pp.geoOriginCity, 100);
  const destCOL = num(pp.geoDestCity, 100);
  const flags = [];

  const currentHousehold = aCurrentSal + bCurrentSal;
  const newHousehold = aNewSal + bNewSal;
  const nominalChange = newHousehold - currentHousehold;
  let nominalPct = null;
  if (currentHousehold !== 0) {
    nominalPct = (nominalChange / currentHousehold) * 100;
  } else {
    flags.push("DIV_ZERO_GUARD");
  }
  let colAdjNewHousehold = null;
  let colChange = null;
  let colPct = null;
  if (destCOL !== 0 && currentHousehold !== 0) {
    // Apex: `newHousehold * (originCOL / destCOL)` — dest terms restated in origin terms.
    colAdjNewHousehold = newHousehold * (originCOL / destCOL);
    colChange = colAdjNewHousehold - currentHousehold;
    colPct = (colChange / currentHousehold) * 100;
  } else {
    flags.push("DIV_ZERO_GUARD");
  }

  // Apex: card shown `if (bNewSal < bCurrentSal)`; hidden otherwise.
  let breakEvenMonths = null;
  if (bNewSal < bCurrentSal) {
    const salCut = bCurrentSal - bNewSal;
    breakEvenMonths = Math.round((salCut / SALARY_BAND_SIZE_USD) * BREAK_EVEN_MONTHS_PER_10K_SALARY_BAND);
  }

  return {
    currentHousehold: round0(currentHousehold),
    newHousehold: round0(newHousehold),
    nominalChange: round0(nominalChange),
    nominalPct,
    colAdjustedChange: colChange === null ? null : round0(colChange),
    colPct,
    breakEvenMonths,
    verdicts: {
      // Apex: `nominalChange >= 0 ? green : red`.
      nominalGain: nominalChange >= 0,
      // Apex: `colChange >= 0 ? green : red`.
      colGain: colChange === null ? null : colChange >= 0,
      // Apex COL-trap warning: `nominalChange > 0 && colChange < 0`.
      colTrap: colChange === null ? null : nominalChange > 0 && colChange < 0,
      // Apex: Partner B cut branch `bNewSal < bCurrentSal`.
      partnerBCut: bNewSal < bCurrentSal,
      // Apex: `bNewSal === 0` no-job-lined-up warning branch.
      partnerBNoJob: bNewSal === 0,
    },
    flags,
  };
}

/**
 * compute(pp) — pure decision kernel (port of Apex #92 inline compute:
 * calculateTab1 / calculateTab2 / calculateTab3). The Apex page has no
 * refused-payload branch — every control carries an `|| fallback`; the kernel
 * mirrors that with num() defaults and DIV_ZERO_GUARD flags where Apex would
 * emit Infinity/NaN.
 * @param {object} pp policy_parameters (16 page controls by id, plus `asOf`)
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const t1 = tab1(pp);
  const t2 = tab2(pp);
  const t3 = tab3(pp);
  const asOf = typeof pp.asOf === "string" ? pp.asOf : null;
  const compliance_flags = [...t1.flags, ...t2.flags, ...t3.flags];
  const output_payload = {
    tool_id: TOOL_ID,
    apex_source: {
      al_id: APEX_SOURCE.al_id,
      display_number: APEX_SOURCE.display_number,
      slug: '92-dual-career-household-optimizer',
    },
    asOf,
    tab1: t1,
    tab2: t2,
    tab3: t3,
    compliance_flags,
  };
  return { output_payload, compliance_flags };
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

export default { compute };
