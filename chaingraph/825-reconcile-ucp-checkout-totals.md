# Reconcile UCP Checkout Totals

Reconciles a pasted Universal Commerce Protocol (UCP 2026-08-25) cart, checkout or order totals block in integer minor units. Recomputes price x quantity per line (exact base-10 digit-array arithmetic, at most one rounding under the caller-declared policy, default half_even), rolls line subtotals into the document subtotal, checks the breakdown identity and the schema sign rules, and in order mode nets adjustment totals against the refund bound. Returns RECONCILED, MISMATCH or INDETERMINATE with per-finding JSON paths; structurally malformed input refuses the whole call with INPUT_REFUSED. Arithmetic consistency only: it never judges whether a tax, fee or discount amount itself was computed correctly, because UCP publishes no tax or rounding algorithm; Business-extension total types and lines priced on a different basis (item.unit_price) are skipped or reported indeterminate, never guessed. Negative totals are reported informationally (UCP issue #1025) and order discount attribution is reported as not evaluable (issue #1026). Verify-only, zero network calls, no fetched keys. Fixture provenance: derived from the UCP schema and issue material (github.com/Universal-Commerce-Protocol/ucp tag v2026-08-25, commit 7a5daa55313f8b468aba76caf01fb76851d37f84, Apache-2.0), including the repo's flower_shop reference storefront example.

- Page: https://ainumbers.co/chaingraph/825-reconcile-ucp-checkout-totals.html
- Markdown twin: https://ainumbers.co/chaingraph/825-reconcile-ucp-checkout-totals.md
- MCP tool: reconcile_ucp_checkout_totals (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- document (object, required): The pasted UCP cart, checkout or order document
- mode (string, optional): "checkout" (default) or "order"
- rounding (string, optional): Line rounding policy, default half_even

## Outputs

- verdict (string, optional)
- mode (string, optional)
- currency (string, optional)
- rounding_applied (string, optional)
- rounding_exercised (boolean, optional)
- totals_identity_ok (boolean, optional)
- declared_total (integer, optional)
- computed_total (integer, optional)
- negative_total (boolean, optional)
- line_count (integer, optional)
- line_results (array, optional)
- violations (array, optional)
- skipped (array, optional)
- indeterminate (array, optional)
- discount_attribution (object,null, optional)
- refunds (object,null, optional)
- refusal (string,null, optional)
- notes (array, optional)

## Sample

```json
{
  "mode": "checkout",
  "document": {
    "currency": "USD",
    "line_items": [
      {
        "item": {
          "id": "tulip-bouquet",
          "price": 3500
        },
        "quantity": 2,
        "totals": [
          {
            "type": "subtotal",
            "amount": 7000
          }
        ]
      }
    ],
    "discounts": {
      "applied": [
        {
          "code": "WELCOME20",
          "title": "Welcome 20% off",
          "amount": -700
        }
      ]
    },
    "totals": [
      {
        "type": "subtotal",
        "amount": 7000
      },
      {
        "type": "discount",
        "amount": -700
      },
      {
        "type": "fulfillment",
        "amount": 495
      },
      {
        "type": "tax",
        "amount": 0
      },
      {
        "type": "fee",
        "amount": 0
      },
      {
        "type": "total",
        "amount": 6795
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_ucp_checkout_totals` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
