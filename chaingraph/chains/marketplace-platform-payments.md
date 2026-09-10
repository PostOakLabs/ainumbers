# Marketplace Platform Payments

Marketplace fee waterfall design > virtual account structure simulation > payout rail cost/finality modelling > split-payment escrow simulation > marketplace payout flow design: composite marketplace payments mandate.

- Page: https://ainumbers.co/chaingraph/chains/marketplace-platform-payments.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/marketplace-platform-payments.md

## Workflow chain: Marketplace Platform Payments

Marketplace fee waterfall design > virtual account structure simulation > payout rail cost/finality modelling > split-payment escrow simulation > marketplace payout flow design: composite marketplace payments mandate.

Domain: SME & Commercial Finance

### Steps

1. 138-marketplace-fee-waterfall-designer
   fee_waterfall and revenue_split feed Stage 2 virtual account structure simulation
2. 146-virtual-account-structure-simulator
   va_structure and settlement_routing feed Stage 3 payout rail cost/finality model
3. 147-payout-rail-cost-finality-modeller
   rail_economics and finality_comparison feed Stage 4 split-payment escrow simulation
4. 151-split-payment-escrow-simulator
   escrow_terms and fund_flows feed Stage 5 marketplace payout flow designer
5. 159-marketplace-payout-flow-designer
   payout_flow and composite_marketplace_mandate - final marketplace payments mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
