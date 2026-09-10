# Royalty Split Validator

Validates a royalty-split configuration against ERC-2981 and 0xSplits rules: share sum, per-recipient cap, no duplicate or zero addresses, basis-point range, and address format. Reports per-rule pass/fail and a deterministic config fingerprint. Validation only; no on-chain calls, no distribution. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-208-royalty-split-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-208-royalty-split-validator.md
- MCP tool: validate_royalty_split (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cap_bps (unknown, required): Amount in basis points
- config (unknown, required)
- entries (array, required)

## Outputs

- cap_bps (number, required)
- config_hash (string, required)
- disclaimer (string, required)
- mode (string, required)
- recipient_count (number, required)
- rules (array, required)
- sum (number, required)
- valid (boolean, required)

## Sample

```json
{
  "entries": [
    {
      "address": "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      "basis_points": 5000
    },
    {
      "address": "0x1234567890ABCDEF1234567890ABCDEF12345678",
      "basis_points": 5000
    }
  ],
  "cap_bps": 5000
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_royalty_split` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
