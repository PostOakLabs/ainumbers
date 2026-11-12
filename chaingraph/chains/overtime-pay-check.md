# Overtime Pay Check

Verify overtime pay for a workweek in two stages: FLSA regular-rate and overtime premium computation per 29 CFR 778 (ART-340), then a session receipt aggregating the run's execution hashes (CRY-05). Federal weekly 40-hour rule only; state daily overtime rules are out of scope. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/overtime-pay-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/overtime-pay-check.md

## Workflow chain: Overtime Pay Check

Verify overtime pay for a workweek in two stages: FLSA regular-rate and overtime premium computation per 29 CFR 778 (ART-340), then a session receipt aggregating the run's execution hashes (CRY-05). Federal weekly 40-hour rule only; state daily overtime rules are out of scope. Not legal advice.

Domain: Consumer & Wealth Compliance

### Steps

1. art-340-compute-flsa-regular-rate
   Produces regular_rate, overtime_hours, and overtime_premium_pay via the FLSA regular-rate method; nondiscretionary bonuses are included in the rate, discretionary bonuses excluded
2. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: I earn $20/hour, worked 45 hours this week, and got a $100 performance bonus. What is my overtime pay?
Run the AINumbers MCP tool `run_chain` with {"chain":"overtime-pay-check"} and read `art-340-compute-flsa-regular-rate.overtime_premium_pay`.
Re-run with `inputs` for `art-340-compute-flsa-regular-rate`, reusing the values that result echoed, with `hours_worked_week` set to 50. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/overtime-pay-check.html
