# IP License Election and Attestation

License selection (CC / CBE / PIL / embedded) > rights matrix comparison > compatibility check > terms assembly > rights record > certified license VC with execution hash binding. The election step is interchangeable across license families; the compatibility check applies when a parent asset constrains the child license.

- Page: https://ainumbers.co/chaingraph/chains/ip-license-election-and-attestation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ip-license-election-and-attestation.md

## Workflow chain: IP License Election and Attestation

License selection (CC / CBE / PIL / embedded) > rights matrix comparison > compatibility check > terms assembly > rights record > certified license VC with execution hash binding. The election step is interchangeable across license families; the compatibility check applies when a parent asset constrains the child license.

Domain: Document & Content Provenance

### Steps

1. art-195-creative-commons-license-chooser
   Selected license_id, spdx_id, and required_elements feed Stage 2 cross-license rights comparison
2. art-198-cross-license-rights-comparator
   Canonical rights vectors and diff feed Stage 3 compatibility check
3. art-204-license-compatibility-checker
   Compatibility verdict and reason codes feed Stage 4 terms assembly
4. art-205-license-terms-assembler
   Rendered license terms feed Stage 5 rights record builder
5. art-206-rights-record-builder
   Normalized rights record and record_hash feed Stage 6 license election certification
6. art-199-license-election-certifier
   Exports certified license election VC with execution_hash binding - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We plan to waive every right in this dataset release. Which Creative Commons license does that elect?
Run the AINumbers MCP tool `run_chain` with {"chain":"ip-license-election-and-attestation"} and read `art-195-creative-commons-license-chooser.license_id`.
Re-run with `inputs` for `art-195-creative-commons-license-chooser`, reusing the values that result echoed, with `waive_all_rights` set to "no". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ip-license-election-and-attestation.html
