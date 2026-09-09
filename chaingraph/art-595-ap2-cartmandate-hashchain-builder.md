# AP2 CartMandate Hash-Chain Builder

Builds an illustrative Google AP2 CartMandate Verifiable Digital Credential (VDC) skeleton whose credentialSubject carries a deterministic hash-chain over an ordered list of cart line items: link_0 = keccak256(canon({index:0,item})), link_i = keccak256(canon({index:i,item,prev:link_(i-1)})), cart_root = the final link. Reuses this repo's existing RFC 8785/JCS canonicalization (cgCanon, from _hash.mjs) and the already-vendored @noble/hashes keccak256 bundle - no new vendoring, no hand-rolled canonicalization or hashing. Stands beside art-16 (Google AP2 Mandate Builder) as a new node, not an edit to it - art-16's flat CheckoutMandate/PaymentMandate shape has no line-item array to chain over. An intact chain proves the ordered cart_items list was not altered after the chain was built; it does NOT prove human authorisation, delivery, settlement, or that item prices are correct or current. Given a prior chain's per-item links (claimed_links) and a (possibly tampered) cart_items, the kernel recomputes and reports CART_CHAIN_INTACT plus the earliest divergent index, never a thrown exception. Zero network calls; never a facilitator, proxy, gateway, or settlement relay.

- Page: https://ainumbers.co/chaingraph/art-595-ap2-cartmandate-hashchain-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-595-ap2-cartmandate-hashchain-builder.md
- MCP tool: build_ap2_cartmandate_hashchain (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agent_id (string, optional)
- subject (string, optional)
- merchant (string, optional)
- stage (string, optional)
- cart_items (array, optional)
- claimed_links (array, optional)

## Outputs

- vdc (object,null, optional)
- vdc_type (string, optional)
- cart_root (string,null, optional)
- chain_length (number, optional)
- chain_links (array, optional)
- cart_chain_intact (boolean,null, optional)
- first_divergent_index (number,null, optional)
- note (string, optional)
- reasons (array, optional)

## Sample

```json
{
  "agent_id": "did:example:agent-001",
  "subject": "did:example:subject-001",
  "merchant": "shop.example.com",
  "stage": "open",
  "cart_items": [
    {
      "sku": "SKU-100",
      "description": "Widget",
      "quantity": 2,
      "unit_price": 9.99,
      "currency": "USD"
    },
    {
      "sku": "SKU-200",
      "description": "Gadget",
      "quantity": 1,
      "unit_price": 24.5,
      "currency": "USD"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_ap2_cartmandate_hashchain` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
