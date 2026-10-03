# License Compatibility Check

Cross-framework rights matrix comparison > compatibility analysis with reason codes and required child license. Also usable as a standalone entry point for checking whether a child license can derive from a parent asset.

- Page: https://ainumbers.co/chaingraph/chains/license-compatibility-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/license-compatibility-check.md

## Workflow chain: License Compatibility Check

Cross-framework rights matrix comparison > compatibility analysis with reason codes and required child license. Also usable as a standalone entry point for checking whether a child license can derive from a parent asset.

Domain: Document & Content Provenance

### Steps

1. art-198-cross-license-rights-comparator
   Canonical rights vectors and diff feed Stage 2 compatibility analysis
2. art-204-license-compatibility-checker
   Exports compatibility verdict, reason codes, and required child license - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our library ships under a share-alike license. May a proprietary module build on it?
Run the AINumbers MCP tool `run_chain` with {"chain":"license-compatibility-check"} and read `art-204-license-compatibility-checker.compatible`.
Re-run with `inputs` for `art-204-license-compatibility-checker`, reusing the values that result echoed, with `child_license` changed so the child is CC-BY-NC-4.0 while parent_license is CC-BY-SA-4.0. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/license-compatibility-check.html
