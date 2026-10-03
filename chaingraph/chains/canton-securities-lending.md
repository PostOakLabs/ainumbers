# Canton Securities Lending Chain

Assess collateral swap eligibility and HQLA classification for Canton securities lending. Swap direction assessment → HQLA tier and haircut verdict.

- Page: https://ainumbers.co/chaingraph/chains/canton-securities-lending.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-securities-lending.md

## Workflow chain: Canton Securities Lending Chain

Assess collateral swap eligibility and HQLA classification for Canton securities lending. Swap direction assessment → HQLA tier and haircut verdict.

Domain: Digital-Asset Rails

### Steps

1. 515-collateral-swap-eligibility-validator
   swap_direction,upgrade_eligible,spread_bps feed Stage 2 collateral eligibility
2. 505-tokenized-collateral-eligibility-checker
   hqla_tier,dtc_eligible,haircut_pct - Exports securities lending mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Does this collateral swap, an IG bond leg against a UST leg, clear the eligibility validator for booking?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-securities-lending"} and read `515-collateral-swap-eligibility-validator.eligibility`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-securities-lending.html
