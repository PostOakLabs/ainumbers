# Corporate Treasury Statement Reconciliation

Linear two-step chain for TMS straight-through reconciliation. Step 1 classifies ISO 20022 camt.053 BkTxCd entries (Domain/Family/SubFamily per CGI-MP v5.0), validates the OPBD+sum(movements)=CLBD balance equation, and scores structured-remittance match rate. Step 2 scores AFP 2024 MAPE and timing-bias of cash forecasts against the reconciled actual transaction amounts, closing the TMS forecast-vs-actual cycle. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/corporate-treasury-statement-reconciliation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/corporate-treasury-statement-reconciliation.md

## Workflow chain: Corporate Treasury Statement Reconciliation

Linear two-step chain for TMS straight-through reconciliation. Step 1 classifies ISO 20022 camt.053 BkTxCd entries (Domain/Family/SubFamily per CGI-MP v5.0), validates the OPBD+sum(movements)=CLBD balance equation, and scores structured-remittance match rate. Step 2 scores AFP 2024 MAPE and timing-bias of cash forecasts against the reconciled actual transaction amounts, closing the TMS forecast-vs-actual cycle. ZERO PII BY CONSTRUCTION.

Domain: Corporate Treasury & FX

### Steps

1. art-258-parse-camt053-reconciliation
   camt.053 BkTxCd classification, OPBD+sum=CLBD balance equation check, structured-remittance match rate. Emits reconciliation_status (CLEAN/PARTIAL_MATCH/LOW_MATCH_RATE/FAILED_BALANCE) and match_rate_pct.
2. art-263-score-cash-forecast-accuracy
   AFP 2024 MAPE/bias scoring across T+1/T+7/T+30/T+90 horizon buckets. Detects persistent timing bias (>75% same-sign). Returns overall_accuracy_tier, by_horizon breakdown, timing_bias_detected. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The bank statement closed at 10500 against a 10000 opening balance. Does the closing balance tie to opening plus booked activity?
Run the AINumbers MCP tool `run_chain` with {"chain":"corporate-treasury-statement-reconciliation"} and read `art-258-parse-camt053-reconciliation.reconciliation_status`.
Re-run with `inputs` for `art-258-parse-camt053-reconciliation`, reusing the values that result echoed, with `transactions` changed so it carries no transactions, so the closing balance cannot tie. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/corporate-treasury-statement-reconciliation.html
