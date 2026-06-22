/**
 * art-93-fuzzy-match-calibration-scorer.kernel.mjs
 * Wave 19 — Fuzzy-Match Calibration Scorer.
 * Given an engine config (algorithm, threshold) and a SYNTHETIC labelled
 * name-pair set, computes FPR/recall/F1 and recommends threshold calibration.
 * No real names — synthetic name pairs only.
 *
 * Fuzzy algorithms implemented (simplified, deterministic):
 *   levenshtein — edit distance normalized by max string length
 *   jaro-winkler — Jaro-Winkler similarity (simplified)
 *   phonetic — simplified Soundex-style common-prefix scoring
 *
 * Citations (verify before citing):
 *   Wolfsberg Sanctions Screening Guidance (2019) — scoring/calibration benchmarks.
 *   FATF Guidance on Sanctions-Related Due Diligence (2021).
 *   EDUCATIONAL: synthetic name pairs only — outputs are decision-support drafts.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-93-fuzzy-match-calibration-scorer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'score_fuzzy_match_calibration',
  mandate_type: 'model_governance',
  gpu:          false,
};

// --- Simplified fuzzy algorithms ---

function levenshteinSim(a, b) {
  const al = a.toLowerCase(), bl = b.toLowerCase();
  const m = al.length, n = bl.length;
  if (m === 0 && n === 0) return 1;
  if (m === 0 || n === 0) return 0;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = al[i-1] === bl[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

function jaroSim(a, b) {
  const s1 = a.toLowerCase(), s2 = b.toLowerCase();
  if (s1 === s2) return 1;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1m = new Array(len1).fill(false), s2m = new Array(len2).fill(false);
  let matches = 0, t = 0;
  for (let i = 0; i < len1; i++) {
    const lo = Math.max(0, i - matchDist), hi = Math.min(i + matchDist + 1, len2);
    for (let j = lo; j < hi; j++) {
      if (!s2m[j] && s1[i] === s2[j]) { s1m[i] = s2m[j] = true; matches++; break; }
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (s1m[i]) {
      while (!s2m[k]) k++;
      if (s1[i] !== s2[k]) t++;
      k++;
    }
  }
  return (matches/len1 + matches/len2 + (matches - t/2)/matches) / 3;
}

function jaroWinklerSim(a, b, p = 0.1) {
  const jaro = jaroSim(a, b);
  const s1 = a.toLowerCase(), s2 = b.toLowerCase();
  let prefix = 0;
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefix++; else break;
  }
  return jaro + prefix * p * (1 - jaro);
}

function soundexCode(s) {
  const map = { b:1,f:1,p:1,v:1, c:2,g:2,j:2,k:2,q:2,s:2,x:2,z:2, d:3,t:3, l:4, m:5,n:5, r:6 };
  const w = s.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '0000';
  let code = w[0].toUpperCase();
  let prev = map[w[0]] ?? 0;
  for (let i = 1; i < w.length && code.length < 4; i++) {
    const c = map[w[i]] ?? 0;
    if (c && c !== prev) code += c;
    prev = c;
  }
  return code.padEnd(4, '0');
}

function phoneticSim(a, b) {
  return soundexCode(a) === soundexCode(b) ? 1 : levenshteinSim(a, b) * 0.6;
}

function computeSim(algorithm, a, b) {
  switch (algorithm) {
    case 'jaro-winkler': return jaroWinklerSim(a, b);
    case 'phonetic':     return phoneticSim(a, b);
    default:             return levenshteinSim(a, b);
  }
}

function gradeCalibration(f1) {
  if (f1 >= 0.90) return 'A';
  if (f1 >= 0.80) return 'B';
  if (f1 >= 0.65) return 'C';
  if (f1 >= 0.50) return 'D';
  return 'F';
}

export function compute(pp) {
  const {
    engine         = { algorithm: 'levenshtein', threshold: 0.80 },
    synthetic_pairs = [],
  } = pp;

  const { algorithm = 'levenshtein', threshold = 0.80 } = engine;
  const thresh = Math.max(0, Math.min(1, threshold));

  if (synthetic_pairs.length === 0) {
    return {
      output_payload: {
        fpr: null, recall: null, f1: null,
        threshold_recommendation: thresh,
        calibration_grade: 'F',
        pairs_evaluated: 0,
        note: 'No synthetic pairs provided — cannot calibrate.',
        reference_version: '2026-06',
      },
      compliance_flags: ['LOW_RECALL'],
    };
  }

  // Score each pair
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const scored_pairs = [];
  for (const pair of synthetic_pairs) {
    const { name_a, name_b, is_match } = pair;
    if (typeof name_a !== 'string' || typeof name_b !== 'string') continue;
    const sim = computeSim(algorithm, name_a, name_b);
    const predicted_match = sim >= thresh;
    const actual_match    = is_match === true || is_match === 1;
    if (predicted_match && actual_match)  tp++;
    if (predicted_match && !actual_match) fp++;
    if (!predicted_match && !actual_match) tn++;
    if (!predicted_match && actual_match)  fn++;
    scored_pairs.push({ name_a, name_b, sim: +sim.toFixed(4), predicted_match, actual_match });
  }

  const total_pos = tp + fn;
  const total_neg = fp + tn;
  const fpr    = total_neg > 0 ? +(fp / total_neg).toFixed(4) : 0;
  const recall = total_pos > 0 ? +(tp / total_pos).toFixed(4) : 0;
  const precision = (tp + fp) > 0 ? +(tp / (tp + fp)).toFixed(4) : 0;
  const f1     = (precision + recall) > 0 ? +(2 * precision * recall / (precision + recall)).toFixed(4) : 0;

  // Threshold recommendation: search [0.60, 0.95] in 0.05 steps for best F1
  let best_f1 = -1, best_thresh = thresh;
  for (let t2 = 0.60; t2 <= 0.95; t2 = +(t2 + 0.05).toFixed(2)) {
    let tp2 = 0, fp2 = 0, tn2 = 0, fn2 = 0;
    for (const sp of scored_pairs) {
      const pm = sp.sim >= t2;
      if (pm && sp.actual_match)  tp2++;
      if (pm && !sp.actual_match) fp2++;
      if (!pm && !sp.actual_match) tn2++;
      if (!pm && sp.actual_match)  fn2++;
    }
    const prec2 = (tp2+fp2) > 0 ? tp2/(tp2+fp2) : 0;
    const rec2  = (tp2+fn2) > 0 ? tp2/(tp2+fn2) : 0;
    const f12   = (prec2+rec2) > 0 ? 2*prec2*rec2/(prec2+rec2) : 0;
    if (f12 > best_f1) { best_f1 = f12; best_thresh = t2; }
  }

  const calibration_grade = gradeCalibration(f1);

  const compliance_flags = [];
  if (fpr > 0.20)    compliance_flags.push('HIGH_FALSE_POSITIVE_RATE');
  if (recall < 0.80) compliance_flags.push('LOW_RECALL');

  const output_payload = {
    fpr,
    recall,
    precision,
    f1,
    confusion_matrix: { tp, fp, tn, fn },
    threshold_assessed: thresh,
    threshold_recommendation: best_thresh,
    calibration_grade,
    pairs_evaluated: scored_pairs.length,
    algorithm_assessed: algorithm,
    wolfsberg_note: 'Wolfsberg Guidance targets high recall with acceptable FPR; calibrate threshold to minimise missed matches (fn) before false positives (fp) in sanctions context.',
    reference_version: '2026-06',
    note: 'SYNTHETIC NAME PAIRS ONLY. No real persons or entities assessed. Calibration scores are illustrative decision-support outputs.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
