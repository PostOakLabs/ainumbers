/**
 * art-564-ucp-checkout-payload-lint.kernel.mjs
 * NEXTSUGG-WAVE-BUILD-SPEC.md §2 — lints a caller-supplied Universal Commerce Protocol
 * (UCP; Google + Shopify, announced NRF 2026-01-11, Apache-2.0 spec on GitHub) checkout
 * resource against the schema PINNED at tag v2026-04-08 of
 * github.com/Universal-Commerce-Protocol/ucp (source/schemas/shopping/checkout.json +
 * its referenced types/line_item.json, types/total.json, types/signed_amount.json).
 * Field names, the required[] set, the status enum, and the totals subtotal/total
 * cardinality rule below are copied verbatim from that pinned schema, not invented.
 *
 * VERIFY-ONLY. Never contacts a UCP/ACP endpoint; never fetches a live spec version.
 * The caller declares which version their payload claims (payload.ucp.version) and this
 * kernel checks it against a small KNOWN_UCP_VERSIONS allowlist -- young spec, expect
 * churn (AIUC-1 fixture precedent: version-pin exactly, never guess forward-compat).
 *
 * THREE-WAY VERDICT, PRECEDENCE ORDER (never collapsed to two):
 *   1. No usable payload object at all -> NONCONFORMANT (a structural failure, not a
 *      version question -- there is nothing to be uncertain about).
 *   2. payload.ucp.version absent, non-string, or not in KNOWN_UCP_VERSIONS ->
 *      UNKNOWN_VERSION. Structural findings are still computed and reported below this
 *      verdict, but the verdict itself stays UNKNOWN_VERSION -- this kernel has no basis
 *      to assert what an unpinned version actually requires, so it never upgrades an
 *      unknown-version payload to CONFORMANT even if it happens to satisfy the pinned
 *      v2026-04-08 shape.
 *   3. version known -> NONCONFORMANT if any error-severity finding, else CONFORMANT.
 *
 * SCOPE. This kernel lints a full checkout RESOURCE (the shape UCP returns from
 * /checkout_sessions and /checkout_sessions/{id}), not a partial checkout REQUEST body --
 * the pinned schema's own `required[]` is the resource-level requirement; the schema's
 * `ucp_request` annotations (which fields a create/update/complete *request* may omit)
 * are a separate, narrower profile this kernel does not lint. Stated explicitly in-page
 * so a caller linting a request body, not a resource, is not misled by a false NONCONFORMANT.
 *
 * NO PII ECHOED. findings[] carry only RFC 6901 pointers, codes, and messages; enum/type
 * values (status, currency, totals entry `type`) may appear in a message but buyer name,
 * email, phone, and line-item identity are never copied into output_payload.
 *
 * FINITE GATE. Every branch (absent payload, absent line_items, absent totals, empty
 * arrays) resolves to a DEFINED finding set and a DEFINED verdict. No NaN, no undefined
 * status literal.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-564-ucp-checkout-payload-lint';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'lint_ucp_checkout_payload', mandate_type: 'compliance_mandate', gpu: false };

export const UCP_SPEC_PINNED_TAG = 'v2026-04-08';
export const UCP_SPEC_SOURCE = 'https://github.com/Universal-Commerce-Protocol/ucp/tree/v2026-04-08/source/schemas/shopping/checkout.json';
export const KNOWN_UCP_VERSIONS = ['2026-01-11', '2026-01-23', '2026-04-08'];

const CHECKOUT_REQUIRED = ['ucp', 'id', 'line_items', 'status', 'currency', 'totals', 'links'];
const CHECKOUT_STATUS_ENUM = ['incomplete', 'requires_escalation', 'ready_for_complete', 'complete_in_progress', 'completed', 'canceled'];
const TOTAL_TYPE_WELL_KNOWN = ['subtotal', 'items_discount', 'discount', 'fulfillment', 'tax', 'fee', 'total'];
const LINE_ITEM_REQUIRED = ['id', 'item', 'quantity', 'totals'];
const TOTAL_ENTRY_REQUIRED = ['type', 'amount'];
const CURRENCY_RE = /^[A-Z]{3}$/;

function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isSafeInt(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }

function finding(code, severity, path, message) {
  return { code, severity, path, message };
}

function lintTotalsArray(totalsArr, basePath, findings, requireSubtotalAndTotal) {
  if (!Array.isArray(totalsArr)) {
    findings.push(finding('TOTALS_NOT_ARRAY', 'error', basePath, 'totals must be an array of Total entries.'));
    return;
  }
  let subtotalCount = 0;
  let totalCount = 0;
  totalsArr.forEach((entry, i) => {
    const path = `${basePath}[${i}]`;
    if (!isPlainObject(entry)) {
      findings.push(finding('TOTAL_ENTRY_NOT_OBJECT', 'error', path, 'each totals entry must be an object.'));
      return;
    }
    for (const req of TOTAL_ENTRY_REQUIRED) {
      if (!(req in entry)) findings.push(finding('TOTAL_ENTRY_MISSING_FIELD', 'error', `${path}.${req}`, `required Total field "${req}" is absent.`));
    }
    if ('type' in entry) {
      if (!isNonEmptyString(entry.type)) {
        findings.push(finding('TOTAL_ENTRY_TYPE_INVALID', 'error', `${path}.type`, 'Total.type must be a non-empty string.'));
      } else {
        if (entry.type === 'subtotal') subtotalCount++;
        if (entry.type === 'total') totalCount++;
        if (!TOTAL_TYPE_WELL_KNOWN.includes(entry.type) && !('display_text' in entry)) {
          findings.push(finding('TOTAL_ENTRY_NONSTANDARD_TYPE_MISSING_DISPLAY_TEXT', 'warning', `${path}.display_text`, `Total.type "${entry.type}" is not one of the well-known categories and carries no display_text.`));
        }
      }
    }
    if ('amount' in entry && !isSafeInt(entry.amount)) {
      findings.push(finding('TOTAL_ENTRY_AMOUNT_NOT_INTEGER', 'error', `${path}.amount`, 'Total.amount must be an integer number of the currency minor unit (signed_amount).'));
    }
  });
  if (requireSubtotalAndTotal) {
    if (subtotalCount !== 1) findings.push(finding('TOTALS_SUBTOTAL_CARDINALITY', 'error', basePath, `totals must contain exactly one entry with type "subtotal" (found ${subtotalCount}).`));
    if (totalCount !== 1) findings.push(finding('TOTALS_TOTAL_CARDINALITY', 'error', basePath, `totals must contain exactly one entry with type "total" (found ${totalCount}).`));
  }
}

function lintLineItems(lineItems, findings) {
  if (!Array.isArray(lineItems)) {
    findings.push(finding('LINE_ITEMS_NOT_ARRAY', 'error', 'line_items', 'line_items must be an array.'));
    return;
  }
  if (lineItems.length === 0) {
    findings.push(finding('LINE_ITEMS_EMPTY', 'warning', 'line_items', 'line_items is empty -- structurally valid but an unusual checkout resource to lint.'));
  }
  lineItems.forEach((li, i) => {
    const path = `line_items[${i}]`;
    if (!isPlainObject(li)) {
      findings.push(finding('LINE_ITEM_NOT_OBJECT', 'error', path, 'each line item must be an object.'));
      return;
    }
    for (const req of LINE_ITEM_REQUIRED) {
      if (!(req in li)) findings.push(finding('LINE_ITEM_MISSING_FIELD', 'error', `${path}.${req}`, `required LineItem field "${req}" is absent.`));
    }
    if ('item' in li && !isPlainObject(li.item)) {
      findings.push(finding('LINE_ITEM_ITEM_NOT_OBJECT', 'error', `${path}.item`, 'LineItem.item must be an object.'));
    }
    if ('quantity' in li) {
      if (!isSafeInt(li.quantity) || li.quantity < 1) {
        findings.push(finding('LINE_ITEM_QUANTITY_INVALID', 'error', `${path}.quantity`, 'LineItem.quantity must be an integer >= 1.'));
      }
    }
    if ('totals' in li) lintTotalsArray(li.totals, `${path}.totals`, findings, false);
  });
}

export function compute(pp) {
  pp = pp || {};
  const findings = [];
  const payload = isPlainObject(pp.payload) ? pp.payload : null;

  if (!payload) {
    return {
      output_payload: {
        verdict: 'NONCONFORMANT',
        ucp_version_declared: null,
        ucp_spec_pinned_tag: UCP_SPEC_PINNED_TAG,
        ucp_spec_source: UCP_SPEC_SOURCE,
        finding_count: 1,
        error_count: 1,
        warning_count: 0,
        findings: [finding('MISSING_PAYLOAD', 'error', '', 'pp.payload is absent or is not a JSON object -- nothing to lint.')],
        rationale: ['No usable checkout payload object was supplied; this is a structural failure, not a version question, so the verdict is NONCONFORMANT rather than UNKNOWN_VERSION.'],
        note: 'Verify-only UCP checkout-resource lint against the pinned v2026-04-08 schema. Never contacts a UCP/ACP endpoint.',
      },
      compliance_flags: ['UCP_LINT_RUN', 'UCP_NONCONFORMANT', 'UCP_MISSING_PAYLOAD'],
    };
  }

  for (const req of CHECKOUT_REQUIRED) {
    if (!(req in payload)) findings.push(finding('CHECKOUT_MISSING_REQUIRED_FIELD', 'error', req, `required Checkout field "${req}" is absent (pinned schema required[]: ${CHECKOUT_REQUIRED.join(', ')}).`));
  }

  const ucpVersionDeclared = isPlainObject(payload.ucp) && isNonEmptyString(payload.ucp.version) ? payload.ucp.version.trim() : null;
  const versionKnown = ucpVersionDeclared !== null && KNOWN_UCP_VERSIONS.includes(ucpVersionDeclared);
  if (ucpVersionDeclared === null) {
    findings.push(finding('UCP_VERSION_ABSENT', 'error', 'ucp.version', 'payload.ucp.version is absent or not a string; cannot confirm which UCP version this payload targets.'));
  } else if (!versionKnown) {
    findings.push(finding('UCP_VERSION_NOT_PINNED', 'warning', 'ucp.version', `payload declares UCP version "${ucpVersionDeclared}", which is outside the pinned allowlist (${KNOWN_UCP_VERSIONS.join(', ')}). This lint cannot assert conformance to an unpinned version's requirements.`));
  }

  if ('status' in payload && !CHECKOUT_STATUS_ENUM.includes(payload.status)) {
    findings.push(finding('CHECKOUT_STATUS_INVALID', 'error', 'status', `status must be one of: ${CHECKOUT_STATUS_ENUM.join(', ')}.`));
  }
  if ('currency' in payload && !(isNonEmptyString(payload.currency) && CURRENCY_RE.test(payload.currency))) {
    findings.push(finding('CHECKOUT_CURRENCY_INVALID', 'error', 'currency', 'currency must be a 3-letter uppercase ISO 4217 code.'));
  }
  if ('links' in payload && !Array.isArray(payload.links)) {
    findings.push(finding('CHECKOUT_LINKS_NOT_ARRAY', 'error', 'links', 'links must be an array (mandatory for legal-compliance display per the pinned schema).'));
  }
  if ('id' in payload && !isNonEmptyString(payload.id)) {
    findings.push(finding('CHECKOUT_ID_INVALID', 'error', 'id', 'id must be a non-empty string.'));
  }

  if ('line_items' in payload) lintLineItems(payload.line_items, findings);
  if ('totals' in payload) lintTotalsArray(payload.totals, 'totals', findings, true);

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;

  let verdict;
  if (ucpVersionDeclared === null || !versionKnown) {
    verdict = 'UNKNOWN_VERSION';
  } else {
    verdict = errorCount > 0 ? 'NONCONFORMANT' : 'CONFORMANT';
  }

  const rationale = [];
  rationale.push(`Pinned schema: UCP ${UCP_SPEC_PINNED_TAG} source/schemas/shopping/checkout.json (${UCP_SPEC_SOURCE}).`);
  rationale.push(ucpVersionDeclared === null
    ? 'payload.ucp.version was absent, so no version-specific conformance claim can be made.'
    : versionKnown
      ? `payload declares UCP version ${ucpVersionDeclared}, within the pinned allowlist.`
      : `payload declares UCP version ${ucpVersionDeclared}, outside the pinned allowlist -- verdict capped at UNKNOWN_VERSION regardless of structural findings.`);
  rationale.push(`${errorCount} error-severity finding(s), ${warningCount} warning-severity finding(s) against the pinned checkout resource shape.`);
  rationale.push('This lints a full checkout RESOURCE against the schema\'s resource-level required[] set, not a partial create/update/complete request body (the schema\'s narrower ucp_request per-verb profile is out of scope).');
  rationale.push('Verify-only: never contacts a UCP or ACP endpoint; the caller supplies the payload.');

  return {
    output_payload: {
      verdict,
      ucp_version_declared: ucpVersionDeclared,
      ucp_spec_pinned_tag: UCP_SPEC_PINNED_TAG,
      ucp_spec_source: UCP_SPEC_SOURCE,
      finding_count: findings.length,
      error_count: errorCount,
      warning_count: warningCount,
      findings,
      rationale,
      note: 'Deterministic, verify-only structural lint of a caller-supplied UCP checkout resource against the schema pinned at tag v2026-04-08 of github.com/Universal-Commerce-Protocol/ucp. Never fetches a live spec version and never contacts a UCP/ACP endpoint. UCP composes with AP2 (Google developer blog) and is not presented here as a competitor to ACP or AP2.',
    },
    compliance_flags: ['UCP_LINT_RUN', `UCP_${verdict}`, ...(errorCount > 0 ? ['UCP_STRUCTURAL_ERRORS'] : []), ...(warningCount > 0 ? ['UCP_STRUCTURAL_WARNINGS'] : [])],
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
