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
