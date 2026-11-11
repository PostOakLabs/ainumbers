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

### Ask your agent

Question: Can this tokenized money market fund be pledged as collateral, or do its liquidity and NAV terms make it ineligible?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-mmf-collateral"} and read `514-tokenized-fund-collateral-validator.eligibility`.
Re-run with `inputs` for `514-tokenized-fund-collateral-validator`, reusing the values that result echoed, with `fund_type` changed so fund_type is sec_inst_prime_mmf with nav still 1. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-mmf-collateral.html
