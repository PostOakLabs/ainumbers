# TRAIGA Safe Harbor

Gated three-step chain for the Texas Responsible AI Governance Act affirmative defense. Step 1 flags TRAIGA applicability and intentional prohibited-use assertions (gate: a prohibited use exits immediately, no defense evidence assembled). Step 2 (shipped map_nist_ai_rmf_functions) maps supplied controls to NIST AI RMF coverage (gate: Minimal or Partial coverage band exits, Substantial or Comprehensive continues). Step 3 assembles the affirmative-defense evidence pack. Evidence toward the Tex. Bus. & Com. Code §553.106 statutory defense, never a guarantee the defense succeeds.

- Page: https://ainumbers.co/chaingraph/chains/traiga-safe-harbor.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/traiga-safe-harbor.md

## Workflow chain: TRAIGA Safe Harbor

Gated three-step chain for the Texas Responsible AI Governance Act affirmative defense. Step 1 flags TRAIGA applicability and intentional prohibited-use assertions (gate: a prohibited use exits immediately, no defense evidence assembled). Step 2 (shipped map_nist_ai_rmf_functions) maps supplied controls to NIST AI RMF coverage (gate: Minimal or Partial coverage band exits, Substantial or Comprehensive continues). Step 3 assembles the affirmative-defense evidence pack. Evidence toward the Tex. Bus. & Com. Code §553.106 statutory defense, never a guarantee the defense succeeds.

Domain: AI & Agent Governance

### Steps

1. art-313-traiga-exposure-assessor
   prohibited_use_detected feeds the gate - a detected prohibited use exits the chain, otherwise the RMF mapping stage runs
2. art-174-nist-ai-rmf-function-mapper
   coverage_band feeds the gate - Minimal or Partial coverage exits (does not meet the substantial-compliance bar), Substantial or Comprehensive continues to the pack builder
3. art-314-traiga-safe-harbor-pack-builder
   Assembles the affirmative-defense evidence pack from the exposure and RMF-mapping results - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our agent serves Texas users. Does the state AI act reach the deployment, and what exposure flags follow?
Run the AINumbers MCP tool `run_chain` with {"chain":"traiga-safe-harbor"} and read `art-313-traiga-exposure-assessor.traiga_applicable`.
Re-run with `inputs` for `art-313-traiga-exposure-assessor`, reusing the values that result echoed, with `deploys_in_texas` set to true. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/traiga-safe-harbor.html
