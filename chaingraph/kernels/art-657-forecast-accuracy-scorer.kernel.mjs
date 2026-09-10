import { executionHash } from './_hash.mjs';

// art-657-forecast-accuracy-scorer — AT-14 "forecast accuracy scorer" (DERIV-WORKFLOWS-BUILD-SPEC.md
// staged-WU table). Scores a batch of resolved probabilistic forecasts (a stated probability
// paired with the realized 0/1 outcome) using two textbook PROPER SCORING RULES — the Brier score
// (Brier, 1950) and the logarithmic score — plus a Brier Skill Score against a caller-supplied
// reference forecast. DERIV-WF-SCORING-1's enhancement clause: each forecast may carry an
// INFORMATIONAL subject-matter category (a label the caller supplies, inspired by the kind of
// subject-matter buckets a prediction-market contract-eligibility discussion draws — economic
// indicator / election-political / sports competition / gaming-style event / weather-climate /
// other), and the output breaks scores out per category. This is deliberately NOT a regulatory
// determination: the kernel never decides eligibility, cites no rule, and the category is exactly
// what the caller labels it. Per the row's own stated exemption, this is pure scoring math with no
// behavioural rule attached, so no clause snapshot is pinned (standards_basis: not_applicable below).
//
// DETERMINISM: compute() must be a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, which is a
// STRICT SUBSET of a browser/Node global environment: TextEncoder/atob/btoa/URL are ALL
// ABSENT (chaingraph/kernels/check-guest-builtin-safety.mjs enforces this per kernel, over
// every fixture vector, in milliseconds — never discover this after a multi-hour GPU
// prove). compute() below never touches any of those — no UTF-8 encoder needed.

const TOOL_ID = 'art-657-forecast-accuracy-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_forecast_accuracy_score',
  mandate_type: 'forecast_accuracy_score', gpu: false,
};

// Informational subject-matter buckets, fixed enum order (drives the deterministic
// category_breakdown output regardless of input order). Descriptive labels only — see the
// header comment and category_note in output_payload for the "not a regulatory determination"
// statement.
const CATEGORY_ENUM = ['economic_indicator', 'election_political', 'sports_competition', 'gaming_style_event', 'weather_climate', 'other'];
const MAX_FORECASTS = 500; // bounds guest-loop iteration; excess entries are dropped and flagged
const EPS = 1e-9; // log-score clamp — avoids log(0) = -Infinity on a certain/wrong call

function round6(v) { return isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }
function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// brierTerm/logTerm operate on an already-normalized {probability, outcome} record.
function brierTerm(probability, outcome) { return (probability - outcome) ** 2; }
function logTerm(probability, outcome) {
  const pc = Math.min(1 - EPS, Math.max(EPS, probability));
  return -(outcome * Math.log(pc) + (1 - outcome) * Math.log(1 - pc));
}

// Canned example batch used only when the caller supplies no forecasts — keeps compute()
// non-throwing and deterministic on empty/missing input (same convention as this suite's other
// kernels: a sane default rather than an error on absent input).
const DEFAULT_FORECASTS = [
  { probability: 0.72, outcome: 1, category: 'election_political' },
  { probability: 0.18, outcome: 0, category: 'economic_indicator' },
  { probability: 0.55, outcome: 1, category: 'sports_competition' },
  { probability: 0.90, outcome: 1, category: 'weather_climate' },
  { probability: 0.35, outcome: 0, category: 'gaming_style_event' },
];

/**
 * compute(pp) — pure decision kernel.
 * @param {object} pp policy_parameters — { forecasts: [{probability, outcome, category?}, ...], reference_probability? }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  let rawForecasts = Array.isArray(pp.forecasts) && pp.forecasts.length > 0 ? pp.forecasts : null;
  if (!rawForecasts) {
    compliance_flags.push('DEFAULT_SAMPLE_USED');
    rawForecasts = DEFAULT_FORECASTS;
  }
  let truncated = false;
  if (rawForecasts.length > MAX_FORECASTS) {
    rawForecasts = rawForecasts.slice(0, MAX_FORECASTS);
    truncated = true;
  }

  const records = rawForecasts.map((r) => {
    r = r || {};
    const probability = clamp01(safeNum(r.probability, 0.5));
    const outcome = Number(r.outcome) === 1 ? 1 : 0;
    const category = CATEGORY_ENUM.includes(r.category) ? r.category : 'other';
    return { probability, outcome, category };
  });
  const n = records.length;

  let brierSum = 0, logSum = 0, outcomeSum = 0, maxLogTerm = 0;
  for (const rec of records) {
    const bi = brierTerm(rec.probability, rec.outcome);
    const li = logTerm(rec.probability, rec.outcome);
    brierSum += bi;
    logSum += li;
    outcomeSum += rec.outcome;
    if (li > maxLogTerm) maxLogTerm = li;
  }

  const brier_score = round6(brierSum / n);
  const log_score = round6(logSum / n);
  const base_rate = round6(outcomeSum / n);

  const reference_probability = clamp01(safeNum(pp.reference_probability, 0.5));
  let brierRefSum = 0;
  for (const rec of records) brierRefSum += brierTerm(reference_probability, rec.outcome);
  const brier_reference = round6(brierRefSum / n);
  // Brier Skill Score: 1 - (forecast Brier / reference Brier). >0 beats the reference,
  // 0 ties it, <0 is worse than just quoting the reference probability every time.
  const brier_skill_score = brierRefSum > 0 ? round6(1 - (brierSum / n) / (brierRefSum / n)) : null;

  let accuracy_class;
  if (brier_score <= 0.05) accuracy_class = 'EXCELLENT';
  else if (brier_score <= 0.15) accuracy_class = 'GOOD';
  else if (brier_score <= 0.25) accuracy_class = 'FAIR'; // 0.25 = Brier score of a constant p=0.5 guess — the textbook "no skill" reference point
  else accuracy_class = 'POOR';

  const category_breakdown = CATEGORY_ENUM.map((cat) => {
    const catRecords = records.filter((r) => r.category === cat);
    const cn = catRecords.length;
    if (cn === 0) return { category: cat, n: 0, brier_score: null, log_score: null };
    let cb = 0, cl = 0;
    for (const rec of catRecords) {
      cb += brierTerm(rec.probability, rec.outcome);
      cl += logTerm(rec.probability, rec.outcome);
    }
    return { category: cat, n: cn, brier_score: round6(cb / cn), log_score: round6(cl / cn) };
  });

  if (n < 5) compliance_flags.push('INSUFFICIENT_SAMPLE_SIZE');
  if (brier_score <= 0 && n > 1) compliance_flags.push('ZERO_VARIANCE_SUSPICIOUS');
  if (maxLogTerm > 5) compliance_flags.push('HIGH_CONFIDENCE_MISS');
  if (truncated) compliance_flags.push('SAMPLE_TRUNCATED');

  const output_payload = {
    n,
    brier_score,
    log_score,
    base_rate,
    reference_probability: round6(reference_probability),
    brier_reference,
    brier_skill_score,
    accuracy_class,
    category_breakdown,
    // AUTHORING-STANDARD.md flag-mirror doctrine: compliance_flags is conditional
    // (DEFAULT_SAMPLE_USED/INSUFFICIENT_SAMPLE_SIZE/ZERO_VARIANCE_SUSPICIOUS/HIGH_CONFIDENCE_MISS/
    // SAMPLE_TRUNCATED vary by input), so it must mirror into a closed-list output_payload member.
    // warnings is that member here -- truthy (non-empty) exactly when compliance_flags is non-empty.
    warnings: compliance_flags.slice(),
    category_note: 'Category labels are an informational grouping for reporting purposes only. They do not determine, and are not derived from, contract eligibility, legality, or regulatory status under any authority -- supply your own category per forecast.',
    scoring_note: 'Brier score and logarithmic score are proper scoring rules: a forecaster cannot improve their expected score by reporting anything other than their true belief. Lower is better for both; 0 is a perfect score.',
    disclaimer: 'Not financial or legal advice. This tool scores forecast calibration only -- it does not determine contract eligibility, legality, or regulatory status under any authority. For informational purposes only.',
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
