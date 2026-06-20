// art-11 — VoP Batch Match-Rate Analyser: pure decision kernel.
// Faithful port of the Jaro-Winkler + token-sort matching engine in
//   repo/chaingraph/art-11-vop-batch-match-rate-analyser.html
// Pure: no DOM, no window, no network, no randomness.
// policy_parameters carries the full payee list so the execution_hash anchors the complete input.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-11-vop-batch-match-rate-analyser';
const TOOL_VERSION = '1.0.0';

// ── Jaro-Winkler string similarity ──────────────────────────────────────────
function jaro(s1, s2) {
  if (s1 === s2) return 1;
  const l1 = s1.length, l2 = s2.length;
  if (!l1 || !l2) return 0;
  const matchDist = Math.floor(Math.max(l1, l2) / 2) - 1;
  const s1m = new Array(l1).fill(false), s2m = new Array(l2).fill(false);
  let matches = 0, transpositions = 0;
  for (let i = 0; i < l1; i++) {
    const lo = Math.max(0, i - matchDist), hi = Math.min(i + matchDist + 1, l2);
    for (let j = lo; j < hi; j++) {
      if (s2m[j] || s1[i] !== s2[j]) continue;
      s1m[i] = s2m[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!s1m[i]) continue;
    while (!s2m[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3;
}

function jaroWinkler(s1, s2, p = 0.1) {
  const j = jaro(s1, s2);
  let prefLen = 0;
  const maxPref = Math.min(4, Math.min(s1.length, s2.length));
  while (prefLen < maxPref && s1[prefLen] === s2[prefLen]) prefLen++;
  return j + prefLen * p * (1 - j);
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(gmbh|ag|bv|nv|sa|sas|sl|spa|ltd|limited|llc|plc|inc|corp|co)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function tokenSort(s) {
  return normalize(s).split(' ').sort().join(' ');
}

function similarity(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1.0;
  const jw = jaroWinkler(na, nb);
  const ta = tokenSort(a), tb = tokenSort(b);
  const jwToken = jaroWinkler(ta, tb);
  return Math.max(jw, jwToken);
}

function classify(sim, matchT, closeT) {
  return sim >= matchT ? 'MATCH' : sim >= closeT ? 'CLOSE_MATCH' : 'NO_MATCH';
}

/**
 * compute(pp) — pure VoP batch match-rate engine.
 * pp: {
 *   payees: Array<{ account_name: string, reference_name: string }>,
 *   match_threshold: number,       // e.g. 0.90
 *   close_match_threshold: number, // e.g. 0.75
 * }
 */
export function compute(pp) {
  const payees        = Array.isArray(pp.payees) ? pp.payees : [];
  const matchT        = typeof pp.match_threshold === 'number' ? pp.match_threshold : 0.90;
  const closeT        = typeof pp.close_match_threshold === 'number' ? pp.close_match_threshold : 0.75;
  const algorithm     = 'jaro-winkler+token-sort';

  const total = payees.length;
  let matchCount = 0, closeCount = 0, noMatch = 0;

  for (const r of payees) {
    const sim = similarity(String(r.account_name || ''), String(r.reference_name || ''));
    const outcome = classify(sim, matchT, closeT);
    if (outcome === 'MATCH') matchCount++;
    else if (outcome === 'CLOSE_MATCH') closeCount++;
    else noMatch++;
  }

  const matchRatePct = total > 0 ? parseFloat((matchCount / total * 100).toFixed(1)) : 0;

  const output_payload = {
    total_records:   total,
    match:           matchCount,
    close_match:     closeCount,
    no_match:        noMatch,
    match_rate_pct:  matchRatePct,
  };

  let compliance_flags;
  if (total === 0) {
    compliance_flags = ['VOP_NO_RECORDS'];
  } else if (matchCount / total >= 0.85) {
    compliance_flags = ['VOP_HIGH_MATCH_RATE'];
  } else if (noMatch / total >= 0.3) {
    compliance_flags = ['VOP_HIGH_NO_MATCH_RATE'];
  } else {
    compliance_flags = ['VOP_ACCEPTABLE_MATCH_RATE'];
  }

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': [
      'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
      'https://ainumbers.co/chaingraph/context/v0.3/iso20022-context.jsonld',
    ],
    chaingraph_version: '0.4.0',
    semantic_profile: 'iso20022:pacs.008-subset',
    'dct:conformsTo': ['https://ainumbers.co/chaingraph/profiles/iso20022/pacs008-subset.jsonld'],
    mandate_type: 'compliance_mandate',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'compliance_mandate' };
