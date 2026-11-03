# Retirement Decumulation Decisions

Social Security claiming-age optimization paired with the pension lump-sum-vs-annuity decision engine.

- Page: https://ainumbers.co/chaingraph/chains/retirement-decumulation-decisions.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/retirement-decumulation-decisions.md

## Workflow chain: Retirement Decumulation Decisions

Social Security claiming-age optimization paired with the pension lump-sum-vs-annuity decision engine.

Domain: Consumer & Wealth Compliance

### Steps

1. art-282-social-security-claiming-optimizer
   recommendedClaimAge and lifetimePV establish the claimant's decumulation income baseline used alongside the pension lump-sum-vs-annuity comparison
2. art-283-pension-lump-sum-vs-annuity-decision-engine
   annuityPV, breakEvenRate, and recommendation form the paired decumulation decision record; terminal stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A colleague was offered a 300000 lump sum against a 2000 monthly pension. Which is the better deal for them?
Run the AINumbers MCP tool `run_chain` with {"chain":"retirement-decumulation-decisions"} and read `art-283-pension-lump-sum-vs-annuity-decision-engine.recommendation`.
Re-run with `inputs` for `art-283-pension-lump-sum-vs-annuity-decision-engine`, reusing the values that result echoed, with `election` changed so its lumpSum offer is 700000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/retirement-decumulation-decisions.html
