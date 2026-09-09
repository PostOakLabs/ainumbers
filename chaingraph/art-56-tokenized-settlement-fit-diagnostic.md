# Wholesale Tokenized Settlement Fit Diagnostic

12-question A-F readiness diagnostic for wholesale tokenized settlement (tokenized deposits, central bank money, regulated stablecoins as settlement assets). Grades settlement-asset choice, finality regime, cross-network atomicity, asset-leg type, cash-leg issuer, intraday liquidity, and reconciliation controls; routes to the right wholesale-settlement chain and emits a remediation checklist.

- Page: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-56-tokenized-settlement-fit-diagnostic.md
- MCP tool: run_tokenized_settlement_fit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_settlement_value_usd (unknown, optional): Amount in US dollars
- asset_leg_type (unknown, optional)
- atomicity_mechanism (unknown, optional)
- cash_leg_asset (unknown, optional)
- deposit_token_issuer (unknown, optional)
- finality_regime (unknown, optional)
- intraday_liquidity (unknown, optional)
- network_model (unknown, optional)
- operating_hours (unknown, optional)
- participant_eligibility (unknown, optional)
- participant_type (unknown, optional)
- reconciliation_model (unknown, optional)

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
