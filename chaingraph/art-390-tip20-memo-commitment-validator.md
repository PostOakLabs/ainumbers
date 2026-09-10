# TIP-20 Memo/Commitment Validator

Validates a TIP-20 TransferWithMemo's 32-byte memo as a hash-or-locator commitment: checks length/hex form, recomputes the SHA-256 commitment over a supplied off-chain payload or a templated invoice-ID locator, and reports whether the memo matches. Integrity-only - distinct from screen_tip20_transfer_batch (art-38, AML/Travel Rule screening of a transfer batch). Calculator only, zero egress.

- Page: https://ainumbers.co/chaingraph/art-390-tip20-memo-commitment-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-390-tip20-memo-commitment-validator.md
- MCP tool: validate_tip20_memo_commitment (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- invoice_id (unknown, required)
- invoice_locator_template (unknown, required)
- memo_hex (unknown, required)
- payload (unknown, required)

## Outputs

- commitment_source_supplied (boolean, optional)
- invoice_locator (string, optional)
- invoice_locator_commitment (string, optional)
- invoice_locator_match (string, optional)
- memo_hex (string, optional)
- memo_hex_valid (boolean, optional)
- memo_length_valid (boolean, optional)
- note (string, optional)
- overall_valid (boolean, optional)
- payload_commitment (string, optional)
- payload_commitment_match (boolean, optional)

## Sample

```json
{
  "memo_hex": "4c39ea457ea3882ae9b4482b045f554f3d032babaa7cc90cecf66d92408aeb8f",
  "payload": "invoice payload synthetic test data"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_tip20_memo_commitment` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
