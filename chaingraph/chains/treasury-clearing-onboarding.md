# Sponsored/Agent Clearing Onboarding

W-G. Counterparty allowlist (LEI/OFAC/FATF Rec 16, 509) -> AML typology screen (art-10) -> Merkle-root onboarding receipt (cry-05). KYC/AML/audit pack for sponsored or agent clearing onboarding.

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-onboarding.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-onboarding.md

## Workflow chain: Sponsored/Agent Clearing Onboarding

W-G. Counterparty allowlist (LEI/OFAC/FATF Rec 16, 509) -> AML typology screen (art-10) -> Merkle-root onboarding receipt (cry-05). KYC/AML/audit pack for sponsored or agent clearing onboarding.

Domain: Treasury Clearing

### Steps

1. 509-canton-party-allowlist-validator
   party verdict + LEI/OFAC flags feed the AML scorer
2. art-10-amla-transaction-typology-risk-scorer
   typology risk score feeds the audit aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite onboarding receipt with Merkle-root hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
