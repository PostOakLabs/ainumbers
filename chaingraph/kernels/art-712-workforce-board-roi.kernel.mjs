import { executionHash } from './_hash.mjs';

// art-712-workforce-board-roi — port of ApexLogics Apex #15 "Workforce Board ROI
// Report Generator" (AL-07, apexlogics.org/tools/15-workforce-board-roi-report/)
// into the AINumbers kernel shape: one pure `compute(pp)` returning
// { output_payload, compliance_flags }. Ported from the APEXPORT-WF15 payload
// (GRADES abc4e16d); provenance pins, grounded/ungrounded premises and fixture
// vectors live in the node metadata and the row's cited sources, never here.
//
// What it computes, from a program's cost + WIOA outcome data:
//   * cost-per-participant, cost-per-employed-exit(Q2), cost-per-credential;
//   * a 5-indicator benchmark scorecard vs WIOA targets (exceeds / meets / below / na), the
//     targets being the caller's negotiated levels via policy_parameters.wioa_targets or the
//     Apex illustrative defaults when not supplied;
//   * a wage-vs-sector-baseline gain, an annual taxpayer "tax recapture" estimate at a fixed
//     effective rate, a break-even horizon, a 3-year net benefit and a 3-year return per $1;
//   * an overall ROI grade (Excellent / Strong / Moderate / Below Target / Scored / Pending Data).
//
// DEVIATIONS FROM THE APEX SOURCE (both deliberate, both logged in the porting
// payload's DIFFERS record):
//   1. SECTOR_BASELINE_ANNUAL uses the OFFICIAL BLS QCEW Q3 2023 private-sector weekly wage x52,
//      NOT the Apex page's embedded 12 sector values. The Apex values do not match any QCEW
//      vintage checked (Q3 2023, 2023 annual, 2022 annual, 2021 annual). Per tasking, the
//      official value wins.
//   2. The Apex page uses alert()+early-return for missing required fields; this kernel returns a
//      named refusal payload instead, matching the AINumbers refusal plumbing.
//
// NUMERIC CONVENTION: this kernel keeps the Apex float arithmetic (USD dollars, percentages)
// so its outputs match the Apex tool's own vectors to the digit. AINumbers kernels prefer
// integer minor units; converting money to integer cents/micros is a recorded open question
// with the porting payload. No Date, no clock, no randomness: a pure function of pp.

const TOOL_ID = 'art-712-workforce-board-roi';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'workforce_board_roi_report',
  mandate_type: 'workforce_program_roi', gpu: false,
};

// ── WIOA performance targets: Apex illustrative defaults (5 indicators x 3 program types) ──
// Illustrative defaults carried from the Apex page (apex15.html lines 524-555); WIOA levels of
// performance are negotiated per State (20 CFR 677.190, adjusted by the statistical adjustment
// model, TEGL 11-19 Change 2) — no national value exists — so supply your State's negotiated
// levels via policy_parameters.wioa_targets. See the node metadata for the grounded indicator
// DEFINITIONS (the WIOA statute's five primary indicators and their performance-accountability
// regulation) and for the porting provenance of these values.
const WIOA_TARGETS_APEX_DEFAULTS = {
  adult: {
    label: 'Adult (Title I-B)',
    empRateQ2: 76.0,          // Employment Rate - Q2 after exit (%)
    empRateQ4: 74.0,          // Employment Rate - Q4 after exit (%)
    medianEarningsQ2: 6200,   // Median Earnings - Q2 after exit ($)
    credentialRate: 53.0,     // Credential Attainment Rate (%)
    skillGainsRate: 56.0,     // Measurable Skill Gains (%)
    empQ2Label: 'Employment Rate – Q2 After Exit (%)',
    empQ4Label: 'Employment Rate – Q4 After Exit (%)',
  },
  dislocated_worker: {
    label: 'Dislocated Worker (Title I-B)',
    empRateQ2: 76.0,
    empRateQ4: 73.0,
    medianEarningsQ2: 8100,
    credentialRate: 60.0,
    skillGainsRate: 53.0,
    empQ2Label: 'Employment Rate – Q2 After Exit (%)',
    empQ4Label: 'Employment Rate – Q4 After Exit (%)',
  },
  youth: {
    label: 'Youth (Title I-B)',
    empRateQ2: 67.0,          // Employment, Education, or Training Rate - Q2
    empRateQ4: 72.0,          // Employment, Education, or Training Rate - Q4
    medianEarningsQ2: 3400,   // Median Earnings Q2 (lower; many part-time/in-school)
    credentialRate: 68.0,
    skillGainsRate: 58.0,
    empQ2Label: 'Employment/Education/Training Rate – Q2 (%)',
    empQ4Label: 'Employment/Education/Training Rate – Q4 (%)',
  },
};

// ── Sector baseline annual wage ────────────────────────────────────────────────────────────────
// OFFICIAL BLS QCEW Q3 2023, private ownership (own_code 5), avg_wkly_wage x 52, fetched
// 2026-10-05 from https://data.bls.gov/cew/data/api/2023/3/area/US000.csv during the porting
// run. These REPLACE the Apex page's embedded values (apex15.html lines 562-575); each row
// differs — see the payload's DIFFERS record. public_admin is government ownership (QCEW
// "private" excludes it); the value used is NAICS 92 own_code 3 (local government). "other"
// has no NAICS counterpart; the value used is the all-industries private average (NAICS 10,
// own_code 5).
const SECTOR_BASELINE_ANNUAL = {
  healthcare:     62452,  // NAICS 62, Q3 2023 own 5 wk 1201 x52
  manufacturing:  77844,  // NAICS 31-33, wk 1497 x52
  construction:   75036,  // NAICS 23, wk 1443 x52
  it_tech:       153244,  // NAICS 51, wk 2947 x52
  retail:         40716,  // NAICS 44-45, wk 783 x52
  transportation: 62972,  // NAICS 48-49, wk 1211 x52
  finance:       112476,  // NAICS 52, wk 2163 x52
  education:      64480,  // NAICS 61, wk 1240 x52
  hospitality:    28600,  // NAICS 72, wk 550 x52
  professional:  114400,  // NAICS 54, wk 2200 x52
  public_admin:   69940,  // NAICS 92, own 3 (local govt), wk 1345 x52 — not a private sector
  other:          69056,  // NAICS 10 (all industries), own 5 — no NAICS counterpart
};

// Sector display labels (Apex apex15.html lines 562-575)
const SECTOR_LABELS = {
  healthcare: 'Healthcare & Social Assistance', manufacturing: 'Manufacturing',
  construction: 'Construction', it_tech: 'Information Technology', retail: 'Retail Trade',
  transportation: 'Transportation & Warehousing', finance: 'Financial Services & Insurance',
  education: 'Educational Services', hospitality: 'Accommodation & Food Services',
  professional: 'Professional & Business Services', public_admin: 'Public Administration',
  other: 'Other / Mixed Sectors',
};

// ── Tax premise ────────────────────────────────────────────────────────────────────────────────
// UNGROUNDED: "~30% combined effective rate (federal income + FICA + state avg.)" is the Apex
// page's modeling assumption (apex15.html line 675). No single official source publishes a 30%
// combined effective rate; the employee FICA share is grounded at 7.65% (IRS Topic 751) and
// flagged in the node metadata. Branch marked.
const TAX_RATE = 0.30;

// ── Benchmark comparators (apex15.html lines 644-651) ──────────────────────────────────────────
const EARNINGS_EXCEEDS_MULT = 1.05; // earnings: exceeds when userVal >= target*1.05
const PCT_EXCEEDS_MARGIN_PP = 2;    // percentage indicators: exceeds when userVal >= target+2 pp
const PCT_MEETS_MARGIN_PP = 1;      // percentage indicators: meets when userVal >= target-1 pp

// ── Grade thresholds (apex15.html lines 696-705) ───────────────────────────────────────────────
const GRADE_THRESHOLDS = [
  { grade: 'Excellent', returnMin: 2.0, metMin: 4, sub: 'Strong taxpayer return with benchmark-exceeding outcomes' },
  { grade: 'Strong',    returnMin: 1.5, metMin: 3, sub: 'Above-average return with solid WIOA benchmark performance' },
  { grade: 'Moderate',  returnMin: 1.0, metMin: 2, sub: 'Positive return; selected benchmarks need improvement' },
];
const GRADE_BELOW = { grade: 'Below Target', sub: 'Program may benefit from a strategic review' };
const GRADE_SCORED = { grade: 'Scored', sub: 'Enter median earnings to unlock full ROI grade' };
const GRADE_PENDING = { grade: 'Pending Data', sub: 'Enter outcome metrics to generate benchmark comparison' };
const BREAKEVEN_MONTH_YEAR_CUTOFF = 36; // display: <=36 -> ceil months, else years

const SCOPE_NOTE =
  'WIOA performance targets and BLS QCEW sector baselines are inputs to this tool; the sector ' +
  'baselines here are the official QCEW Q3 2023 private-sector weekly wage x52, and the WIOA ' +
  'targets are illustrative defaults carried from the Apex page; WIOA levels are negotiated per ' +
  'State (20 CFR 677.190) — supply your State\u2019s negotiated levels via policy_parameters' +
  '.wioa_targets. Tax recapture is a fixed 30% effective-rate assumption, not a statutory rate. ' +
  'No PII; a pure function of the declared program inputs.';

// ---------- refusal plumbing ----------

/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  const domain_errors = [{ code: reason, text }];
  // FLAG-COMPUTED convention (mirrors art-704's refused()): the refusal flag is pushed
  // behind the branch that checks the recorded domain_errors it attests — a conditional
  // emission, never a bare literal array (FLAGS-COMPUTED-LINT-1).
  const flags = [];
  if (domain_errors.length > 0) flags.push('ART712_INPUT_REFUSED');
  return {
    output_payload: {
      program_name: null, program_type: null, program_year: null, sector: null,
      cost_per_participant: null, employed_q2: null, credentialed: null,
      cost_per_employed_q2: null, cost_per_credential: null,
      benchmarks: [], indicators_scored: 0, indicators_met: 0, indicators_exceeded: 0,
      annualized_earnings: null, sector_baseline_annual: null, earnings_gain_annual: null,
      annual_tax_recapture: null, breakeven_months: null, three_year_net_benefit: null,
      return_per_dollar_3yr: null, grade: null, grade_sub: null,
      refusal_reason: reason, domain_errors, scope_note: SCOPE_NOTE,
      targets_source: null,
    },
    compliance_flags: flags,
  };
}

// ---------- validation ----------

const PROGRAM_TYPES = Object.keys(WIOA_TARGETS_APEX_DEFAULTS);
const SECTOR_KEYS = Object.keys(SECTOR_BASELINE_ANNUAL);
// One illustrative label — a single target table is NOT three program years: WIOA levels are
// negotiated per State (20 CFR 677.190) and program_year is echoed as a display label only.
const PROGRAM_YEARS = ['illustrative'];

/** @type {(v: unknown) => boolean} */
function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }
/** @type {(v: unknown) => boolean} null or a finite number */
function isNumOrNull(v) { return v === null || v === undefined || isFiniteNum(v); }

/** @type {(pp: object) => { output_payload: object, compliance_flags: string[] } | null} */
function validate(pp) {
  if (!pp || typeof pp !== 'object') return refused('REFUSED_NO_INPUT', 'pp must be an object of program inputs');
  if (!PROGRAM_TYPES.includes(pp.program_type)) {
    return refused('REFUSED_BAD_PROGRAM_TYPE', 'program_type must be one of ' + PROGRAM_TYPES.join(', '));
  }
  if (!SECTOR_KEYS.includes(pp.sector)) {
    return refused('REFUSED_BAD_SECTOR', 'sector must be one of ' + SECTOR_KEYS.join(', '));
  }
  if (!isFiniteNum(pp.total_budget) || !(pp.total_budget > 0)) {
    return refused('REFUSED_BAD_BUDGET', 'total_budget must be a number greater than 0');
  }
  if (!isFiniteNum(pp.participants_enrolled) || !(pp.participants_enrolled >= 1)) {
    return refused('REFUSED_BAD_ENROLLED', 'participants_enrolled must be a number >= 1');
  }
  const exited = pp.participants_exited;
  if (exited !== null && exited !== undefined && (!isFiniteNum(exited) || exited < 0)) {
    return refused('REFUSED_BAD_EXITED', 'participants_exited must be null or a number >= 0');
  }
  for (const k of ['emp_rate_q2', 'emp_rate_q4', 'credential_rate', 'skill_gains_rate']) {
    if (!isNumOrNull(pp[k])) return refused('REFUSED_BAD_PCT', k + ' must be null or a number');
    const v = pp[k];
    if (isFiniteNum(v) && (v < 0 || v > 100)) return refused('REFUSED_BAD_PCT', k + ' must be between 0 and 100');
  }
  if (!isNumOrNull(pp.median_earnings_q2)) {
    return refused('REFUSED_BAD_EARNINGS', 'median_earnings_q2 must be null or a number >= 0');
  }
  if (isFiniteNum(pp.median_earnings_q2) && pp.median_earnings_q2 < 0) {
    return refused('REFUSED_BAD_EARNINGS', 'median_earnings_q2 must be null or a number >= 0');
  }
  if (pp.wioa_targets !== null && pp.wioa_targets !== undefined) {
    const wt = pp.wioa_targets;
    if (!wt || typeof wt !== 'object' || Array.isArray(wt)) {
      return refused('REFUSED_BAD_WIOA_TARGETS', 'wioa_targets must be an object keyed by program type');
    }
    for (const k of Object.keys(wt)) {
      if (!PROGRAM_TYPES.includes(k)) {
        return refused('REFUSED_BAD_WIOA_TARGETS', 'wioa_targets keys must be among ' + PROGRAM_TYPES.join(', '));
      }
      const t = wt[k];
      if (!t || typeof t !== 'object' || Array.isArray(t)) {
        return refused('REFUSED_BAD_WIOA_TARGETS', 'wioa_targets.' + k + ' must be an object of the five indicators');
      }
      for (const ind of ['empRateQ2', 'empRateQ4', 'medianEarningsQ2', 'credentialRate', 'skillGainsRate']) {
        if (t[ind] !== undefined && !isFiniteNum(t[ind])) {
          return refused('REFUSED_BAD_WIOA_TARGETS', 'wioa_targets.' + k + '.' + ind + ' must be a finite number');
        }
      }
    }
  }
  return null;
}

// ---------- benchmark status (apex15.html lines 647-651) ----------

/** @type {(userVal: number|null, target: number, isEarnings: boolean) => 'exceeds'|'meets'|'below'|'na'} */
function benchStatus(userVal, target, isEarnings) {
  if (userVal === null || userVal === undefined) return 'na';
  if (isEarnings) return userVal >= target * EARNINGS_EXCEEDS_MULT ? 'exceeds' : userVal >= target ? 'meets' : 'below';
  return userVal >= target + PCT_EXCEEDS_MARGIN_PP ? 'exceeds'
    : userVal >= target - PCT_MEETS_MARGIN_PP ? 'meets' : 'below';
}

// ---------- compute ----------

/**
 * compute(pp) — pure workforce-program ROI report over the declared input domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const bad = validate(pp);
  if (bad) return bad;

  const programType = pp.program_type;
  const sectorKey = pp.sector;
  // Targets: the caller's negotiated levels when supplied, else the Apex illustrative defaults.
  const defaults = WIOA_TARGETS_APEX_DEFAULTS[programType];
  const suppliedTargets = (pp.wioa_targets && pp.wioa_targets[programType]) || null;
  const targets = suppliedTargets ? { ...defaults, ...suppliedTargets } : defaults;
  const targetsSource = suppliedTargets ? 'caller' : 'apex_defaults';
  const sectorBaselineAnnual = SECTOR_BASELINE_ANNUAL[sectorKey];

  const totalBudget = pp.total_budget;
  const enrolled = pp.participants_enrolled;
  const exited = (pp.participants_exited === null || pp.participants_exited === undefined)
    ? enrolled : pp.participants_exited;                 // apex15.html line 613
  const avgWeeks = (pp.avg_training_weeks === undefined) ? null : pp.avg_training_weeks;
  const empRateQ2 = pp.emp_rate_q2 ?? null;
  const empRateQ4 = pp.emp_rate_q4 ?? null;
  const medEarnings = pp.median_earnings_q2 ?? null;
  const credRate = pp.credential_rate ?? null;
  const skillGains = pp.skill_gains_rate ?? null;

  // Cost efficiency (apex15.html lines 637-641)
  const costPerParticipant = totalBudget / enrolled;
  const employedQ2 = empRateQ2 !== null ? Math.round(exited * empRateQ2 / 100) : null;
  const credentialed = credRate !== null ? Math.round(exited * credRate / 100) : null;
  const costPerEmployed = (employedQ2 && employedQ2 > 0) ? totalBudget / employedQ2 : null;
  const costPerCredential = (credentialed && credentialed > 0) ? totalBudget / credentialed : null;

  // Benchmark scorecard (apex15.html lines 653-663)
  const benchmarks = [
    { key: 'emp_rate_q2', label: targets.empQ2Label, userVal: empRateQ2, target: targets.empRateQ2, isEarnings: false },
    { key: 'emp_rate_q4', label: targets.empQ4Label, userVal: empRateQ4, target: targets.empRateQ4, isEarnings: false },
    { key: 'median_earnings_q2', label: 'Median Earnings – Q2 ($)', userVal: medEarnings, target: targets.medianEarningsQ2, isEarnings: true },
    { key: 'credential_rate', label: 'Credential Attainment (%)', userVal: credRate, target: targets.credentialRate, isEarnings: false },
    { key: 'skill_gains_rate', label: 'Measurable Skill Gains (%)', userVal: skillGains, target: targets.skillGainsRate, isEarnings: false },
  ].map((b) => ({ ...b, status: benchStatus(b.userVal, b.target, b.isEarnings) }));

  const validCount = benchmarks.filter((b) => b.status !== 'na').length;
  const metCount = benchmarks.filter((b) => b.status === 'exceeds' || b.status === 'meets').length;
  const exceedsCount = benchmarks.filter((b) => b.status === 'exceeds').length;

  // Wage & taxpayer ROI (apex15.html lines 665-691)
  const annualizedEarnings = medEarnings !== null ? medEarnings * 4 : null;   // Q2 x4 annual proxy
  const earningsGainAnnual = annualizedEarnings !== null ? annualizedEarnings - sectorBaselineAnnual : null;
  const taxRecapturePerPerson = (earningsGainAnnual !== null && earningsGainAnnual > 0)
    ? earningsGainAnnual * TAX_RATE : 0;
  const annualTaxRecapture = (employedQ2 !== null) ? employedQ2 * taxRecapturePerPerson : null;
  const breakevenMonths = (annualTaxRecapture && annualTaxRecapture > 0)
    ? totalBudget / (annualTaxRecapture / 12) : null;
  const threeYrBenefit = annualTaxRecapture !== null ? annualTaxRecapture * 3 - totalBudget : null;
  const returnPerDollar = (annualTaxRecapture !== null && totalBudget > 0)
    ? (annualTaxRecapture * 3) / totalBudget : null;

  // ROI grade (apex15.html lines 694-705)
  let grade, gradeSub;
  const hasROI = returnPerDollar !== null;
  if (hasROI && validCount > 0) {
    const hit = GRADE_THRESHOLDS.find((g) => returnPerDollar >= g.returnMin && metCount >= g.metMin);
    grade = hit ? hit.grade : GRADE_BELOW.grade;
    gradeSub = hit ? hit.sub : GRADE_BELOW.sub;
  } else if (validCount > 0) {
    grade = GRADE_SCORED.grade; gradeSub = GRADE_SCORED.sub;
  } else {
    grade = GRADE_PENDING.grade; gradeSub = GRADE_PENDING.sub;
  }

  const flags = [];
  if (grade === 'Below Target') flags.push('ART712_BELOW_TARGET');
  if (annualTaxRecapture === 0) flags.push('ART712_NO_TAX_RECAPTURE');

  return {
    output_payload: {
      program_name: (pp.program_name && String(pp.program_name).trim()) || 'Unnamed Program',
      program_type: programType,
      program_year: pp.program_year || 'PY 2023',
      sector: sectorKey,
      sector_label: SECTOR_LABELS[sectorKey],
      total_budget: totalBudget,
      participants_enrolled: enrolled,
      participants_exited: exited,
      avg_training_weeks: avgWeeks,
      cost_per_participant: costPerParticipant,
      employed_q2: employedQ2,
      credentialed,
      cost_per_employed_q2: costPerEmployed,
      cost_per_credential: costPerCredential,
      benchmarks,
      indicators_scored: validCount,
      indicators_met: metCount,
      indicators_exceeded: exceedsCount,
      annualized_earnings: annualizedEarnings,
      sector_baseline_annual: sectorBaselineAnnual,
      earnings_gain_annual: earningsGainAnnual,
      annual_tax_recapture: annualTaxRecapture,
      breakeven_months: breakevenMonths,
      three_year_net_benefit: threeYrBenefit,
      return_per_dollar_3yr: returnPerDollar,
      grade, grade_sub: gradeSub,
      refusal_reason: null,
      domain_errors: [],
      scope_note: SCOPE_NOTE,
      targets_source: targetsSource,
    },
    compliance_flags: flags,
  };
}

// NB: named exports only (meta / compute / buildArtifact) — the corpus-wide kernel
// convention. A trailing `export default` would survive stripEsmSyntaxForVm's ESM
// strip (chaingraph/vm/kernel-vm.mjs handles import / export{} / export-declaration
// forms, not export-default) and throw "unsupported keyword: export" in the QuickJS
// VM parity gate.
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
