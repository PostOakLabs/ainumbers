# eIDAS 2.0 / EUDI Wallet Acceptance

Attribute attestation mapping > wallet-based KYC flow design > RP registration check > readiness scoring. eIDAS 2.0 (Regulation (EU) 2024/1183).

- Page: https://ainumbers.co/chaingraph/chains/eudi-wallet.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/eudi-wallet.md

## Workflow chain: eIDAS 2.0 / EUDI Wallet Acceptance

Attribute attestation mapping > wallet-based KYC flow design > RP registration check > readiness scoring. eIDAS 2.0 (Regulation (EU) 2024/1183).

Domain: EU Digital ID & Consumer Credit

### Steps

1. 489-eudi-attribute-attestation-mapper
   pid_attributes and qeaa_map feed Stage 2 KYC flow
2. 490-eudi-kyc-flow-designer
   kyc_flow_steps feed Stage 3 RP registration check
3. 491-eudi-relying-party-registration-checker
   rp_registration_status feeds Stage 4 readiness
4. 348-eidas2-eudi-wallet-relying-party-readiness-scorer
   Exports EUDI Acceptance Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
