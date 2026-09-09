# Wash-Sale Window Guard

Computes a wash-sale window screen from caller-declared synthetic inputs: the 61-day acquisition window of the declared wash-sale method (sale date minus 30 days through sale date plus 30 days, inclusive; 26 U.S.C. 1091(a), cited informatively) is applied to a declared lot sale and a declared replacement-purchase list. The node totals the disallowed loss (2 decimal places, half-up, restated in a trace), flags a replacement account declared tax-deferred inside the window (the IRA-trap case, where the disallowed loss is treated as permanently lost rather than deferred; Rev. Rul. 2008-5, cited informatively), and raises a basis-carryforward flag on the flagged taxable path (26 U.S.C. 1091(d), cited informatively). The verdict reports the declared arithmetic only (WASH_SALE_FLAGGED, WASH_SALE_CLEAR). Undated or malformed lots fail closed. This is a deterministic calculator over declared numbers: it is never advice, never an optimizer, and it renders no tax position on any real holding. Zero storage, zero network, no runtime clock.

- Page: https://ainumbers.co/chaingraph/art-687-wash-sale-window-guard.html
- Markdown twin: https://ainumbers.co/chaingraph/art-687-wash-sale-window-guard.md
- MCP tool: compute_wash_sale_window_guard (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- sale (object, required): declared lot sale with lot_id, sale_date, realized_loss
- replacement_purchases (array, required): declared replacement purchases, each with date and account_type

## Outputs

- window_start (string, required)
- window_end (string, required)
- replacements_in_window (integer, required)
- disallowed_loss (number, required)
- ira_trap (boolean, required)
- trace (string, required)
- overall (string, required)
- warnings (array, optional)

## Sample

```json
{
  "sale": {
    "lot_id": "SYN-A",
    "sale_date": "2026-03-10",
    "realized_loss": 1200
  },
  "replacement_purchases": [
    {
      "date": "2026-03-25",
      "account_type": "taxable"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_wash_sale_window_guard` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
