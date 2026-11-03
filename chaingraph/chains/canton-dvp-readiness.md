# Canton DvP Readiness Chain

Validate DvP atomicity and collateral eligibility for Canton settlement. PFMI P12 atomicity model + DTC/Fed/HQLA eligibility verdict.

- Page: https://ainumbers.co/chaingraph/chains/canton-dvp-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-dvp-readiness.md

## Workflow chain: Canton DvP Readiness Chain

Validate DvP atomicity and collateral eligibility for Canton settlement. PFMI P12 atomicity model + DTC/Fed/HQLA eligibility verdict.

Domain: Digital-Asset Rails

### Steps

1. 507-canton-dvp-atomicity-validator
   dvp_verdict,atomicity_model,finality_model feed Stage 2 collateral eligibility
2. 505-tokenized-collateral-eligibility-checker
   hqla_tier,dtc_eligible,haircut_pct - Exports DvP readiness mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Does our delivery-versus-payment design settle both legs atomically with irrevocable finality, or does it leave Herstatt risk open?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-dvp-readiness"} and read `507-canton-dvp-atomicity-validator.verdict`.
Re-run with `inputs` for `507-canton-dvp-atomicity-validator`, reusing the values that result echoed, with `platform` changed so platform is traditional_csd with every other input unchanged. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-dvp-readiness.html
