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
