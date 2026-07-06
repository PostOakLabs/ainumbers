import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-274-compile-work-mandate';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mandate_type: 'governance_mandate',
  gpu:          false,
};

// §22.4 compile_work_mandate: mandate document → deterministic §21.4 gated-chain config.
// Pure structural transform (no transcendentals, no engine APIs).
// Rejection: multi_pointer_gate if conditions/triggers name more than one RFC 6901 pointer.
export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const mandate = (pp.mandate !== null && typeof pp.mandate === 'object') ? pp.mandate : {};

  const scope             = (mandate.scope !== null && typeof mandate.scope === 'object') ? mandate.scope : {};
  const conditions        = Array.isArray(mandate.conditions)          ? mandate.conditions          : [];
  const escalationTriggers = Array.isArray(mandate.escalation_triggers) ? mandate.escalation_triggers : [];

  // Derive ordered step IDs from scope (§22.4 Rule 1).
  // scope.tool_ids takes precedence; scope.chains[0] is treated as a single chain-reference step
  // when tool_ids is absent/empty (chain catalog expansion is a runtime concern, not kernel concern).
  let stepIds;
  if (Array.isArray(scope.tool_ids) && scope.tool_ids.length > 0) {
    stepIds = scope.tool_ids.slice();
  } else if (Array.isArray(scope.chains) && scope.chains.length > 0) {
    stepIds = [String(scope.chains[0])];
  } else {
    stepIds = [];
  }

  // §22.4 Rule 2: all conditions + escalation_triggers MUST share exactly one RFC 6901 pointer.
  const allEntries = conditions.concat(escalationTriggers);
  const seenPointers = [];
  for (let i = 0; i < allEntries.length; i++) {
    const ptr = allEntries[i].pointer;
    if (ptr != null && seenPointers.indexOf(ptr) < 0) seenPointers.push(ptr);
  }
  if (seenPointers.length > 1) {
    return {
      output_payload: {
        error:  'multi_pointer_gate',
        detail: 'All conditions and escalation_triggers must share one RFC 6901 pointer per §22.4 Rule 2.',
        found:  seenPointers,
      },
      compliance_flags: ['MULTI_POINTER_GATE_REJECTED'],
    };
  }

  const pointer = seenPointers.length === 1 ? seenPointers[0] : null;

  // Build steps skeleton (§22.4 Rule 1).
  const steps = stepIds.map(function(tid) {
    return { tool_id: String(tid), id: String(tid) };
  });

  // §22.4 Rule 3: attach a single gate to the checkpoint step when conditions/triggers exist.
  // Checkpoint index = max(0, N-2): for N>=2 the penultimate step; for N=1 the only step.
  // Escalation triggers first (next:"escalate"), then conditions (next: next-step id or "end").
  // default is always "escalate" (§22.4 Rule 4).
  if (pointer !== null && steps.length > 0 && (conditions.length > 0 || escalationTriggers.length > 0)) {
    const checkpointIdx = steps.length >= 2 ? steps.length - 2 : 0;
    const nextStepId    = (checkpointIdx + 1 < steps.length) ? steps[checkpointIdx + 1].id : 'end';

    const rules = [];

    for (let j = 0; j < escalationTriggers.length; j++) {
      const t    = escalationTriggers[j];
      const rule = { op: String(t.op) };
      if (t.op !== 'present' && t.op !== 'absent') rule.value = t.value;
      rule.next = 'escalate';
      rules.push(rule);
    }

    for (let k = 0; k < conditions.length; k++) {
      const c    = conditions[k];
      const rule = { op: String(c.op) };
      if (c.op !== 'present' && c.op !== 'absent') rule.value = c.value;
      rule.next = nextStepId;
      rules.push(rule);
    }

    steps[checkpointIdx] = {
      tool_id: steps[checkpointIdx].tool_id,
      id:      steps[checkpointIdx].id,
      gate:    { input: pointer, rules, default: 'escalate' },
    };
  }

  return {
    output_payload:   { chain_config: { steps } },
    compliance_flags: [],
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
