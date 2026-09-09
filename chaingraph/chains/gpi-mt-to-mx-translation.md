# GPI MT-to-MX Translation

Linear two-step chain for SWIFT GPI MT103 to pacs.008 migration fidelity. Step 1 simulates the GPI tracker lifecycle for the payment status transition and Universal Confirmation SLA (ACSP to ACCC within 24h). Step 2 scores MT103-to-pacs.008 field mapping fidelity (ordering customer, beneficiary, agent BICs, remittance info, charge bearer code mapping OUR=DEBT/SHA=SHAR/BEN=CRED). Both steps always run. Use to diagnose translation quality before CBPR+ November 2026 go-live.

- Page: https://ainumbers.co/chaingraph/chains/gpi-mt-to-mx-translation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/gpi-mt-to-mx-translation.md

## Workflow chain: GPI MT-to-MX Translation

Linear two-step chain for SWIFT GPI MT103 to pacs.008 migration fidelity. Step 1 simulates the GPI tracker lifecycle for the payment status transition and Universal Confirmation SLA (ACSP to ACCC within 24h). Step 2 scores MT103-to-pacs.008 field mapping fidelity (ordering customer, beneficiary, agent BICs, remittance info, charge bearer code mapping OUR=DEBT/SHA=SHAR/BEN=CRED). Both steps always run. Use to diagnose translation quality before CBPR+ November 2026 go-live.

Domain: Cross-Border & Instant Payments

### Steps

1. art-244-gpi-tracker-lifecycle-simulator
   GPI status transition validity, SLA breach flag, and allowed next statuses. Passes to MT-to-MX fidelity scoring.
2. art-245-mt-mx-translation-fidelity-scorer
   MT103-to-pacs.008 fidelity score, per-field mapping results, charge bearer check, and truncation risks. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
