# Google AP2 Mandate Builder

Builds an illustrative Google AP2 Checkout/Payment Mandate Verifiable Digital Credential (VDC) skeleton from a declared mandate type, stage, agent, subject, merchant, and amount. Stage 2 of the Agentic Policy Chain. This is the EXTERNAL Google AP2 payments protocol shape (ap2-protocol.org), distinct from the AINumbers Policy Mandate export. Field names are illustrative; sign with the agent key and verify against the live spec before real use. Zero PII, deterministic compute.

- Page: https://ainumbers.co/chaingraph/art-16-google-ap2-mandate-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-16-google-ap2-mandate-builder.md
- MCP tool: draft_ap2_mandate_credential (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "mandate_type": "checkout",
  "stage": "open",
  "agent_id": "did:web:agent.example.com",
  "subject": "urn:user:demo-001",
  "merchant": "merchant.example.com",
  "amount": "3239 USD"
}
```

## Verify

Run the sample policy_parameters through MCP tool `draft_ap2_mandate_credential` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
