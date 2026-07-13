import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-289-lint-besu-settlement-contract';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'lint_besu_settlement_contract',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Static conformance lint of a Solidity source or ABI-JSON artifact against
// permissioned-EVM settlement-rail invariants. Lightweight regex/structural
// scan only -- never compiles, never calls solc, never touches a network.
// v1 scope (SLI-WAVE-1 §5 G3): source + ABI only; bytecode/opcode heuristics deferred.

function lintSolidity(source) {
  const findings = [];
  const push = (rule_id, severity, locus, rationale) => findings.push({ rule_id, severity, locus, rationale });

  const hasPairedTransferAndRequire =
    (source.match(/(transferFrom|safeTransfer)\s*\(/g) || []).length >= 2 &&
    /require\s*\(/.test(source);
  push('R1', hasPairedTransferAndRequire ? 'pass' : 'fail', 'contract body',
    hasPairedTransferAndRequire
      ? 'Two or more paired transfer calls guarded by require(...) found (atomic PvP/DvP heuristic).'
      : 'Could not find two paired transfer calls guarded by a require(...) revert; atomic paired-or-revert settlement not evidenced.');

  const usesMsgValue = /\bpayable\b/.test(source) || /msg\.value/.test(source);
  push('R2', usesMsgValue ? 'fail' : 'pass', 'function modifiers/body',
    usesMsgValue
      ? 'Contract declares payable functions or reads msg.value; native-token settlement dependence found.'
      : 'No payable functions or msg.value reads; settlement does not depend on the native token.');

  const hasFinalityEvent = /event\s+\w*(Settled|Finalized|Settlement)\w*\s*\(/i.test(source);
  push('R3', hasFinalityEvent ? 'pass' : 'fail', 'event declarations',
    hasFinalityEvent
      ? 'A Settled/Finalized/Settlement-named event declaration is present.'
      : 'No event whose name matches Settled/Finalized/Settlement was found.');

  const transferFnBlocks = source.match(/function\s+\w*[Tt]ransfer\w*\s*\([^)]*\)[^{]*\{/g) || [];
  const gatedTransferFns = transferFnBlocks.filter((b) => /(onlyCompliant|whenNotPaused|complianceGate)/i.test(b));
  const hasTransferFns = transferFnBlocks.length > 0;
  const allGated = hasTransferFns && gatedTransferFns.length === transferFnBlocks.length;
  push('R4', !hasTransferFns ? 'warn' : allGated ? 'pass' : 'fail', 'transfer function signatures',
    !hasTransferFns
      ? 'No transfer-named function found to check for a compliance-gate modifier.'
      : allGated
        ? 'Every transfer-named function carries a compliance-gate modifier (onlyCompliant/whenNotPaused/complianceGate).'
        : 'At least one transfer-named function is missing a compliance-gate modifier.');

  const hasUnboundedLoop = /for\s*\([^)]*<\s*\w+\.length[^)]*\)/.test(source) && !/require\s*\([^)]*<=\s*\w*MAX/i.test(source);
  push('R5', hasUnboundedLoop ? 'warn' : 'pass', 'loop bounds',
    hasUnboundedLoop
      ? 'A loop iterates to a dynamic array length with no adjacent MAX-bound require(...); potential unbounded participant-set loop.'
      : 'No unbounded participant-set loop pattern detected.');

  const looksUpgradeable = /(delegatecall|UUPSUpgradeable|TransparentUpgradeableProxy)/.test(source);
  const disclosesUpgradeability = /\/\/\s*UPGRADEABLE:/i.test(source);
  push('R6', !looksUpgradeable ? 'pass' : disclosesUpgradeability ? 'pass' : 'warn', 'upgradeability pattern',
    !looksUpgradeable
      ? 'No upgradeable-proxy pattern (delegatecall/UUPS/TransparentUpgradeableProxy) detected.'
      : disclosesUpgradeability
        ? 'Upgradeable-proxy pattern detected and explicitly disclosed via a "// UPGRADEABLE:" comment.'
        : 'Upgradeable-proxy pattern detected with no adjacent "// UPGRADEABLE:" disclosure comment.');

  return findings;
}

function lintAbi(abiArray) {
  const findings = [];
  const push = (rule_id, severity, locus, rationale) => findings.push({ rule_id, severity, locus, rationale });
  const items = Array.isArray(abiArray) ? abiArray : [];
  const functions = items.filter((i) => i && i.type === 'function');
  const events = items.filter((i) => i && i.type === 'event');

  const transferFns = functions.filter((f) => /transfer/i.test(f.name || ''));
  push('R1', transferFns.length >= 1 ? 'warn' : 'fail', 'abi.functions',
    transferFns.length >= 1
      ? 'ABI declares transfer-named function(s); paired-or-revert atomicity cannot be confirmed from ABI shape alone.'
      : 'ABI declares no transfer-named function.');

  const payableFns = functions.filter((f) => f.stateMutability === 'payable');
  push('R2', payableFns.length > 0 ? 'fail' : 'pass', 'abi.functions[].stateMutability',
    payableFns.length > 0
      ? `${payableFns.length} function(s) are payable; native-token settlement dependence found.`
      : 'No payable functions in the ABI.');

  const finalityEvents = events.filter((e) => /Settled|Finalized|Settlement/i.test(e.name || ''));
  push('R3', finalityEvents.length > 0 ? 'pass' : 'fail', 'abi.events',
    finalityEvents.length > 0
      ? 'A Settled/Finalized/Settlement-named event is declared in the ABI.'
      : 'No Settled/Finalized/Settlement-named event declared in the ABI.');

  push('R4', 'warn', 'abi.functions', 'Compliance-gate modifiers are Solidity-source-level constructs and cannot be checked from an ABI fragment alone.');
  push('R5', 'warn', 'abi.functions', 'Loop-bound heuristics require source; not checkable from an ABI fragment alone.');
  push('R6', 'warn', 'abi', 'Upgradeability disclosure requires source; not checkable from an ABI fragment alone.');

  return findings;
}

export function compute(pp) {
  const artifactKind = pp.artifact_kind === 'abi' ? 'abi' : 'solidity';
  const source = pp.source == null ? '' : pp.source;

  let findings;
  if (artifactKind === 'abi') {
    let parsed = [];
    try { parsed = typeof source === 'string' ? JSON.parse(source) : source; } catch (e) { parsed = []; }
    findings = lintAbi(parsed);
  } else {
    findings = lintSolidity(String(source));
  }

  const invariants_pass = {};
  for (const f of findings) invariants_pass[f.rule_id] = f.severity === 'pass';

  const failCount = findings.filter((f) => f.severity === 'fail').length;
  const warnCount = findings.filter((f) => f.severity === 'warn').length;
  const overall = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';

  const output_payload = {
    artifact_kind: artifactKind,
    ruleset_profile: pp.ruleset_profile || 'sli-besu-settlement-v1',
    findings,
    invariants_pass,
    overall,
    fail_count: failCount,
    warn_count: warnCount,
  };
  const compliance_flags = overall === 'fail'
    ? ['SLI_LINT_FAILED', 'ESCALATION_RAISED']
    : overall === 'warn'
      ? ['SLI_LINT_PASSED_WITH_WARNINGS']
      : ['SLI_LINT_PASSED'];

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
