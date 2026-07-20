/**
 * art-413-screen-sanctions-private.kernel.mjs
 * Private-input sanctions screen — profiles the list-membership math of
 * art-38 (screen_tip20_transfer_batch) under OCG Standard §25 ocg-private-input@1.
 * The screened party/transfer list is the PRIVATE witness: it is never present in
 * policy_parameters, output_payload, or the execution_hash preimage. Only a
 * sha256-salted@1 hiding commitment to the list sits at policy_parameters.parties_commitment
 * (SPEC.md §25.0-§25.2). The verdict proves "I screened THIS committed list against list
 * version X and found N hits" without revealing who was screened.
 *
 * Private-input variant of art-38 screen_tip20_transfer_batch — use the public-input
 * kernel when disclosure of the party list is acceptable; use this one when it is not.
 *
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */
import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID      = 'art-413-screen-sanctions-private';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'screen_sanctions_private',
  mandate_type: 'analytics_mandate',
  gpu:          false,
  // §25 profile marker — buildArtifact's first argument is the PRIVATE WITNESS (parties/salt),
  // not the artifact's own policy_parameters (which carries only the commitment). This is the
  // profile's defining property (SPEC.md §18.3/§25.2), not a VM/host-API limitation — gate
  // scripts that replay buildArtifact(fixture.policy_parameters) must skip nodes carrying this
  // flag (see chaingraph/kernels/vm-parity-gate.mjs).
  private_input_profile: 'ocg-private-input@1',
};

// Same test SDN list as art-38 (screen_tip20_transfer_batch) — reused math, not new logic.
const OFAC_SDN_NAMES = ['SANCTIONED ENTITY', 'OFAC_TEST_SDN', 'BLOCKED_PARTY'];

const DEFAULT_LIST_VERSION = 'OFAC-SDN-TEST-2026-07';
const LIST_SOURCE = 'OFAC Specially Designated Nationals (SDN) List test fixture set, per FinCEN 31 CFR Chapter X screening obligations. Production deployments substitute the live OFAC SDN + FATF Travel Rule party lists; this profile proves the SCREENING RAN against a committed list, not the list contents.';

// ---- pure, deterministic verdict math over the PRIVATE party list (never hashed as-is) ----
// Called only with the plaintext witness, held in the prover's memory — never with committed pp.
function screenPartiesPrivate(parties, matching_config) {
  const list = Array.isArray(parties) ? parties : [];
  const caseInsensitive = matching_config?.case_insensitive !== false;

  let hit_count = 0;
  for (const party of list) {
    const name = String((party && party.name) ?? party ?? '');
    const probe = caseInsensitive ? name.toUpperCase() : name;
    if (OFAC_SDN_NAMES.some((sdn) => probe.includes(sdn))) hit_count++;
  }

  return {
    screened: true,
    hit_count,
    clean: hit_count === 0,
    total_checked: list.length,
  };
}

// §25.1 commitment = sha256(salt ‖ cgCanon(input_value)), hex-encoded, "sha256:"-prefixed.
// salt: hex string, >=256 bits (>=64 hex chars). Never returned, never logged, never persisted here.
async function commitPrivateInput(saltHex, inputValue) {
  if (typeof saltHex !== 'string' || saltHex.length < 64 || !/^[0-9a-f]+$/i.test(saltHex)) {
    throw new Error('salt must be a hex string of at least 256 bits (64 hex chars)');
  }
  const saltBytes = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < saltBytes.length; i++) saltBytes[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  const inputBytes = new TextEncoder().encode(JSON.stringify(cgCanon(inputValue)));
  const combined = new Uint8Array(saltBytes.length + inputBytes.length);
  combined.set(saltBytes, 0);
  combined.set(inputBytes, saltBytes.length);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', combined);
  return 'sha256:' + Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Deterministic, side-effect-free recompute over an ALREADY-COMMITTED policy_parameters —
// exists for gate harnesses that expect a `compute` export (empty-input-finite.test.mjs skips
// kernels lacking one; this satisfies it without ever seeing the plaintext witness). Per SPEC.md
// §18.3, a private-input node's output is NOT third-party-recomputable from policy_parameters
// alone — this function only echoes the public shape, it never re-derives the verdict. Defined
// BEFORE buildArtifact so check-engine-parity.mjs's bundler (which extracts everything textually
// preceding `export async function buildArtifact` as the QuickJS-runnable region) captures it.
export function compute(pp) {
  const p = pp || {};
  return {
    screened: false,
    hit_count: 0,
    clean: null,
    coverage: { total_checked: 0 },
    list_version: p.list_version ?? DEFAULT_LIST_VERSION,
    note: 'Private-input node: verdict is not recomputable from policy_parameters alone (SPEC.md §18.3). Call buildArtifact with the private witness, or verify the existing artifact via validate_private_inputs.',
  };
}

/**
 * buildArtifact — the wire input `raw` is the caller's PRIVATE witness plus public config:
 *   { parties: [{name}], salt, list_version?, matching_config? }
 * The returned artifact's own policy_parameters carries ONLY the commitment + public fields —
 * `parties` and `salt` never enter policy_parameters, output_payload, or the §4 preimage.
 */
export async function buildArtifact(raw, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const r = raw || {};
  const parties         = Array.isArray(r.parties) ? r.parties : [];
  const salt            = r.salt;
  const list_version     = typeof r.list_version === 'string' ? r.list_version : DEFAULT_LIST_VERSION;
  const matching_config  = (r.matching_config && typeof r.matching_config === 'object') ? r.matching_config : { case_insensitive: true };

  const verdict = screenPartiesPrivate(parties, matching_config);
  const parties_commitment = await commitPrivateInput(salt, parties);

  const policy_parameters = {
    parties_commitment,
    list_version,
    list_source: LIST_SOURCE,
    matching_config,
  };
  const output_payload = {
    screened:          verdict.screened,
    hit_count:         verdict.hit_count,
    clean:             verdict.clean,
    coverage:          { total_checked: verdict.total_checked },
    list_version,
    regulatory_basis: 'FinCEN 31 CFR Chapter X OFAC/SDN screening obligation; FATF Recommendation 6 (targeted financial sanctions). Verdict proves the committed party list was screened against the pinned list version — the parties themselves are never disclosed (OCG Standard §25 ocg-private-input@1).',
    pii_note:          'ZERO PII disclosed: the screened party/transfer list is a private witness, never present in policy_parameters or output_payload. Only the screening verdict (hit count, clean flag) is public.',
    not_legal_advice:  'Not legal advice. Sanctions screening determinations require review by a qualified compliance officer against the live OFAC SDN list and applicable BSA/AML program.',
  };

  const hash = await executionHash(policy_parameters, output_payload);

  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters,
    output_payload,
    private_inputs: [
      { pointer: '/parties_commitment', commitment: parties_commitment, commitment_scheme: 'sha256-salted@1' },
    ],
    compliance_flags: verdict.clean ? ['SCREEN_CLEAN'] : ['SCREEN_HAS_HITS'],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
