# Canton MMF Collateral Eligibility Chain

Validate a tokenized money-market fund as eligible collateral for Canton settlement. Fund-level NAV and eligibility check → HQLA tier and haircut verdict.

- Page: https://ainumbers.co/chaingraph/chains/canton-mmf-collateral.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-mmf-collateral.md

## Workflow chain: Canton MMF Collateral Eligibility Chain

Validate a tokenized money-market fund as eligible collateral for Canton settlement. Fund-level NAV and eligibility check → HQLA tier and haircut verdict.

Domain: Digital-Asset Rails

### Steps

1. 514-tokenized-fund-collateral-validator
   fund_eligible,nav_verified,ucits_compliant feed Stage 2 collateral eligibility
2. 505-tokenized-collateral-eligibility-checker
   hqla_tier,dtc_eligible,haircut_pct - Exports MMF collateral mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
