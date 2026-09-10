# NACHA ACH Rules Compliance

ACH/NACHA message validation > NACHA ACH rule compliance checking: composite NACHA ACH rules compliance mandate.

- Page: https://ainumbers.co/chaingraph/chains/nacha-ach-rules-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/nacha-ach-rules-compliance.md

## Workflow chain: NACHA ACH Rules Compliance

ACH/NACHA message validation > NACHA ACH rule compliance checking: composite NACHA ACH rules compliance mandate.

Domain: Cross-Border & Instant Payments

### Steps

1. 07-ach-nacha-validator
   ach_message_validation and format_errors feed Stage 2 NACHA rule compliance check
2. 224-nacha-ach-rule-compliance-checker
   rule_compliance_status and violation_flags - final NACHA ACH compliance mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
