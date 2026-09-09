# Mortgage Government Loan Fit

Gated two-step government loan program router. First step surfaces the target loan program into output_payload (loan_program field). Gate routes VA program to VA funding fee and residual income calculation; all other programs (FHA and others) continue to FHA MIP eligibility and cost calculation. Both branches are reachable: VA path computes funding fee + 38 USC §3729 table; FHA/default path computes HUD 4000.1 MIP. Total function with mandatory default.

- Page: https://ainumbers.co/chaingraph/chains/mortgage-government-loan-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mortgage-government-loan-fit.md

## Workflow chain: Mortgage Government Loan Fit

Gated two-step government loan program router. First step surfaces the target loan program into output_payload (loan_program field). Gate routes VA program to VA funding fee and residual income calculation; all other programs (FHA and others) continue to FHA MIP eligibility and cost calculation. Both branches are reachable: VA path computes funding fee + 38 USC §3729 table; FHA/default path computes HUD 4000.1 MIP. Total function with mandatory default.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-223-conforming-loan-limit
   loan_program field (VA/FHA/Conventional) surfaces into output_payload; gate routes VA to funding-fee path, default to FHA MIP path
2. art-225-va-funding-fee-residual
   VA funding fee (38 USC §3729) and residual income (Pamphlet 26-7 Ch.4) - VA path final stage
3. art-224-fha-mip-eligibility
   FHA MIP eligibility and cost (HUD 4000.1, ML 2023-05) - FHA/default path final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
