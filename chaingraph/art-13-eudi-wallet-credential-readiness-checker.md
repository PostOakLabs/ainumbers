# EUDI Wallet Credential-Acceptance Readiness Checker

eIDAS 2.0 verifiable-credential acceptance readiness against EUDI Wallet ARF v1.4 profiles. PID/QEAA/EAA attribute mapping, relying-party obligations, conformance gaps. Member-state wallet rollout Nov 2026; obliged-entity acceptance Dec 2027.

- Page: https://ainumbers.co/chaingraph/art-13-eudi-wallet-credential-readiness-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-13-eudi-wallet-credential-readiness-checker.md
- MCP tool: check_eudi_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "credential_type": "eaa",
  "format": "sd_jwt_vc",
  "issuer_country": "DE",
  "sd": true,
  "pop": true,
  "rev": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_eudi_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
