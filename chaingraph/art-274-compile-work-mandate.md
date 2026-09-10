# Work Mandate Compiler

Compiles a §22 Work Mandate document into a deterministic §21.4 gated-chain config. Transforms scope.tool_ids (or scope.chains) into an ordered steps[] skeleton, maps conditions into gate rules (op/value/next), and maps escalation_triggers into rules whose next routes to the reserved 'escalate' target (§22.3). All conditions and triggers must share one RFC 6901 pointer per §22.4 Rule 2; multi-pointer policies are rejected with error:'multi_pointer_gate'. Default for every gate is 'escalate'. Same mandate always produces byte-identical config (deterministic, hash-stable). Not a payment-mandate builder, not an audit-mandate tool, not an agent-OBO validator - this compiles a policy mandate into an enforceable gated-chain config. Zero PII: structural mandate fields only.

- Page: https://ainumbers.co/chaingraph/art-274-compile-work-mandate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-274-compile-work-mandate.md
- MCP tool: compile_work_mandate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mandate (unknown, required)

## Outputs

- chain_config (object, optional)

## Sample

```json
{
  "mandate": {
    "mandate_type": "work_mandate",
    "scope": {
      "tool_ids": [
        "assess_loan",
        "record_outcome"
      ],
      "chains": []
    },
    "conditions": [
      {
        "pointer": "/decision/approved",
        "op": "eq",
        "value": true
      }
    ],
    "escalation_triggers": []
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compile_work_mandate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
