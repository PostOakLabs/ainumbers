# Financial Crime Compliance Chain

Dual customer risk rating → triple-layer sanctions, PEP, and batch screening (opening with the sanctions-programme health checker read as a mid-chain screening layer, surfacing current gaps for the PEP and batch screens that follow) → fuzzy-match calibration scoring → layering typology and AMLA transaction risk scoring → ML anomaly detection and structuring pattern detection → final AML programme health scorecard (the same health checker run again, this time as the terminal read over everything Stages 2 through 6 produced, not a repeat of the earlier screen).

- Page: https://ainumbers.co/chaingraph/chains/financial-crime-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/financial-crime-compliance.md

## Workflow chain: Financial Crime Compliance Chain

Dual customer risk rating → triple-layer sanctions, PEP, and batch screening (opening with the sanctions-programme health checker read as a mid-chain screening layer, surfacing current gaps for the PEP and batch screens that follow) → fuzzy-match calibration scoring → layering typology and AMLA transaction risk scoring → ML anomaly detection and structuring pattern detection → final AML programme health scorecard (the same health checker run again, this time as the terminal read over everything Stages 2 through 6 produced, not a repeat of the earlier screen).

Domain: Financial Crime & KYC

### Steps

1. 110-customer-risk-rating
   crr_tier,risk_band feed Stage 2
2. 477-fatf-customer-risk-rating
   fatf_risk_category,enhanced_dd_required feed Stage 2
3. 316-sanctions-programme-health-checker
   programme_health_score,gap_list feed Stage 2
4. 112-pep-sanctions-simulator
   pep_hit_rate,match_precision feed Stage 2
5. 43-batch-sanctions-screening
   batch_results,match_rate feed Stage 3
6. art-93-fuzzy-match-calibration-scorer
   f1_score,fpr,calibration_grade feed Stage 4
7. 120-layering-typology-identifier
   layering_patterns,typology_matches feed Stage 4
8. art-10-amla-transaction-typology-risk-scorer
   typology_risk_score,fatf_category feed Stage 5
9. ml-03-timeseries-anomaly-detector
   anomaly_flags,deviation_sigma feed Stage 5
10. 117-structuring-pattern-detector
   structuring_confidence,ctr_threshold_breaches feed Stage 6
11. 316-sanctions-programme-health-checker
   final_programme_health_score,remediation_plan - Exports AML compliance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
