# AP2/MCP Policy Validator

Validates a caller-supplied payload against the AINumbers Unified Build Contract v1.0 Policy Mandate field set (ap2_version, mandate_id, tool_id, mandate_type, jurisdiction, audit_metadata, and related fields), scoring compliance 0-100 and flagging deprecated fields. Stage 3 of the Agentic Policy Chain. Deterministic, zero PII, no external network calls.

- Page: https://ainumbers.co/chaingraph/art-17-ap2-mcp-policy-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-17-ap2-mcp-policy-validator.md
- MCP tool: validate_ap2_mandate_credential (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "payload": {
    "ap2_version": "1.0",
    "mandate_id": "google-ap2-mandate-builder-2026-07-31T00-00-00",
    "issued_at": "2026-07-31T00:00:00Z",
    "issued_by": "ainumbers.co",
    "tool_id": "google-ap2-mandate-builder",
    "tool_version": "1.1.0",
    "mandate_type": "compliance_control",
    "jurisdiction": [
      "BR",
      "US"
    ],
    "regulatory_frameworks": [
      "Google AP2 (ap2-protocol.org)"
    ],
    "payload": {
      "vdc_type": "CheckoutMandate",
      "vdc_stage": "open",
      "issuer": "did:web:agent.example.com",
      "merchant": "merchant.example.com"
    },
    "summary": "AINumbers Policy Mandate ABOUT a Google AP2 mandate artifact — 2026-07-31",
    "agent_instructions": [
      "Note: the payload concerns the EXTERNAL Google AP2 spec; sign the real VDC with the agent key and verify field names at ap2-protocol.org."
    ],
    "valid_from": "2026-07-31",
    "source_tool_inputs": {},
    "regulatory_citations": [
      "ap2-protocol.org",
      "github.com/google-agentic-commerce/AP2"
    ],
    "audit_metadata": {
      "client_side_executed": true,
      "zero_pii_verified": true,
      "deterministic_run": true
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_ap2_mandate_credential` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
