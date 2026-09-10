# Exchange Assurance Pack

Custody segregation ratio > asset/liability coverage > PoR liabilities composer > best-execution recompute: composite exchange-assurance mandate.

- Page: https://ainumbers.co/chaingraph/chains/exchange-assurance-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/exchange-assurance-pack.md

## Workflow chain: Exchange Assurance Pack

Custody segregation ratio > asset/liability coverage > PoR liabilities composer > best-execution recompute: composite exchange-assurance mandate.

Domain: Digital-Asset Rails

### Steps

1. art-538-custody-segregation-ratio
   segregation_ratio and status feed Stage 2 asset/liability coverage as the custody-side input to the exchange's solvency picture
2. art-539-asset-liability-coverage
   coverage_ratio and surplus_shortfall_musd feed Stage 3 PoR-liabilities composer as balance-sheet context for the reported liabilities figure
3. art-540-por-liabilities-composer
   composite_determination and reserve_to_liability_ratio feed Stage 4 best-execution recompute, completing the reserves side of the assurance pack
4. art-541-best-execution-recompute
   pct_at_or_better and avg_price_improvement_bps complete the pack - composite exchange-assurance mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
