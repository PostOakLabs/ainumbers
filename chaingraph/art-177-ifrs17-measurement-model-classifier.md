# IFRS 17 Measurement Model Classifier

Classify insurance contracts to their IFRS 17 measurement model: Premium Allocation Approach (PAA) for coverage periods of 12 months or less, Variable Fee Approach (VFA) for direct-participating contracts with investment-linked features (not reinsurance), or General Measurement Model/BBA as the default. Returns measurement_model (GMM/VFA/PAA), eligible_models, paa_eligible, vfa_eligible flags, and direct_participating indicator. Root node of the ifrs17-measurement-conformance chain. IFRS 17 live since Jan 1 2023. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-177-ifrs17-measurement-model-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-177-ifrs17-measurement-model-classifier.md
- MCP tool: classify_ifrs17_measurement_model (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- contract (unknown, optional)

## Outputs

- coverage_period_months (integer, optional)
- direct_participating (boolean, optional)
- eligible_models (array, optional)
- is_reinsurance (boolean, optional)
- measurement_model (string, optional)
- paa_eligible (boolean, optional)
- vfa_eligible (boolean, optional)

## Sample

```json
{
  "contract": {
    "coverage_period_months": 12,
    "direct_participating_features": false,
    "is_reinsurance": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_ifrs17_measurement_model` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
