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

### Ask your agent

Question: Procurement flagged a new model vendor as high-risk. Which contractual clause pack should the contract team pull for that tier?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-vendor-onboarding-packet"} and read `art-412-ai-act-procurement-clause-mapper.template`.
Re-run with `inputs` for `art-412-ai-act-procurement-clause-mapper`, reusing the values that result echoed, with `risk_tier` set to "high-risk". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-vendor-onboarding-packet.html
