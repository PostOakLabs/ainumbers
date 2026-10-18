# APY Earned Check

Check whether a bank paid the APY it disclosed, in two recompute stages: first recompute the period's interest from daily balances under the caller's declared day-count convention, compounding, and rate terms, diffed against the core's reported accruals with a MATCHES, DIVERGES, or INDETERMINATE verdict (ART-661), then recompute the APY earned from a caller-supplied interest figure and the average daily balance and compare it with the disclosed APY inside a caller-declared accuracy band (ART-663), then a session receipt aggregating the run's execution hashes (CRY-05). Day-count convention, compounding, and every rate term are caller-declared inputs; a divergence is an arithmetic finding, never a determination that interest was miscalculated. Not legal advice and not tax advice.

- Page: https://ainumbers.co/chaingraph/chains/apy-earned-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/apy-earned-check.md

## Workflow chain: APY Earned Check

Check whether a bank paid the APY it disclosed, in two recompute stages: first recompute the period's interest from daily balances under the caller's declared day-count convention, compounding, and rate terms, diffed against the core's reported accruals with a MATCHES, DIVERGES, or INDETERMINATE verdict (ART-661), then recompute the APY earned from a caller-supplied interest figure and the average daily balance and compare it with the disclosed APY inside a caller-declared accuracy band (ART-663), then a session receipt aggregating the run's execution hashes (CRY-05). Day-count convention, compounding, and every rate term are caller-declared inputs; a divergence is an arithmetic finding, never a determination that interest was miscalculated. Not legal advice and not tax advice.

Domain: Consumer & Wealth Compliance

### Steps

1. art-661-interest-accrual-recompute
   Recomputes the period's interest from daily balances under the caller's declared day-count convention, compounding, and rate terms; the recomputation is diffed against the core's reported accruals, with verdict MATCHES, DIVERGES, or INDETERMINATE
2. art-663-apy-earned-recompute
   Recomputes the APY earned from a caller-supplied interest figure and the average daily balance and compares it with the disclosed APY inside the caller's declared accuracy band, with verdict MATCHES, DIVERGES, or INDETERMINATE
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: My savings statement shows 5.12% APY earned. Did the bank pay the rate it disclosed?
Run the AINumbers MCP tool `run_chain` with {"chain":"apy-earned-check"} and read `art-663-apy-earned-recompute.verdict`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/apy-earned-check.html
