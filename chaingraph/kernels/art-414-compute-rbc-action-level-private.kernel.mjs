/**
 * art-414-compute-rbc-action-level-private.kernel.mjs
 * Private-input NAIC RBC action-level tier — profiles the ladder math of
 * art-254 (compute_rbc_action_level) under OCG Standard §25 ocg-private-input@1.
 * Total Adjusted Capital + Authorized Control Level RBC are the PRIVATE witness: never
 * present in policy_parameters, output_payload, or the execution_hash preimage. Only a
 * sha256-salted@1 hiding commitment sits at policy_parameters.rbc_components_commitment.
 * Proves "our RBC is at tier X" without disclosing the capital or ACL dollar figures.
 *
 * Private-input variant of art-254 compute_rbc_action_level — use the public-input kernel
 * when disclosure of the capital figures is acceptable; use this one when it is not.
 *
 * Pure decision kernel — no DOM, no window, no Date.now(), no Math.random().
 */
import { executionHash, cgCanon } from './_hash.mjs';

const TOOL_ID      = 'art-414-compute-rbc-action-level-private';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'compute_rbc_action_level_private',
  mandate_type: 'analytics_mandate',
  gpu:          false,
  // §25 profile marker — see art-413's identical note. buildArtifact's first argument is the
  // PRIVATE WITNESS (rbc_components/salt), not policy_parameters (commitment only).
  private_input_profile: 'ocg-private-input@1',
};

const TABLE_VERSION = 'NAIC-RBC-ACTION-LEVELS-2024';
const TABLE_SOURCE  = 'NAIC RBC Instructions (2024 edition): Life RBC (LR023), P&C RBC (Exhibit 1), Health RBC (HR-1). NAIC Model Laws: Life Insurance RBC Model Law #312 (life), #315 (P&C), #315H (health).';

const ACTION_LEVELS = [
  { code: 'MANDATORY_CONTROL',  label: 'Mandatory Control Level',  min: null, max: 70,  description: 'Regulatory takeover authority. State must take action to protect policyholders.' },
  { code: 'AUTHORIZED_CONTROL', label: 'Authorized Control Level', min: 70,   max: 100, description: 'State authorized but not required to take control.' },
  { code: 'REGULATORY_ACTION',  label: 'Regulatory Action Level',  min: 100,  max: 150, description: 'Detailed corrective action plan required; state can examine/require action.' },
  { code: 'COMPANY_ACTION',     label: 'Company Action Level',     min: 150,  max: 200, description: 'Company must file RBC plan with comprehensive corrective strategy.' },
  { code: 'NO_ACTION',          label: 'No Action Level',          min: 200,  max: null, description: 'Above 200% ACL — no NAIC regulatory action required.' },
];

// ---- pure, deterministic tier math over the PRIVATE capital components ----
// Called only with the plaintext witness, held in the prover's memory — never with committed pp.
function rbcTierPrivate(rbc_components) {
  const tac = Number(rbc_components?.total_adjusted_capital);
  const acl = Number(rbc_components?.authorized_control_level);
  const tacFinite = Number.isFinite(tac) ? tac : 0;
  const aclFinite = Number.isFinite(acl) ? acl : 0;

  const rbc_ratio_pct = aclFinite > 0 ? Math.round((tacFinite / aclFinite) * 100 * 100) / 100 : 0;

  let tier = ACTION_LEVELS[0];
  for (const al of ACTION_LEVELS) {
    const aboveMin = al.min === null || rbc_ratio_pct >= al.min;
    const belowMax = al.max === null || rbc_ratio_pct < al.max;
    if (aboveMin && belowMax) { tier = al; break; }
  }
  return tier;
}

// §25.1 commitment = sha256(salt ‖ cgCanon(input_value)), hex-encoded, "sha256:"-prefixed.
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

// See art-413's identical note: satisfies gate harnesses expecting a `compute` export without
// ever recomputing the verdict from policy_parameters alone (SPEC.md §18.3). Defined BEFORE
// buildArtifact so check-engine-parity.mjs's bundler (which extracts everything textually
// preceding `export async function buildArtifact`) captures it.
export function compute(pp) {
  const p = pp || {};
  return {
    action_level_code: null,
    action_level_label: null,
    table_version: p.table_version ?? TABLE_VERSION,
    note: 'Private-input node: tier is not recomputable from policy_parameters alone (SPEC.md §18.3). Call buildArtifact with the private witness, or verify the existing artifact via validate_private_inputs.',
  };
}

/**
 * buildArtifact — the wire input `raw` is the caller's PRIVATE witness plus public config:
 *   { rbc_components: {total_adjusted_capital, authorized_control_level}, salt, insurer_type? }
 * The returned artifact's policy_parameters carries ONLY the commitment + public fields —
 * `rbc_components` and `salt` never enter policy_parameters, output_payload, or the §4 preimage.
 */
export async function buildArtifact(raw, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const r = raw || {};
  const rbc_components = (r.rbc_components && typeof r.rbc_components === 'object') ? r.rbc_components : {};
  const salt          = r.salt;
  const insurer_type  = ['life', 'pc', 'health'].includes(r.insurer_type) ? r.insurer_type : 'pc';

  const tier = rbcTierPrivate(rbc_components);
  const rbc_components_commitment = await commitPrivateInput(salt, rbc_components);

  const policy_parameters = {
    rbc_components_commitment,
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    insurer_type,
  };
  const output_payload = {
    action_level_code:        tier.code,
    action_level_label:       tier.label,
    action_level_description: tier.description,
    table_version: TABLE_VERSION,
    regulatory_basis: 'NAIC RBC Model Laws #312 (life), #315 (P&C), #315H (health). Verdict proves the committed capital figures map to this action-level tier — the underlying dollar amounts are never disclosed (OCG Standard §25 ocg-private-input@1).',
    pii_note: 'ZERO PII disclosed: total adjusted capital and authorized control level are a private witness, never present in policy_parameters or output_payload. Only the action-level tier is public.',
    not_legal_advice: 'Not legal or actuarial advice. RBC action level determinations require review by a qualified actuary and the applicable state insurance department.',
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
      { pointer: '/rbc_components_commitment', commitment: rbc_components_commitment, commitment_scheme: 'sha256-salted@1' },
    ],
    compliance_flags: tier.code === 'NO_ACTION' ? ['RBC_NO_ACTION'] : ['RBC_ACTION_REQUIRED'],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
