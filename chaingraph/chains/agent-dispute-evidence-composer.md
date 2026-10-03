# Assemble Agent Dispute Evidence

Five-step agentic-transaction compelling-evidence pack, mapped to Visa CE3.0: documents authorization at the point of delegation (AP2 mandate), inspects the Visa Trusted Agent Protocol signature, binds the Mastercard Agent Pay agentic token, aggregates a session execution receipt for fulfillment, then terminates in a deterministic evidence lint checking presence and digest-binding of every element.

- Page: https://ainumbers.co/chaingraph/chains/agent-dispute-evidence-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-dispute-evidence-composer.md

## Workflow chain: Assemble Agent Dispute Evidence

Five-step agentic-transaction compelling-evidence pack, mapped to Visa CE3.0: documents authorization at the point of delegation (AP2 mandate), inspects the Visa Trusted Agent Protocol signature, binds the Mastercard Agent Pay agentic token, aggregates a session execution receipt for fulfillment, then terminates in a deterministic evidence lint checking presence and digest-binding of every element.

Domain: AI & Agent Governance

### Steps

1. art-01-ap2-mandate-chain-validator
   Documents authorization at the point of delegation; feeds the terminal lint as evidence.ap2_mandate
2. art-23-visa-trusted-agent-protocol-inspector
   Visa TAP signature inspection over the transaction; feeds the terminal lint as evidence.tap_signature
3. art-24-mastercard-agentic-token-builder
   Mastercard Agent Pay token binding; feeds the terminal lint as evidence.agentic_token
4. cry-05-agent-action-audit-trail-aggregator
   Session-receipt execution proof for the fulfilled order; feeds the terminal lint as evidence.delivery_proof
5. art-297-agentic-dispute-ce30-linter
   Composes the gated evidence-pack receipt - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A cardholder disputes an agent-made payment under Visa reason code 10.4. Is the evidence pack ready for CE3.0, or are elements still missing?
Run the AINumbers MCP tool `run_chain` with {"chain":"assemble-agent-dispute-evidence"} and read `art-297-agentic-dispute-ce30-linter.ce30_readiness`.
Re-run with `inputs` for `art-297-agentic-dispute-ce30-linter`, reusing the values that result echoed, with `evidence` changed so the delivery proof document is absent from the evidence set. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/assemble-agent-dispute-evidence.html
