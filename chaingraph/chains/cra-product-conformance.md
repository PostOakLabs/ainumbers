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
