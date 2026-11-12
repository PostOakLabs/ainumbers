// art-763-ai-displacement-risk-screener — port of ApexLogics Apex #104 "AI Displacement Risk Screener" (AL-111,
// tool_id 104-ai-displacement-risk-screener) inline compute, landed from the
// APEXPORT-104 porting payload (bus nitro, GRADES PASS-PENDING-XV 2026-10-18,
// Builder-verifies-at-land: 18/18 payload fixture vectors re-executed through
// compute() matching the stored outputs, APEX-PORT-104-LAND-1).
//
// Source bytes pinned in APEXPORT-104-REPORT.md (Apex page 48016 bytes,
// sha256 68D2AA10A6B93A7E31C8E10FDDCACEFDBD661EF330951A6BF1FC25572F891D18,
// fetched 2026-10-13). Apex HTML line numbers cited below as "Apex L<n>".
//
// Pure function: no Date, no clock, no randomness, no I/O. The Apex page calls
// `new Date().toISOString()` ONLY for the export timestamp (Apex L607), never
// in the arithmetic, so there is no wall-clock branch to parameterize and no
// as-of input is needed (the APEXPORT-110B as-of pattern does not apply).
//
// GROUNDING / VINTAGE (see APEXPORT-104 payload CITES.md):
// - Automation probabilities are Frey-Osborne 2013-vintage estimates
//   (Oxford Martin working paper 2013; journal version received 2015-09-24,
//   accepted 2016-08-19, published 2016-09-29). STALE BY CONSTRUCTION — every
//   downstream number inherits that vintage. Do not modernize silently.
// - Task splits are Apex-embedded approximations labelled "O*NET 2024"; the
//   live O*NET database fetched at porting time is release 31.0. UNGROUNDED as
//   exact O*NET cell values (approximations, Apex-authored).
// - Median salaries labelled "BLS OES 2025" could NOT be fetched at porting
//   time (BLS returned HTTP 403). UNGROUNDED — salary branch marked below.
// - Composite weights, sector factors, education adjustments and tier cutoffs
//   are Apex-authored (no official counterpart). UNGROUNDED — marked below.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-763-ai-displacement-risk-screener';
const TOOL_VERSION = '1.0.0';
const APEX_SOURCE = {
  al_id: 'AL-111',
  tool_id: '104-ai-displacement-risk-screener',
  display_number: '#104',
  page_url: 'https://apexlogics.org/tools/104-ai-displacement-risk-screener/',
  page_bytes: 48016,
  page_sha256: '68D2AA10A6B93A7E31C8E10FDDCACEFDBD661EF330951A6BF1FC25572F891D18',
  fetch_date: '2026-10-13',
};

// --- Named constants (Apex L493-L507) -------------------------------------
// Composite weights: 0.40 * automation probability + 0.40 * routine-task
// fraction + 0.20 * sector exposure. Apex-authored; UNGROUNDED (no official
// counterpart). Kept exactly as Apex.
export const W_PROB = 0.40; // Apex L494
export const W_ROUTINE = 0.40; // Apex L494
export const W_SECTOR = 0.20; // Apex L494

// Custom-occupation probability estimate (Apex L485): high routine -> high
// prob. Cap 0.99 is an Apex comparator; see boundary fixtures B-CAPa/B-CAPb.
export const PROB_ROUTINE_SLOPE = 0.85; // Apex L485
export const PROB_FLOOR = 0.05; // Apex L485
export const PROB_CAP = 0.99; // Apex L485 (Math.min cap)

// Education adjustment (Apex L499-500): informational only, NOT in the core
// score. Apex-authored; UNGROUNDED.
export const ED_BONUS = {
  no_degree: 0,
  associate: -3,
  bachelor: -7,
  master: -12,
  doctorate: -18,
};

// Tier cutoffs (Apex L504-507): score <= 30 Low, <= 55 Medium, <= 75 High,
// else Critical. Apex-authored; UNGROUNDED. Boundary fixtures B-T30/B-T55/B-T75.
export const TIER_CUT_LOW = 30; // Apex L504
export const TIER_CUT_MEDIUM = 55; // Apex L505
export const TIER_CUT_HIGH = 75; // Apex L506

// Adjacent-pivot similarity gate (Apex L546): sim >= 60 on the UNROUNDED sim.
// Boundary fixtures B-SIMa/B-SIMb. sim = 100 - 60*|prob-dProb|
// - 20*|rc-dRc|/100 - 20*|nra-dNra|/100 (Apex L544).
export const SIM_GATE = 60; // Apex L546
export const SIM_W_PROB = 60; // Apex L544
export const SIM_W_RC = 20; // Apex L544
export const SIM_W_NRA = 20; // Apex L544
export const ALT_TOP_N = 3; // Apex L547 (.slice(0, 3))

// Sector exposure factors (Apex L190-200, <select id="sector"> option values).
// Apex-authored; UNGROUNDED.
export const SECTOR_FACTORS = {
  'technology': 0.25,
  'education': 0.22,
  'healthcare': 0.28,
  'government': 0.30,
  'professional': 0.40,
  'retail': 0.58,
  'finance': 0.65,
  'transportation': 0.72,
  'manufacturing': 0.75,
  'other': 0.45,
};

// --- SOC lookup table (Apex L351-414, verbatim values) ----------------------
// Row: [soc, title, prob, rc, rm, nra, nri, nrm, medianSal].
// prob = Frey-Osborne automation probability 0-1 (2013 VINTAGE — stale).
// Task splits = approximate O*NET task-content distributions (Apex-authored
// approximations; UNGROUNDED as exact O*NET cells).
// medianSal = USD labelled "BLS OES 2025" (UNREACHABLE this run, BLS HTTP 403;
// UNGROUNDED — informational salary-delta branch only, never in the score).
// NOTE: SOC codes are 2018-SOC vintage (e.g. 15-1132 was retired in the 2019
// SOC split into 15-1252/15-1253/15-1254); retained VERBATIM as lookup keys
// for fidelity (see .d/DIFFERS.md D1). 62 rows (page copy says "~200").
/** @type {Array<[string, string, number, number, number, number, number, number, number]>} SOC row: [soc, title, prob, rc, rm, nra, nri, nrm, medianSal]. */
export const SOC_TABLE = [
  ["11-1021","General & Operations Manager",0.16,28,5,38,26,3,109820],
  ["11-2021","Marketing Manager",0.14,22,3,40,30,5,156580],
  ["11-3021","Computer & IS Manager",0.08,18,2,48,28,4,169510],
  ["11-3031","Financial Manager",0.07,26,2,45,23,4,156100],
  ["11-9111","Medical & Health Services Manager",0.10,22,3,38,32,5,110680],
  ["13-1071","Human Resources Specialist",0.55,40,5,22,30,3,67650],
  ["13-1111","Management Analyst",0.24,28,3,42,22,5,99410],
  ["13-1151","Training Specialist",0.22,30,4,28,35,3,62700],
  ["13-2011","Accountant / Auditor",0.94,55,5,25,12,3,79880],
  ["13-2041","Credit Analyst",0.98,70,3,14,8,5,82380],
  ["13-2051","Financial Analyst",0.23,35,3,42,15,5,99890],
  ["13-2099","Financial Specialist (other)",0.58,45,4,28,18,5,77910],
  ["15-1121","Computer Systems Analyst",0.20,30,4,46,16,4,102240],
  ["15-1132","Software Developer",0.04,15,4,60,16,5,132270],
  ["15-1141","Database Administrator",0.14,30,5,48,12,5,101000],
  ["15-1211","Computer/IS Research Scientist",0.04,12,2,68,14,4,136620],
  ["15-1221","Computer Network Architect",0.07,20,4,55,16,5,126900],
  ["15-2051","Data Scientist",0.04,15,3,65,12,5,108020],
  ["17-1011","Architect",0.02,18,5,50,20,7,96000],
  ["17-2051","Civil Engineer",0.02,22,8,48,14,8,95890],
  ["17-2112","Industrial Engineer",0.01,20,8,52,12,8,96350],
  ["17-2141","Mechanical Engineer",0.01,18,8,52,12,10,96310],
  ["19-1020","Biological Scientist",0.02,15,10,55,12,8,85880],
  ["21-1011","Substance Abuse Counselor",0.003,12,3,22,58,5,49330],
  ["21-1022","Healthcare Social Worker",0.01,15,2,25,55,3,60840],
  ["23-1011","Lawyer",0.04,30,2,45,20,3,145760],
  ["25-2021","Elementary School Teacher",0.01,10,4,28,55,3,61620],
  ["25-2031","Secondary School Teacher",0.008,10,4,30,52,4,62360],
  ["25-3031","Tutors & Instructors (other)",0.37,25,5,30,35,5,43510],
  ["25-9099","Education Worker (other)",0.55,42,5,20,28,5,43210],
  ["29-1141","Registered Nurse",0.009,18,12,28,35,7,86070],
  ["29-1171","Nurse Practitioner",0.003,14,8,35,38,5,124680],
  ["29-1215","Hospitalist / Physician",0.004,10,5,42,40,3,229300],
  ["29-1151","Oral & Maxillofacial Surgeon",0.004,8,10,38,30,14,237020],
  ["29-2055","Surgical Technologist",0.53,20,30,22,18,10,57870],
  ["29-2061","Licensed Practical Nurse",0.12,22,18,25,28,7,60250],
  ["29-2099","Health Technologist (other)",0.50,35,20,22,18,5,56120],
  ["31-1132","Home Health Aide",0.39,15,30,10,32,13,30180],
  ["33-3051","Police Officer",0.09,15,15,25,35,10,70820],
  ["35-1011","Chef / Head Cook",0.11,10,35,20,22,13,60760],
  ["35-2014","Cook, Restaurant",0.92,12,52,5,10,21,34940],
  ["35-3031","Waiter / Waitress",0.94,10,20,5,38,27,31370],
  ["37-2011","Janitor / Cleaner",0.66,5,55,5,10,25,34320],
  ["41-2011","Cashier",0.97,30,30,5,25,10,31670],
  ["41-2031","Retail Salesperson",0.92,20,20,10,38,12,36160],
  ["41-4012","Sales Rep, Non-Technical",0.92,28,10,18,38,6,62890],
  ["43-3021","Billing / Posting Clerk",0.97,72,5,10,8,5,48330],
  ["43-4051","Customer Service Rep",0.55,48,8,12,28,4,39680],
  ["43-9021","Data Entry Keyer",0.99,75,10,8,4,3,37400],
  ["43-9061","Office Clerk (General)",0.96,68,10,8,10,4,40250],
  ["43-6011","Executive Secretary",0.40,50,5,20,22,3,65840],
  ["47-2031","Carpenter",0.56,8,40,20,12,20,60200],
  ["47-2111","Electrician",0.15,8,30,28,18,16,61550],
  ["47-2152","Plumber",0.38,8,32,22,18,20,61550],
  ["49-9021","HVAC Mechanic",0.35,8,30,28,15,19,57300],
  ["51-4121","Welder",0.73,5,50,15,10,20,48160],
  ["51-9111","Packaging Machine Operator",0.98,10,65,8,5,12,40300],
  ["53-3032","Truck Driver (Heavy)",0.79,5,55,8,10,22,53200],
  ["53-3031","Driver / Sales Worker",0.69,8,45,8,22,17,40780],
  ["13-1041","Compliance Officer",0.52,45,4,28,18,5,76920],
  ["15-2011","Actuary",0.04,18,2,65,10,5,120000],
  ["25-4022","Librarian",0.65,42,12,25,18,3,62580],
];

const SOC_BY_CODE = {};
for (const d of SOC_TABLE) SOC_BY_CODE[d[0]] = d;

function tierOf(score) {
  if (score <= TIER_CUT_LOW) return 'Low'; // Apex L504
  if (score <= TIER_CUT_MEDIUM) return 'Medium'; // Apex L505
  if (score <= TIER_CUT_HIGH) return 'High'; // Apex L506
  return 'Critical'; // Apex L507
}

// Pure compute. pp = {
//   soc_code: string|null (6-digit SOC; null/unknown -> custom estimate),
//   rc, rm, nra, nri, nrm: integers 0..100 (task composition sliders),
//   sector_exp: number (sector exposure factor),
//   ed_level: string (no_degree|associate|bachelor|master|doctorate),
//   years_role: integer >= 0 (recorded; not in the arithmetic, Apex L477),
// }.
// Returns { score, adj_score, tier, prob, routine_frac, sector_exp,
//   automation_pct, routine_pct, sector_pct, title, soc, median_salary_usd,
//   alts: [{ soc, title, score, sim, salary_delta_vs_selected_usd|null }] }.
// median_salary_usd / salary deltas are UNGROUNDED informational (BLS 403).
export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'ai_displacement_risk_screener',
  mandate_type: 'career_workforce', gpu: false,
};

/**
 * compute(pp) — pure decision kernel (port of Apex #104 inline compute).
 * Invalid-domain inputs are rejected by throw with a named reason (the payload
 * contract; no refused-payload branch — see fixtures/proptest).
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  const output_payload = computeFlat(pp);
  return { output_payload, compliance_flags: [] };
}

function computeFlat(pp) {
  if (pp === null || typeof pp !== 'object' || Array.isArray(pp)) {
    throw new Error('pp must be an object');
  }
  const { soc_code, rc, rm, nra, nri, nrm, sector_exp, ed_level, years_role } = pp;
  for (const [k, v] of [['rc', rc], ['rm', rm], ['nra', nra], ['nri', nri], ['nrm', nrm]]) {
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error(k + ' must be an integer 0..100');
  }
  if (typeof sector_exp !== 'number' || !Number.isFinite(sector_exp)) {
    throw new Error('sector_exp must be a finite number');
  }
  if (typeof ed_level !== 'string') throw new Error('ed_level must be a string');
  if (!Number.isInteger(years_role) || years_role < 0) throw new Error('years_role must be an integer >= 0');

  // Apex L480-488: SOC row wins when selected; otherwise estimate from sliders.
  let prob, title, soc, medSal;
  const d = (typeof soc_code === 'string' && SOC_BY_CODE[soc_code]) || null;
  if (d) {
    prob = d[2]; title = d[1]; soc = d[0]; medSal = d[8];
  } else {
    prob = Math.min(PROB_CAP, ((rc + rm) / 100) * PROB_ROUTINE_SLOPE + PROB_FLOOR);
    title = 'Custom Occupation'; soc = null; medSal = null;
  }

  // Apex L491-496: routine fraction, weighted composite, clamp, round.
  const routineFrac = (rc + rm) / 100;
  let composite = W_PROB * prob + W_ROUTINE * routineFrac + W_SECTOR * sector_exp;
  composite = Math.min(1, Math.max(0, composite));
  const score = Math.round(composite * 100);

  // Apex L499-500: education adjustment is informational only.
  // UNGROUNDED branch (Apex-authored table).
  const adjScore = Math.max(0, score + (ED_BONUS[ed_level] || 0));

  const tier = tierOf(score);

  // Apex L537-547: adjacent lower-exposure pivots. dScore uses the SAME
  // weights with the candidate row's prob/routine and the CALLER's sector.
  // Exclusion comparator dScore >= score (Apex L542) is tested at equality by
  // fixtures B-DSa (exclude) / B-DSb (include).
  const altCandidates = SOC_TABLE
    .map((cand) => ({ soc: cand[0], title: cand[1], prob: cand[2], rc: cand[3], rm: cand[4], nra: cand[5], salary: cand[8], _sim: 0, _score: 0 }))
    .filter((cand) => {
      if (cand.soc === soc) return false;
      const dScore = Math.round((W_PROB * cand.prob + W_ROUTINE * ((cand.rc + cand.rm) / 100) + W_SECTOR * sector_exp) * 100);
      if (dScore >= score) return false;
      const sim = 100 - SIM_W_PROB * Math.abs(prob - cand.prob)
        - SIM_W_RC * Math.abs(rc - cand.rc) / 100
        - SIM_W_NRA * Math.abs(nra - cand.nra) / 100;
      cand._sim = Math.round(sim);
      cand._score = dScore;
      return sim >= SIM_GATE; // NOTE: unrounded sim gates; _sim displays rounded.
    }).sort((a, b) => b._sim - a._sim).slice(0, ALT_TOP_N);

  const alts = altCandidates.map((cand) => ({
    soc: cand.soc,
    title: cand.title,
    score: cand._score,
    sim: cand._sim,
    // UNGROUNDED salary-delta branch (Apex L550-553; BLS OES 2025 unfetched).
    salary_delta_vs_selected_usd: (medSal && cand.salary) ? (cand.salary - medSal) : null,
  }));

  return {
    score,
    adj_score: adjScore,
    tier,
    prob,
    routine_frac: routineFrac,
    sector_exp,
    automation_pct: Math.round(prob * 100),
    routine_pct: rc + rm,
    sector_pct: Math.round(sector_exp * 100),
    title,
    soc,
    median_salary_usd: medSal, // UNGROUNDED (BLS fetch failed; informational only)
    alts,
  };
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
