# Arc CCTP v2 Transfer Validator

Validates a CCTP v2 cross-chain USDC transfer for domain pair eligibility, Fast Transfer 30-second finality risk (LP availability), Hook payload safety, CCTP v1 sunset migration status (31 Jul 2026), and large-notional LP-depth risk. 6 checks, A–F grade. 13 CCTP v2 domains as of Oct 2025.

- Page: https://ainumbers.co/chaingraph/art-47-arc-cctp-transfer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-47-arc-cctp-transfer.md
- MCP tool: validate_cctp_v2_transfer (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- dest_domain (unknown, optional)
- hook_payload (unknown, optional)
- notional_usd (unknown, optional): Amount in US dollars
- source_domain (unknown, optional)
- transfer_mode (unknown, optional)
- using_v1 (unknown, optional)

## Outputs

- verdict (string, optional)
- grade (string, optional)
- fail_count (integer, optional)
- warn_count (integer, optional)
- source_domain (string, optional)
- dest_domain (string, optional)
- transfer_mode (string, optional)
- notional_usd (integer, optional)
- compliance_flags (array, optional)

## Sample

```json
{
  "source_domain": "arc",
  "dest_domain": "ethereum",
  "notional_usd": 50000,
  "transfer_mode": "fast",
  "hook_payload": null,
  "using_v1": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_cctp_v2_transfer` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
