# UCP Checkout Payload Lint

Deterministic, verify-only structural lint of a caller-supplied Universal Commerce Protocol (UCP; Google + Shopify, announced NRF 2026-01-11, Apache-2.0 spec on GitHub) checkout resource against the schema pinned at tag v2026-04-08 of github.com/Universal-Commerce-Protocol/ucp. Checks the resource-level required[] field set, the status enum, ISO 4217 currency form, integer minor-unit amounts, and the exactly-one-subtotal / exactly-one-total cardinality rule on totals[]. Verdict CONFORMANT | NONCONFORMANT | UNKNOWN_VERSION: a payload declaring a UCP version outside the pinned allowlist is capped at UNKNOWN_VERSION regardless of otherwise-clean structure, never upgraded to CONFORMANT for a version this kernel has no pinned rules for. Never contacts a UCP or ACP endpoint and never fetches a live spec version - the caller supplies the payload. UCP composes with AP2 rather than competing with it; part of the agentic-commerce-convergence chain alongside art-12 (ACP checkout conformance) and art-01 (AP2 mandate-chain validator).

- Page: https://ainumbers.co/chaingraph/art-564-ucp-checkout-payload-lint.html
- Markdown twin: https://ainumbers.co/chaingraph/art-564-ucp-checkout-payload-lint.md
- MCP tool: lint_ucp_checkout_payload (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- payload (unknown, required)

## Outputs

- error_count (integer, optional)
- finding_count (integer, optional)
- findings (array, optional)
- note (string, optional)
- rationale (array, optional)
- ucp_spec_pinned_tag (string, optional)
- ucp_spec_source (string, optional)
- ucp_version_declared (string, optional)
- verdict (string, optional)
- warning_count (integer, optional)

## Sample

```json
{
  "payload": {
    "ucp": {
      "version": "2026-04-08"
    },
    "id": "checkout_abc123",
    "status": "ready_for_complete",
    "currency": "USD",
    "line_items": [
      {
        "id": "li_1",
        "item": {
          "id": "sku_1",
          "name": "Widget"
        },
        "quantity": 2,
        "totals": [
          {
            "type": "subtotal",
            "amount": 4000
          },
          {
            "type": "total",
            "amount": 4000
          }
        ]
      }
    ],
    "totals": [
      {
        "type": "subtotal",
        "amount": 4000
      },
      {
        "type": "tax",
        "amount": 320,
        "display_text": "Sales tax"
      },
      {
        "type": "total",
        "amount": 4320
      }
    ],
    "links": [
      {
        "url": "https://merchant.example/tos",
        "type": "terms_of_service"
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_ucp_checkout_payload` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
