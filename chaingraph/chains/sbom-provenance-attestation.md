# SBOM Provenance Attestation (EU CRA / SLSA / OpenVEX)

Validate a CycloneDX SBOM against EU CRA Annex I machine-readable SBOM requirement (art-135) → verify the SLSA provenance in-toto statement: subject digest match, builder.id present, claimed build level (art-136) → validate the OpenVEX vulnerability disclosure statement including not_affected justification (art-137). Full EU CRA supply-chain attestation pipeline. Zero network.

- Page: https://ainumbers.co/chaingraph/chains/sbom-provenance-attestation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sbom-provenance-attestation.md

## Workflow chain: SBOM Provenance Attestation (EU CRA / SLSA / OpenVEX)

Validate a CycloneDX SBOM against EU CRA Annex I machine-readable SBOM requirement (art-135) → verify the SLSA provenance in-toto statement: subject digest match, builder.id present, claimed build level (art-136) → validate the OpenVEX vulnerability disclosure statement including not_affected justification (art-137). Full EU CRA supply-chain attestation pipeline. Zero network.

Domain: DORA / NIS2 / ICT Resilience

### Steps

1. art-135-cyclonedx-sbom-validator
   SBOM validity verdict feeds SLSA provenance verifier
2. art-136-slsa-provenance-verifier
   Provenance validity feeds OpenVEX disclosure validator
3. art-137-openvex-statement-validator
   VEX validity emits full supply-chain attestation verdict - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We attach a CycloneDX SBOM to the release for the CRA file. Does the attached SBOM meet the machine readable bar?
Run the AINumbers MCP tool `run_chain` with {"chain":"sbom-provenance-attestation"} and read `art-135-cyclonedx-sbom-validator.sbom_valid`.
Re-run with `inputs` for `art-135-cyclonedx-sbom-validator`, reusing the values that result echoed, with `sbom` changed so the express component carries no purl. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/sbom-provenance-attestation.html
