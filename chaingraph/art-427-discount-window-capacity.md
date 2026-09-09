# Discount Window Borrowing-Capacity Calculator

Federal Reserve Discount Window borrowing-capacity calculator: lendable value = sum of pledged collateral positions x published Fed collateral margins (margin table effective date is caller-supplied policy input, not hardcoded) compared against a runnable-liability / uninsured-deposit coverage target. Timely given the pending Discount Window Preparedness Act and the Treasury LCR-recognition push for pre-positioned collateral; no existing vendor tool covers this calculation.

- Page: https://ainumbers.co/chaingraph/art-427-discount-window-capacity.html
- Markdown twin: https://ainumbers.co/chaingraph/art-427-discount-window-capacity.md
- MCP tool: compute_discount_window_capacity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- collateral_positions (unknown, required)
- coverage_target_pct (number, optional): Percentage value
- margin_table_version (unknown, required)
- runnable_liabilities (unknown, required)

## Outputs

- capacity_compliant (boolean, optional)
- capacity_surplus_shortfall_musd (integer, optional)
- collateral_par_value_musd (integer, optional)
- coverage_pct (number, optional)
- coverage_target_pct (integer, optional)
- lendable_value_musd (integer, optional)
- margin_table_version (string, optional)
- note (string, optional)
- runnable_liabilities_musd (integer, optional)

## Sample

```json
{
  "margin_table_version": "2026-07-01",
  "collateral_positions": [
    {
      "category": "U.S. Treasury securities",
      "par_value_musd": 2000,
      "margin_pct": 100
    },
    {
      "category": "Agency MBS",
      "par_value_musd": 1500,
      "margin_pct": 96
    },
    {
      "category": "Municipal bonds",
      "par_value_musd": 500,
      "margin_pct": 90
    },
    {
      "category": "Consumer loans",
      "par_value_musd": 1000,
      "margin_pct": 80
    }
  ],
  "runnable_liabilities": [
    {
      "label": "Uninsured deposits",
      "balance_musd": 2500
    },
    {
      "label": "Wholesale funding",
      "balance_musd": 500
    }
  ],
  "coverage_target_pct": 100
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_discount_window_capacity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
