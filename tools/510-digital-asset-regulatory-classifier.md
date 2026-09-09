# Digital Asset Regulatory Classifier

Classify tokenized assets under GENIUS Act, MiCA, MiFID II, and EU DLT Pilot Regime. Outputs applicable frameworks, MiFID II instrument type, and DLT Pilot eligibility flag.

- Page: https://ainumbers.co/tools/510-digital-asset-regulatory-classifier.html
- Markdown twin: https://ainumbers.co/tools/510-digital-asset-regulatory-classifier.md
- MCP tool: classify_digital_asset_regulatory (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_name (string, required)
- asset_type (string, required)
- issuer_jurisdiction (string, required)
- issuer_type (string, optional)
- transfer_value (boolean, optional)
- redeemable_par (boolean, optional)
- economic_rights (boolean, optional)
- market_cap_eur (number, optional)
- on_dlt (boolean, optional)
- dlt_type (string, optional)

## Outputs

- classification_results (array, optional)
- compliance_flags (object, optional)
- iso20022_party_identification (array, optional)

## Sample

```json
{
  "asset_type": "stablecoin_usd",
  "issuer_jurisdiction": "us",
  "issuer_type": "bank",
  "transfer_value": true,
  "redeemable_par": true,
  "economic_rights": false,
  "market_cap_eur": null,
  "on_dlt": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_digital_asset_regulatory` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
