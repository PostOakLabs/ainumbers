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
