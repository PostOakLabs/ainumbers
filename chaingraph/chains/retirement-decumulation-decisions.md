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
