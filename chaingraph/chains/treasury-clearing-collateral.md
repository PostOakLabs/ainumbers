# Cleared Repo Collateral & Substitution

W-D. HQLA eligibility for UST collateral (505) -> collateral-swap/substitution direction (515) -> 2a-7 MMF cash-investor validation (514). Collateral side of cleared repo.

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-collateral.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-collateral.md

## Workflow chain: Cleared Repo Collateral & Substitution

W-D. HQLA eligibility for UST collateral (505) -> collateral-swap/substitution direction (515) -> 2a-7 MMF cash-investor validation (514). Collateral side of cleared repo.

Domain: Treasury Clearing

### Steps

1. 505-tokenized-collateral-eligibility-checker
   hqla_tier + haircut feed the swap validator
2. 515-collateral-swap-eligibility-validator
   swap_direction verdict feeds the fund-collateral validator
3. 514-tokenized-fund-collateral-validator
   Exports composite collateral artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
