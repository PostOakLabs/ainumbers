# EU Consumer Credit (CCD2)

Scope classification > Art. 18 creditworthiness > SECCI pre-contractual disclosure > readiness. CCD2 (Directive (EU) 2023/2225) applies from 20 Nov 2026.

- Page: https://ainumbers.co/chaingraph/chains/ccd2-consumer-credit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ccd2-consumer-credit.md

## Workflow chain: EU Consumer Credit (CCD2)

Scope classification > Art. 18 creditworthiness > SECCI pre-contractual disclosure > readiness. CCD2 (Directive (EU) 2023/2225) applies from 20 Nov 2026.

Domain: EU Digital ID & Consumer Credit

### Steps

1. 481-ccd2-scope-classifier
   in_scope_products and obligation_tier feed Stage 2
2. 482-ccd2-creditworthiness-assessment-builder
   assessment_framework feeds Stage 3 disclosure
3. 483-ccd2-secci-precontractual-disclosure-generator
   disclosure_set feeds Stage 4 readiness scoring
4. 484-ccd2-readiness-scorer
   Exports CCD2 Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
