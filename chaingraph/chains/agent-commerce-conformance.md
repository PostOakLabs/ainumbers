# Agent Commerce Cross-Protocol Conformance

AP2 v0.2 mandate chain > ACP checkout conformance > x402 settlement modelling > unified cross-protocol conformance verdict.

- Page: https://ainumbers.co/chaingraph/chains/agent-commerce-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-commerce-conformance.md

## Workflow chain: Agent Commerce Cross-Protocol Conformance

AP2 v0.2 mandate chain > ACP checkout conformance > x402 settlement modelling > unified cross-protocol conformance verdict.

Domain: AI & Agent Governance

### Steps

1. art-01-ap2-mandate-chain-validator
   ap2_mandate and execution_hash (H1) feed Stage 2 ACP checkout conformance
2. art-12-acp-checkout-conformance-validator
   acp_verdict and conformance_flags + execution_hash (H2) feed Stage 3 x402 settlement model
3. art-03-x402-settlement-modeler
   x402_payload and settlement execution_hash (H3) feed Stage 4 cross-protocol validator
4. art-30-agent-commerce-conformance-validator
   Exports unified AP2+ACP+TAP+x402 cross-protocol conformance mandate; execution_hash (H4) covers full transaction - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An agent checkout needs to settle 25000 dollars in one payment. Which settlement rail does the modeler pick for it?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-commerce-conformance"} and read `art-03-x402-settlement-modeler.recommended_rail`.
Re-run with `inputs` for `art-03-x402-settlement-modeler`, reusing the values that result echoed, with `amount_usd` set to 25000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-commerce-conformance.html
