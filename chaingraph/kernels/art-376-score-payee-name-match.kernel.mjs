/**
 * art-376-score-payee-name-match.kernel.mjs
 * Deterministic, versioned name-match scoring for Verification-of-Payee (VoP) /
 * Confirmation-of-Payee (CoP) evidence chains.
 *
 * THE POINT IS DECLARED DETERMINISM: "score 87, algorithm v1.0.0" is
 * reproducible evidence in a way a black-box vendor match score is not.
 * `algorithm_version` is carried in the artifact + output_payload so a
 * receipt states exactly which declared algorithm produced the score.
 *
 * Scope check (VOP-EVIDENCE-BUILD-SPEC.md §VE-1 dispatch requirement):
 * art-11-vop-batch-match-rate-analyser.kernel.mjs already exists (mcp_name
 * simulate_vop_matching). It is a BATCH aggregate analyzer: it ingests a
 * list of payee pairs and returns match/close_match/no_match COUNTS and a
 * rate over the batch, using float Jaro-Winkler similarity against
 * caller-supplied thresholds, with no per-pair score exposed and no
 * declared algorithm_version. This kernel is a different artifact shape:
 * a SINGLE declared-version scorer for ONE name pair, returning an
 * integer-scaled score + EPC band, meant to be embedded as evidence in a
 * VE-2 session receipt ("this score, from this algorithm version, is why
 * the warning fired"). Extending art-11 in place would conflate a batch
 * analytics tool with a per-session evidentiary primitive; they are built
 * as separate nodes here per the spec's extend-or-cite instruction, with
 * this note as the citation. No duplicate registry surface: art-11 keeps
 * its mcp_name/tool_id, this kernel's `score_payee_name_match` is new and
 * grep-verified unique.
 *
 * Algorithm (declared, versioned — algorithm_version below):
 *   1. normalize(): lowercase, NFD-decompose + strip combining marks
 *      (diacritics), strip punctuation, strip a declared legal-entity
 *      suffix token list, collapse whitespace.
 *   2. tokenSort(): normalize() then sort tokens alphabetically (handles
 *      reordered given/family name or entity name order).
 *   3. Integer Levenshtein edit distance, computed on both the plain
 *      normalized form and the token-sorted form; take whichever gives the
 *      higher similarity (handles both typo-drift and word-reordering).
 *   4. Similarity -> integer score 0-100 via floor integer division only
 *      (no float rounding path): score = 100 - floor(distance*100/maxLen).
 *   5. EPC-style banding against declared integer thresholds:
 *      score >= match_threshold -> MATCH
 *      score >= close_match_threshold -> CLOSE_MATCH
 *      else -> NO_MATCH
 *
 * Transliteration (Latin <-> non-Latin script, e.g. Cyrillic/CJK -> Latin)
 * is explicitly OUT OF SCOPE and declared as such in output_payload
 * (`transliteration_in_scope: false`) rather than half-implemented; NFD
 * diacritic stripping (Latin accented chars) is in scope and distinct from
 * transliteration.
 *
 * Zero PII: fixtures use synthetic names only, per PII banner rules.
 * Pure decision kernel — no DOM, no window, no network, no randomness.
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'art-376-score-payee-name-match',
  mcp_name:     'score_payee_name_match',
  mandate_type: 'compliance_mandate',
  version:      '1.0.0',
};

const TOOL_ID           = 'art-376-score-payee-name-match';
const TOOL_VERSION      = '1.0.0';
const ALGORITHM_VERSION = 'vop-namematch-1.0.0';

const ENTITY_SUFFIXES = [
  'gmbh', 'ag', 'bv', 'nv', 'sa', 'sas', 'sarl', 'sl', 'spa', 'oy', 'ab',
  'ltd', 'limited', 'llc', 'llp', 'plc', 'inc', 'incorporated', 'corp',
  'corporation', 'co', 'company',
];
const SUFFIX_RE = new RegExp('\\b(' + ENTITY_SUFFIXES.join('|') + ')\\b', 'g');

// ── normalization (declared, deterministic) ─────────────────────────────────
// Explicit char map, NOT String.prototype.normalize('NFD') — .normalize() is
// ICU-dependent (engine/locale-sensitive) and hard-banned by
// scripts/check-kernel-determinism.mjs; a fixed table is deterministic on
// every JS engine, including the QuickJS proving guest. Covers common Latin-1
// / Latin Extended-A diacritics seen in EU payee names.
const DIACRITIC_MAP = {
  'à':'a','á':'a','â':'a','ã':'a','ä':'a','å':'a','ā':'a','ă':'a','ą':'a',
  'ç':'c','ć':'c','ĉ':'c','ċ':'c','č':'c',
  'ď':'d','đ':'d',
  'è':'e','é':'e','ê':'e','ë':'e','ē':'e','ĕ':'e','ė':'e','ę':'e','ě':'e',
  'ĝ':'g','ğ':'g','ġ':'g','ģ':'g',
  'ĥ':'h','ħ':'h',
  'ì':'i','í':'i','î':'i','ï':'i','ĩ':'i','ī':'i','ĭ':'i','į':'i','ı':'i',
  'ĵ':'j','ķ':'k',
  'ĺ':'l','ļ':'l','ľ':'l','ŀ':'l','ł':'l',
  'ñ':'n','ń':'n','ņ':'n','ň':'n','ŉ':'n',
  'ò':'o','ó':'o','ô':'o','õ':'o','ö':'o','ø':'o','ō':'o','ŏ':'o','ő':'o',
  'ŕ':'r','ŗ':'r','ř':'r',
  'ś':'s','ŝ':'s','ş':'s','š':'s',
  'ţ':'t','ť':'t','ŧ':'t',
  'ù':'u','ú':'u','û':'u','ü':'u','ũ':'u','ū':'u','ŭ':'u','ů':'u','ű':'u','ų':'u',
  'ŵ':'w',
  'ý':'y','ÿ':'y','ŷ':'y',
  'ź':'z','ż':'z','ž':'z',
  'æ':'ae','œ':'oe','ß':'ss',
};

// Guest-friendly lookup: derived once from DIACRITIC_MAP (still the single
// source of truth for the table-driven equivalence test), but the hot loop
// below never does Unicode-string object-property access — that indexing
// pattern is super-linearly slow inside the QuickJS proving guest
// (ART376-PROFILE-1). Paired string+array scan via String#indexOf instead.
const DIACRITIC_KEYS = Object.keys(DIACRITIC_MAP).join('');
const DIACRITIC_VALS = Object.values(DIACRITIC_MAP);

function stripDiacritics(s) {
  let out = '';
  for (const ch of s) {
    const idx = DIACRITIC_KEYS.indexOf(ch);
    out += idx === -1 ? ch : DIACRITIC_VALS[idx];
  }
  return out;
}

// Test-only exports (ART376-FIX-1 table-driven equivalence test) — additive,
// no behavior change; buildArtifact/compute/meta remain the real contract.
export const __test__ = { DIACRITIC_MAP, stripDiacritics };

function basicClean(s) {
  return stripDiacritics(String(s || '').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(s) {
  return basicClean(s).replace(SUFFIX_RE, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSort(normalized) {
  if (!normalized) return normalized;
  return normalized.split(' ').sort().join(' ');
}

// ── integer Levenshtein edit distance (pure int DP, no float anywhere) ─────
function levenshtein(a, b) {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[lb];
}

// integer similarity score 0-100, floor division only
function distanceScore(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const d = levenshtein(a, b);
  return 100 - Math.floor((d * 100) / maxLen);
}

function band(score, matchT, closeT) {
  if (score >= matchT) return 'MATCH';
  if (score >= closeT) return 'CLOSE_MATCH';
  return 'NO_MATCH';
}

/**
 * compute(pp) — pure single-pair name-match scoring engine.
 * pp: {
 *   account_name: string,    // name held on the receiving account (synthetic input)
 *   reference_name: string,  // name declared by the payer initiating the transfer
 *   match_threshold: integer,       // e.g. 95 (0-100 scale)
 *   close_match_threshold: integer, // e.g. 80 (0-100 scale)
 * }
 */
export function compute(pp) {
  const accountRaw   = String(pp.account_name ?? '');
  const referenceRaw = String(pp.reference_name ?? '');
  const matchT = Number.isInteger(pp.match_threshold) ? pp.match_threshold : 95;
  const closeT = Number.isInteger(pp.close_match_threshold) ? pp.close_match_threshold : 80;

  const normAccount   = normalize(accountRaw);
  const normReference = normalize(referenceRaw);
  const suffixStripped =
    normAccount !== basicClean(accountRaw) || normReference !== basicClean(referenceRaw);

  const plainScore = distanceScore(normAccount, normReference);
  const tokenScore = distanceScore(tokenSort(normAccount), tokenSort(normReference));
  const score = Math.max(plainScore, tokenScore);
  const match_band = band(score, matchT, closeT);

  const compliance_flags = [];
  if (match_band === 'MATCH') compliance_flags.push('VOP_NAME_MATCH');
  else if (match_band === 'CLOSE_MATCH') compliance_flags.push('VOP_NAME_CLOSE_MATCH_WARNING_REQUIRED');
  else compliance_flags.push('VOP_NAME_NO_MATCH_WARNING_REQUIRED');

  return {
    score,
    match_band,
    algorithm_version: ALGORITHM_VERSION,
    match_threshold: matchT,
    close_match_threshold: closeT,
    normalized_account_name: normAccount,
    normalized_reference_name: normReference,
    entity_suffix_stripped: suffixStripped,
    transliteration_in_scope: false,
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = [] } = result;
  const output_payload = result;
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    algorithm_version: ALGORITHM_VERSION,
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
