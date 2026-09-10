# Agent Payment Rail Trust Crosswalk

Crosswalk agent identity posture (alg, directory published, card present, signature verified) to Visa TAP, Mastercard Agent Pay, and Web Bot Auth acceptance criteria. Emits per-rail accepted/gaps. Consumes art-132, feeds art-134.

- Page: https://ainumbers.co/chaingraph/art-133-agent-payment-rail-trust-crosswalk.html
- Markdown twin: https://ainumbers.co/chaingraph/art-133-agent-payment-rail-trust-crosswalk.md
- MCP tool: crosswalk_agent_payment_rail_trust (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "alg": "ed25519",
  "directory_published": true,
  "card_present": true,
  "signature_verified": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `crosswalk_agent_payment_rail_trust` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
