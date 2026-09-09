# Settlement-Fail Predictor

Scores a trade's fail probability from anonymized configuration features (SSI match status, instrument liquidity tier, counterparty fail-history band, deadline proximity, partial-settlement availability) and ranks a batch for pre-settlement intervention. No PII. Transparent weighted scorecard: dominant driver per trade.

- Page: https://ainumbers.co/chaingraph/art-79-settlement-fail-predictor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-79-settlement-fail-predictor.md
- MCP tool: predict_settlement_fail (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- trades (unknown, optional)

## Outputs

- batch_fail_rate_estimate (integer, optional)
- methodology (object, optional)
- note (string, optional)
- scored_trades (array, optional)
- top_drivers (array, optional)
- trade_count (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `predict_settlement_fail` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
