import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-302-401k-adp-acp-test';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_401k_adp_acp_test',
  mandate_type: 'compliance_mandate', gpu: false,
};

// IRC §401(k)(3)(A)(ii) / §401(m)(2) permitted-disparity limits are fixed statutory
// constants (1.25x, or 2 percentage points AND 2x, whichever is greater) — not annually
// indexed, no DRAFT-PIN needed.
const BASIC_MULTIPLIER = 1.25;
const ALT_ADDER_PCT = 0.02; // 2 percentage points, expressed as a fraction (0.02 = 2%)
const ALT_MULTIPLIER = 2;

const VALID_METHODS = new Set(['current_year', 'prior_year']);

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function pct(v) {
  const n = num(v);
  return n !== null && n >= 0 ? n : null;
}

function runTest(hce, nhce) {
  const basicMax = nhce * BASIC_MULTIPLIER;
  const altMax = Math.min(nhce + ALT_ADDER_PCT, nhce * ALT_MULTIPLIER);
  const allowed_max_pct = Math.max(basicMax, altMax);
  const pass = hce <= allowed_max_pct;
  const excess_pct = pass ? 0 : hce - allowed_max_pct;
  return { computed: true, hce_pct: hce, nhce_pct: nhce, allowed_max_pct, pass, excess_pct };
}

const NOT_COMPUTED = { computed: false, hce_pct: null, nhce_pct: null, allowed_max_pct: null, pass: null, excess_pct: null };

export function compute(pp) {
  const method = typeof pp.method === 'string' && VALID_METHODS.has(pp.method) ? pp.method : null;
  const adpHce = pct(pp.adp_hce_pct);
  const adpNhce = pct(pp.adp_nhce_pct);

  if (!method || adpHce === null || adpNhce === null) {
    return {
      output_payload: {
        method,
        adp: NOT_COMPUTED,
        acp: NOT_COMPUTED,
        all_tests_pass: null,
        error: !method ? 'unsupported_or_missing_method' : 'missing_required_adp_percentage',
      },
      compliance_flags: ['ACA_401K_ADP_ACP_PARAMETER_NOT_SUPPLIED'],
    };
  }

  const adp = runTest(adpHce, adpNhce);

  const acpHce = pct(pp.acp_hce_pct);
  const acpNhce = pct(pp.acp_nhce_pct);
  const acpSupplied = acpHce !== null && acpNhce !== null;
  const acp = acpSupplied ? runTest(acpHce, acpNhce) : NOT_COMPUTED;

  const all_tests_pass = adp.pass === true && (!acp.computed || acp.pass === true);

  const compliance_flags = ['ACA_401K_ADP_ACP_ASSESSED'];
  compliance_flags.push(adp.pass ? 'ACA_401K_ADP_PASS' : 'ACA_401K_ADP_FAIL');
  compliance_flags.push(!acp.computed ? 'ACA_401K_ACP_NOT_SUPPLIED' : (acp.pass ? 'ACA_401K_ACP_PASS' : 'ACA_401K_ACP_FAIL'));

  return {
    output_payload: { method, adp, acp, all_tests_pass, error: null },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
