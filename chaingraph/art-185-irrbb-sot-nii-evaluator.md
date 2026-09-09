# IRRBB SOT NII Evaluator

Evaluate the Net Interest Income (NII) leg of the EBA Supervisory Outlier Test: the worst-case 1-year delta NII under parallel up/down shocks versus a caller-supplied threshold (EBA leaves NII SOT calibration to competent-authority / institution discretion under EBA Guidelines on IRRBB and CSRBB, EBA/GL/2022/14 - no single EU-wide bright-line percentage exists, unlike the EVE leg). Returns delta_nii_pct_of_nii, threshold_set, and nii_outlier. Terminal node of the irrbb-supervisory-outlier-test chain. Exports as Policy Mandate JSON or W3C VC. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-185-irrbb-sot-nii-evaluator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-185-irrbb-sot-nii-evaluator.md
- MCP tool: evaluate_irrbb_sot_nii (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- baseline (unknown, optional)
- nii_shock (unknown, optional)

## Outputs

- delta_nii_pct_of_nii (integer, optional)
- nii_outlier (boolean, optional)
- projected_nii (integer, optional)
- sot_nii_threshold_pct (integer, optional)
- threshold_set (boolean, optional)
- worst_delta_nii (integer, optional)

## Sample

```json
{
  "nii_shock": {
    "delta_nii_parallel_up": 20,
    "delta_nii_parallel_down": -150
  },
  "baseline": {
    "projected_nii": 1000,
    "sot_nii_threshold_pct": 10
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `evaluate_irrbb_sot_nii` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
