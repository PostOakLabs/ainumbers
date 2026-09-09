# IFRS 17 Risk Adjustment Checker

Check IFRS 17 risk-adjustment (RA) disclosure completeness: validates technique (VaR/CTE/CoC/other per IFRS 17 para 119b), confidence-level disclosure for VaR and CTE techniques, positive RA amount, and onerous-contract loss-component recognition (IFRS 17 para 47-50). Returns ra_valid flag, technique_ok, gaps list, and onerous_properly_handled indicator. Terminal node of the ifrs17-measurement-conformance chain. IFRS 17 para 56-57 and 119. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-179-ifrs17-risk-adjustment-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-179-ifrs17-risk-adjustment-checker.md
- MCP tool: check_ifrs17_risk_adjustment (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- risk_adjustment (unknown, optional)

## Outputs

- confidence_disclosed (boolean, optional)
- confidence_level_pct (integer, optional)
- disclosed (boolean, optional)
- gaps (array, optional)
- loss_component_recognized (boolean, optional)
- onerous_contracts_identified (boolean, optional)
- onerous_properly_handled (boolean, optional)
- ra_amount (integer, optional)
- ra_valid (boolean, optional)
- technique (string, optional)
- technique_ok (boolean, optional)

## Sample

```json
{
  "risk_adjustment": {
    "ra_amount": 500,
    "technique": "CoC",
    "confidence_level_pct": 0,
    "disclosed": true,
    "onerous_contracts_identified": false,
    "loss_component_recognized": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_ifrs17_risk_adjustment` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
