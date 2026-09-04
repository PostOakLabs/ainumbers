/**
 * art-671-short-sale-locate-ssr-checker.kernel.mjs
 *
 * SHORTSALE-LOCATE-BUILD-1 (SHORTSALE-LOCATE-BUILD-SPEC.md) -- deterministic locate-documentation
 * and SSR-flag arithmetic over caller-declared synthetic inputs. A CHECKER of declared inputs,
 * never a consumer of market data: there is no borrow list feed, no SSR tape, no venue, and no
 * clock inside compute(). The caller declares the short-sale order, the locate documentation
 * (source, list date, on-list flag), and whether the short-sale price restriction (SSR) flag is
 * active; this kernel only classifies the declared state and returns it with a note.
 *
 * CLASSIFICATION (declared pass-through, never inferred):
 *   - locate_satisfied = the declared locate documentation lists the symbol on the declared
 *     source (on_list === true) under a declared, recognized source and a well-formed list date.
 *   - ssr_restriction = the caller-declared ssr_active flag, passed through verbatim. The price
 *     test itself (Rule 201 at-or-below NBB) is performed by the caller's own feeds; this kernel
 *     only carries the declared flag and says so.
 *   - overall = LOCATE_MISSING when no locate is documented; SSR_RESTRICTED when a locate is
 *     documented but the declared SSR flag is active (the order is recordable but the declared
 *     price-test state restricts at-or-borrow pricing per that flag); LOCATE_DOCUMENTED otherwise.
 *
 * FAIL CLOSED, NEVER GUESS. An absent or invalid side, quantity, symbol, locate source, list
 * date, on-list flag, or ssr_active flag resolves to the fail-closed payload -- every verdict
 * field nulled, each offending field named in domain_errors and in the note -- never a silently
 * repaired classification and never a silently defaulted parameter.
 *
 * T372 POINTER (spec scope): when no locate is documented, the note points at the buy-in /
 * close-out determination as the caller's judgement, paired with the suite's T372 Buy-In Scope
 * Classifier. This kernel does not compute buy-in rights, costs, or penalties.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4). This kernel checks arithmetic and
 * shape of caller-declared synthetic inputs. It is NOT compliance advice, NOT a recommendation
 * to borrow, locate, cover, or trade, and NOT connected to any live borrow list, SSR tape,
 * cutoff feed, or register: a declared on-list flag is documentation the caller asserts, never
 * a fact this kernel verified. The not_proven discipline applies -- an output records declared
 * inputs under named rules; it does not prove any live state.
 *
 * Output payload shape: exactly { locate_satisfied, ssr_restriction, note, overall } on success
 * (the canonical pinned shape; extra keys would move the execution_hash), and the same four keys
 * nulled plus a domain_errors[] array on the fail-closed path (the flag-mirror member: a caveat
 * carrier, truthy exactly when inputs were refused).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). Runs unmodified in the
 * QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in this file).
 *
 * Spec: SHORTSALE-LOCATE-BUILD-SPEC.md (canonical worked example + opposite-verdict vector).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-671-short-sale-locate-ssr-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_short_sale_locate_ssr_checker',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

const ORDER_SIDE = 'sell_short';
const LOCATE_SOURCES = ['easy_to_borrow_list', 'hard_to_borrow_list', 'agreed_borrow', 'proprietary_inventory'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Human phrasing per domain error code -- composes the fail-closed note.
const ERROR_PHRASES = {
  INVALID_ORDER_SIDE: `order.side must be "${ORDER_SIDE}" (this checker classifies short-sale locates only)`,
  INVALID_ORDER_QTY: 'order.qty must be a positive whole number of shares',
  INVALID_ORDER_SYMBOL: 'order.symbol must be a non-empty declared symbol string',
  INVALID_LOCATE_SOURCE: `locate.source must be one of ${LOCATE_SOURCES.join(', ')}`,
  INVALID_LOCATE_DATE: 'locate.list_date must be a declared date in YYYY-MM-DD form',
  INVALID_ON_LIST: 'locate.on_list must be a boolean',
  INVALID_SSR_ACTIVE: 'ssr_active must be a boolean (declared pass-through of the caller price-test flag)',
};

/** Shortest round-trip formatting for note strings (5000 -> "5000", 2026-09-03 stays a string). */
function fmt(v) { return String(v); }

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];
  const order = (pp.order && typeof pp.order === 'object' && !Array.isArray(pp.order)) ? pp.order : null;
  const locate = (pp.locate && typeof pp.locate === 'object' && !Array.isArray(pp.locate)) ? pp.locate : null;

  const side = order && typeof order.side === 'string' ? order.side.trim().toLowerCase() : null;
  if (side !== ORDER_SIDE) domain_errors.push('INVALID_ORDER_SIDE');

  const qty = order ? order.qty : undefined;
  if (!(typeof qty === 'number' && Number.isSafeInteger(qty) && qty > 0)) domain_errors.push('INVALID_ORDER_QTY');

  const symbol = order && typeof order.symbol === 'string' ? order.symbol.trim() : null;
  if (!(typeof symbol === 'string' && symbol.length > 0)) domain_errors.push('INVALID_ORDER_SYMBOL');

  const source = locate && typeof locate.source === 'string' ? locate.source.trim().toLowerCase() : null;
  if (!LOCATE_SOURCES.includes(source)) domain_errors.push('INVALID_LOCATE_SOURCE');

  const listDate = locate && typeof locate.list_date === 'string' ? locate.list_date.trim() : null;
  if (!(typeof listDate === 'string' && DATE_RE.test(listDate))) domain_errors.push('INVALID_LOCATE_DATE');

  const onList = locate ? locate.on_list : undefined;
  if (typeof onList !== 'boolean') domain_errors.push('INVALID_ON_LIST');

  const ssrActive = pp.ssr_active;
  if (typeof ssrActive !== 'boolean') domain_errors.push('INVALID_SSR_ACTIVE');

  const compliance_flags = [];
  if (domain_errors.length > 0) {
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`SHORTLOC_${code}`);
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    return {
      output_payload: {
        locate_satisfied: null,
        ssr_restriction: null,
        note: `fail-closed: ${reasons}; no locate or SSR classification computed -- correct the named inputs and resubmit. Checker of caller-declared synthetic inputs only: not compliance advice, not a recommendation, and not connected to any live borrow list, SSR tape, cutoff feed, or register.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const locate_satisfied = onList === true;
  const ssr_restriction = ssrActive;

  let overall;
  let note;
  if (!locate_satisfied) {
    overall = 'LOCATE_MISSING';
    note = `no locate documented for the declared ${fmt(qty)} share short sale in ${symbol}: declared source ${source} dated ${list_date_safe(listDate)} did not list the symbol; buy-in and close-out treatment is the caller's judgement (suite pointer T372, buy-in scope classifier)`;
  } else if (ssr_restriction) {
    overall = 'SSR_RESTRICTED';
    note = `locate recorded pre-order per declared source dated ${listDate}; declared SSR price-test flag is active, carried as declared -- the price test itself belongs to the caller's feeds`;
  } else {
    overall = 'LOCATE_DOCUMENTED';
    note = `locate recorded pre-order per declared source dated ${listDate}`;
  }

  const output_payload = { locate_satisfied, ssr_restriction, note, overall };
  return { output_payload, compliance_flags };
}

/** list_date is already validated by the time LOCATE_MISSING composes its note; kept total for safety. */
function list_date_safe(d) { return typeof d === 'string' && DATE_RE.test(d) ? d : 'an undeclared date'; }

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
