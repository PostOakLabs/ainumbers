# Agent Identity & Authorization Attestation Checker

KYA-OS (DIF Trusted AI Agents WG) credential-chain attestation: delegated-authority credential chain, scope limits, validity windows (max 90 days), chain depth cap (4 hops), EU AI Act high-risk scope classification.

- Page: https://ainumbers.co/chaingraph/art-04-agent-identity-attestation-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-04-agent-identity-attestation-checker.md
- MCP tool: check_agent_attestation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- credential (unknown, required)
- validate_at_unix (unknown, required)

## Outputs

- overall_status (string, optional)
- pass (integer, optional)
- fail (integer, optional)
- warn (integer, optional)
- checks (array, optional)
- root_agent_id (string, optional)
- scopes (array, optional)

## Sample

```json
{
  "validate_at_unix": 1750248000,
  "credential": {
    "credential_type": "AgentCredential",
    "agent_id": "agent:acme:shopping-bot:v2",
    "issuer": "did:web:auth.acme.com",
    "issued_at": 1750161600,
    "expires_at": 1752840000,
    "scopes": [
      "read:account",
      "execute:checkout",
      "write:payment"
    ],
    "eu_ai_act_risk_class": "limited",
    "signature": "ed25519:MEYCIQDexampleSignatureHexGoesHereForTestingPurposesOnly"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_agent_attestation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
