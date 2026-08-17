import { executionHash } from './_hash.mjs';

// {{TOOL_ID}} — scaffolded by scripts/new-kernel.mjs (KERNEL-SCAFFOLD-1). Fill in:
//   1. compute(pp) below — replace the NOT_IMPLEMENTED throw with real logic.
//   2. chaingraph/kernels/fixtures/{{TOOL_ID}}.fixtures.json — replace the placeholder
//      vector with real golden vectors (name, policy_parameters, output_payload).
//   3. chaingraph/kernels/__proptests__/{{TOOL_ID}}.proptest.mjs — replace the
//      placeholder property with real class-A/B/K properties per FV-PBT-FLOOR-BUILD-SPEC.md.
//   4. chaingraph/graph/nodes/{{TOOL_ID}}.json — replace TODO-CITE / standards_basis and
//      the description once compute() is real.
// Run `node scripts/kernel-preflight.mjs {{TOOL_ID}}` repeatedly while doing all of the
// above — RIDER-KERNEL.md explains why each check exists.
//
// DETERMINISM: compute() must be a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, which is a
// STRICT SUBSET of a browser/Node global environment: TextEncoder/atob/btoa/URL are ALL
// ABSENT (chaingraph/kernels/check-guest-builtin-safety.mjs enforces this per kernel, over
// every fixture vector, in milliseconds — never discover this after a multi-hour GPU
// prove). If compute() needs UTF-8 bytes, call the pure-JS encoder below instead of
// `new TextEncoder()` — validated byte-identical to TextEncoder.encode() across
// ASCII/2-3-4-byte sequences/surrogate pairs/lone surrogates (22 named + 20,000 fuzz
// cases, 0 mismatches, ART595-ART590-UTF8-FIX-1). Delete this helper if compute() never
// needs it — an unused function is dead weight, not a safety net.
function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd; // unpaired high surrogate
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd; // lone low surrogate
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}
void utf8ToBytes; // keep the helper available without tripping an unused-var lint before compute() calls it

const TOOL_ID = '{{TOOL_ID}}';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: '{{MCP_NAME}}',
  mandate_type: '{{MANDATE_TYPE}}', gpu: false,
};

/**
 * compute(pp) — pure decision kernel. Fill this in; delete the NOT_IMPLEMENTED throw.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  throw new Error('NOT_IMPLEMENTED: {{TOOL_ID}} compute() is a KERNEL-SCAFFOLD-1 stub — replace this with real logic before shipping.');
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
