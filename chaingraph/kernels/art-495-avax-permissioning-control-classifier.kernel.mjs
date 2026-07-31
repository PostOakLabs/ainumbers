import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-495-avax-permissioning-control-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_avax_permissioning_controls',
  mandate_type: 'compliance_control', gpu: false,
};

// Evergreen / subnet-EVM permissioning-control classifier (art-495). Answers a different
// question than art-459's SoD matrix check: not who holds conflicting power, but where the
// control lives at all. Six canonical supervisory controls -- five backed by a subnet-EVM
// allowlist-gated precompile (TX AllowList, Contract Deployer AllowList, Native Minter,
// Fee Manager, Reward Manager), plus validator-set membership, which ACP-77 places under a
// caller-deployed validator-manager contract rather than core protocol. For each control the
// kernel classifies protocol_enforced / application_enforced / absent from caller-transcribed
// genesis state -- no chain observation, no RPC. An undeclared input never falls through to a
// silent guess: it becomes a named judgment_required entry (control, what is undetermined,
// which input resolves it, who decides), never a bare flag. Zero PII: opaque control/precompile
// keys only, no address or entity data enters this kernel.

const PRECOMPILE_CONTROLS = [
  { control_id: 'transaction_permissioning', precompile_key: 'txallowlist', label: 'Transaction submission (TX AllowList)' },
  { control_id: 'contract_deployment_permissioning', precompile_key: 'deployerallowlist', label: 'Contract deployment (Contract Deployer AllowList)' },
  { control_id: 'native_asset_issuance_control', precompile_key: 'nativeminter', label: 'Native asset issuance (Native Minter)' },
  { control_id: 'fee_policy_control', precompile_key: 'feemanager', label: 'Fee policy (Fee Manager)' },
  { control_id: 'reward_distribution_control', precompile_key: 'rewardmanager', label: 'Reward distribution (Reward Manager)' },
];

const VALIDATOR_MANAGER_MODES = new Set(['poa', 'pos', 'managed']);

function s(v) { return String(v == null ? '' : v).trim(); }

function classifyPrecompileControl(entry, precompiles, applicationControls) {
  const cfg = precompiles[entry.precompile_key];
  if (!cfg || typeof cfg.activated !== 'boolean') {
    return {
      control_id: entry.control_id, label: entry.label, precompile_key: entry.precompile_key,
      status: 'judgment_required',
      judgment: {
        undetermined: `activation state of precompile '${entry.precompile_key}' for control '${entry.control_id}'`,
        resolving_input: `precompiles.${entry.precompile_key}.activated (boolean, transcribed from genesis)`,
        decided_by: 'the L1 operator supplying the genesis configuration',
      },
    };
  }
  if (cfg.activated === true) {
    return { control_id: entry.control_id, label: entry.label, precompile_key: entry.precompile_key, status: 'protocol_enforced', basis: 'precompile_active_in_genesis' };
  }
  const declared = applicationControls[entry.control_id];
  if (declared === true) {
    return { control_id: entry.control_id, label: entry.label, precompile_key: entry.precompile_key, status: 'application_enforced', basis: 'app_level_control_declared' };
  }
  if (declared === false) {
    return { control_id: entry.control_id, label: entry.label, precompile_key: entry.precompile_key, status: 'absent', basis: 'precompile_inactive_no_app_control' };
  }
  return {
    control_id: entry.control_id, label: entry.label, precompile_key: entry.precompile_key,
    status: 'judgment_required',
    judgment: {
      undetermined: `whether an application-level control substitutes for the inactive '${entry.precompile_key}' precompile`,
      resolving_input: `application_controls.${entry.control_id} (boolean)`,
      decided_by: 'the L1 operator or its ITGC reviewer',
    },
  };
}

function classifyValidatorSetControl(pp, applicationControls) {
  const mode = s(pp.validator_manager_mode).toLowerCase();
  const control_id = 'validator_set_membership_control';
  const label = 'Validator set membership (validator-manager contract, ACP-77)';
  if (VALIDATOR_MANAGER_MODES.has(mode)) {
    return { control_id, label, precompile_key: null, status: 'application_enforced', basis: `validator_manager_mode_${mode}` };
  }
  if (mode === 'none') {
    const declared = applicationControls[control_id];
    if (declared === true) return { control_id, label, precompile_key: null, status: 'application_enforced', basis: 'app_level_control_declared' };
    return { control_id, label, precompile_key: null, status: 'absent', basis: 'no_validator_manager_no_app_control' };
  }
  return {
    control_id, label, precompile_key: null,
    status: 'judgment_required',
    judgment: {
      undetermined: 'which validator-manager mode (poa / pos / managed / none) governs this L1',
      resolving_input: 'validator_manager_mode (string: "poa" | "pos" | "managed" | "none")',
      decided_by: 'the L1 operator supplying the genesis and validator-manager deployment record',
    },
  };
}

export function compute(pp) {
  pp = pp || {};
  const precompiles = (pp.precompiles && typeof pp.precompiles === 'object') ? pp.precompiles : {};
  const applicationControls = (pp.application_controls && typeof pp.application_controls === 'object') ? pp.application_controls : {};

  const controls = PRECOMPILE_CONTROLS.map((entry) => classifyPrecompileControl(entry, precompiles, applicationControls));
  controls.push(classifyValidatorSetControl(pp, applicationControls));

  const gap_register = controls
    .filter((c) => c.status === 'absent')
    .map((c) => ({ control_id: c.control_id, label: c.label, reason: c.basis }));

  const judgment_required = controls
    .filter((c) => c.status === 'judgment_required')
    .map((c) => ({ control_id: c.control_id, label: c.label, ...c.judgment }));

  const protocol_enforced_count = controls.filter((c) => c.status === 'protocol_enforced').length;
  const application_enforced_count = controls.filter((c) => c.status === 'application_enforced').length;
  const absent_count = gap_register.length;
  const judgment_required_count = judgment_required.length;

  const compliance_flags = ['AVAX_PERMISSIONING_CLASSIFIED'];
  if (absent_count > 0) compliance_flags.push('AVAX_PERMISSIONING_GAPS_FOUND');
  if (judgment_required_count > 0) compliance_flags.push('AVAX_PERMISSIONING_JUDGMENT_REQUIRED');
  if (protocol_enforced_count === 0) compliance_flags.push('AVAX_PERMISSIONING_NO_PROTOCOL_CONTROLS');
  if (absent_count === 0 && judgment_required_count === 0) compliance_flags.push('AVAX_PERMISSIONING_FULLY_RESOLVED');

  return {
    output_payload: {
      controls,
      gap_register,
      judgment_required,
      controls_evaluated: controls.length,
      protocol_enforced_count,
      application_enforced_count,
      absent_count,
      judgment_required_count,
    },
    compliance_flags,
  };
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
