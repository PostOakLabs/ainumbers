# Intraday Liquidity & Capital under 24/7 Settlement

W-E. Settlement-risk capital (504) -> intraday/HQLA liquidity stress (sim-01) -> liquidity-usage anomaly monitoring (ml-03). Models the liquidity and capital impact of moving from RTGS windows to 24/7 tokenized settlement. Educational estimator.

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-intraday-liquidity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-intraday-liquidity.md

## Workflow chain: Intraday Liquidity & Capital under 24/7 Settlement

W-E. Settlement-risk capital (504) -> intraday/HQLA liquidity stress (sim-01) -> liquidity-usage anomaly monitoring (ml-03). Models the liquidity and capital impact of moving from RTGS windows to 24/7 tokenized settlement. Educational estimator.

Domain: Wholesale Settlement

### Steps

1. 504-settlement-risk-capital-optimizer
   capital profile (H1) feeds the liquidity stress test
2. sim-01-lcr-nsfr-liquidity-stress-test
   liquidity result (H2) feeds the anomaly detector
3. ml-03-timeseries-anomaly-detector
   Exports composite intraday-liquidity artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
