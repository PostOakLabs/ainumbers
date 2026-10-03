# Besu Settlement Contract Conformance Gate

Pre-deployment gate for a bank’s Besu-permissioned settlement contract and its off-chain orchestrator: static contract lint, orchestrator attestation, and receipt aggregation compose into one conformance record before go-live.

- Page: https://ainumbers.co/chaingraph/chains/besu-contract-conformance-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/besu-contract-conformance-composer.md

## Workflow chain: Besu Settlement Contract Conformance Gate

Pre-deployment gate for a bank’s Besu-permissioned settlement contract and its off-chain orchestrator: static contract lint, orchestrator attestation, and receipt aggregation compose into one conformance record before go-live.

Domain: Digital-Asset Rails

### Steps

1. art-289-lint-besu-settlement-contract
   lint findings feed Stage 2 orchestrator attestation
2. art-292-attest-settlement-orchestrator
   orchestrator attestation feeds Stage 3 receipt aggregation
3. cry-05-agent-action-audit-trail-aggregator
   Aggregates the conformance receipts - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our settlement contract is about to deploy to Besu. Does it evidence the paired or revert pattern the ruleset wants, or does a rule fail?
Run the AINumbers MCP tool `run_chain` with {"chain":"besu-contract-conformance"} and read `art-289-lint-besu-settlement-contract.overall`.
Re-run with `inputs` for `art-289-lint-besu-settlement-contract`, reusing the values that result echoed, with `source` changed so the source settles with a single unguarded transfer call. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/besu-contract-conformance.html
