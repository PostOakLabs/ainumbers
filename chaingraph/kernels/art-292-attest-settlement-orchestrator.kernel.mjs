import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-292-attest-settlement-orchestrator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'attest_settlement_orchestrator',
  mandate_type: 'infrastructure_mandate',
  gpu: false,
};

// Extends the attest_mcp_server (art-33) self-attestation doctrine to a
// settlement decision path: the shared ledger is an orchestration layer, and
// this kernel attests the off-chain orchestrator deciding commit/halt --
// never the ledger itself, never a live query.
const ALLOWED_TRANSPORTS = ['https', 'mcp-stdio', 'mcp-http'];

function scoreChecks(checks) {
  let got = 0, max = 0;
  for (const c of checks) {
    if (c.status === 'info') continue;
    max += 2;
    if (c.status === 'pass') got += 2;
    else if (c.status === 'warn') got += 1;
  }
  return { got, max, pct: max > 0 ? Math.round((100 * got) / max) : 100 };
}

function grade(pct) {
  if (pct >= 90) return 'A';
  if (pct >= 78) return 'B';
  if (pct >= 62) return 'C';
  if (pct >= 45) return 'D';
  return 'F';
}

function lintManifest(m) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note });
  if (!m || typeof m !== 'object') { push('A01', 'fail', 'orchestrator_manifest missing or not an object'); return checks; }
  push('A01', typeof m.name === 'string' && m.name.length > 0 ? 'pass' : 'fail', `name=${m.name}`);
  push('A02', typeof m.version === 'string' && m.version.length > 0 ? 'pass' : 'fail', `version=${m.version}`);
  push('A03', typeof m.description === 'string' && m.description.trim().length >= 10 ? 'pass' : 'warn', 'description present and non-trivial');
  return checks;
}

function auditPolicyRef(ref) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note });
  const s = typeof ref === 'string' ? ref.trim() : '';
  push('B01', s.length > 0 ? 'pass' : 'fail', `decision_policy_ref=${s || '(empty)'}`);
  push('B02', /^[a-z0-9._\-\/:]+$/i.test(s) ? 'pass' : s.length > 0 ? 'warn' : 'fail', 'decision_policy_ref uses a stable reference-safe charset');
  return checks;
}

function auditKernelBindings(bindings) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note });
  const arr = Array.isArray(bindings) ? bindings : [];
  push('C01', arr.length > 0 ? 'pass' : 'fail', `kernel_bindings count=${arr.length}`);
  const wellFormed = arr.filter((b) => b && typeof b.tool_id === 'string' && typeof b.mcp_name === 'string');
  push('C02', arr.length === 0 ? 'fail' : wellFormed.length === arr.length ? 'pass' : 'warn', `${wellFormed.length}/${arr.length} bindings carry {tool_id, mcp_name}`);
  const uniqueToolIds = new Set(wellFormed.map((b) => b.tool_id));
  push('C03', uniqueToolIds.size === wellFormed.length ? 'pass' : 'fail', 'no duplicate tool_id in kernel_bindings');
  return checks;
}

function auditTransport(transport) {
  const checks = [];
  const push = (code, status, note) => checks.push({ code, status, note });
  push('D01', ALLOWED_TRANSPORTS.includes(transport) ? 'pass' : 'fail', `transport=${transport}`);
  push('D02', transport === 'mcp-stdio' ? 'warn' : 'pass', transport === 'mcp-stdio' ? 'stdio transport has no in-flight transport encryption; acceptable only for local/co-located orchestration' : 'transport carries transit encryption');
  return checks;
}

export function compute(pp) {
  const manifest = pp.orchestrator_manifest;
  const policyRef = pp.decision_policy_ref;
  const bindings = pp.kernel_bindings;
  const transport = pp.transport;

  const domainA = lintManifest(manifest);
  const domainB = auditPolicyRef(policyRef);
  const domainC = auditKernelBindings(bindings);
  const domainD = auditTransport(transport);

  const domains = [
    { domain: 'A', label: 'Orchestrator Manifest Lint', checks: domainA },
    { domain: 'B', label: 'Decision Policy Reference', checks: domainB },
    { domain: 'C', label: 'Kernel Binding Audit', checks: domainC },
    { domain: 'D', label: 'Transport Audit', checks: domainD },
  ];
  const allChecks = [...domainA, ...domainB, ...domainC, ...domainD];

  let totalGot = 0, totalMax = 0;
  const per_domain_scores = domains.map((d) => {
    const s = scoreChecks(d.checks);
    totalGot += s.got; totalMax += s.max;
    return { domain: d.domain, label: d.label, score: s.pct };
  });
  const composite_score = totalMax > 0 ? Math.round((100 * totalGot) / totalMax) : 100;
  const composite_grade = grade(composite_score);
  const failCount = allChecks.filter((c) => c.status === 'fail').length;
  const overallStatus = failCount > 0 ? 'fail' : allChecks.some((c) => c.status === 'warn') ? 'warn' : 'pass';

  const boundToolIds = Array.isArray(bindings) ? bindings.filter((b) => b && b.tool_id).map((b) => b.tool_id) : [];
  const attestation = {
    orchestrator_name: manifest && manifest.name ? manifest.name : null,
    decision_policy_ref: policyRef || null,
    bound_tool_ids: boundToolIds,
    transport: transport || null,
    composite_grade,
    composite_score,
  };

  const output_payload = { attestation, per_domain_scores, checks: allChecks, overall: overallStatus };
  const compliance_flags = overallStatus === 'fail'
    ? ['SLI_ATTESTATION_FAILED', 'ESCALATION_RAISED']
    : overallStatus === 'warn'
      ? ['SLI_ATTESTATION_PASSED_WITH_WARNINGS']
      : ['SLI_ATTESTATION_PASSED'];

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
