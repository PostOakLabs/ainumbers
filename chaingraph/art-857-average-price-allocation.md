# Average Price Allocation

Average-price allocation for one block order executed in several fills. Given an ISO 4217 currency, a side (buy labels amounts as cost, sell as proceeds), up to 5,000 fills of price per share (decimal string, at most 8 decimals) and whole-share quantity, and up to 500 pseudonymous accounts with whole-share allocations that must sum exactly to the filled quantity, the node returns the total in minor units, the average price to 8 decimals, each account's amount before and after the residual, the signed residual and where it went, and an identity check: the final account amounts plus any unallocated residual equal the total. All arithmetic is exact integer arithmetic on scaled values with half-up rounding; there is no floating point on the computation path, so a fill at 1.005 rounds the way the decimal says. Minor units follow the ISO 4217 minor-unit column (JPY 0, BHD, KWD, OMR, TND and JOD 3, most codes 2); unknown codes and fills carrying a different currency are refused. Two declared amount bases: unrounded_average (default) and rounded_average_dp, which rounds the average to a declared 0 to 8 decimals first and requires an explicit residual rule. Two residual rules: assign_largest (the account with the most shares, ties to the first declared) and report_unallocated. The rounding basis and the residual rule are declared conventions of this tool, not a regulatory or fairness rule. Calculation check, not investment, legal or regulatory advice.

- Page: https://ainumbers.co/chaingraph/art-857-average-price-allocation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-857-average-price-allocation.md
- MCP tool: allocate_average_price (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- currency (string, required): ISO 4217 alphabetic code. Sets the minor unit (JPY 0; BHD, KWD, OMR, TND, JOD 3; most codes 2). Unknown codes are refused.
- side (string, required): buy labels amounts as cost, sell as proceeds. The arithmetic is the same.
- fills (array, required): Executed fills of one block order, at most 5,000.
- allocations (array, required): Accounts receiving the fills, at most 500. Shares must sum exactly to the filled quantity.
- amount_basis (string, optional): Default unrounded_average. rounded_average_dp rounds the average half-up to average_price_dp first.
- average_price_dp (integer, optional): Required with rounded_average_dp; refused with unrounded_average.
- residual_handling (string, optional): Default assign_largest under unrounded_average; required with no default under rounded_average_dp.

## Outputs

- allocations (array, required)
- amount_basis (string, required)
- amount_label (string,null, required)
- average_price (string,null, required)
- average_price_dp (null,number, required)
- currency (string,null, required)
- identity_holds (boolean,null, required)
- minor_unit_exponent (number,null, required)
- note (string, required)
- overall (string, required)
- refusals (array, required)
- residual_account (string,null, required)
- residual_handling (string,null, required)
- residual_minor (number,null, required)
- rounded_average_price (null,string, required)
- side (string,null, required)
- total_minor (number,null, required)
- total_shares (number,null, required)
- unallocated_residual_minor (number,null, required)
- warnings (array, required)

## Sample

```json
{
  "currency": "USD",
  "side": "buy",
  "fills": [
    {
      "price_per_share": "10.00",
      "quantity_shares": 100
    },
    {
      "price_per_share": "10.50",
      "quantity_shares": 200
    },
    {
      "price_per_share": "9.80",
      "quantity_shares": 100
    }
  ],
  "allocations": [
    {
      "account": "ACCT-A",
      "shares": 200
    },
    {
      "account": "ACCT-B",
      "shares": 200
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `allocate_average_price` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
