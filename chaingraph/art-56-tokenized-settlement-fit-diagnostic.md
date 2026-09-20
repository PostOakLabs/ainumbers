# Wholesale Tokenized Settlement Fit Diagnostic

12-question A-F readiness diagnostic for wholesale tokenized settlement (tokenized deposits, central bank money, regulated stablecoins as settlement assets). Grades settlement-asset choice, finality regime, cross-network atomicity, asset-leg type, cash-leg issuer, intraday liquidity, and reconciliation controls; routes to the right wholesale-settlement chain and emits a remediation checklist.

- Page: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.md
- MCP tool: run_tokenized_settlement_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_settlement_value_usd (any, optional): Amount in US dollars; type not evidenced by kernel source
- asset_leg_type (any, optional): type not evidenced by kernel source
- atomicity_mechanism (any, optional): type not evidenced by kernel source
- cash_leg_asset (any, optional): type not evidenced by kernel source
- deposit_token_issuer (any, optional): type not evidenced by kernel source
- finality_regime (any, optional): type not evidenced by kernel source
- intraday_liquidity (any, optional): type not evidenced by kernel source
- network_model (any, optional): type not evidenced by kernel source
- operating_hours (any, optional): type not evidenced by kernel source
- participant_eligibility (any, optional): type not evidenced by kernel source
- participant_type (any, optional): type not evidenced by kernel source
- reconciliation_model (any, optional): type not evidenced by kernel source

## Outputs

- dim_scores (object, optional)
- finality_flag (string, optional)
- note (string, optional)
- overall_grade (string, optional)
- overall_score (number, optional)
- primary_recommendation (string, optional)
- remediation_checklist (array, optional)
- secondary_recommendations (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `run_tokenized_settlement_fit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
