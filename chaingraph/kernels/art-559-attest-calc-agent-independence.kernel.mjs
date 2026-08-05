import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-559-attest-calc-agent-independence';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'attest_calc_agent_independence',
  mandate_type: 'attestation_mandate',
  gpu: false,
};

// PARAMETRIC-TRIGGER-BUILD-SPEC.md §2. Receipts the organizational-independence
// claim a parametric trigger's neutrality depends on: that the entity whose
// kernel computed a specific art-251/art-252/art-309 execution_hash declares no
// controlling or compensating relationship with a party to the outcome the
// trigger determines.
//
// ⛔ SELF-DECLARED ATTESTATION ONLY -- exactly like art-373's declared inputs and
// art-306's self-asserted reputation field. This node attests that independence
// was DECLARED, never that it was verified against an external corporate
// registry. "Not a determination of independence -- a citable record of what
// was declared, and to which specific trigger computation. Whether the
// declaration is true is a fact for the parties and, on dispute, an arbitrator
// or court to establish."
//
// ⛔ DISTINCT FROM art-306: art-306 scores whether an AI agent's execution
// evidence is complete enough for an underwriter to price it -- a rubric
// composite over four evidence dimensions. This node produces no composite and
// scores nothing; it is a binary declared-relationship attestation binding to
// ONE specific trigger computation (trigger_ref). Different question, different
// shape.
//
// SPEC.md §25 (ocg-private-input@1, profile-scoped, OPTIONAL). A counterparty
// identifier (party_id) is exactly the enumerable shape §25 exists for -- a bare
// SHA-256 over a party identifier is rainbow-table recoverable, since the space
// of real-world cedants/sponsors/reinsurers is small. By default party_id is
// plaintext (asserted, byte-identical to a profile-naive caller). A caller that
// wants to withhold the plaintext MAY instead supply party_id as a
// "sha256-salted@1" commitment by declaring party_id_commitment_scheme on that
// party entry; any other scheme name, or a value that is not a well-formed
// sha256:<64-hex> commitment, is REJECTED and dropped rather than trusted as
// opaque (SPEC.md §25.1). This node does not prove the private-input profile
// (compute_proof_ready stays "deferred" -- no ZkVmReceipt ships with this
// shard); the declaration mechanism is byte-identical to art-359's, which ships
// under the same constraint.

const PARTY_ROLES = ['cedant', 'sponsor', 'reinsurer', 'other'];
const TRIGGER_TOOL_IDS = [
  'art-251-compute-parametric-trigger-payout',
  'art-252-validate-cat-bond-trigger-terms',
  'art-309-parametric-index-deriver',
];

const SHA256_SALTED_SCHEME = 'sha256-salted@1';
const SHA256_COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function nonEmpty(v) { const s = safeStr(v); return s.length > 0 ? s : null; }

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const calc_agent_id = nonEmpty(pp.calc_agent_id);
  if (!calc_agent_id) rejected_inputs.push({ where: 'calc_agent_id', reason: 'absent -- a free-text/DID identifier of the computing entity is required', supplied: null });

  const declared_relationship = pp.relationship_declaration;
  const relationship_declaration = declared_relationship === 'none' || declared_relationship === 'disclosed' ? declared_relationship : null;
  if (!relationship_declaration) {
    rejected_inputs.push({ where: 'relationship_declaration', reason: 'absent or not one of "none"/"disclosed" -- must be explicitly declared, never assumed', supplied: declared_relationship === undefined ? null : declared_relationship });
  }
  const disclosure_note = relationship_declaration === 'disclosed' ? nonEmpty(pp.disclosure_note) : null;

  const trigger_ref_in = (pp.trigger_ref && typeof pp.trigger_ref === 'object') ? pp.trigger_ref : {};
  const trigger_execution_hash = nonEmpty(trigger_ref_in.execution_hash);
  if (!trigger_execution_hash) rejected_inputs.push({ where: 'trigger_ref.execution_hash', reason: 'absent -- the execution_hash of the art-251/art-252/art-309 artifact this independence claim covers is required', supplied: null });
  const trigger_tool_id_raw = nonEmpty(trigger_ref_in.tool_id);
  const trigger_tool_id = trigger_tool_id_raw && TRIGGER_TOOL_IDS.includes(trigger_tool_id_raw) ? trigger_tool_id_raw : null;
  if (!trigger_tool_id) {
    rejected_inputs.push({
      where: 'trigger_ref.tool_id',
      reason: trigger_tool_id_raw
        ? 'not one of the trigger-computation tool_ids this attestation may cite: ' + TRIGGER_TOOL_IDS.join(', ')
        : 'absent -- must name which trigger-computation artifact this independence claim covers',
      supplied: trigger_tool_id_raw || null,
    });
  }

  const private_input_candidates = [];
  const parties_in = Array.isArray(pp.interested_parties) ? pp.interested_parties : [];
  const interested_parties = parties_in.map((raw, i) => {
    const p = raw && typeof raw === 'object' ? raw : {};
    const party_role = PARTY_ROLES.includes(p.party_role) ? p.party_role : null;
    if (!party_role) rejected_inputs.push({ where: `interested_parties[${i}].party_role`, reason: 'absent or not one of cedant/sponsor/reinsurer/other', supplied: p.party_role === undefined ? null : p.party_role });

    const declaredScheme = nonEmpty(p.party_id_commitment_scheme);
    const schemeKnown = declaredScheme === null || declaredScheme === SHA256_SALTED_SCHEME;
    let party_id = nonEmpty(p.party_id);
    let party_id_is_commitment = false;

    if (!party_id) {
      rejected_inputs.push({ where: `interested_parties[${i}].party_id`, reason: 'absent', supplied: null });
    } else if (declaredScheme !== null) {
      if (!schemeKnown) {
        rejected_inputs.push({ where: `interested_parties[${i}].party_id_commitment_scheme`, reason: `unknown commitment scheme -- "${SHA256_SALTED_SCHEME}" is the sole scheme accepted (SPEC.md §25.1); the declared party_id is excluded rather than trusted as opaque`, supplied: declaredScheme });
        party_id = null;
      } else if (!SHA256_COMMITMENT_RE.test(party_id)) {
        rejected_inputs.push({ where: `interested_parties[${i}].party_id`, reason: `declared commitment_scheme "${SHA256_SALTED_SCHEME}" but the value is not a well-formed sha256: commitment (^sha256:[0-9a-f]{64}$)`, supplied: party_id });
        party_id = null;
      } else {
        party_id_is_commitment = true;
      }
    }

    const entry = { party_role, party_id, label: party_id_is_commitment ? 'private-commitment' : 'asserted' };
    if (declaredScheme !== null) {
      entry.party_id_commitment_scheme = declaredScheme;
      if (party_id_is_commitment) {
        private_input_candidates.push({ pointer: `/interested_parties/${i}/party_id`, commitment: party_id, commitment_scheme: SHA256_SALTED_SCHEME });
      }
    }
    return entry;
  });
  if (interested_parties.length === 0) rejected_inputs.push({ where: 'interested_parties', reason: 'absent or empty -- at least one interested party the trigger outcome could pay or receive from is required', supplied: null });

  const independence_asserted = relationship_declaration === 'none';

  const compliance_flags = ['CALC_AGENT_INDEPENDENCE_DECLARATION_RECORDED'];
  compliance_flags.push(independence_asserted ? 'CALC_AGENT_INDEPENDENCE_ASSERTED' : 'CALC_AGENT_INDEPENDENCE_NOT_ASSERTED');
  if (private_input_candidates.length > 0) compliance_flags.push('CALC_AGENT_INDEPENDENCE_PARTY_ID_PRIVATE_INPUT');
  if (rejected_inputs.length > 0) compliance_flags.push('CALC_AGENT_INDEPENDENCE_INPUTS_REJECTED');

  const output_payload = {
    calc_agent_id,
    interested_parties,
    relationship_declaration,
    disclosure_note,
    trigger_ref: { execution_hash: trigger_execution_hash, tool_id: trigger_tool_id },
    independence_asserted,
    rejected_inputs,
    note: 'Not a determination of independence -- a citable record of what was declared, and to which specific trigger computation. Whether the declaration is true is a fact for the parties and, on dispute, an arbitrator or court to establish. Self-declared only, never independently verified against an external corporate registry.',
  };

  return { output_payload, compliance_flags, private_input_candidates, trigger_execution_hash, trigger_tool_id };
}

export async function buildArtifact(pp, { now } = {}) {
  const { output_payload, compliance_flags, private_input_candidates, trigger_execution_hash, trigger_tool_id } = compute(pp);
  const hash = await executionHash(pp, output_payload);

  // chain.parent_hashes/parent_tool_ids are populated FROM trigger_ref, not from
  // caller-supplied chain-assembly opts -- this node attests independence of an
  // ALREADY-PRODUCED trigger artifact it cites, it is never itself chained into a
  // pipeline the way a compute step is (PARAMETRIC-TRIGGER-BUILD-SPEC.md §2).
  const parent_hashes = trigger_execution_hash ? [trigger_execution_hash] : [];
  const parent_tool_ids = trigger_tool_id ? [trigger_tool_id] : [];

  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth: parent_hashes.length ? 1 : 0 },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (private_input_candidates.length > 0) artifact.private_inputs = private_input_candidates;
  return artifact;
}
