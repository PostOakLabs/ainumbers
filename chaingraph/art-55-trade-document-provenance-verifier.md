# Trade Document Provenance & Consistency Verifier

Cross-validates a full trade-document set (eBL, commercial invoice, packing list, certificate of origin, insurance certificate) for internal consistency and computes a SHA-256 Merkle provenance root. Flags TBML red flags: over/under-invoicing, phantom shipments, mismatched goods/values (FATF typologies, ICC DSI KTDDE field model). Educational screen, not a SAR determination.

- Page: https://ainumbers.co/chaingraph/art-55-trade-document-provenance-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-55-trade-document-provenance-verifier.md
- MCP tool: verify_trade_document_set (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- documents (unknown, optional)
- expected_route (unknown, optional)
- hash_alg (unknown, optional)
- reference_market_price (unknown, optional)

## Outputs

- consistency_verdict (string, optional)
- doc_count (integer, optional)
- invoicing_deviation_pct (string, optional)
- merkle_root (string, optional)
- mismatches (array, optional)
- note (string, optional)
- tbml_flags (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_trade_document_set` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
