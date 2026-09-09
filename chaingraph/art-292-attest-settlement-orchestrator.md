# Settlement Orchestrator Attestation

Extends the lint_mcp_server_conformance (art-33) self-reported conformance lint to the settlement decision path: checks the off-chain orchestrator deciding commit/halt on a shared-ledger orchestration layer, never the ledger itself. Four-domain check (manifest lint, decision-policy reference, kernel-binding audit, transport audit) into a composite ship-readiness grade, binding the decision policy and invoked kernels to an execution-receipt chain. This is an unsigned lint result, not a signed attestation. audit_signature.signatures is empty by design, as it is on every unsigned OpenChainGraph node. Formerly named attest_settlement_orchestrator; that name remains accepted permanently.

- Page: https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-292-attest-settlement-orchestrator.md
- MCP tool: lint_settlement_orchestrator_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- decision_policy_ref (unknown, required)
- kernel_bindings (unknown, required)
- orchestrator_manifest (unknown, required)
- transport (unknown, required)

## Outputs

- attestation (object, optional)
- checks (array, optional)
- overall (string, optional)
- per_domain_scores (array, optional)

## Sample

```json
{
  "orchestrator_manifest": {
    "name": "swift-ledger-orchestrator",
    "version": "1.0.0",
    "description": "Off-chain orchestration layer deciding commit/halt for shared-ledger settlement."
  },
  "decision_policy_ref": "policy://sli/commit-halt-v1",
  "kernel_bindings": [
    {
      "tool_id": "art-288-map-iso20022-to-evm-calldata",
      "mcp_name": "map_iso20022_to_evm_calldata"
    },
    {
      "tool_id": "art-291-screen-onledger-transfer-batch",
      "mcp_name": "screen_onledger_transfer_batch"
    }
  ],
  "transport": "https"
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_settlement_orchestrator_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
