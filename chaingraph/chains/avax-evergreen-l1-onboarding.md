# Avalanche Evergreen L1 Onboarding

Evergreen permissioning-control classifier > precompile segregation-of-duties check > validator change-control receipt > L1 continuous-fee runway model: composite Evergreen L1 onboarding walkthrough.

- Page: https://ainumbers.co/chaingraph/chains/avax-evergreen-l1-onboarding.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/avax-evergreen-l1-onboarding.md

## Workflow chain: Avalanche Evergreen L1 Onboarding

Evergreen permissioning-control classifier > precompile segregation-of-duties check > validator change-control receipt > L1 continuous-fee runway model: composite Evergreen L1 onboarding walkthrough.

Domain: Digital-Asset Rails

### Steps

1. art-495-avax-permissioning-control-classifier
   protocol-enforced, application-enforced and absent control classification (with gap register) feeds Stage 2 precompile segregation-of-duties check
2. art-459-sod-matrix-check
   clean/conflict SoD verdict over the application-enforced roles feeds Stage 3 validator change-control receipt
3. art-497-validator-change-control-receipt
   authorization chain, quorum verdict and exceptions for the validator-set change feed Stage 4 L1 continuous-fee runway model
4. art-496-l1-continuous-fee-runway
   annual TCO, months_to_depletion and refill_amount_required complete the Evergreen L1 onboarding walkthrough

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The treasury keeps a fixed AVAX balance for validator fees. Does the runway clear our 24 month target at the current fee curve?
Run the AINumbers MCP tool `run_chain` with {"chain":"avax-evergreen-l1-onboarding"} and read `art-496-l1-continuous-fee-runway.runway_flag`.
Re-run with `inputs` for `art-496-l1-continuous-fee-runway`, reusing the values that result echoed, with `current_balance` set to 60000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/avax-evergreen-l1-onboarding.html
