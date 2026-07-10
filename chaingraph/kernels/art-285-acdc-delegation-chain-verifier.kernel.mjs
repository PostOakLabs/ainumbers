// art-285 — ACDC Delegation Chain Verifier: pure decision kernel.
// Faithful port of compute() in
//   repo/chaingraph/art-285-acdc-delegation-chain-verifier.html
// Pure: no DOM, no window, no network. VERIFY-ONLY doctrine (GAP-C):
// verifies a supplied chain of Authentic Chained Data Containers (ACDC);
// never operates witness/registry infrastructure, never resolves a
// revocation registry over the network (report, don't resolve).
//
// Standards pin (2026-07-10): KERI / ACDC / CESR ratified by ToIP, Jan 2026.
//
// SCOPE NOTE (v1): SAID (self-addressing identifier) integrity is checked
// with the canonical _hash.mjs JCS canonicalizer + SHA-256 digest, matching
// this kernel's plain-hex `d` field convention — NOT full CESR multicodec
// SAIDs (which default to Blake3-256 in KERI; BLAKE3 is excluded per the
// OCG art-201 exec-check-friendly lesson). CESR binary streams are OUT of
// scope; JSON-serialized ACDCs only (noted on the node page).

import { executionHash } from './_hash.mjs';
// RISC0 guest loader stub for _hash.mjs exports only executionHash, not cgCanon.
// Byte-identical to _hash.mjs cgCanon — inlined so this kernel runs unmodified in-guest.
const cgCanon = (v) => Array.isArray(v) ? v.map(cgCanon) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = cgCanon(v[k]), o), {}) : v;

const TOOL_ID = 'art-285-acdc-delegation-chain-verifier';
const TOOL_VERSION = '1.0.0';
const DEFAULT_MAX_DEPTH = 10;
const HARD_MAX_DEPTH = 50;

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'verify_acdc_delegation_chain',
  mandate_type: 'compliance_mandate', gpu: false,
};

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function canonJson(v) { return JSON.stringify(cgCanon(v)); }

async function computeSaid(cred) {
  const placeholder = '#'.repeat(typeof cred.d === 'string' ? cred.d.length : 64);
  const blanked = { ...cred, d: placeholder };
  return sha256Hex(canonJson(blanked));
}

function findEdgeTo(edges, targetSaid) {
  if (!edges || typeof edges !== 'object') return null;
  for (const key of Object.keys(edges)) {
    if (key === 'd') continue;
    const e = edges[key];
    if (e && typeof e === 'object' && e.n === targetSaid) return e;
  }
  return null;
}

export async function compute(pp) {
  const credentials = Array.isArray(pp.credentials) ? pp.credentials : null;
  const expectedRootAid = pp.expected_root_aid ?? null;
  const maxChainDepth = Math.min(Number(pp.max_chain_depth ?? DEFAULT_MAX_DEPTH) || DEFAULT_MAX_DEPTH, HARD_MAX_DEPTH);

  const saidFailures = [];
  const edgeFailures = [];
  const revocationStatusReported = [];

  if (!credentials || credentials.length === 0) {
    return {
      output_payload: { valid: false, chain_depth: 0, root_aid_matched: false, said_failures: [{ index: -1, code: 'CREDENTIALS_MISSING' }], edge_failures: [] },
      compliance_flags: ['ACDC_CHAIN_INVALID'],
    };
  }

  const bounded = credentials.length > maxChainDepth ? credentials.slice(0, maxChainDepth) : credentials;
  if (credentials.length > maxChainDepth) {
    saidFailures.push({ index: maxChainDepth, code: 'CHAIN_DEPTH_EXCEEDED', detail: `chain has ${credentials.length} credentials, bound is ${maxChainDepth}` });
  }

  for (let i = 0; i < bounded.length; i++) {
    const cred = bounded[i] ?? {};
    if (typeof cred.d !== 'string' || !cred.d) {
      saidFailures.push({ index: i, code: 'SAID_MISSING', detail: 'credential has no d (SAID) field' });
      continue;
    }
    const computed = await computeSaid(cred);
    if (computed !== cred.d.replace(/^0x/, '').toLowerCase()) {
      saidFailures.push({ index: i, code: 'SAID_MISMATCH', detail: `computed ${computed}` });
    }
    if (cred.schema_said_expected && cred.s !== cred.schema_said_expected) {
      saidFailures.push({ index: i, code: 'SCHEMA_SAID_SELF_MISMATCH', detail: 'credential declares a schema SAID inconsistent with schema_said_expected' });
    }
    if (cred.revocation_status !== undefined) {
      revocationStatusReported.push({ index: i, status: cred.revocation_status });
    }
  }

  for (let i = 0; i < bounded.length - 1; i++) {
    const child = bounded[i] ?? {};
    const parent = bounded[i + 1] ?? {};
    const edge = findEdgeTo(child.e, parent.d);
    if (!edge) {
      edgeFailures.push({ index: i, code: 'EDGE_BROKEN', detail: `no edge in credential[${i}] references credential[${i + 1}].d` });
      continue;
    }
    const parentIssuee = parent.a?.i ?? null;
    if (child.i !== parentIssuee) {
      edgeFailures.push({ index: i, code: 'ISSUER_ISSUEE_MISMATCH', detail: `credential[${i}].i (${child.i}) != credential[${i + 1}].a.i (${parentIssuee})` });
    }
    if (edge.s && parent.s && edge.s !== parent.s) {
      edgeFailures.push({ index: i, code: 'SCHEMA_SAID_MISMATCH', detail: `edge declares schema ${edge.s}, credential[${i + 1}].s is ${parent.s}` });
    }
  }

  const rootCred = bounded[bounded.length - 1] ?? {};
  const rootAidMatched = expectedRootAid != null && rootCred.i === expectedRootAid;
  if (expectedRootAid != null && !rootAidMatched) {
    edgeFailures.push({ index: bounded.length - 1, code: 'ROOT_AID_MISMATCH', detail: `root credential issuer ${rootCred.i} != expected_root_aid ${expectedRootAid}` });
  }

  const valid = saidFailures.length === 0 && edgeFailures.length === 0 && (expectedRootAid == null || rootAidMatched);
  const output_payload = {
    valid, chain_depth: bounded.length, root_aid_matched: rootAidMatched,
    said_failures: saidFailures, edge_failures: edgeFailures,
    revocation_status_reported: revocationStatusReported,
  };
  const compliance_flags = [valid ? 'ACDC_CHAIN_VALID' : 'ACDC_CHAIN_INVALID'];
  if (revocationStatusReported.length > 0) compliance_flags.push('REVOCATION_STATUS_PRESENT_UNRESOLVED');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = await compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
