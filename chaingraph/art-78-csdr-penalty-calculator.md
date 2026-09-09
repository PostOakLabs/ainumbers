# CSDR Cash-Penalty Calculator

Flagship. Computes the CSDR cash penalty for a settlement fail: selects the asset-class daily rate (incl. Oct-2025 RTS increases: equities 1 bp/day, SSA bonds 0.50 bp/day, non-SSA bonds 0.50 bp/day), applies fail duration and reference price/notional, credits partial settlement, and projects forward penalty exposure over an open-fails set.

- Page: https://ainumbers.co/chaingraph/art-78-csdr-penalty-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-78-csdr-penalty-calculator.md
- MCP tool: calculate_csdr_penalty (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fail (unknown, optional)
- open_fails (unknown, optional)
- rate_table_version (unknown, optional)

## Outputs

- asset_class (string, optional)
- batch_detail (string, optional)
- batch_total_exposure (integer, optional)
- daily_rate_bps (integer, optional)
- fail_days (integer, optional)
- note (string, optional)
- notional (integer, optional)
- partial_credit (integer, optional)
- partial_settled_pct (integer, optional)
- penalty_amount (integer, optional)
- penalty_type (string, optional)
- rate_table_version (string, optional)
- reference (object, optional)
- reference_price (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_csdr_penalty` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
