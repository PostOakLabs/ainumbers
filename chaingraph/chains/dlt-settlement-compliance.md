# DLT Tokenised Settlement Compliance

DVP reconciliation > tokenised-asset compliance check > settlement finality auditing > DLT TCO calculation > DLT settlement verification: composite DLT settlement compliance mandate.

- Page: https://ainumbers.co/chaingraph/chains/dlt-settlement-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/dlt-settlement-compliance.md

## Workflow chain: DLT Tokenised Settlement Compliance

DVP reconciliation > tokenised-asset compliance check > settlement finality auditing > DLT TCO calculation > DLT settlement verification: composite DLT settlement compliance mandate.

Domain: Digital-Asset Rails

### Steps

1. 55-dvp-reconciliation
   dvp_reconciliation_results and fails_analysis feed Stage 2 tokenised-asset compliance
2. 63-tokenized-asset-compliance
   tokenised_asset_status and compliance_gaps feed Stage 3 settlement finality audit
3. 65-settlement-finality-auditor
   finality_assessment and irrevocability_checks feed Stage 4 DLT TCO calculation
4. 67-dlt-tco-calculator
   tco_estimate and cost_drivers feed Stage 5 DLT settlement verification
5. 74-dlt-settlement-verifier
   settlement_verification and composite_dlt_mandate - final DLT settlement mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
