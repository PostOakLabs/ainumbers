/**
 * art-683-consolidation-cta-minority-interest.kernel.mjs
 *
 * CONSOLIDATION-CTA-BUILD-1 (CONSOLIDATION-CTA-BUILD-SPEC.md) -- deterministic
 * foreign-subsidiary consolidation arithmetic over caller-declared synthetic
 * inputs. An ACCOUNTING COMPUTE, never a consolidation opinion and never a
 * filing: there is no subsidiary register, no rate table, no FX feed, no
 * ledger store, and no clock inside compute(). The caller declares the
 * subsidiary equity in functional currency, the current and historical
 * translation rates, and the parent ownership percentage; this kernel only
 * performs the translation, the CTA difference, the ownership split, and
 * returns them with a trace.
 *
 * FUNCTIONS (per the spec):
 *   - Translation: equity_at_current = sub_equity_fc * rate_current and
 *     equity_at_historical = sub_equity_fc * rate_historical, each rounded
 *     to 2 decimal places, half-up.
 *   - CTA: cta = equity_at_current - equity_at_historical (the cumulative
 *     translation adjustment implied by the declared rates).
 *   - Minority-interest split at the declared ownership percentage:
 *     parent_share = equity_at_current * parent_ownership_pct / 100 and
 *     minority_interest = equity_at_current - parent_share, rounded 2dp
 *     half-up; the split always sums back to equity_at_current.
 *   - Overall: "CONSOLIDATION_COMPUTED" on any well-formed input;
 *     "CONSOLIDATION_REFUSED" on the fail-closed path.
 *
 * PRIMARY TEXT (SO #38): this kernel cites no dated regulatory constant and
 * carries none in its hashed preimage. The accounting identity it computes is
 * the standard translation-method identity (translated equity at the current
 * rate less translated equity at the historical rate equals the cumulative
 * translation adjustment; the ownership split divides translated equity into
 * parent and non-controlling interests). It is recorded here as a method
 * note, not as a measured regulatory figure, so nothing in this file needed a
 * measured-date source locator before the constants landed.
 *
 * NEVER GUESS, NEVER DEFAULT. An absent, malformed, or out-of-domain input
 * (non-numeric equity, non-positive rate, ownership outside (0, 100)) resolves
 * to the fail-closed payload -- every output field null, overall
 * CONSOLIDATION_REFUSED, each offending field named in domain_errors and in
 * the trace -- never a silently repaired consolidation and never a defaulted
 * rate or ownership percentage.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4). This kernel
 * computes translation and split arithmetic over caller-declared synthetic
 * inputs. It is NOT accounting advice, NOT a determination that any
 * consolidation presentation satisfies any reporting framework, NOT a
 * valuation of any subsidiary, and NOT a filing: it never submits, stages, or
 * posts anything anywhere. Presentation judgements belong to the caller and
 * its auditors alone.
 *
 * Output payload shape: exactly { equity_at_current, equity_at_historical,
 * cta, parent_share, minority_interest, trace, overall } on a computable path
 * (the canonical pinned shape; extra keys would move the execution_hash), and
 * the same fields nulled plus a domain_errors[] array on the fail-closed path.
 *
 * ROUNDING DECLARATION: every computed monetary figure is rounded to 2
 * decimal places, half-up, per the spec constraint; the rounding is applied
 * in-kernel and stated in the trace.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). Runs
 * unmodified in the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in
 * this file).
 *
 * Spec: CONSOLIDATION-CTA-BUILD-SPEC.md (canonical preimage, execution_hash
 * pinned at staging: 29713a75d87ece357de41777c93e491acf3c752216ca9f4fbb3007b924f42c49).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-683-consolidation-cta-minority-interest';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_consolidation_cta',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_SUB_EQUITY: 'sub_equity_fc must be a finite number greater than 0 (subsidiary equity in functional currency)',
  INVALID_RATE_CURRENT: 'rate_current must be a finite number greater than 0 (declared current translation rate)',
  INVALID_RATE_HISTORICAL: 'rate_historical must be a finite number greater than 0 (declared historical translation rate)',
  INVALID_OWNERSHIP: 'parent_ownership_pct must be a finite number strictly between 0 and 100 (declared parent ownership percentage)',
};

/** Round to 2 decimal places, half-up, on the decimal string to dodge binary-float ties. */
function round2(n) {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON * Math.abs(n) * 100) / 100;
}

/** Canonical trace formatting: 2dp-rounded value with trailing zeros trimmed. */
function fmt(n) {
  const s = round2(n).toFixed(2);
  return s.replace(/\.?0+$/, '');
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];
  const compliance_flags = [];

  const equity = pp.sub_equity_fc;
  if (typeof equity !== 'number' || !isFinite(equity) || equity <= 0) domain_errors.push('INVALID_SUB_EQUITY');

  const rateCurrent = pp.rate_current;
  if (typeof rateCurrent !== 'number' || !isFinite(rateCurrent) || rateCurrent <= 0) domain_errors.push('INVALID_RATE_CURRENT');

  const rateHistorical = pp.rate_historical;
  if (typeof rateHistorical !== 'number' || !isFinite(rateHistorical) || rateHistorical <= 0) domain_errors.push('INVALID_RATE_HISTORICAL');

  const ownership = pp.parent_ownership_pct;
  if (typeof ownership !== 'number' || !isFinite(ownership) || ownership <= 0 || ownership >= 100) domain_errors.push('INVALID_OWNERSHIP');

  if (domain_errors.length > 0) {
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`CTA_${code}`);
    return {
      output_payload: {
        equity_at_current: null,
        equity_at_historical: null,
        cta: null,
        parent_share: null,
        minority_interest: null,
        trace: `fail-closed: ${reasons}; no consolidation computed -- correct the named inputs and resubmit. Consolidation translation and split arithmetic over caller-declared synthetic inputs only: not accounting advice, not a framework-conformance determination, and not a filing.`,
        overall: 'CONSOLIDATION_REFUSED',
        domain_errors,
      },
      compliance_flags,
    };
  }

  // Translation at the declared rates, 2dp half-up.
  const equity_at_current = round2(equity * rateCurrent);
  const equity_at_historical = round2(equity * rateHistorical);

  // CTA: the difference the declared rates imply.
  const cta = round2(equity_at_current - equity_at_historical);

  // Minority-interest split at the declared ownership; the two shares always
  // sum back to equity_at_current because minority is the residual.
  const parent_share = round2(equity_at_current * ownership / 100);
  const minority_interest = round2(equity_at_current - parent_share);

  const trace = `${fmt(equity_at_current)}-${fmt(equity_at_historical)}=${fmt(cta)} CTA; split ${fmt(ownership)}/${fmt(100 - ownership)} of ${fmt(equity_at_current)}`;

  return {
    output_payload: { equity_at_current, equity_at_historical, cta, parent_share, minority_interest, trace, overall: 'CONSOLIDATION_COMPUTED' },
    compliance_flags,
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
