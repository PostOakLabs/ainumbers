# NIS2 Entity Scope & Obligations

Determine NIS2 entity classification (Essential/Important/Out-of-scope), assess Article 21 cybersecurity risk-management measure maturity across all ten controls, and calculate maximum penalty exposure under Article 34 including mitigating-factor adjustment. Full chain exports a board-ready PDF with execution_hash.

- Page: https://ainumbers.co/chaingraph/chains/nis2-entity-scope-and-obligations.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/nis2-entity-scope-and-obligations.md

## Workflow chain: NIS2 Entity Scope & Obligations

Determine NIS2 entity classification (Essential/Important/Out-of-scope), assess Article 21 cybersecurity risk-management measure maturity across all ten controls, and calculate maximum penalty exposure under Article 34 including mitigating-factor adjustment. Full chain exports a board-ready PDF with execution_hash.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-141-nis2-entity-scope-classifier
   Entity classification (Essential/Important/Out-of-scope) and penalty caps feed Art. 21 gap checker
2. art-142-nis2-art21-gap-checker
   Art. 21 compliance score and critical gaps feed penalty exposure calculator
3. art-143-nis2-penalty-exposure-calculator
   Maximum penalty exposure and mitigated estimate - board-ready export with execution_hash

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: This mid-size energy operator assumes NIS2 does not reach it. Does the classifier rate it essential or only important?
Run the AINumbers MCP tool `run_chain` with {"chain":"nis2-entity-scope-and-obligations"} and read `art-141-nis2-entity-scope-classifier.entity_classification`.
Re-run with `inputs` for `art-141-nis2-entity-scope-classifier`, reusing the values that result echoed, with `sector_code` set to "postal". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/nis2-entity-scope-and-obligations.html
