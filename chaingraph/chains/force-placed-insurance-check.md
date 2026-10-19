# Force-Placed Insurance Check

Check a lender-placed insurance charge in two stages: first verify the 45-day advance first notice with its prescribed content set, the reminder notice at least 30 days after the first notice and at least 15 days before the charge, and the no-evidence-of-continuous-coverage precondition, with the 15-day cancellation and refund clock and the charged premium reported against borrower alternative quotes as a values-only comparison (ART-734), then a session receipt aggregating the run's execution hashes (CRY-05). All notice dates, coverage periods, and premium figures are caller-supplied inputs; the verdict is an arithmetic and sequence finding, never a legal determination. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/force-placed-insurance-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/force-placed-insurance-check.md

## Workflow chain: Force-Placed Insurance Check

Check a lender-placed insurance charge in two stages: first verify the 45-day advance first notice with its prescribed content set, the reminder notice at least 30 days after the first notice and at least 15 days before the charge, and the no-evidence-of-continuous-coverage precondition, with the 15-day cancellation and refund clock and the charged premium reported against borrower alternative quotes as a values-only comparison (ART-734), then a session receipt aggregating the run's execution hashes (CRY-05). All notice dates, coverage periods, and premium figures are caller-supplied inputs; the verdict is an arithmetic and sequence finding, never a legal determination. Not legal advice.

Domain: Consumer & Wealth Compliance

### Steps

1. art-734-force-placed-insurance-checker
   Verifies the 45-day advance first notice with its prescribed content set, the reminder notice at least 30 days after the first notice and at least 15 days before the charge, and the no-evidence-of-continuous-coverage precondition; evaluates the 15-day cancellation and refund clock with a pro-rata overlapping-coverage refund computed from values; reports the charged premium against borrower alternative quotes as a values-only comparison
2. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: My servicer charged $1,200 for force-placed insurance. Were the required notices sent first, and how does it compare to my $600 quote?
Run the AINumbers MCP tool `run_chain` with {"chain":"force-placed-insurance-check"} and read `art-734-force-placed-insurance-checker.verdict`.
Re-run with `inputs` for `art-734-force-placed-insurance-checker`, reusing the values that result echoed, with `alternative_quote_amount` changed so a $450 quote instead of $600. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/force-placed-insurance-check.html
