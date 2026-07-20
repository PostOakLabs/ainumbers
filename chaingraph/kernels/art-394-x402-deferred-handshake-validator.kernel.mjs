import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-394-x402-deferred-handshake-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_x402_deferred_handshake',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Cloudflare `deferred` x402 scheme (x402 Protocol Version 2 plugin scheme registry — a moving
// surface, not hard-coded here). The 402 offer carries scheme:"deferred", id, termsUrl; the client
// commits via an RFC 9421 HTTP Message Signature over the offer, and the validated `id` becomes the
// settlement reference for a subscription/daily/batch rollup. This kernel validates the OFFER FIELDS,
// the SIGNATURE-COMPONENT COVERAGE, and ID CONTINUITY across a call sequence — it does not perform
// cryptographic signature verification (see art-129 verify_webbotauth_signature, which reuses the
// same RFC 9421 signature-base machinery for that step) and it does not compute rollup invoice
// arithmetic (see art-61 reconcile_x402_batch_settlement, which owns batch/voucher math).
const REQUIRED_COVERED_COMPONENTS = ['@method', '@target-uri', 'content-digest'];

// Deterministic https-scheme + non-empty-authority check (ASCII; no regex/no /u, no URL state machine) — proven
// pattern from art-12 (faithful WHATWG URL parsing is infeasible to prove in the zkVM guest; `new URL()` is also
// absent from bare QuickJS-ng, which diverges from V8's global — "don't parse in the zkVM" is established practice).
// SCOPE: validates the https scheme + presence of a non-empty authority only, not full WHATWG URL validity.
function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  let s = value;
  let a = 0, b = s.length;
  while (a < b && s.charCodeAt(a) <= 0x20) a++;
  while (b > a && s.charCodeAt(b - 1) <= 0x20) b--;
  s = s.slice(a, b);
  if (s.length < 8) return false;
  const c0 = s.charCodeAt(0) | 32, c1 = s.charCodeAt(1) | 32, c2 = s.charCodeAt(2) | 32, c3 = s.charCodeAt(3) | 32, c4 = s.charCodeAt(4) | 32;
  if (!(c0 === 104 && c1 === 116 && c2 === 116 && c3 === 112 && c4 === 115)) return false; // 'https'
  if (s.charCodeAt(5) !== 0x3a) return false; // ':'
  if (s.charCodeAt(6) !== 0x2f || s.charCodeAt(7) !== 0x2f) return false; // '//'
  let i = 8;
  for (; i < s.length; i++) { const ch = s.charCodeAt(i); if (ch === 0x2f || ch === 0x5c || ch === 0x3f || ch === 0x23) break; }
  const authority = s.slice(8, i);
  if (authority.length === 0) return false;
  for (let j = 0; j < authority.length; j++) {
    const ch = authority.charCodeAt(j);
    if (ch <= 0x20 || ch === 0x7f || ch === 0x3c || ch === 0x3e || ch === 0x5e || ch === 0x7c) return false;
  }
  return true;
}

function validateOffer(offer) {
  const findings = [];
  if (!offer || typeof offer !== 'object') {
    findings.push({ level: 'error', msg: 'offer must be an object.' });
    return findings;
  }
  if (offer.scheme !== 'deferred') {
    findings.push({ level: 'error', msg: `offer.scheme must be "deferred" (got "${offer.scheme}").` });
  } else {
    findings.push({ level: 'pass', msg: 'offer.scheme is "deferred".' });
  }
  if (typeof offer.id !== 'string' || !offer.id.trim()) {
    findings.push({ level: 'error', msg: 'offer.id missing or not a non-empty string.' });
  } else {
    findings.push({ level: 'pass', msg: 'offer.id present.' });
  }
  if (!isHttpsUrl(offer.termsUrl)) {
    findings.push({ level: 'error', msg: 'offer.termsUrl missing or not a valid https URL.' });
  } else {
    findings.push({ level: 'pass', msg: 'offer.termsUrl is a valid https URL.' });
  }
  return findings;
}

function validateComponentCoverage(covered_components) {
  const findings = [];
  const names = Array.isArray(covered_components)
    ? covered_components.map(c => (typeof c === 'string' ? c : c && c.name).toString().toLowerCase())
    : [];
  for (const req of REQUIRED_COVERED_COMPONENTS) {
    if (names.includes(req)) {
      findings.push({ level: 'pass', msg: `Signature-Input covers "${req}".` });
    } else {
      findings.push({ level: 'error', msg: `Signature-Input missing required covered component "${req}".` });
    }
  }
  return findings;
}

function validateIdContinuity(id, priorIds) {
  const findings = [];
  const prior = Array.isArray(priorIds) ? priorIds.filter(x => typeof x === 'string') : [];
  if (!id) return findings;
  if (prior.includes(id)) {
    findings.push({ level: 'error', msg: `id "${id}" duplicates a prior settlement-reference id — continuity broken.` });
  } else {
    findings.push({ level: 'pass', msg: `id "${id}" is unique against ${prior.length} prior id(s).` });
  }
  const dupes = prior.filter((v, i) => prior.indexOf(v) !== i);
  if (dupes.length) {
    findings.push({ level: 'error', msg: `prior_ids contains internal duplicates: ${[...new Set(dupes)].join(', ')}.` });
  }
  return findings;
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
  const { offer = {}, covered_components = [], id_continuity } = pp || {};
  const priorIds = id_continuity && Array.isArray(id_continuity.prior_ids) ? id_continuity.prior_ids : [];

  const offerFindings = validateOffer(offer);
  const componentFindings = validateComponentCoverage(covered_components);
  const continuityFindings = (typeof offer.id === 'string' && offer.id.trim())
    ? validateIdContinuity(offer.id, priorIds)
    : [];

  const findings = [...offerFindings, ...componentFindings, ...continuityFindings];
  const { score, errors, warnings, passes } = scoreOf(findings);
  const verdict = errors === 0 ? 'ACCEPT' : 'REFUSE';

  const compliance_flags = ['X402_DEFERRED_HANDSHAKE_ASSESSED'];
  compliance_flags.push(verdict === 'ACCEPT' ? 'DEFERRED_OFFER_VALID' : 'DEFERRED_OFFER_INVALID');
  if (offer && offer.scheme !== 'deferred') compliance_flags.push('SCHEME_NOT_DEFERRED');
  if (continuityFindings.some(f => f.level === 'error')) compliance_flags.push('ID_CONTINUITY_BROKEN');
  if (componentFindings.some(f => f.level === 'error')) compliance_flags.push('SIGNATURE_COMPONENT_COVERAGE_INCOMPLETE');

  const output_payload = {
    verdict,
    score,
    errors,
    warnings,
    passes,
    settlement_reference_id: (typeof offer.id === 'string' && offer.id.trim()) ? offer.id : null,
    required_covered_components: REQUIRED_COVERED_COMPONENTS,
    findings: findings.map(f => ({ level: f.level, msg: f.msg })),
    scope_note: 'Validates the deferred-scheme offer, RFC 9421 signature-component coverage, and settlement-reference id continuity only. Cryptographic signature verification is verify_webbotauth_signature (art-129); rollup/batch settlement arithmetic is reconcile_x402_batch_settlement (art-61). Scheme registry is a plugin surface, not hard-coded — verify against the current x402 scheme registry.',
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
