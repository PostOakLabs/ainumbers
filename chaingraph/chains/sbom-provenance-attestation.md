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
