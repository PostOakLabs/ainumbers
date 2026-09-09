# Tempo MPP Agent Mandate

Parses an MPP (Machine Payments Protocol) session, validates spend cap and session terms, maps HTTP-402 flow to AP2 Intent→Cart→Payment, performs KYA agent identity check (did:key format), models settlement cost, and emits a signed agent-payment mandate. W-C co-lead. ISO 20022 pacs.008-subset artifact; did:key identity in debtor field.

- Page: https://ainumbers.co/chaingraph/art-36-tempo-mpp-agent-mandate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-36-tempo-mpp-agent-mandate.md
- MCP tool: decode_mpp_session (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- agentDid (unknown, optional)
- cadence (unknown, optional)
- duration (unknown, optional)
- merchant (unknown, optional)
- rail (unknown, optional)
- spendCap (unknown, optional)
- stablecoin (unknown, optional)

## Outputs

- cost_per_call (number, optional)
- did_valid (boolean, optional)
- max_vouchers (integer, optional)
- rail (string, optional)
- risk (object, optional)
- spend_cap (integer, optional)
- stablecoin (string, optional)

## Sample

```json
{
  "agentDid": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "merchant": "merchant-001",
  "spendCap": 25,
  "duration": "8h",
  "rail": "tempo_stablecoin",
  "stablecoin": "USDC",
  "cadence": "per-request"
}
```

## Verify

Run the sample policy_parameters through MCP tool `decode_mpp_session` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
