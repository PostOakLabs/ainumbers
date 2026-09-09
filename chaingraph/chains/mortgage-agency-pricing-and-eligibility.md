# Mortgage Agency Pricing and Eligibility

Gated three-step chain: conforming loan limit check feeds agency eligibility matrix (gate: INELIGIBLE routes to non-conforming referral terminal step; ELIGIBLE continues to LLPA pricing stack). Determines agency deliverability and computes the LLPA cost grid for eligible loans. FHFA CLL 2026 + Fannie/Freddie DU/LPA eligibility + LLPA FNM-2025-11-01.

- Page: https://ainumbers.co/chaingraph/chains/mortgage-agency-pricing-and-eligibility.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mortgage-agency-pricing-and-eligibility.md

## Workflow chain: Mortgage Agency Pricing and Eligibility

Gated three-step chain: conforming loan limit check feeds agency eligibility matrix (gate: INELIGIBLE routes to non-conforming referral terminal step; ELIGIBLE continues to LLPA pricing stack). Determines agency deliverability and computes the LLPA cost grid for eligible loans. FHFA CLL 2026 + Fannie/Freddie DU/LPA eligibility + LLPA FNM-2025-11-01.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-223-conforming-loan-limit
   Conforming/super-conforming/jumbo classification feeds Step 2 agency eligibility check
2. art-222-agency-eligibility-matrix
   Agency eligibility verdict - gate routes INELIGIBLE to non-conforming referral, ELIGIBLE to LLPA pricing
3. art-221-llpa-stack
   LLPA pricing stack with table_version binding completes the agency pricing and eligibility report - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
