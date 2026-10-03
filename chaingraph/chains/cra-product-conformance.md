# CRA Product Conformance (EU CRA Annex I + Art. 14)

Validate an SPDX SBOM against EU CRA Annex I machine-readable requirement (art-138) → check Annex I essential requirements: sbom_machine_readable, top-level dep coverage, vuln handling policy, secure-by-default, conformity route (art-139) → assess CRA Article 14 vulnerability reporting readiness: 24-hour early warning, 72-hour notification, CSIRT/ENISA endpoint (art-140). Obligation date Art.14: 11 Sep 2026. Full CRA product conformance pipeline. Zero network.

- Page: https://ainumbers.co/chaingraph/chains/cra-product-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cra-product-conformance.md

## Workflow chain: CRA Product Conformance (EU CRA Annex I + Art. 14)

Validate an SPDX SBOM against EU CRA Annex I machine-readable requirement (art-138) → check Annex I essential requirements: sbom_machine_readable, top-level dep coverage, vuln handling policy, secure-by-default, conformity route (art-139) → assess CRA Article 14 vulnerability reporting readiness: 24-hour early warning, 72-hour notification, CSIRT/ENISA endpoint (art-140). Obligation date Art.14: 11 Sep 2026. Full CRA product conformance pipeline. Zero network.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-138-spdx-sbom-validator
   SPDX SBOM validity feeds Annex I completeness checker
2. art-139-cra-annex1-completeness-checker
   Annex I gaps and conformity route feed vulnerability reporting readiness
3. art-140-cra-vuln-reporting-readiness
   Article 14 readiness emits full CRA product conformance verdict - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We ship a connected product into the EU. With the SBOM and hardening evidence on file, is our Annex I essentials evidence complete?
Run the AINumbers MCP tool `run_chain` with {"chain":"cra-product-conformance"} and read `art-139-cra-annex1-completeness-checker.annex1_complete`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cra-product-conformance.html
