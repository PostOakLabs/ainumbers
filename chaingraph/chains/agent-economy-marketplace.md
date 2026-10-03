# Agent-Service Marketplace Onboarding & Metering

W-F. Agent identity & authorization attestation (art-04) -> agent-traffic acceptance policy (art-21) -> service metering/pricing (ART-63). Onboards an agent service into a micropayment marketplace with a metered, policy-gated listing.

- Page: https://ainumbers.co/chaingraph/chains/agent-economy-marketplace.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-economy-marketplace.md

## Workflow chain: Agent-Service Marketplace Onboarding & Metering

W-F. Agent identity & authorization attestation (art-04) -> agent-traffic acceptance policy (art-21) -> service metering/pricing (ART-63). Onboards an agent service into a micropayment marketplace with a metered, policy-gated listing.

Domain: Agent Economy

### Steps

1. art-04-agent-identity-attestation-checker
   attestation verdict (H1) feeds the traffic-policy builder
2. art-21-agent-traffic-acceptance-policy-builder
   acceptance policy (H2) feeds the metering modeler
3. art-63-agent-service-metering-modeler
   Exports composite marketplace artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our marketplace is drafting its acceptance limits for agent traffic. Does a five-thousand-dollar single-transaction cap still read as sound policy?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-economy-marketplace"} and read `art-21-agent-traffic-acceptance-policy-builder.verdict`.
Re-run with `inputs` for `art-21-agent-traffic-acceptance-policy-builder`, reusing the values that result echoed, with `max_single_val_usd` set to 5000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-economy-marketplace.html
