# CycloneDX SBOM Validator (EU CRA Annex I)

Validates a CycloneDX SBOM against the EU CRA Annex I machine-readable SBOM requirement: bomFormat=CycloneDX, specVersion in [1.4,1.5,1.6], all components carry purl+name+version, top-level dependencies array present. Emits sbom_valid verdict and per-component gap list. Root stage of sbom-provenance-attestation chain.

- Page: https://ainumbers.co/chaingraph/art-135-cyclonedx-sbom-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-135-cyclonedx-sbom-validator.md
- MCP tool: validate_cyclonedx_sbom (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- sbom (unknown, optional)

## Outputs

- component_count (integer, optional)
- components_missing_purl (array, optional)
- format (string, optional)
- has_dependencies (boolean, optional)
- sbom_valid (boolean, optional)
- spec_version (string, optional)

## Sample

```json
{
  "sbom": {
    "bomFormat": "CycloneDX",
    "specVersion": "1.6",
    "components": [
      {
        "name": "express",
        "version": "4.18.2",
        "purl": "pkg:npm/express@4.18.2"
      }
    ],
    "dependencies": [
      {
        "ref": "pkg:npm/express@4.18.2",
        "dependsOn": []
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_cyclonedx_sbom` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
