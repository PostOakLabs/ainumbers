# AI Vendor Onboarding Packet

Risk-classify an AI vendor against the EU AI Act, pull the matching Model Contractual AI Clauses, assemble the Common Paper AI Addendum from Cover Page Key Terms, confirm the DPA is GDPR Art 28 complete, and emit a countersigned agent-acceptance receipt. End-to-end verifiable AI-vendor onboarding.

- Page: https://ainumbers.co/chaingraph/chains/ai-vendor-onboarding-packet.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-vendor-onboarding-packet.md

## Workflow chain: AI Vendor Onboarding Packet

Risk-classify an AI vendor against the EU AI Act, pull the matching Model Contractual AI Clauses, assemble the Common Paper AI Addendum from Cover Page Key Terms, confirm the DPA is GDPR Art 28 complete, and emit a countersigned agent-acceptance receipt. End-to-end verifiable AI-vendor onboarding.

Domain: AI Governance

### Steps

1. art-64-ai-act-highrisk-fit-diagnostic
   high-risk verdict normalizes to a risk_tier (high-risk unless out-of-scope) feeding the clause mapper
2. art-412-ai-act-procurement-clause-mapper
   MCC-AI template + applicable Chapter III clauses inform the addendum's Cover Page Key Terms
3. art-411-ai-addendum-assembler
   assembled AI Addendum + contract-api.json feed the DPA completeness check
4. art-409-dpa-art28-completeness-checker
   Art 28(3) completeness verdict feeds the agent-countersign step
5. art-277-agreement-acceptance-binder
   Exports a countersigned agent-acceptance receipt, hash-chained to the assembled addendum - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
