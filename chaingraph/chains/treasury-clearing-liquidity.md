# Clearing Margin-Funding Liquidity Stress

W-F. LCR/NSFR liquidity stress (sim-01) -> margin-call collateral mobilization (513) -> stress test of margin-call size under 6 historical crises (qfa-03). Models the intraday liquidity drain of meeting CCP margin calls.

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-liquidity.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-liquidity.md

## Workflow chain: Clearing Margin-Funding Liquidity Stress

W-F. LCR/NSFR liquidity stress (sim-01) -> margin-call collateral mobilization (513) -> stress test of margin-call size under 6 historical crises (qfa-03). Models the intraday liquidity drain of meeting CCP margin calls.

Domain: Treasury Clearing

### Steps

1. sim-01-lcr-nsfr-liquidity-stress-test
   lcr/nsfr stress paths feed the mobilizer
2. 513-margin-call-collateral-mobilizer
   mobilization shortfall feeds the stress engine
3. qfa-03-stress-test-engine
   Exports composite liquidity-stress artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
