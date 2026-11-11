# Provable Reputation Score Aggregate

Single-node diagnostic aggregating OCG execution receipts into a deterministic, groth16-provable reputation score: exponential decay, self-issued exclusion, dedupe.

- Page: https://ainumbers.co/chaingraph/chains/reputation-score-aggregate.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/reputation-score-aggregate.md

## Workflow chain: Provable Reputation Score Aggregate

Single-node diagnostic aggregating OCG execution receipts into a deterministic, groth16-provable reputation score: exponential decay, self-issued exclusion, dedupe.

Domain: AI & Agent Governance

### Steps

1. art-278-reputation-score-aggregator
   composite and per-dim scores feed the subject's trust record; standalone recurring aggregation over the growing receipt set

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: An ops team wants to route high-value work to this agent. What does its provable reputation score say today?
Run the AINumbers MCP tool `run_chain` with {"chain":"reputation-score-aggregate"} and read `art-278-reputation-score-aggregator.composite`.
Re-run with `inputs` for `art-278-reputation-score-aggregator`, reusing the values that result echoed, with `decay_half_life_days` set to 1. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/reputation-score-aggregate.html
