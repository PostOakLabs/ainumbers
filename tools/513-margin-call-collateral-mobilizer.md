# Margin Call Collateral Mobilizer

Margin computation branched by instrument type: UMR/BCBS d499 for uncleared derivatives; GMRA/BCBS d349 for repo/SFT. Never mixed. Canton 24/7 collateral mobilisation. VM and IM decomposition.

- Page: https://ainumbers.co/tools/513-margin-call-collateral-mobilizer.html
- Markdown twin: https://ainumbers.co/tools/513-margin-call-collateral-mobilizer.md
- MCP tool: mobilize_margin_collateral (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aana (unknown, optional)
- ccp_cleared (unknown, optional)
- collateral_rows (unknown, optional)
- instrument_type (unknown, optional)
- mta (unknown, optional)
- on_chain (unknown, optional)
- portfolio_mtm (unknown, optional)

## Outputs

- collateral_detail (array, required)
- gap (number, required)
- im_call (number, required)
- shortfall (boolean, required)
- total_mobilizable (number, required)
- total_required (number, required)
- vm_call (number, required)

## Sample

```json
{
  "instrument_type": "interest_rate_swap",
  "portfolio_mtm": -500000,
  "aana": 500000000,
  "ccp_cleared": false,
  "mta": 500000,
  "collateral_rows": [
    {
      "asset_type": "ust",
      "notional": 2000000,
      "already_posted": false
    }
  ],
  "on_chain": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `mobilize_margin_collateral` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
