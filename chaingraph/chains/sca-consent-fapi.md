# SCA, Consent, and FAPI Compliance

Map SCA exemptions, build consent scope, validate FAPI security profile, and generate consent receipts.

- Page: https://ainumbers.co/chaingraph/chains/sca-consent-fapi.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sca-consent-fapi.md

## Workflow chain: SCA, Consent, and FAPI Compliance

Map SCA exemptions, build consent scope, validate FAPI security profile, and generate consent receipts.

Domain: Open Banking / Open Finance

### Steps

1. 92-sca-exemption-mapper
   exemption_map and risk_scores feed T91 consent scope builder
2. 91-consent-dashboard-builder
   consent_scope and framework_flags feed T97 FAPI validation
3. 97-fapi-security-validator
   fapi_profile and security_gaps feed T96 consent receipt generation
4. 96-consent-receipt-generator
   Exports SCA/consent/FAPI Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
