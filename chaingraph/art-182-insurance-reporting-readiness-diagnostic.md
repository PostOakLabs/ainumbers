# Insurance Reporting Readiness Diagnostic

A-F insurance reporting readiness diagnostic across six dimensions: IFRS 17 measurement model election, CSM system implementation, risk-adjustment disclosure, Solvency II Pillar-3 QRT reporting, SII-IFRS 17 reconciliation, and ICS assessment for IAIGs. Returns readiness_grade (A-F), readiness_score (0-100), dimensions_met, and gaps list. Terminal node of the solvency-ii-reconciliation-and-capital chain. IFRS 17 + Solvency II + ICS. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-182-insurance-reporting-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-182-insurance-reporting-readiness-diagnostic.md
- MCP tool: run_insurance_reporting_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity (unknown, optional)

## Outputs

- dimensions_met (integer, optional)
- dimensions_total (integer, optional)
- fully_ready (boolean, optional)
- gaps (array, optional)
- readiness_grade (string, optional)
- readiness_score (integer, optional)

## Sample

```json
{
  "entity": {
    "ifrs17_measurement_model_elected": true,
    "csm_system_implemented": true,
    "risk_adjustment_disclosed": true,
    "sii_qrt_reporting_complete": true,
    "sii_ifrs17_reconciliation_done": true,
    "ics_assessed": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_insurance_reporting_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
