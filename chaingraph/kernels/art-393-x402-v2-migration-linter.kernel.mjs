import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-393-x402-v2-migration-linter';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'lint_x402_v2_migration',
  mandate_type: 'compliance_control',
  gpu: false,
};

// x402 Protocol Version 2 (coinbase/x402 specs/x402-specification-v2.md, 2025-12-09).
// v1 -> v2 wire deltas this kernel checks, per RC-X402:
//   1. PaymentRequirements moved from the 402 response body into a base64 PAYMENT-REQUIRED header.
//   2. X-PAYMENT (request header)         -> PAYMENT-SIGNATURE
//   3. X-PAYMENT-RESPONSE (response header) -> PAYMENT-RESPONSE
//   4. network id: bare chain name (v1, e.g. "base") -> CAIP-2 (v2, e.g. "eip155:8453")
//   5. `accepts` is now an array of requirements the client selects from (was implicit single choice in v1)
const V1_HEADER_NAMES = ['X-PAYMENT', 'X-PAYMENT-RESPONSE'];
const V2_HEADER_NAMES = ['PAYMENT-REQUIRED', 'PAYMENT-SIGNATURE', 'PAYMENT-RESPONSE'];
const V1_TO_V2_HEADER = { 'X-PAYMENT': 'PAYMENT-SIGNATURE', 'X-PAYMENT-RESPONSE': 'PAYMENT-RESPONSE' };
const CAIP2_RE = /^[-a-z0-9]{3,8}:[-a-zA-Z0-9]{1,32}$/;
// Accepts a bare number (1, 2) or a conventional v-prefixed string ("v1", "V2"), case-insensitive.
// Anything else (including numeric strings that don't match, garbage, objects) returns null --
// NEVER NaN. A caller-supplied protocol_version that fails to parse must degrade to "unspecified",
// not crash the finite gate (X402LINT-FIX-1: Number('v2') === NaN was reaching the hash canonicalizer).
const VERSION_RE = /^v?(\d+(?:\.\d+)?)$/i;
function parseProtocolVersion(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const m = VERSION_RE.exec(raw.trim());
    if (m) return Number(m[1]);
  }
  return null;
}

function normalizeHeaderKeys(headers) {
  const out = {};
  if (headers && typeof headers === 'object') {
    for (const k of Object.keys(headers)) out[k.toUpperCase()] = headers[k];
  }
  return out;
}

function lint(pp) {
  const findings = [];
  const headers = normalizeHeaderKeys(pp.headers);
  const body = (pp.body && typeof pp.body === 'object') ? pp.body : null;
  const declaredVersion = parseProtocolVersion(pp.protocol_version);
  const versionUnparseable = pp.protocol_version !== undefined && pp.protocol_version !== null && declaredVersion === null;
  if (versionUnparseable) {
    findings.push({ level: 'error', msg: `protocol_version "${pp.protocol_version}" could not be parsed as a version number (expected e.g. 2 or "v2") — treating as unspecified.` });
  }

  const v1HeadersPresent = V1_HEADER_NAMES.filter(h => h.toUpperCase() in headers);
  const v2HeadersPresent = V2_HEADER_NAMES.filter(h => h.toUpperCase() in headers);

  for (const h of v1HeadersPresent) {
    findings.push({ level: 'error', msg: `Deprecated v1 header "${h}" present — migrate to "${V1_TO_V2_HEADER[h]}" (v2).` });
  }
  if (v2HeadersPresent.length) {
    findings.push({ level: 'pass', msg: `v2 header(s) present: ${v2HeadersPresent.join(', ')}.` });
  }

  // v1 shipped PaymentRequirements in the 402 response body; v2 moves it into the PAYMENT-REQUIRED header.
  const bodyHasAccepts = !!(body && Array.isArray(body.accepts));
  const bodyHasSingleRequirement = !!(body && !Array.isArray(body.accepts) && (body.scheme || body.network) && !('PAYMENT-REQUIRED' in headers));
  if (body && !('PAYMENT-REQUIRED' in headers) && (bodyHasAccepts || bodyHasSingleRequirement)) {
    findings.push({ level: 'error', msg: 'Payment requirements found in the 402 response body with no PAYMENT-REQUIRED header — v1 body-based delivery detected; v2 moves requirements into the header.' });
  }
  if (bodyHasSingleRequirement) {
    findings.push({ level: 'warn', msg: 'Body carries a single requirements object, not an array — v2 requires `accepts` to be an array the client selects from.' });
  }
  if (bodyHasAccepts) {
    findings.push({ level: 'pass', msg: '`accepts` is an array — matches v2 client-selects-from-array shape.' });
  }

  // CAIP-2 network id check
  const network = pp.network ?? (body && body.network) ?? null;
  if (network) {
    if (CAIP2_RE.test(network) && network.includes(':')) {
      findings.push({ level: 'pass', msg: `network id "${network}" is CAIP-2 formatted (v2).` });
    } else {
      findings.push({ level: 'warn', msg: `network id "${network}" is not CAIP-2 formatted (v2 expects e.g. "eip155:8453") — looks like a v1 bare chain name.` });
    }
  }

  let inferredVersion = 1;
  if (v2HeadersPresent.length && !v1HeadersPresent.length) inferredVersion = 2;
  else if (v1HeadersPresent.length && !v2HeadersPresent.length) inferredVersion = 1;
  else if (v2HeadersPresent.length && v1HeadersPresent.length) inferredVersion = 1; // mixed = not migrated

  if (v1HeadersPresent.length && v2HeadersPresent.length) {
    findings.push({ level: 'error', msg: 'Mixed v1 and v2 headers present — migration is incomplete.' });
  }

  if (declaredVersion !== null && declaredVersion !== inferredVersion) {
    findings.push({ level: 'warn', msg: `Declared protocol_version (${declaredVersion}) does not match wire evidence (inferred v${inferredVersion}).` });
  }

  if (!v1HeadersPresent.length && !v2HeadersPresent.length && !body) {
    findings.push({ level: 'error', msg: 'No x402 headers or body supplied — nothing to lint.' });
  }

  return { findings, inferredVersion, v1HeadersPresent, v2HeadersPresent, declaredVersion, versionUnparseable };
}

function scoreOf(findings) {
  let e = 0, w = 0, p = 0;
  for (const f of findings) {
    if (f.level === 'error') e++;
    else if (f.level === 'warn') w++;
    else if (f.level === 'pass') p++;
  }
  let score = 100 - e * 15 - w * 4;
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score, errors: e, warnings: w, passes: p };
}

export function compute(pp) {
  const { findings, inferredVersion, v1HeadersPresent, v2HeadersPresent, declaredVersion, versionUnparseable } = lint(pp || {});
  const { score, errors, warnings, passes } = scoreOf(findings);

  const compliance_flags = ['X402_V2_MIGRATION_CHECKED'];
  compliance_flags.push(inferredVersion === 2 ? 'X402_WIRE_V2' : 'X402_WIRE_V1');
  if (v1HeadersPresent.length) compliance_flags.push('DEPRECATED_V1_HEADER_PRESENT');
  if (v1HeadersPresent.length && v2HeadersPresent.length) compliance_flags.push('MIGRATION_INCOMPLETE');
  if (versionUnparseable) compliance_flags.push('X402_PROTOCOL_VERSION_UNPARSEABLE');
  if (errors === 0) compliance_flags.push('X402_V2_MIGRATION_CLEAN');

  const output_payload = {
    protocol_version: 2,
    declared_protocol_version: declaredVersion,
    inferred_wire_version: inferredVersion,
    deprecated_headers_found: v1HeadersPresent,
    v2_headers_found: v2HeadersPresent,
    score,
    errors,
    warnings,
    passes,
    findings: findings.map(f => ({ level: f.level, msg: f.msg })),
    spec_note: 'Pinned to x402 Protocol Version 2 (coinbase/x402 specs/x402-specification-v2.md, 2025-12-09). Header/body deltas checked here only; scheme and asset registries are plugins and are not hard-coded — verify against the current x402 scheme registry before relying on a scheme/network pass.',
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
