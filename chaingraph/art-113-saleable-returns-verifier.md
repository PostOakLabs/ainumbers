# DSCSA Saleable Returns Verifier

Match a returned unit SGTIN+lot to its original transaction hash (DSCSA §582(c)(4)(D)). Unauthorized trading partner or mismatched SGTIN/lot → REFUSE. Feeds suspect-product assessment (art-114).

- Page: https://ainumbers.co/chaingraph/art-113-saleable-returns-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-113-saleable-returns-verifier.md
- MCP tool: verify_saleable_return (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- original_lot (unknown, optional)
- original_sgtin (unknown, optional)
- original_txn_hash (unknown, optional)
- returned_lot (unknown, optional)
- returned_sgtin (unknown, optional)
- seller_authorized (unknown, optional)
- within_resale_window (unknown, optional)

## Outputs

- id_match (boolean, optional)
- lot_match (boolean, optional)
- match (boolean, optional)
- reason (string, optional)
- txn_anchored (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "returned_sgtin": "00312345678906.SN12345",
  "original_sgtin": "00312345678906.SN12345",
  "returned_lot": "L2026A",
  "original_lot": "L2026A",
  "original_txn_hash": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "seller_authorized": true,
  "within_resale_window": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_saleable_return` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
