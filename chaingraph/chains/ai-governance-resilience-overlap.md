# AI-as-ICT Resilience (DORA x AI Act Overlap)

W-F. DORA readiness for the AI system as ICT (art-29) -> AI Act Article 15 robustness/cybersecurity conformity (ART-65) -> integrity over the combined evidence (cry-04). Maps where DORA ICT-risk duties and AI Act high-risk duties overlap for a financial AI system.

- Page: https://ainumbers.co/chaingraph/chains/ai-governance-resilience-overlap.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ai-governance-resilience-overlap.md

## Workflow chain: AI-as-ICT Resilience (DORA x AI Act Overlap)

W-F. DORA readiness for the AI system as ICT (art-29) -> AI Act Article 15 robustness/cybersecurity conformity (ART-65) -> integrity over the combined evidence (cry-04). Maps where DORA ICT-risk duties and AI Act high-risk duties overlap for a financial AI system.

Domain: AI Governance

### Steps

1. art-29-dora-readiness-diagnostic
   DORA readiness (H1) feeds the conformity pack
2. art-65-ai-conformity-pack-builder
   robustness/cyber conformity (H2) feeds the verifier
3. cry-04-merkle-batch-verifier
   Exports composite resilience-overlap artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Supervisors asked for our DORA position on the AI platform. Where does the readiness grade sit once the twelve control answers are recorded?
Run the AINumbers MCP tool `run_chain` with {"chain":"ai-governance-resilience-overlap"} and read `art-29-dora-readiness-diagnostic.grade`.
Re-run with `inputs` for `art-29-dora-readiness-diagnostic`, reusing the values that result echoed, with `answers` changed so q1 through q12 are each yes. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ai-governance-resilience-overlap.html
