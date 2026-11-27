/**
 * scripts/lib/verdict-read.mjs: the one verdict reader for the estate.
 *
 * Moved verbatim out of scripts/check-kernel-missing-input-failclosed.mjs so the
 * fail-open sweep, the headroom search (chaingraph/kernels/_headroom.mjs callers) and the
 * receipt folder replay agree on what a verdict is. Behaviour is unchanged.
 * The receipt-folder page embeds the block between the two markers below; keep the text
 * from "Verdict-bearing keys" to the end of readVerdict self-contained.
 * Node built-ins only; no network, no clock, no randomness.
 */

// Verdict-bearing keys of an output payload, in the order they are tried.
export const VERDICT_KEYS = ['verdict', 'status', 'decision', 'outcome', 'result', 'readiness', 'eligibility', 'profile_status', 'ready', 'eligible', 'compliant', 'valid', 'passed', 'pass', 'met', 'approved', 'conserved', 'within_mandate'];

// The small explicit token map. Anything outside it is UNCLASSIFIED, never guessed.
const POSITIVE = new Set(['READY', 'SPEND', 'MET', 'PASS', 'PASSED', 'OK', 'APPROVED', 'ELIGIBLE', 'COMPLIANT', 'VALID', 'CONFIRMED', 'SETTLED', 'SUCCESS', 'ALLOW', 'ALLOWED', 'ACCEPT', 'ACCEPTED', 'FINAL', 'CLEAR', 'WITHIN_MANDATE', 'CONSERVED']);
const REFUSAL = new Set(['REFUSE', 'REFUSED', 'REFUSAL', 'INDETERMINATE', 'NOT_EVALUATED', 'NOT_EVALUABLE', 'NOTEVALUATED', 'NOTEVALUABLE', 'ERROR', 'INVALID_INPUT', 'MISSING_INPUT', 'UNKNOWN']);
const NEGATIVE = new Set(['FAIL', 'FAILED', 'NOT_READY', 'NOT_MET', 'UNMET', 'REJECT', 'REJECTED', 'DENY', 'DENIED', 'INELIGIBLE', 'NON_COMPLIANT', 'INVALID', 'BLOCKED', 'NO_SPEND', 'NOT_ELIGIBLE', 'BREACH', 'OUTSIDE_MANDATE', 'NOT_CONSERVED', 'EXCEEDS_MANDATE']);
const BOOL_KEYS = new Set(['ready', 'eligible', 'compliant', 'valid', 'passed', 'pass', 'met', 'approved', 'conserved', 'within_mandate']);

/** @returns {'positive'|'refusal'|'negative'|'unclassified'} */
export function classifyValue(key, value) {
  if (typeof value === 'boolean') return BOOL_KEYS.has(key) ? (value ? 'positive' : 'negative') : 'unclassified';
  if (typeof value !== 'string') return 'unclassified';
  const t = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (POSITIVE.has(t)) return 'positive';
  if (REFUSAL.has(t)) return 'refusal';
  if (NEGATIVE.has(t)) return 'negative';
  return 'unclassified';
}

/** Find the verdict key/class of a payload: first VERDICT_KEYS entry present. */
export function readVerdict(payload) {
  if (!payload || typeof payload !== 'object') return null;
  for (const k of VERDICT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, k)) return { key: k, value: payload[k], cls: classifyValue(k, payload[k]) };
  }
  return null;
}
