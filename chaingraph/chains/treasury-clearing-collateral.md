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

### Ask your agent

Question: Our repo desk wants to post a wrapped stablecoin where the basket currently holds Treasury tokens. Will the eligibility checker still admit it?
Run the AINumbers MCP tool `run_chain` with {"chain":"treasury-clearing-collateral"} and read `505-tokenized-collateral-eligibility-checker.dtc_status`.
Re-run with `inputs` for `505-tokenized-collateral-eligibility-checker`, reusing the values that result echoed, with `asset_type` set to "stablecoin". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/treasury-clearing-collateral.html
