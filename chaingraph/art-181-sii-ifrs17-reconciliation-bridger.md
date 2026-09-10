# SII-IFRS 17 Reconciliation Bridger

Bridge Solvency II technical provisions (best estimate + risk margin) to IFRS 17 insurance contract liabilities (fulfilment cash flows + risk adjustment + CSM). Computes bridge_delta and flags when the relative gap exceeds 10% of SII provisions. Compares risk adjustment against SII risk margin using EIOPA research benchmarks (RA typically 33-44% lower than risk margin for life insurance, FSI Insights 26). Feeds insurance reporting readiness diagnostic (art-182). Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-181-sii-ifrs17-reconciliation-bridger.html
- Markdown twin: https://ainumbers.co/chaingraph/art-181-sii-ifrs17-reconciliation-bridger.md
- MCP tool: reconcile_sii_ifrs17 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- provisions (unknown, optional)

## Outputs

- bel_fcf_delta (integer, optional)
- bridge_delta (integer, optional)
- bridge_within_tolerance (boolean, optional)
- ifrs17_csm (integer, optional)
- ifrs17_fcf (integer, optional)
- ifrs17_insurance_contract_liabilities (integer, optional)
- ifrs17_ra (integer, optional)
- ra_vs_risk_margin_ratio_pct (integer, optional)
- relative_bridge_delta_pct (number, optional)
- rm_ra_delta (integer, optional)
- sii_best_estimate (integer, optional)
- sii_risk_margin (integer, optional)
- sii_technical_provisions (integer, optional)

## Sample

```json
{
  "provisions": {
    "sii_best_estimate": 10000,
    "sii_risk_margin": 1000,
    "ifrs17_fcf": 9800,
    "ifrs17_ra": 700,
    "ifrs17_csm": 300
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_sii_ifrs17` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
