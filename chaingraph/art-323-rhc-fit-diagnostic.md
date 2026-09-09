# Robinhood Chain Fit Diagnostic

12-question A-F diagnostic grading a firm's Robinhood Chain adoption fit across four paths: stock-token application, collateral/lending venue, index/basket product, and agent-settlement automation. Routes to the reconciliation, regime-mapping, valuation-lint, collateral-haircut, BoLD-finality, and AP-redemption-stress workflows. Deliberately does not reuse the MiCA/GENIUS question set from the Tempo and Arc diagnostics, since Robinhood Chain stock tokens sit in the opposite regulatory carve-out. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-323-rhc-fit-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-323-rhc-fit-diagnostic.md
- MCP tool: run_robinhood_chain_fit_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "q1_holds_or_custodies_stock_tokens": "no",
  "q2_tracks_corporate_actions": "no",
  "q3_computes_usd_valuation": "no",
  "q4_accepts_stock_tokens_as_collateral": "no",
  "q5_needs_staleness_halt_checks": "no",
  "q6_off_hours_settlement_exposure": "no",
  "q7_builds_index_or_basket_product": "no",
  "q8_needs_regulatory_characterization": "no",
  "q9_assumed_mica_genius_applies": "no",
  "q10_asserts_settlement_finality": "yes",
  "q11_relies_on_redemption_reachability": "yes",
  "q12_automates_settlement_decisions": "yes"
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_robinhood_chain_fit_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
