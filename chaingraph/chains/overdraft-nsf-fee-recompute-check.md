# Overdraft / NSF Fee Recompute Check

Recompute overdraft and NSF fee events in two stages: an independent replay of the posted ledger under the caller's declared posting-order policy and fee schedule, diffed by post date and fee type against caller-supplied core-charged fees with a MATCHES, DIVERGES, or INDETERMINATE verdict (ART-662), then a session receipt aggregating the run's execution hashes (CRY-05). Posting order and every fee-schedule term are caller-declared inputs; a divergence is an arithmetic finding, never a determination that a fee was charged incorrectly. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/overdraft-nsf-fee-recompute-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/overdraft-nsf-fee-recompute-check.md

## Workflow chain: Overdraft / NSF Fee Recompute Check

Recompute overdraft and NSF fee events in two stages: an independent replay of the posted ledger under the caller's declared posting-order policy and fee schedule, diffed by post date and fee type against caller-supplied core-charged fees with a MATCHES, DIVERGES, or INDETERMINATE verdict (ART-662), then a session receipt aggregating the run's execution hashes (CRY-05). Posting order and every fee-schedule term are caller-declared inputs; a divergence is an arithmetic finding, never a determination that a fee was charged incorrectly. Not legal advice.

Domain: Consumer & Wealth Compliance

### Steps

1. art-662-odnsf-fee-recompute
   Replays the posted ledger under the declared posting-order policy and fee schedule to recompute each OD and NSF fee event; recomputed totals are diffed by post date and fee type against the caller-supplied core-charged figures, with verdict MATCHES, DIVERGES, or INDETERMINATE
2. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: My bank charged two $35 overdraft fees after a $120 card purchase and a $30 ACH debit posted the same day on $100. Does an independent recompute agree?
Run the AINumbers MCP tool `run_chain` with {"chain":"overdraft-nsf-fee-recompute-check"} and read `art-662-odnsf-fee-recompute.verdict`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/overdraft-nsf-fee-recompute-check.html
