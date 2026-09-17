# Canton Counterparty Onboarding Chain

KYA screening and party allowlist validation for Canton Network onboarding.

- Page: https://ainumbers.co/chaingraph/chains/canton-counterparty-onboarding.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/canton-counterparty-onboarding.md

## Workflow chain: Canton Counterparty Onboarding Chain

KYA screening and party allowlist validation for Canton Network onboarding.

Domain: Digital-Asset Rails

### Steps

1. 509-canton-party-allowlist-validator
   allowlist_verdict,fatf_flags,parties_approved - Exports counterparty onboarding mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
