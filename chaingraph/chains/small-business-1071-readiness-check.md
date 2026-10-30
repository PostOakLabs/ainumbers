# Small Business 1071 Readiness Check

Check small business lending coverage readiness in two independent stages: first compute whether a financial institution meets the CFPB Section 1071 origination threshold from caller-supplied origination counts and validate SBLAR records against caller-declared required fields (ART-475); then a session receipt aggregating the run's execution hashes (CRY-05). All origination counts, field lists, and SBLAR records are caller-supplied; findings are arithmetic findings, never coverage determinations. Federal only, not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/small-business-1071-readiness-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/small-business-1071-readiness-check.md

## Workflow chain: Small Business 1071 Readiness Check

Check small business lending coverage readiness in two independent stages: first compute whether a financial institution meets the CFPB Section 1071 origination threshold from caller-supplied origination counts and validate SBLAR records against caller-declared required fields (ART-475); then a session receipt aggregating the run's execution hashes (CRY-05). All origination counts, field lists, and SBLAR records are caller-supplied; findings are arithmetic findings, never coverage determinations. Federal only, not legal advice.

Domain: SME & Commercial Finance

### Steps

1. art-475-cfpb-1071-coverage-check
   Computes Section 1071 coverage from caller-supplied origination counts and validates SBLAR records against a caller-declared required-field list
2. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Do my small business origination counts trigger Section 1071 reporting requirements?
Run the AINumbers MCP tool `run_chain` with {"chain":"small-business-1071-readiness-check"} and read `art-475-cfpb-1071-coverage-check.originations_year1_count`.
Re-run with `inputs` for `art-475-cfpb-1071-coverage-check`, reusing the values that result echoed, with `originations_year1_count` set to 999. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/small-business-1071-readiness-check.html
