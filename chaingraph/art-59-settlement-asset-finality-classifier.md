# Settlement-Asset & Legal-Finality Classifier

Classifies the settlement asset (CBM token / tokenized commercial bank deposit / regulated stablecoin / e-money token) against its legal-finality regime (EU SFD 98/26/EC / CPMI-IOSCO PFMI Principle 8 / UCC Article 12 control) -> finality tier 1-4 + singleness-of-money verdict. Gates ART-58 cross-network atomicity check.

- Page: https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-59-settlement-asset-finality-classifier.md
- MCP tool: classify_settlement_asset_finality (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- finality_designation (any, optional): type not evidenced by kernel source
- governing_law (any, optional): type not evidenced by kernel source
- issuer (any, optional): type not evidenced by kernel source
- jurisdiction (any, optional): type not evidenced by kernel source
- settlement_asset (any, optional): type not evidenced by kernel source
- singleness_test (any, optional): type not evidenced by kernel source
- transfer_mechanism (any, optional): type not evidenced by kernel source

## Outputs

- applicable_regime (string, optional)
- finality_gaps (array, optional)
- finality_tier (integer, optional)
- note (string, optional)
- recommendation (string, optional)
- settlement_asset_class (string, optional)
- singleness_verdict (string, optional)
- status_asof (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_settlement_asset_finality` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
