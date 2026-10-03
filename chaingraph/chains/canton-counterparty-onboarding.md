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

### Ask your agent

Question: A counterparty asks to join our Canton allowlist. Does this party clear the screen, or do its FATF status and PEP flags hold approval?
Run the AINumbers MCP tool `run_chain` with {"chain":"canton-counterparty-onboarding"} and read `509-canton-party-allowlist-validator.portfolio_verdict`.
Re-run with `inputs` for `509-canton-party-allowlist-validator`, reusing the values that result echoed, with `parties` changed so the party is flagged as a politically exposed person. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/canton-counterparty-onboarding.html
