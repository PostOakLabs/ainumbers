# T+1 / CSDR Settlement Chain

Verify allocation affirmation conformance and T+1 readiness → predict settlement fails and assess FX exposure → calculate CSDR cash penalties → compute settlement efficiency KPIs → model buy-in exposure and classify scope. End-to-end T+1 and CSDR settlement compliance journey.

- Page: https://ainumbers.co/chaingraph/chains/t1-csdr-settlement.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/t1-csdr-settlement.md

## Workflow chain: T+1 / CSDR Settlement Chain

Verify allocation affirmation conformance and T+1 readiness → predict settlement fails and assess FX exposure → calculate CSDR cash penalties → compute settlement efficiency KPIs → model buy-in exposure and classify scope. End-to-end T+1 and CSDR settlement compliance journey.

Domain: Securities Settlement

### Steps

1. art-81-allocation-affirmation-conformance
   affirmation_pass,ssi_gaps,counterparty_mismatches feed Stage 2 fail prediction
2. 351-t1-settlement-operational-readiness-assessor
   readiness_score,gap_items,cutoff_compliance feed Stage 2 fail prediction
3. art-79-settlement-fail-predictor
   fail_probability,fail_reasons,expected_fail_rate feed Stage 3 penalty calculation
4. 215-fx-settlement-fails-assessor
   fx_fail_rate,exposure_usd,corridor_breakdown feed Stage 3 CSDR penalty
5. art-78-csdr-penalty-calculator
   cash_penalty_eur,penalty_band,reporting_obligation feed Stage 4 efficiency KPI
6. 368-csdr-settlement-fails-penalty-calculator
   total_penalty_estimate,daily_rate,penalty_tier feed Stage 4 efficiency scoring
7. art-84-settlement-efficiency-kpi
   efficiency_rate,fail_count,kpi_band feed Stage 4 efficiency rate
8. 370-settlement-efficiency-rate-calculator
   settlement_rate_pct,t0_t2_breakdown,volume_weighted feed Stage 5 buy-in
9. art-83-buy-in-exposure-modeler
   buy_in_exposure_usd,triggered_threshold feed Stage 5 scope classification
10. 372-buyin-scope-classifier-cost-penalty-estimator
   buyin_scope,total_cost_estimate - Exports CSDR settlement compliance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
