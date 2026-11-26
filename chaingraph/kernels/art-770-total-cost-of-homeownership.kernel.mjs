// art-770-total-cost-of-homeownership — port of ApexLogics Apex #153 "Total Cost of
// Homeownership" (AL-167, tool_id 153-total-cost-of-homeownership) inline calculate(),
// landed from the APEXPORT-153 porting payload (GRADES PASS-PENDING-XV 2026-10-18;
// Builder-verifies-at-land per Tim 2026-10-17: 35/35 payload fixture vectors re-executed
// through compute() matching the stored outputs — 3 live vectors plus 14 boundary pairs
// (32 sides), APEX-PORT-153-LAND-1).
//
// Source bytes pinned in APEXPORT-153-REPORT.md (Apex page 53373 bytes,
// sha256 D6015F52F3099C412879F6D23DE00A616F48E3CBB9970DD2C657961AEA307AA3,
// fetched 2026-10-13). Apex HTML line numbers cited below as "Apex L<n>".
//
// Pure function: no Date, no clock, no randomness, no I/O. The Apex page calls
// new Date() ONLY in exportMarkdown/exportAP2 display strings (Apex ~L696, ~L743),
// never in the arithmetic, so there is no wall-clock branch to parameterize and no
// as-of input is needed (the APEXPORT-110B as-of pattern does not apply).
//
// GROUNDING / DIFFERS (see APEXPORT-153 payload CITES.md / DIFFERS.md):
// - D1: SALT deduction cap default. Apex uses $10,000 with a falsy `|| 10000`
//   fallback (Apex ~L287, ~L483). The official 2026 figure is $40,400
//   (26 USC 164(b)(7)(A)(ii); Pub. L. 119-21). The Apex fallback is PRESERVED in
//   the arithmetic for vector fidelity; the official figure is carried beside it
//   as SALT_CAP_OFFICIAL_2026 and documented in the manifest and page hint.
// - D2: MI drop threshold. Apex models a single 80% leg (borrower-requested
//   cancellation, 12 USC 4901(2)/4902(a)). The 78% automatic-termination leg
//   (12 USC 4901(18)/4902(b)) is NOT modeled; MI_AUTO_TERMINATE_LTV is carried
//   as an informational constant only.
// - D3: LTV denominator is the purchase price (Apex ~L520), not the HPA
//   "lesser of sales price or appraised value" — the tool takes no appraisal input.
// - D4: deduction-benefit formula is the Apex simplification (Apex ~L558): no
//   itemize-vs-standard threshold, no acquisition-indebtedness limit.
// - H0-H3 (deliberate browser divergences, declared, no number changed): refusal
//   and success carry the SAME output_payload keys (art-704 convention); no DOM
//   side effects or alert(); loanBalanceAtExit keeps the raw float (amortization
//   dust preserved); the cSaltCap falsy quirk is preserved exactly.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-770-total-cost-of-homeownership';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-167',
  tool_id: '153-total-cost-of-homeownership',
  display_number: '#153',
  page_url: 'https://apexlogics.org/tools/153-total-cost-of-homeownership/',
  page_bytes: 53373,
  page_sha256: 'D6015F52F3099C412879F6D23DE00A616F48E3CBB9970DD2C657961AEA307AA3',
  fetch_date: '2026-10-13',
};

// --- Named literal constants (every Apex constant, commented) ---------------
// Apex clamps (calculate() sanitization):
export const PRICE_MAX = 50000000; // Apex: price = Math.min(price, 50000000)
export const TERM_MAX_YEARS = 40; // Apex: termYears = Math.min(termYears, 40)
export const TERM_MAX_MONTHS = 480; // Apex: n = Math.min(termYears*12, 480)
export const SELLING_PCT_MAX = 20; // Apex: sellingPct = clamp(sellingPct, 0, 20)
// Apex editable-constants panel defaults:
export const MI_DROP_LTV_DEFAULT = 0.80; // cMiDropLTV 80% (Apex ~L281); 12 USC 4901 cancellation date = 80% (CITES C3)
export const SALT_CAP_APEX_FALLBACK = 10000; // cSaltCap $10000 fallback `|| 10000` (Apex ~L483)
// Official 2026 SALT figure (DIFFERS D1): 26 USC 164(b)(7) gives $40,400 for tax
// years beginning in calendar year 2026 (CITES C1). The kernel PRESERVES the Apex
// 10000 fallback for vector fidelity (compute uses whatever saltCap the caller
// supplies); the page hint documents the $40,400 figure.
export const SALT_CAP_OFFICIAL_2026 = 40400; // 26 USC 164(b)(7)(A)(ii) (CITES C1)
// HPA automatic-termination level, NOT modeled by Apex (DIFFERS D2):
// 12 USC 4901(18) = 78%. Informational; Apex models only the 80% borrower-cancel leg.
export const MI_AUTO_TERMINATE_LTV = 0.78;
// Page defaults mirrored verbatim (Apex input value= attributes):
export const DEFAULTS = {
  price: 450000, downPct: 20, annualRate: 6.5, termYears: 30, closingPct: 2.5, miRatePct: 0.55,
  propertyTaxRate: 1.1, insuranceAnnual: 1800, hoaMonthly: 0, maintenancePct: 1.0, extraUtilities: 1200,
  appreciationPct: 3.0, taxGrowthPct: 2.0, inflationPct: 3.0, holdYears: 7, sellingPct: 6.0,
  oppRatePct: 5.0, marginalRatePct: 0, cMiDropLTVPct: 80, cSaltCap: 10000,
};
// cMaintenanceRuleOfThumb (default 1.0, Apex ~L291) is INFORMATIONAL ONLY —
// calculate() never reads it (the user's own maintenancePct input drives the math,
// Apex ~L484). It is therefore NOT a kernel input (manifest documents the exclusion).

const money = (n) => Math.round(n * 100) / 100;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, fb) => (typeof v === "number" && Number.isFinite(v) ? v : fb);

// growthFactor(ratePct, k): (1 + ratePct/100)^k via an integer loop, no Math.pow
// (Apex ~L442) — kept verbatim so outputs match the page to the digit.
function growthFactor(ratePct, k) {
  let f = 1;
  const g = 1 + ratePct / 100;
  for (let j = 0; j < k; j++) f = f * g;
  return f;
}

function refusedPayload(inputEcho, code, message) {
  return {
    output_payload: {
      inputs: inputEcho,
      downPayment: null, loanAmount: null, closingCosts: null, cashAtClose: null, monthlyPayment: null,
      totalInterest: null, totalPrincipal: null, totalMI: null,
      totalPropertyTax: null, totalInsurance: null, totalMaintenance: null, totalHOA: null,
      totalUtilities: null, deductibleBenefit: null, oppCost: null,
      homeValueAtExit: null, sellingCosts: null, loanBalanceAtExit: null, netSaleProceeds: null,
      equityFromPrincipal: null, equityFromAppreciation: null,
      grossCost: null, netCost: null, costPerMonth: null, netCostPerMonth: null,
      breakEvenMonthlyRent: null, shareBps: null, negativeAppreciation: null,
      refusal: code, message,
      // FLAG-MIRROR-DOCTRINE (AUTHORING-STANDARD 2.2): closed-list member so a
      // 21.4 chain gate can route on the refusal (H4 declared divergence from the
      // payload refusal shape, which carried no mirror member).
      domain_errors: [code],
    },
  };
}

/**
 * compute(pp) — pure port of Apex #153 inline calculate().
 * Sanitization mirrors calculate() exactly. A refusal carries the SAME keys as a
 * success (art-704 convention); only holdYears <= 0 is refused (Apex guard parity).
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const r = computeInner(pp);
  return {
    output_payload: r.output_payload,
    // Ternary construction (FLAGS-COMPUTED-LINT-1 sanctioned form): the flag is
    // emitted only when the hold comparator actually refused.
    compliance_flags: r.refused ? ["ART770_INPUT_REFUSED"] : [],
  };
}

function computeInner(pp) {
  if (pp === null || typeof pp !== "object") pp = {};
  // --- Sanitization mirrors calculate() exactly (Apex ~L453-484) ---
  let price = num(pp.price, 0); if (price < 0) price = 0;
  price = Math.min(price, PRICE_MAX);
  let downPct = num(pp.downPct, 20);
  downPct = clamp(downPct, 0, 100);
  let annualRate = num(pp.annualRate, 0); if (annualRate < 0) annualRate = 0;
  let termYears = num(pp.termYears, 30); if (termYears < 1) termYears = 30;
  termYears = Math.min(termYears, TERM_MAX_YEARS);
  let closingPct = num(pp.closingPct, 0); if (closingPct < 0) closingPct = 0;
  let miRatePct = num(pp.miRatePct, 0); if (miRatePct < 0) miRatePct = 0;
  let propertyTaxRate = num(pp.propertyTaxRate, 0); if (propertyTaxRate < 0) propertyTaxRate = 0;
  let insuranceAnnual = num(pp.insuranceAnnual, 0); if (insuranceAnnual < 0) insuranceAnnual = 0;
  let hoaMonthly = num(pp.hoaMonthly, 0); if (hoaMonthly < 0) hoaMonthly = 0;
  let maintenancePct = num(pp.maintenancePct, 0); if (maintenancePct < 0) maintenancePct = 0;
  let extraUtilities = num(pp.extraUtilities, 0); if (extraUtilities < 0) extraUtilities = 0;
  let appreciationPct = num(pp.appreciationPct, 0);
  let taxGrowthPct = num(pp.taxGrowthPct, 0);
  let inflationPct = num(pp.inflationPct, 0);
  // Apex: parseInt(holdYears, 10); NaN -> 0 -> refusal. Truncate non-integers the same way.
  let holdYears = typeof pp.holdYears === "number" && Number.isFinite(pp.holdYears)
    ? Math.trunc(pp.holdYears) : 0;
  let sellingPct = num(pp.sellingPct, 0); if (sellingPct < 0) sellingPct = 0;
  sellingPct = clamp(sellingPct, 0, SELLING_PCT_MAX);
  let oppRatePct = num(pp.oppRatePct, 0);
  let marginalRatePct = num(pp.marginalRatePct, 0); if (marginalRatePct < 0) marginalRatePct = 0;
  // Apex: parseFloat(cMiDropLTV) -> finite ? /100 : 0.80
  const cMiDropRaw = typeof pp.cMiDropLTVPct === "number" ? pp.cMiDropLTVPct : NaN;
  const miDropLTV = Number.isFinite(cMiDropRaw) ? cMiDropRaw / 100 : MI_DROP_LTV_DEFAULT;
  // Apex: parseFloat(cSaltCap) || 10000 — falsy (0/NaN/absent) falls back. Preserved (DIFFERS D1).
  const cSaltRaw = typeof pp.cSaltCap === "number" ? pp.cSaltCap : NaN;
  const cSaltCap = cSaltRaw || SALT_CAP_APEX_FALLBACK;

  const inputs = {
    price, downPct, annualRate, termYears, closingPct, miRatePct, propertyTaxRate,
    insuranceAnnual, hoaMonthly, maintenancePct, extraUtilities, appreciationPct,
    taxGrowthPct, inflationPct, holdYears, sellingPct, oppRatePct, marginalRatePct,
    cMiDropLTVPct: Number.isFinite(cMiDropRaw) ? cMiDropRaw : 80, cSaltCap,
  };

  // Comparator C-hold: holdYears <= 0 -> Apex shows 'Years you plan to stay must be
  // at least 1.' and returns with stale results (H0: returned as a value here).
  if (holdYears <= 0) {
    return { output_payload: refusedPayload(inputs, "REFUSED_BAD_HOLD_YEARS",
      "Years you plan to stay must be at least 1.").output_payload, refused: true };
  }

  // Step 1: loan setup
  const downPayment = money(price * downPct / 100);
  const loanAmount = money(price - downPayment);
  const closingCosts = money(price * closingPct / 100);
  const cashAtClose = money(downPayment + closingCosts);

  // Step 2: monthly payment (standard amortization; integer power loop like Apex)
  const i = annualRate / 100 / 12;
  const n = Math.min(termYears * 12, TERM_MAX_MONTHS);
  let monthlyPayment;
  if (loanAmount <= 0) {
    monthlyPayment = 0;
  } else if (i === 0) {
    monthlyPayment = money(loanAmount / n);
  } else {
    let f = 1;
    for (let k = 0; k < n; k++) f = f * (1 + i);
    monthlyPayment = money(loanAmount * i * f / (f - 1));
  }

  // Step 3: amortize month by month for holdYears*12 months (capped at n).
  // MI charged while post-payment LTV is STRICTLY above miDropLTV (Apex ~L521).
  const monthsToAmortize = Math.min(holdYears * 12, n);
  let balance = loanAmount;
  let totalInterestRaw = 0, totalPrincipalRaw = 0, totalMIRaw = 0;
  if (loanAmount > 0) {
    for (let m = 0; m < monthsToAmortize; m++) {
      const interestM = balance * i;
      let principalM = monthlyPayment - interestM;
      if (principalM > balance) {
        principalM = balance;
      }
      balance = balance - principalM;
      const ltv = balance / price;
      const miM = (ltv > miDropLTV) ? (loanAmount * miRatePct / 100 / 12) : 0;
      totalInterestRaw += interestM;
      totalPrincipalRaw += principalM;
      totalMIRaw += miM;
    }
  }
  if (holdYears * 12 > n) balance = 0;
  // H2 preserved: loanBalanceAtExit is the RAW float balance (amortization dust kept),
  // not money-rounded, exactly as Apex returns it.
  const totalInterest = money(totalInterestRaw);
  const totalPrincipal = money(totalPrincipalRaw);
  const totalMI = money(totalMIRaw);

  // Step 4: property tax by year (assessed on purchase price, grown by taxGrowthPct)
  const taxYear1 = price * propertyTaxRate / 100;
  let totalPropertyTaxRaw = 0;
  for (let y = 1; y <= holdYears; y++) totalPropertyTaxRaw += taxYear1 * growthFactor(taxGrowthPct, y - 1);
  const totalPropertyTax = money(totalPropertyTaxRaw);

  // Step 5: insurance, maintenance, HOA, utilities by year (grown by inflationPct)
  const maintenanceYear1 = price * maintenancePct / 100;
  const hoaYear1 = hoaMonthly * 12;
  const utilitiesYear1 = extraUtilities;
  let totalInsuranceRaw = 0, totalMaintenanceRaw = 0, totalHOARaw = 0, totalUtilitiesRaw = 0;
  for (let y = 1; y <= holdYears; y++) {
    const gf = growthFactor(inflationPct, y - 1);
    totalInsuranceRaw += insuranceAnnual * gf;
    totalMaintenanceRaw += maintenanceYear1 * gf;
    totalHOARaw += hoaYear1 * gf;
    totalUtilitiesRaw += utilitiesYear1 * gf;
  }
  const totalInsurance = money(totalInsuranceRaw);
  const totalMaintenance = money(totalMaintenanceRaw);
  const totalHOA = money(totalHOARaw);
  const totalUtilities = money(totalUtilitiesRaw);

  // Step 6: tax deduction offset — (interest + min(propertyTax, saltCap*holdYears))
  // * marginalRate. Apex simplification preserved (DIFFERS D4): no itemize-vs-standard
  // threshold, no acquisition-indebtedness limit. Premises grounded at CITES C1
  // (164: real-property tax deductible) + C2 (163(h): qualified residence interest)
  // + C5 (standard deduction — enter 0 if standard; page hint).
  const saltCapAcrossYears = cSaltCap * holdYears;
  const deductibleBenefit = money((totalInterest + Math.min(totalPropertyTax, saltCapAcrossYears)) * marginalRatePct / 100);

  // Step 7: opportunity cost — cashAtClose compounding annually at oppRatePct
  // (accrual reuse: art-661 pattern).
  let oppCostRaw = 0, runningCash = cashAtClose;
  for (let y = 1; y <= holdYears; y++) {
    const gain = runningCash * oppRatePct / 100;
    oppCostRaw += gain;
    runningCash += gain;
  }
  const oppCost = money(oppCostRaw);

  // Step 8: home value at exit (annual compounding loop, like Apex ~L571)
  let homeValue = price;
  for (let y = 1; y <= holdYears; y++) homeValue = homeValue * (1 + appreciationPct / 100);
  const homeValueAtExit = money(homeValue);

  // Step 9: sale proceeds
  const sellingCosts = money(homeValueAtExit * sellingPct / 100);
  const netSaleProceeds = money(homeValueAtExit - sellingCosts - balance);

  // Step 10: equity built
  const equityFromPrincipal = money(totalPrincipal);
  const equityFromAppreciation = money(homeValueAtExit - price);

  // Step 11: gross cost of ownership
  const grossCost = money(closingCosts + totalInterest + totalMI + totalPropertyTax + totalInsurance + totalMaintenance + totalHOA + totalUtilities + sellingCosts + oppCost - deductibleBenefit);

  // Step 12: net cost after equity (appreciation only; principal excluded from gross already)
  const netCost = money(grossCost - equityFromAppreciation);

  // Steps 13-14: per-month figures; break-even rent = net monthly
  const costPerMonth = money(grossCost / (holdYears * 12));
  const netCostPerMonth = money(netCost / (holdYears * 12));
  const breakEvenMonthlyRent = netCostPerMonth;

  // Step 15: cost composition in basis points (positive legs; deduction reported negative)
  const components = {
    closingCosts, totalInterest, totalMI, totalPropertyTax, totalInsurance,
    totalMaintenance, totalHOA, totalUtilities, sellingCosts, oppCost,
  };
  const shareBps = {};
  for (const key in components) {
    shareBps[key] = Math.round(components[key] / Math.max(grossCost, 0.01) * 10000);
  }
  shareBps.deductibleBenefit = Math.round(-deductibleBenefit / Math.max(grossCost, 0.01) * 10000);

  return {
    output_payload: {
      inputs,
      downPayment, loanAmount, closingCosts, cashAtClose, monthlyPayment,
      totalInterest, totalPrincipal, totalMI,
      totalPropertyTax, totalInsurance, totalMaintenance, totalHOA, totalUtilities,
      deductibleBenefit, oppCost,
      homeValueAtExit, sellingCosts, loanBalanceAtExit: balance, netSaleProceeds,
      equityFromPrincipal, equityFromAppreciation,
      grossCost, netCost, costPerMonth, netCostPerMonth, breakEvenMonthlyRent,
      shareBps, negativeAppreciation: appreciationPct < 0,
      refusal: null, message: null,
      domain_errors: [],
    },
    refused: false,
  };
}

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'total_cost_of_homeownership',
  mandate_type: 'consumer_finance', gpu: false,
};

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
