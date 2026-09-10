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
