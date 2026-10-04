# Cleared Settlement Integrity & Fails

W-H convergence terminal. Merkle batch integrity over the cleared settlement set (cry-04) -> PFMI P12 DvP atomicity & CRE70 fail charge (507) -> settlement-fail-rate anomaly monitoring (ml-03).

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-settlement-integrity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-settlement-integrity.md

## Workflow chain: Cleared Settlement Integrity & Fails

W-H convergence terminal. Merkle batch integrity over the cleared settlement set (cry-04) -> PFMI P12 DvP atomicity & CRE70 fail charge (507) -> settlement-fail-rate anomaly monitoring (ml-03).

Domain: Treasury Clearing

### Steps

1. cry-04-merkle-batch-verifier
   batch integrity verdict feeds the DvP validator
2. 507-canton-dvp-atomicity-validator
   atomicity/finality verdict + fail-charge feed the anomaly detector
3. ml-03-timeseries-anomaly-detector
   Exports composite settlement-integrity artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A Canton settlement drill failed because the network kept no unwind procedure on record. What verdict does the DvP check hand back?
Run the AINumbers MCP tool `run_chain` with {"chain":"treasury-clearing-settlement-integrity"} and read `507-canton-dvp-atomicity-validator.verdict`.
Re-run with `inputs` for `507-canton-dvp-atomicity-validator`, reusing the values that result echoed, with `unwind_procedure` set to false. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/treasury-clearing-settlement-integrity.html
