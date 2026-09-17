# AP2 PaymentReceipt Verifier & HNP Guardrail

Verifies an AP2 v0.2 PaymentReceipt against its signed Intent/Cart/Payment mandate chain, and applies the Human-Not-Present (HNP) autonomy guardrail: amount, category, mandate age, cart freshness. Runtime/post-trade: art-01 validates the mandate before the buy; ART-62 verifies the receipt after, applying HNP gating (AP2 v0.2 new primitive, FIDO Alliance Apr 2026).

- Page: https://ainumbers.co/chaingraph/art-62-ap2-payment-receipt-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-62-ap2-payment-receipt-verifier.md
- MCP tool: verify_ap2_payment_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- hnp_policy (unknown, optional)
- mandate_chain (unknown, optional)
- payment_receipt (unknown, optional)

## Outputs

- authorized_amount_headroom (string, optional)
- findings (array, optional)
- hnp_verdict (string, optional)
- human_present (boolean, optional)
- mandate_chain_intact (boolean, optional)
- note (string, optional)
- receipt_id (string, optional)
- receipt_verdict (string, optional)
- signature_check (string, optional)
- status_asof (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_ap2_payment_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
