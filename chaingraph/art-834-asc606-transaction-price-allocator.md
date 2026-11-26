# ASC 606 Transaction Price Allocator

Allocates a declared transaction price across declared performance obligations by relative standalone selling price, in integer minor units, under the discount handling (spread proportionally, or assigned to declared obligation ids), rounding rule (largest remainder, or round half up with the remainder to the largest obligation) and residual approach (off, or on for one declared obligation) that the caller declares. Returns the allocated amount per obligation, summing exactly to the price, the relative share in basis points, the discount allocated, and flags for a negative or zero residual, a missing standalone selling price, a price below the total with no discount rule, an allocation above a declared cap, and INDETERMINATE when a required fact is missing. It never guesses a standalone selling price. The residual_candidate flag is the caller's declaration that the residual-approach conditions of ASC 606-10-32-34 hold for that obligation, and discount handling assign takes caller-declared ids that assert the 32-37 conditions hold; the kernel checks neither. Re-running with a new price is a fresh allocation, not the change-in-transaction-price treatment of 32-42 to 32-45. Largest-remainder rounding is a kernel convention, not a paragraph rule, and ssp_share_bps truncates so shares can sum to 9999. It does not decide the standalone selling prices, does not identify the performance obligations in a contract, and is not an accounting conclusion. Ids and integers only, no free text. Allocated amounts could be consumed by art-265 (amortize_asc606_commissions); no adjacency is declared here.

- Page: https://ainumbers.co/chaingraph/art-834-asc606-transaction-price-allocator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-834-asc606-transaction-price-allocator.md
- MCP tool: allocate_asc606_transaction_price (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "discount_handling": "proportional",
  "rounding_rule": "largest_remainder",
  "residual_approach": "off",
  "transaction_price_minor": 100000,
  "obligations": [
    {
      "id": "licence",
      "ssp_minor": 60000
    },
    {
      "id": "support",
      "ssp_minor": 40000
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `allocate_asc606_transaction_price` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
